# C. elegans Neural Interactome Beta

![alt text](images/fig1.png)

# Introduction

C. elegans Neural Interactome is an interactive simulation platform for the neuronal network of Caenorhabditis elegans worm. It incorporates both static connectome and dynamic biophysical processes to simulate/visualize the network dynamics and allow users to interact with the network in real-time via stimuli injection/network modification. For more detailed information about the software, please refer to the [published paper in Front. Compute. Neurosci](https://www.frontiersin.org/articles/10.3389/fncom.2019.00008/full).

# Web Interface
Web service running the latest version of Neural Interactome is available at: 

> http://neuralcode.amath.washington.edu/neuralinteractome


# Installation (Windows)

We recommend you to install [Windows Anaconda for Python 2.7](https://www.anaconda.com/download/#windows) as it comes with most of the packages that are necessary for Neural Interactome. Once you install Anaconda, you will have to install following additional packages through Anaconda Prompt.

* pip install flask==0.12.4 (The official 1.0 version doesn't work with current Neural Interactome)
* pip install flask-socketio
* pip install eventlet

Once you have installed all the dependencies, unzip the cloned zip file to your desired location. Navigate inside the Neural Interactome folder (Where initialize.py is located) in Anaconda prompt, and simply type **python initialize.py**, which will set up the local Neural Interactome server. Once the server is up, go to the browser and enter your localhost address (127.0.0.1:5000) to access the Neural Interactome. 

# Installation (Linux/Mac)

For the Linux/Mac, if you have Python 2.7 installed, you just need to ensure that you have installed all the depenedencies below. Once all the dependencies have been installed, navigate inside the Neural Interactome folder (Where initialize.py is located) in terminal, and type **python initialize.py**, which will set up the local Neural Interactome web server. Once the server is up, go to the browser and enter your localhost address (127.0.0.1:5000) to access the Neural Interactome. 

# Dependencies

* numpy
* scipy
* eventlet
* flask
* flask-socketio

# How to save neural dynamics data

For each simulation session, you can save the simulated data for all neurons by either clicking the reset button or exiting the localhost web page. The saved dynamics is in .npy format and can be found within installation path/saved_dynamics folder. The file can be loaded directly by Python numpy package with command np.load('saved_dynamics.npy'). 

# For further information refer to:
Neural Interactome: Interactive Simulation of a Neuronal System

Jimin Kim, William Leahy, Eli Shlizerman

Published paper: Frontiers in Computational Neuroscience https://www.frontiersin.org/articles/10.3389/fncom.2019.00008/full

In review.

### The paper has to be cited in any use or modification of the dataset or the code.
