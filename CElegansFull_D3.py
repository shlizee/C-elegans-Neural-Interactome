
# coding: utf-8

# In[1]:

import matplotlib.pyplot as plt
import numpy as np
import scipy.io as sio
import time

from gevent import monkey
monkey.patch_all()

from scipy import integrate, signal
from threading import Thread
from flask import Flask, render_template, session, request
from flask.ext.socketio import SocketIO, emit, join_room, leave_room, close_room, disconnect


WrittenBy = 'Jimin Kim'
Email = 'jk55@u.washington.edu'
Version = '0.4-Alpha'

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
# Input_Mask
InMask = np.zeros(N)

# In[3]:

def VthFinder(Iext, InMask):

    Gcmat = np.zeros((N, N))
    np.fill_diagonal(Gcmat, Gc)

    Ecvec = np.zeros((N,1))
    Ecvec.fill(Ec)

    M1 = -Gcmat
    b1 = Gc * Ecvec

    Ggij = np.multiply(ggap, Gg)
    gdiag = np.zeros((N, N))
    np.fill_diagonal(gdiag, np.diagonal(Ggij))
    GgapSubDiag = np.subtract(Ggij, gdiag)
    GgapSum = GgapSubDiag.sum(axis = 1)
    GgapSumMat = np.zeros((N, N))
    np.fill_diagonal(GgapSumMat, GgapSum)

    M2 = -(np.subtract(GgapSumMat, GgapSubDiag))

    Gsij = np.multiply(gsyn, Gs)
    Seq = round((ar/(ar + 2 * ad)), 4)
    S_eq = np.zeros((N, 1))
    S_eq.fill(Seq)
    Sjmat = np.zeros((N, N))
    Sjmat.fill(Seq)
    GSyn = np.multiply(Sjmat, Gsij)
    sdiag = np.zeros((N, N))
    np.fill_diagonal(sdiag, np.diagonal(GSyn))
    GSynSubDiag = np.subtract(GSyn, sdiag)
    GSynSum = GSynSubDiag.sum(axis = 1)
    GSynSumMat = np.zeros((N, N))
    np.fill_diagonal(GSynSumMat, GSynSum)

    M3 = -GSynSumMat
    b2 = np.dot(Gsij, np.multiply(S_eq, E))

    InputMask = Iext * InMask

    M = M1 + M2 + M3
    b = -(b1 + b2 + InputMask)

    Vth = np.linalg.solve(M, b)
    
    return Vth


# In[1]:

def Neuron(t, y):
    
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

def update_Mask(ind):
    
    if InMask[ind] == 1:
        InMask[ind] = 0
        
    elif InMask[ind] == 0:
        InMask[ind] = 1

    print InMask


def run_Network(t_Delta, input_Magnitude, atol):
    
    dt = t_Delta
    
    # Input signal magnitude
    global Iext 
    Iext = input_Magnitude
    
    global Vth
    Vth = np.reshape(VthFinder(Iext, np.reshape(InMask, (N,1))), N)
    
    InitCond = 10**(-4)*np.random.normal(0, 0.94, 2*N)   
         
    # Configuring the ODE Solver
    r = integrate.ode(Neuron).set_integrator('vode', atol = atol, min_step = dt*1e-6, method = 'bdf', with_jacobian = True)
    r.set_initial_value(InitCond, 0)
                 
    r.integrate(r.t + dt)
    data = np.subtract(r.y[:N], Vth)

    @socketio.on("continue run", namespace='/test')
    def continueRun():
        r.integrate(r.t + dt)
        data = np.subtract(r.y[:N], Vth)
        emit('new data', data.tolist())

    emit('new data', data.tolist())
        
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
    InMask = np.zeros(N)
    print('Client disconnected')

@socketio.on('startRun', namespace='/test')
def startRun(t_Delta, input_Magnitude, atol):
    run_Network(t_Delta, input_Magnitude, atol)
    
@socketio.on('update', namespace='/test')
def update(ind):
    update_Mask(ind)

@socketio.on("stop", namespace="/test")
def stopit():
    stopit = True

if __name__ == '__main__':
    socketio.run(app)

