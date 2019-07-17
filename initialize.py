
# coding: utf-8

import time
import os

import numpy as np
import scipy.io as sio

import eventlet
eventlet.monkey_patch()

from scipy import integrate, signal, sparse, linalg
from threading import Thread
from flask import Flask, render_template, session, request
from flask_socketio import SocketIO, emit, join_room, leave_room, close_room, disconnect

__author__ = 'Jimin Kim'
__authoremail__ = 'jk55@u.washington.edu'
__version__ = '2.1.0-Beta'

""" Number of Neurons """
N = 279

""" Cell membrane conductance (pS) """
Gc = 0.1

""" Cell Membrane Capacitance """
C = 0.015

""" Gap Junctions (Electrical, 279*279) """
ggap = 1.0
Gg_Static = np.load('Gg.npy')

""" Synaptic connections (Chemical, 279*279) """
gsyn = 1.0
Gs_Static = np.load('Gs.npy')

""" Leakage potential (mV) """
Ec = -35.0

""" Directionality (279*1) """
E = np.load('emask.npy')
E = -48.0 * E
EMat = np.tile(np.reshape(E, N), (N, 1))

""" Synaptic Activity Parameters """
ar = 1.0/1.5 # Synaptic activity's rise time
ad = 5.0/1.5 # Synaptic activity's decay time
B = 0.125 # Width of the sigmoid (mv^-1)

""" Input_Mask/Continuous Transtion """
transit_Mat = np.zeros((2, N))

t_Tracker = 0
Iext = 100000

rate = 0.025
offset = 0.15

""" Connectome Arrays """
Gg_Dynamic = Gg_Static.copy()
Gs_Dynamic = Gs_Static.copy()

""" Data matrix stack size """
stack_Size = 5
init_data_Mat = np.zeros((stack_Size + 50, N))
data_Mat = np.zeros((stack_Size, N))

""" Directory paths for presets """
default_Dir = os.getcwd()
preset_Dir = default_Dir + '/presets'
save_Dir = default_Dir + '/saved_dynamics'

""" Mask transition """
def transit_Mask(input_Array):

    global t_Switch, oldMask, newMask, transit_End, Vth_Static

    transit_Mat[0,:] = transit_Mat[1,:]

    t_Switch = t_Tracker

    transit_Mat[1,:] = input_Array

    oldMask = transit_Mat[0,:]
    newMask = transit_Mat[1,:]

    Vth_Static = EffVth_rhs(Iext, newMask)
    transit_End = t_Switch + 0.3

    print oldMask, newMask, t_Switch, transit_End

def update_Mask(old, new, t, tSwitch):

    return np.multiply(old, 0.5-0.5*np.tanh((t-tSwitch)/rate)) + np.multiply(new, 0.5+0.5*np.tanh((t-tSwitch)/rate))

""" Ablation """
def modify_Connectome(ablation_Array):

    global Vth_Static, Gg_Dynamic, Gs_Dynamic

    apply_Col = np.tile(ablation_Array, (N, 1))
    apply_Row = np.transpose(apply_Col)

    apply_Mat = np.multiply(apply_Col, apply_Row)

    Gg_Dynamic = np.multiply(Gg_Static, apply_Mat)
    Gs_Dynamic = np.multiply(Gs_Static, apply_Mat)

    try:
        newMask

    except NameError:

        EffVth(Gg_Dynamic, Gs_Dynamic)

        if np.sum(ablation_Array) != N:

            print 'Neurons %s are ablated' %np.where(ablation_Array == False)[0]

        else:

            print "All Neurons healthy"

        print "EffVth Recalculated"

    else:

        EffVth(Gg_Dynamic, Gs_Dynamic)
        Vth_Static = EffVth_rhs(Iext, newMask)

        if np.sum(ablation_Array) != N:

            print 'Neurons %s are ablated' %np.where(ablation_Array == False)[0]

        else:

            print "All Neurons healthy"

        print "EffVth Recalculated"
        print "Vth Recalculated"

""" Efficient V-threshold computation """
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

def voltage_filter(v_vec, vmax, scaler):
    
    filtered = vmax * np.tanh(scaler * np.divide(v_vec, vmax))
    
    return filtered

""" Right hand side """
def membrane_voltageRHS(t, y):

    """ Split the incoming values """
    Vvec, SVec = np.split(y, 2)

    """ Gc(Vi - Ec) """
    VsubEc = np.multiply(Gc, (Vvec - Ec))

    """ Gg(Vi - Vj) Computation """
    Vrep = np.tile(Vvec, (N, 1))
    GapCon = np.multiply(Gg_Dynamic, np.subtract(np.transpose(Vrep), Vrep)).sum(axis = 1)

    """ Gs*S*(Vi - Ej) Computation """
    VsubEj = np.subtract(np.transpose(Vrep), EMat)
    SynapCon = np.multiply(np.multiply(Gs_Dynamic, np.tile(SVec, (N, 1))), VsubEj).sum(axis = 1)

    global InMask, Vth

    if t >= t_Switch and t <= transit_End:

        InMask = update_Mask(oldMask, newMask, t, t_Switch + offset)
        Vth = EffVth_rhs(Iext, InMask)

    else:

        InMask = newMask
        Vth = Vth_Static

    """ ar*(1-Si)*Sigmoid Computation """
    SynRise = np.multiply(np.multiply(ar, (np.subtract(1.0, SVec))),
                          np.reciprocal(1.0 + np.exp(-B*(np.subtract(Vvec, Vth)))))

    SynDrop = np.multiply(ad, SVec)

    """ Input Mask """
    Input = np.multiply(Iext, InMask)

    """ dV and dS and merge them back to dydt """
    dV = (-(VsubEc + GapCon + SynapCon) + Input)/C
    dS = np.subtract(SynRise, SynDrop)

    return np.concatenate((dV, dS))

