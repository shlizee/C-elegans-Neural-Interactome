
# coding: utf-8

# In[1]:

import matplotlib.pyplot as plt
import numpy as np
import scipy.io as sio
import time

from scipy import integrate, signal, sparse, linalg

WrittenBy = 'Jimin Kim'
Email = 'jk55@u.washington.edu'
Version = '0.6.0'

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

# In[3]:

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

EffVth()

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


# In[5]:

def run_Network(rhs, t_Start, t_Final, t_Delta, input_Mask, input_Magnitude, atol):
    
    # Time Range of Simulation
    t0 = t_Start
    tf = t_Final #2.0 #4.0 #8.0 #16 #32 #64
    dt = t_Delta
    
    global nsteps
    global InMask
    nsteps = np.floor((tf - t0)/dt) + 1

    # Configuring the input mask
    if input_Mask == 'PLM':

        InMask = np.zeros(N)
        InMask[276] = 1
        InMask[278] = 1
    
    elif input_Mask == 'ALM':
        
        InMask = sio.loadmat('ExtMask3.mat')
        InMask = np.reshape(InMask['Ext3'], N)
        
    elif input_Mask == 'RMD':
        
        InMask = sio.loadmat('ExtMask2.mat')
        InMask = np.reshape(InMask['Ext2'], N)
        
    else:
        
        InMask = input_Mask
    
    # Input signal magnitude
    global Iext 
    Iext = input_Magnitude
    
    #Calculate V_threshold
    global Vth 
    Vth = EffVth_rhs(Iext, InMask)
    
    InitCond = 10**(-4)*np.random.normal(0, 0.94, 2*N)   
         
    # Configuring the ODE Solver
    r = integrate.ode(rhs).set_integrator('vode', atol = atol, min_step = dt*1e-6, method = 'bdf', with_jacobian = True)
    r.set_initial_value(InitCond, t0)
    
    # Additional Python step to store the trajectories
    t = np.zeros(nsteps)
    Traj = np.zeros((nsteps, N))
    
    t[0] = t0
    Traj[0, :] = InitCond[:N]
    
    # Integrate the ODE(s) across each delta_t timestep
    k = 1
    
    start_time = time.time()
    
    while r.successful() and k < nsteps:
                 
        r.integrate(r.t + dt)
                 
        t[k] = r.t
        Traj[k, :] = r.y[:N]
        k += 1
    
    end_time = time.time()
    
    t_Comp = end_time - start_time
    
    return (t, Traj, t_Comp)


# In[6]:

def plot_Colormap(Traj):

    VsubVth = np.subtract(Traj, np.tile(Vth, (nsteps, 1))).transpose()

    # Motor Neurons 
    Nplot = np.array([165, 153, 173, 189, 204, 219, 236, 164, 182, 196, 215, 
                     232, 246, 151, 139, 171, 180, 187, 194, 203, 213, 218,
                     230, 235, 167, 169, 175, 184, 191, 201, 206, 216, 222,
                     233, 239, 242, 251])

    # Subtract 1 since python matrices have 0 index
    Nplot = np.subtract(Nplot, 1)

    Motor_Vth = VsubVth[Nplot, 100:]
    
    fig = plt.figure(figsize=(15,10))
    plt.pcolor(VsubVth[:, 100:], cmap='RdBu')
    plt.colorbar()
    plt.xlim(0, nsteps - 100)
    plt.ylim(0,N)
    plt.xlabel('Time (10 ms)', fontsize = 15)
    plt.ylabel('Neuron Index Number', fontsize = 15)
    plt.title('C.Elegans Neurons Voltage Dynamics', fontsize = 25)
    plt.savefig('CElegansWhole')

    fig = plt.figure(figsize=(15,10))
    plt.pcolor(Motor_Vth, cmap='RdBu')
    plt.colorbar()
    plt.xlim(0, nsteps - 100)
    plt.ylim(0,len(Nplot))
    plt.xlabel('Time (10 ms)', fontsize = 15)
    plt.ylabel('Motor Neuron Index Number', fontsize = 15)
    plt.title('C.Elegans Motor Neurons Voltage Dynamics', fontsize = 25)
    plt.savefig('CElegansMotor')


# In[7]:

def plot_DominantModes(Traj, t):

    VsubVth = np.subtract(Traj, np.tile(Vth, (nsteps, 1)))

    # Motor Neurons 
    Nplot = np.array([165, 153, 173, 189, 204, 219, 236, 164, 182, 196, 215, 
                     232, 246, 151, 139, 171, 180, 187, 194, 203, 213, 218,
                     230, 235, 167, 169, 175, 184, 191, 201, 206, 216, 222,
                     233, 239, 242, 251])

    # Subtract 1 since python matrices have 0 index
    Nplot = np.subtract(Nplot, 1)

    Motor_Vth = VsubVth[100:, Nplot]

    # Perform SVD 
    U, s, Z = np.linalg.svd(Motor_Vth, full_matrices=True)

    fig = plt.figure(figsize=(9,6))
    plt.plot(t[100:], U[:,0], t[100:], U[:,1], lw = 2)
    plt.title('Motor Neurons: First Two Dominant Modes Dynamics', fontsize = 15)
    plt.xlabel('Time (Seconds)')
    plt.show
    plt.savefig('MotorNeurons')

    fig = plt.figure(figsize=(9,6))
    plt.scatter(U[:,0], U[:,1])
    plt.title('Phase Space of Two Modes', fontsize = 15)
    plt.show
    plt.savefig('PhaseSpace')

