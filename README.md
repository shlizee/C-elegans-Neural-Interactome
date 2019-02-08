# C. elegans Neural Interactome Beta

![alt text](images/fig1.png)

# Introduction

C. elegans Neural Interactome is an interactive simulation platform for the neuronal network of Caenorhabditis elegans worm. It incorporates both static connectome and dynamic biophysical processes to simulate/visualize the network dynamics and allow users to interact with the network in real-time via stimuli injection/network modifications. For more detailed information please refer to the [pre-print of our paper in BioRxiv](https://www.biorxiv.org/content/early/2017/11/26/209155).

# Web Interface
Web service running the latest version of Neural Interactome is available at: 

> http://neuralcode.amath.washington.edu/neuralinteractome


# Installation (Windows)

We recommend to install [Windows Anaconda for Python 2.7](https://www.anaconda.com/download/#windows) since it has most of the package necessary for Neural Interactome. Once you install Anaconda, you will have to install the following additional packages through Anaconda prompt:

* pip install flask==0.12.4 (The official 1.0 version doesn't work with current Neural Interactome)
* pip install flask-socketio
* pip install eventlet

Once you have installed these dependencies, unzip the cloned zip file to your desired location. Navigate to the Neural Interactome folder (location of initialize.py) in Anaconda prompt, and type 

**python initialize.py**, 

This will set up the local Neural Interactome server. Once the server is up, go to the browser and enter your localhost address (127.0.0.1:5000) to access the Neural Interactome. 

# Installation (Linux/Mac)

For Linux/Mac, if you have Python 2.7 installed, you just make sure that you have all the depenedencies below installed. Once all the dependencies have been installed, navigate inside the Neural Interactome folder (where initialize.py is located) in terminal, and type 

**python initialize.py**

This will set up the local Neural Interactome server. Once the server is up, go to the browser and enter your localhost address (127.0.0.1:5000) to access the Neural Interactome. 

# Dependencies

* numpy
* scipy
* eventlet
* flask
* flask-socketio

# Saving Neural Dynamics Data

For each simulation session, you can save the simulated data for all neurons by either: (i) clicking the reset button or (ii) exiting the localhost web page. The voltage dynamics of all neurons will be saved in .npy format and can be found within installation path/saved_dynamics folder. The file can be loaded directly with Python numpy package using the command np.load('saved_dynamics.npy'). 

# For further information refer to:
Neural Interactome: Interactive Simulation of a Neuronal System

Jimin Kim, William Leahy, Eli Shlizerman

Preprint: BioRxiv https://doi.org/10.1101/209155

To appear: Front. Comput. Neurosci. https://www.frontiersin.org/articles/10.3389/fncom.2019.00008/

### The paper has to be cited in any use or modification of the dataset or the code.
