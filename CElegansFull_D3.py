
# coding: utf-8

# In[1]:

import matplotlib.pyplot as plt
import numpy as np
import scipy.io as sio
import time

import eventlet
eventlet.monkey_patch() 

from scipy import integrate, signal, sparse, linalg
from threading import Thread
from flask import Flask, render_template, session, request
from flask.ext.socketio import SocketIO, emit, join_room, leave_room, close_room, disconnect

WrittenBy = 'Jimin Kim'
Email = 'jk55@u.washington.edu'
Version = '1.0.0-Beta'

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
Gg = G['Gg']
# -----------------------------------------------------------------------------------------------------------------------
# Synaptic connections (Chemical, 279*279)
gsyn = 1.0
S = sio.loadmat('Gs.mat')
Gs = S['Gs']
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
# Input_Mask/Smooth Transtion
transit_Mat = np.zeros((2, N))
t_Tracker = 0
Iext = 100000

rate = 0.025
offset = 0.15

stack_Size = 5
init_data_Mat = np.zeros((stack_Size + 10, N))
data_Mat = np.zeros((stack_Size, N))

# In[3]:

def transit_Mask(ind, percentage):
    
    global t_Switch
    global oldMask
    global newMask
    global transit_End
    global Vth_Static
    
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
        
def EffVth():

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
    
    global LL
    global UU
    global bb

    (P, LL, UU) = linalg.lu(M)
    bbb = -b1 - b3
    bb = np.reshape(bbb, N)

def EffVth_rhs(Iext, InMask):
    
    InputMask = np.multiply(Iext, InMask)
    b = np.subtract(bb, InputMask)
    
    Vth = linalg.solve(UU, linalg.solve(LL, b))
    
    return Vth

# In[1]:

def Jimin_RHS(t, y):
    
    # Split the incoming values
    Vvec, SVec = np.split(y, 2)
    
    # Gc(Vi - Ec)
    VsubEc = np.multiply(Gc, (Vvec - Ec))
    
    # Gg(Vi - Vj) Computation
    Vrep = np.tile(Vvec, (N, 1))
    GapCon = np.multiply(Gg, np.subtract(np.transpose(Vrep), Vrep)).sum(axis = 1)
    
    # Gs*S*(Vi - Ej) Computation
    VsubEj = np.subtract(np.transpose(Vrep), EMat)
    SynapCon = np.multiply(np.multiply(Gs, np.tile(SVec, (N, 1))), VsubEj).sum(axis = 1)
    
    global InMask
    global Vth
    
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


def run_Network(t_Delta, atol):
    
    dt = t_Delta
    
    InitCond = 10**(-4)*np.random.normal(0, 0.94, 2*N)   
         
    # Configuring the ODE Solver
    r = integrate.ode(Jimin_RHS).set_integrator('vode', atol = atol, min_step = dt*1e-6, method = 'bdf', with_jacobian = True)
    r.set_initial_value(InitCond, 0)
    
    data_Mat[0, :] = InitCond[:N]
    
    global oldMask
    global t_Switch
    global t_Tracker
    global transit_End
    
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
    
EffVth()
        
# In[5]:

app = Flask(__name__)
app.debug = True
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)
thread = None
    
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
    emit('my response', {'data': open("chem.json").read(), 'count': 0})


@socketio.on('disconnect', namespace='/test')
def test_disconnect():
    global transit_Mat 
    global t_Tracker
    transit_Mat = np.zeros((2, N))
    t_Tracker = 0
    print('Client disconnected')

@socketio.on('startRun', namespace='/test')
def startRun(t_Delta, atol):
    run_Network(t_Delta, atol)
    
@socketio.on('update', namespace='/test')
def update(ind, percentage):
    transit_Mask(ind, percentage)

@socketio.on("stop", namespace="/test")
def stopit():
    #stopit = True
    global t_Tracker
    t_Tracker = 0
    print('Simulation stopped')
    
@socketio.on("reset", namespace="/test")
def resetit():
    #stopit = True
    global t_Tracker
    global transit_Mat
    t_Tracker = 0
    transit_Mat = np.zeros((2, N))
    
    print('Simulation Resetted')

if __name__ == '__main__':
    socketio.run(app)

