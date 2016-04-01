
# coding: utf-8

# In[1]:

import numpy as np
import scipy.io as sio

import time
import eventlet
eventlet.monkey_patch() 

from scipy import integrate, signal, sparse, linalg
from threading import Thread
from flask import Flask, render_template, session, request
from flask.ext.socketio import SocketIO, emit, join_room, leave_room, close_room, disconnect

Author = 'Jimin Kim'
Email = 'jk55@u.washington.edu'
Version = '1.1.0'

# In[2]:

# Number of Neurons 
N = 279
# ----------------------------------------------------------------------------------------------------------------------
# Cell membrane conductance (pS)
Gc = 0.1
#------------------------------------------------------------------------------------------------------------------------
# Cell Membrane Capacitance
C = 0.01
# -----------------------------------------------------------------------------------------------------------------------
# Gap Junctions (Electrical, 279*279)
ggap = 1.0
G = sio.loadmat('Gg.mat')
Gg_Static = G['Gg']
# -----------------------------------------------------------------------------------------------------------------------
# Synaptic connections (Chemical, 279*279)
gsyn = 1.0
S = sio.loadmat('Gs.mat')
Gs_Static = S['Gs']
# ----------------------------------------------------------------------------------------------------------------------
# Leakage potential (mV)
Ec = -35.0 
# ----------------------------------------------------------------------------------------------------------------------
# Directionality (279*1)
E = sio.loadmat('Emask.mat')
E = -45.0*E['E']
EMat = np.tile(np.reshape(E, N), (N, 1))
# ----------------------------------------------------------------------------------------------------------------------
# Synaptic Activity Parameters 
ar = 1.0 # Synaptic activity's rise time
ad = 5.0 # Synaptic activity's decay time
B = 0.125 # Width of the sigmoid (mv^-1)
# ----------------------------------------------------------------------------------------------------------------------
# Input_Mask/Continuous Transtion
transit_Mat = np.zeros((2, N))
t_Tracker = 0
Iext = 100000

rate = 0.025
offset = 0.15

# Connectome 3D-array
connectome_Array = np.zeros((N, N, 2))
connectome_Array[:, :, 0] = Gg_Static
connectome_Array[:, :, 1] = Gs_Static

Gg_Dynamic = connectome_Array[:, :, 0]
Gs_Dynamic = connectome_Array[:, :, 1]

# Data matrix stack size
stack_Size = 5
init_data_Mat = np.zeros((stack_Size + 10, N))
data_Mat = np.zeros((stack_Size, N))

# In[3]:

# Mask transition
def transit_Mask(ind, percentage):
    
    global t_Switch, oldMask, newMask, transit_End, Vth_Static
    
    transit_Mat[0,:] = transit_Mat[1,:]
    
    t_Switch = t_Tracker
    
    transit_Mat[1,ind] = np.round(percentage, 2)
        
    oldMask = transit_Mat[0,:]
    newMask = transit_Mat[1,:]
    
    Vth_Static = EffVth_rhs(Iext, newMask)
    transit_End = t_Switch + 0.3
          
    print oldMask, newMask, t_Switch, transit_End
    
def update_Mask(old, new, t, tSwitch):
    
    return np.multiply(old, 0.5-0.5*np.tanh((t-tSwitch)/rate)) + np.multiply(new, 0.5+0.5*np.tanh((t-tSwitch)/rate))

# Ablation
def modify_Connectome(ind):
    
    global Gg_Dynamic, Gs_Dynamic, Vth_Static
    
    connectome_Array[:, ind, 0] = 0
    connectome_Array[ind, :, 0] = 0
    
    connectome_Array[:, ind, 1] = 0
    connectome_Array[ind, :, 1] = 0
    
    Gg_Dynamic = connectome_Array[:, :, 0]
    Gs_Dynamic = connectome_Array[:, :, 1]
    
    try:
        newMask
    
    except NameError:
        
        EffVth(Gg_Dynamic, Gs_Dynamic)
        print "Neuron %s Deactivated" % ind
        print "EffVth Recalculated"
        
    else:
        
        EffVth(Gg_Dynamic, Gs_Dynamic)
        Vth_Static = EffVth_rhs(Iext, newMask)
        print "Neuron %s Deactivated" % ind
        print "EffVth Recalculated"
        print "Vth Recalculated"
    
