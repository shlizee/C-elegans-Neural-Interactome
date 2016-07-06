// top level service that handles the animation loop and behavior
angular.module("App")
.factory("AnimationService", ["SocketService", "NetworkService", "$timeout", "$rootScope", 
	function(socket, network, $timeout, $rootScope) {

	var isRunning = false;
	var hasStarted = false;
	var isBuffering = false;
	var isPaused = false;

	var pauseMessage = "";

	var debug = window.location.search.indexOf("debug");

	var frameIndex = 0;

	// Time between frames
	var animationDelay = 100;
	// Extra time padded around shifts in voltage
	var extraAnimationDelay = 150;
	// How many more frames should there be an extra delay?
	// Delays are added to pad input changes
	var delayQueue = 0;

	var changeIndices = [];

	// Buffer of voltage data
	var buffer = [];
	var maxBufferSize = 15;

	// When new data comes in push it onto the buffer
	// Then load some more
	socket.on("new data", function(data) {

		// Prevents polluting the buffer with old data
		if (!isRunning) return;

		data.forEach(function(d) {
			buffer.push(d);
		});

		if ((buffer.length - frameIndex) <= maxBufferSize && !isPaused) {
			socket.emit("continue run");
		} else {
			var isTabHidden = false;
			var checkTab = setInterval(function() {
				if (!document.hidden && !isPaused && (buffer.length - frameIndex) <= maxBufferSize) {
					if (isRunning) socket.emit("continue run");
					clearInterval(checkTab);
				}
			}, 50);
		}

	});

	// On broadcasted change events, add to the buffer queue
	$rootScope.$on("new selection", onInputChange);
	$rootScope.$on("input changed", onInputChange);

	document.onkeydown = function(e) {
		if (buffer.length === 0) return;
	    e = e || window.event;
	    // console.log(e.which || e.keyCode)
	    switch(e.which || e.keyCode) {
	    	 case 37: // left
        		frameIndex = Math.max(0, frameIndex-2);
        		network.updateData(buffer[frameIndex]);
        	 case 39: // right
        	 	frameIndex = Math.min(buffer.length-1, frameIndex+1);
        	 	network.updateData(buffer[frameIndex]);
	    }
	}

	var factory = {}

	factory.start = start;
	factory.pause = pause;
	factory.resume = resume;
	factory.reset = reset;
	factory.stop = stop;
	factory.getFrameIndex = function() { return frameIndex; };
	factory.isRunning = function() { return isRunning; };
	factory.hasStarted = function() { return hasStarted; };
	factory.isBuffering = function() { 
		return isRunning && isBuffering;
	};
	factory.isPaused = function() {
		return isPaused;
	}
	factory.animationTime = function(){ return frameIndex / 100; };
	factory.setFrame = function(i) { 
		frameIndex = i; 
		network.updateData(buffer[frameIndex]); 
	};
	factory.getAnimationDelay = getAnimationDelay;

	factory.pauseMessage = function() {
		return pauseMessage;
	}

	factory.getBufferSize = getBufferSize;

	factory.getBufferSummary = getBufferSummary;

	return factory;

	function start() {
		isRunning = true;
		socket.emit("startRun", 0.01, 1e-3);
		animationTick();
	}

	function stop() {
		frameIndex = 0;
		isRunning = false;
		isPaused = false;
		hasStarted = false;
		socket.emit("stop");
		network.updateData(network.nodes());
		changeIndices = [];
		buffer = [];
	}

	function pause(message) {
		isPaused = true;
		pauseMessage = message ? "" : "Paused";
	}

	function resume() {
		isPaused = false;
	}

	function reset() {
		buffer = [];
		stop();
		socket.emit("reset");
	}

	function getBufferSize() {
		return buffer.length;
	}

	function getBufferSummary() {
		return {
			changes: changeIndices,
			nFrames: buffer.length,
			frame: frameIndex
		}
		// return buffer.map(function(d,i) {
		// 	var transition = false;
		// 	for (var j=0; j<changeIndices.length; j++) {
		// 		var diff = i - changeIndices[j];
		// 		if (diff > 0 && diff < 15) {
		// 			transition = true;
		// 		}
		// 	}
		// 	return { 
		// 		active: i === frameIndex,
		// 		transition: transition,
		// 		change: changeIndices.indexOf(i) > -1
		// 	}
		// });
	}

	// What to do every animation frame
	function animationTick() {

		// if (buffer.length > 1500) {
		// 	pause("Animation stopped after 2000 frames");
		// }

		if ( debug > -1 ) {
			var status = "";
			for (var i=0; i<buffer.length; i++) {
				status += "■";
			}
			console.log(buffer.length + status);
		}

		// Check the buffer length
		// if buffer is empty
		if ((buffer.length === frameIndex) || document.hidden || isPaused) {
			isBuffering = true;
		} else {
			isBuffering = false;
			hasStarted = true;
			network.updateData(buffer[frameIndex]);
			frameIndex++;
			if (delayQueue > 0) delayQueue--;
		}

		// Run another frame
		if (isRunning) $timeout(animationTick, getAnimationDelay());
		
	}

	function getAnimationDelay() {
		return animationDelay + (delayQueue > 0 ? extraAnimationDelay : 0);
	}

	function onInputChange() {
		changeIndices.push(buffer.length);
		changeIndices = _.uniq(changeIndices);
		delayQueue = (buffer.length-frameIndex) + 15;
	}

}]);

