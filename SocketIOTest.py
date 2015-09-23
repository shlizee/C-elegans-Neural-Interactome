from gevent import monkey
monkey.patch_all()

import time
import CElegansFull_Notebook as CE
import numpy as np
from threading import Thread
from flask import Flask, render_template, session, request
from flask.ext.socketio import SocketIO, emit, join_room, leave_room, close_room, disconnect
    
(t, data, t_comp) = CE.run_Network(CE.Neuron, 0, 32.0, 0.01, 'ALM', 90000, 1e-3)
simData = np.subtract(data, np.tile(CE.Vth, (CE.nsteps, 1)))

app = Flask(__name__)
app.debug = True
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)
thread = None

def send_Data(a,b):
    for i in range(100,3200):
        emit('new data', simData[i,:].tolist())

def background_thread():
    """Example of how to send server generated events to clients."""
    count = 0
    while True:
        time.sleep(10)
        count += 1
        socketio.emit('my response',
                      {'data': 'Server generated event', 'count': count},
                      namespace='/test')

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
    print('Client disconnected')

@socketio.on('startRun', namespace='/test')
def start_run(a,b):
    send_Data(a,b)

if __name__ == '__main__':
    socketio.run(app)