def recover_Connectome(ind):
    
    global Gg_Dynamic, Gs_Dynamic, Vth_Static
    
    connectome_Array[:, ind, 0] = Gg_Static[:, ind]
    connectome_Array[ind, :, 0] = Gg_Static[ind, :]
    
    connectome_Array[:, ind, 1] = Gs_Static[:, ind]
    connectome_Array[ind, :, 1] = Gs_Static[ind, :]
    
    Gg_Dynamic = connectome_Array[:, :, 0]
    Gs_Dynamic = connectome_Array[:, :, 1]
    
    try:
        newMask
    
    except NameError:
        
        EffVth(Gg_Dynamic, Gs_Dynamic)
        print "Neuron %s Activated" % ind
        print "EffVth Recalculated"
        
    else:
        
        EffVth(Gg_Dynamic, Gs_Dynamic)
        Vth_Static = EffVth_rhs(Iext, newMask)
        print "Neuron %s Activated" % ind
        print "EffVth Recalculated"
        print "Vth Recalculated"

# Efficient V-threshold computation    
def EffVth(Gg, Gs):

    Gcmat = np.multiply(Gc, np.eye(N))
    EcVec = np.multiply(Ec, np.ones((N, 1)))

    M1 = -Gcmat
    b1 = np.multiply(Gc, EcVec)

    Ggap = np.multiply(ggap, Gg)
    Ggapdiag = np.subtract(Ggap, np.diag(np.diag(Ggap)))
    Ggapsum = Ggapdiag.sum(axis = 1) 
    Ggapsummat = sparse.spdiags(Ggapsum, 0, N, N).toarray()
    M2 = -np.subtract(Ggapsummat, Ggapdiag)

    Gs_ij = np.multiply(gsyn, Gs)
    s_eq = round((ar/(ar + 2 * ad)), 4)
    sjmat = np.multiply(s_eq, np.ones((N, N)))
    S_eq = np.multiply(s_eq, np.ones((N, 1)))
    Gsyn = np.multiply(sjmat, Gs_ij)
    Gsyndiag = np.subtract(Gsyn, np.diag(np.diag(Gsyn)))
    Gsynsum = Gsyndiag.sum(axis = 1)
    M3 = -sparse.spdiags(Gsynsum, 0, N, N).toarray()

    b3 = np.dot(Gs_ij, np.multiply(s_eq, E))

    M = M1 + M2 + M3 
    
    global LL, UU, bb

    (P, LL, UU) = linalg.lu(M)
    bbb = -b1 - b3
    bb = np.reshape(bbb, N)

def EffVth_rhs(Iext, InMask):
    
    InputMask = np.multiply(Iext, InMask)
    b = np.subtract(bb, InputMask)
    
    Vth = linalg.solve_triangular(UU, linalg.solve_triangular(LL, b, lower = True, check_finite=False), check_finite=False)
    
    return Vth

# Right hand side
def Jimin_RHS(t, y):
    
    # Split the incoming values
    Vvec, SVec = np.split(y, 2)
    
    # Gc(Vi - Ec)
    VsubEc = np.multiply(Gc, (Vvec - Ec))
    
    # Gg(Vi - Vj) Computation
    Vrep = np.tile(Vvec, (N, 1))
    GapCon = np.multiply(Gg_Dynamic, np.subtract(np.transpose(Vrep), Vrep)).sum(axis = 1)
    
    # Gs*S*(Vi - Ej) Computation
    VsubEj = np.subtract(np.transpose(Vrep), EMat)
    SynapCon = np.multiply(np.multiply(Gs_Dynamic, np.tile(SVec, (N, 1))), VsubEj).sum(axis = 1)
    
    global InMask, Vth
    
    if t <= transit_End:
        
        InMask = update_Mask(oldMask, newMask, t, t_Switch + offset)
        Vth = EffVth_rhs(Iext, InMask)
        
    else:
        
        InMask = newMask
        Vth = Vth_Static
    
    # ar*(1-Si)*Sigmoid Computation 
    SynRise = np.multiply(np.multiply(ar, (np.subtract(1.0, SVec))), 
                          np.reciprocal(1.0 + np.exp(-B*(np.subtract(Vvec, Vth)))))
    
    SynDrop = np.multiply(ad, SVec)    
    
    # Input Mask
    Input = np.multiply(Iext, InMask)
    
    # dV and dS and merge them back to dydt
    dV = (-(VsubEc + GapCon + SynapCon) + Input)/C
    dS = np.subtract(SynRise, SynDrop)
    
    return np.concatenate((dV, dS))

