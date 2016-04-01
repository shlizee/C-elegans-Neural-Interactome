// top level service that handles the animation loop and behavior
angular.module("App")
.factory("AnimationService", ["SocketService", "NetworkService", "$timeout", "$rootScope", 
	function(socket, network, $timeout, $rootScope) {

	var isRunning = false;
	var hasStarted = false;
	var isBuffering = false;
	var isPaused = false;

	var debug = window.location.search.indexOf("debug");

	// Time between frames
	var animationDelay = 100;
	// Extra time padded around shifts in voltage
	var extraAnimationDelay = 150;
	// How many more frames should there be an extra delay?
	// Delays are added to pad input changes
	var delayQueue = 0;

	// Elapsed "real" time
	var animationTime = 0;

	// Buffer of voltage data
	var buffer = [];
	var maxBufferSize = 15;

	// When new data comes in push it onto the buffer
	// Then load some more
	socket.on("new data", function(data) {

		if (!isRunning) return;

		data.forEach(function(d) {
			buffer.push(d);
		});

		if (buffer.length < maxBufferSize && !isPaused) {
			socket.emit("continue run");
		} else {
			var isTabHidden = false;
			var checkTab = setInterval(function() {
				if (!document.hidden && !isPaused && buffer.length < maxBufferSize) {
					if (isRunning) socket.emit("continue run");
					clearInterval(checkTab);
				}
			}, 50);
		}

	});

	// On broadcasted change events, add to the buffer queue
	$rootScope.$on("new selection", onInputChange);
	$rootScope.$on("input changed", onInputChange);

	var factory = {}

	factory.start = start;
	factory.pause = pause;
	factory.resume = resume;
	factory.reset = reset;
	factory.stop = stop;
	factory.isRunning = function() { return isRunning; };
	factory.hasStarted = function() { return hasStarted; };
	factory.isBuffering = function() { 
		return isRunning && isBuffering;
	};
	factory.isPaused = function() {
		return isPaused;
	}
	factory.animationTime = function(){ return animationTime; };
	factory.getAnimationDelay = getAnimationDelay;

	factory.getBufferSize = getBufferSize;

	return factory;

	function start() {
		isRunning = true;
		socket.emit("startRun", 0.01, 1e-3);
		animationTick();
	}

	function stop() {
		animationTime = 0;
		isRunning = false;
		isPaused = false;
		hasStarted = false;
		buffer = [];
		socket.emit("stop");
		network.updateData(network.nodes());
	}

	function pause() {
		isPaused = true;
	}

	function resume() {
		isPaused = false;
	}

	function reset() {
		stop();
		socket.emit("reset");
	}

	function getBufferSize() {
		return buffer.length;
	}

	// What to do every animation frame
	function animationTick() {

		if ( debug > -1 ) {
			var status = "";
			for (var i=0; i<buffer.length; i++) {
				status += "■";
			}
			console.log(buffer.length + status);
		}

		// Check the buffer length
		// if buffer is empty
		if (buffer.length < 1 || document.hidden || isPaused) {
			isBuffering = true;
		} else {
			isBuffering = false;
			hasStarted = true;
			network.updateData(buffer.shift());
			animationTime += 0.01;
			if (delayQueue > 0) delayQueue--;
		}

		// Run another frame
		if (isRunning) $timeout(animationTick, getAnimationDelay());
		
	}

	function getAnimationDelay() {
		return animationDelay + (delayQueue > 0 ? extraAnimationDelay : 0);
	}

	function onInputChange() {
		delayQueue = buffer.length + 15;
	}

}]);