""" Simulation initiator """
def run_Network(t_Delta, atol):

    dt = t_Delta

    InitCond = 10**(-4)*np.random.normal(0, 0.94, 2*N)

    """ Configuring the ODE Solver """
    r = integrate.ode(membrane_voltageRHS).set_integrator('vode', atol = atol, min_step = dt*1e-6, method = 'bdf', with_jacobian = True)
    r.set_initial_value(InitCond, 0)

    init_data_Mat[0, :] = InitCond[:N]

    global session_Data, oldMask, t_Switch, t_Tracker, transit_End

    session_Data = []

    try:
        newMask

    except NameError:

        transit_Mask(np.zeros(N))

    else:

        oldMask = newMask.copy()

    t_Switch = 0
    transit_End = 0.3
    k = 1

    while r.successful() and k < stack_Size + 50:

        r.integrate(r.t + dt)
        data = np.subtract(r.y[:N], Vth)
        init_data_Mat[k, :] = voltage_filter(data, 500, 1)
        t_Tracker = r.t
        k += 1

    @socketio.on("continue run", namespace='/test')
    def continueRun():

        global t_Tracker
        k = 0

        while r.successful() and k < stack_Size:

            r.integrate(r.t + dt)
            data = np.subtract(r.y[:N], Vth)
            data_Mat[k, :] = voltage_filter(data, 500, 1)
            t_Tracker = r.t
            k += 1

        emit('new data', data_Mat.tolist())
        session_Data.append(np.asarray(data_Mat.tolist()))

    emit('new data', init_data_Mat[50:, :].tolist())
    session_Data.append(np.asarray(init_data_Mat[50:, :].tolist()))

EffVth(Gg_Static, Gs_Static)


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
    emit('data loaded', {'chem': open("chem.json").read(), 'gap': open("gap.json").read(), 'count': 0})
    emit('list presets', os.listdir(preset_Dir))


@socketio.on('disconnect', namespace='/test')
def test_disconnect():
    global t_Tracker, transit_Mat, Gg_Dynamic, Gs_Dynamic, newMask, oldMask, Vth_Static

    t_Tracker = 0
    transit_Mat = np.zeros((2, N))

    oldMask = transit_Mat[0,:]
    newMask = transit_Mat[1,:]

    Gg_Dynamic = Gg_Static.copy()
    Gs_Dynamic = Gs_Static.copy()

    EffVth(Gg_Dynamic, Gs_Dynamic)
    Vth_Static = EffVth_rhs(Iext, newMask)

    if 'session_Data' in globals():

        os.chdir(save_Dir)

        np.save('saved_dynamics.npy', np.vstack(session_Data))

        os.chdir(default_Dir)

        print "Session Voltage Dynamics Saved"

    print "EffVth Recalculated"
    print "Simulation Resetted"
    print "Client disconnected"

@socketio.on('startRun', namespace='/test')
def startRun(t_Delta, atol):
    run_Network(t_Delta, atol)

@socketio.on('update', namespace='/test')
def update(input_Array):
    transit_Mask(np.asarray(input_Array))

@socketio.on('modify connectome', namespace='/test')
def config_connectome(ablation_Array):
    modify_Connectome(np.asarray(ablation_Array))

@socketio.on("stop", namespace="/test")
def stopit():
    global t_Tracker
    t_Tracker = 0
    print "Simulation stopped"

@socketio.on("reset", namespace="/test")
def resetit():
    global t_Tracker, transit_Mat, Gg_Dynamic, Gs_Dynamic, newMask, oldMask, Vth_Static

    t_Tracker = 0
    transit_Mat = np.zeros((2, N))

    oldMask = transit_Mat[0,:]
    newMask = transit_Mat[1,:]

    Gg_Dynamic = Gg_Static.copy()
    Gs_Dynamic = Gs_Static.copy()

    EffVth(Gg_Dynamic, Gs_Dynamic)
    Vth_Static = EffVth_rhs(Iext, newMask)

    if 'session_Data' in globals():

        os.chdir(save_Dir)

        np.save('saved_dynamics.npy', np.vstack(session_Data))

        os.chdir(default_Dir)

        print "Session Voltage Dynamics Saved"

    print "EffVth Recalculated"
    print "Simulation Resetted"

@socketio.on("save", namespace="/test")
def save(name, json):

    os.chdir(preset_Dir)

    preset_file = open(name + '.json', "w")
    preset_file.write(json)
    preset_file.close()

    emit('list presets', os.listdir(preset_Dir))

    print "preset %s saved" %name

    os.chdir(default_Dir)

@socketio.on("load", namespace="/test")
def load(name):

    os.chdir(preset_Dir)

    with open(name + '.json', 'r') as preset:
        data = preset.read()

    emit('file loaded', data)

    print "preset %s loaded" %name

    os.chdir(default_Dir)

@socketio.on("delete", namespace="/test")
def delete(name):

    os.chdir(preset_Dir)

    os.remove(name + '.json')
    emit('list presets', os.listdir(preset_Dir))

    print "preset %s deleted" %name

    os.chdir(default_Dir)

if __name__ == '__main__':
    socketio.run(app, host = '0.0.0.0')