# Simulation initiator
def run_Network(t_Delta, atol):
    
    dt = t_Delta
    
    InitCond = 10**(-4)*np.random.normal(0, 0.94, 2*N)   
         
    # Configuring the ODE Solver
    r = integrate.ode(Jimin_RHS).set_integrator('vode', atol = atol, min_step = dt*1e-6, method = 'bdf', with_jacobian = True)
    r.set_initial_value(InitCond, 0)
    
    init_data_Mat[0, :] = InitCond[:N]
    
    global oldMask, t_Switch, t_Tracker, transit_End
    
    oldMask = np.zeros(N)
    t_Switch = 0
    transit_End = 0.3
    k = 1
    
    while r.successful() and k < stack_Size + 10:
        
        r.integrate(r.t + dt)
        data = np.subtract(r.y[:N], Vth)
        init_data_Mat[k, :] = data
        t_Tracker = r.t
        k += 1

    @socketio.on("continue run", namespace='/test')
    def continueRun():
        
        global t_Tracker
        k = 0
        
        while r.successful() and k < stack_Size:
            
            r.integrate(r.t + dt)
            data = np.subtract(r.y[:N], Vth)
            data_Mat[k, :] = data
            t_Tracker = r.t
            k += 1
        
        emit('new data', data_Mat.tolist())  
        
    emit('new data', init_data_Mat.tolist())
    
EffVth(Gg_Static, Gs_Static)
        
# In[5]:

app = Flask(__name__)
app.debug = True
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)
thread = None

jinja_options = app.jinja_options.copy()
jinja_options.update(dict(
    block_start_string='<%',
    block_end_string='%>',
    variable_start_string='%%',
    variable_end_string='%%',
    comment_start_string='<#',
    comment_end_string='#>',
))
app.jinja_options = jinja_options
    
def background_thread():
    while True:
        time.sleep(10)

@app.route('/')
def index():
    global thread
    if thread is None:
        thread = Thread(target=background_thread)
        thread.start()
    return render_template('index.html')

@socketio.on('connect', namespace='/test')
def test_connect():
    emit('data loaded', {'data': open("chem.json").read(), 'count': 0})


@socketio.on('disconnect', namespace='/test')
def test_disconnect():
    global transit_Mat, t_Tracker
    transit_Mat = np.zeros((2, N))
    t_Tracker = 0
    print('Client disconnected')

@socketio.on('startRun', namespace='/test')
def startRun(t_Delta, atol):
    run_Network(t_Delta, atol)
    
@socketio.on('update', namespace='/test')
def update(ind, percentage):
    transit_Mask(ind, percentage)
    
@socketio.on('activate', namespace='/test')
def activate(ind):
    recover_Connectome(ind)
    
@socketio.on('deactivate', namespace='/test')
def deactivate(ind):
    modify_Connectome(ind)

@socketio.on("stop", namespace="/test")
def stopit():
    global t_Tracker
    t_Tracker = 0
    print "Simulation stopped"
    
@socketio.on("reset", namespace="/test")
def resetit():
    global t_Tracker, transit_Mat, Gg_Dynamic, Gs_Dynamic, Vth_Static
    
    t_Tracker = 0
    transit_Mat = np.zeros((2, N))
    
    connectome_Array[:, :, 0] = Gg_Static
    connectome_Array[:, :, 1] = Gs_Static

    Gg_Dynamic = connectome_Array[:, :, 0]
    Gs_Dynamic = connectome_Array[:, :, 1]
    
    EffVth(Gg_Dynamic, Gs_Dynamic)
    
    print "EffVth Recalculated"
    print "Simulation Resetted"

if __name__ == '__main__':
    socketio.run(app)

