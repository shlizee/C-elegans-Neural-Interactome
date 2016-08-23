// controller for the menu
angular.module("App")
.controller("menuController", ["$scope", "NetworkService", "$timeout", "AnimationService", "SocketService", function($scope, network, $timeout, animation, socket) {

	$scope.nodeGroups = network.nodeGroups;

	$scope.liClick = liClick;
	$scope.hoverStart = network.nodeHoverStart;
	$scope.hoverEnd = network.nodeHoverEnd;

	$scope.newVoltage = newVoltage;

	$scope.$on("data loaded", refresh);
	$scope.$on("new selection", refresh);
	$scope.$on("new hover", refresh);

	$scope.bufferSize = animation.getBufferSize;

	$scope.isBuffering = animation.isBuffering;

	$scope.reorderGroup = reorderGroup;

	$scope.isPaused = animation.isPaused;

	$scope.pauseMessage = animation.pauseMessage;






	socket.on("list presets", function(list) {
		$scope.load.list = list.filter(function(l) {
			return l.indexOf("json") > -1;
		}).map(function(l) {
			return l.replace(".json", "");
		});
		$scope.$apply();
	});

	$scope.save = {
		name: "",
		submit: function(nodes) {
			var hashmap = {}
			network.nodes().forEach(function(node) {
				hashmap[node.name] = {
					activated: node.activated,
					inputCurrent: node.inputCurrent,
					selected: node.selected
				};
			});
			socket.emit("save", this.name, JSON.stringify(hashmap));
			this.name = "";
		}
	}

	$scope.load = {
		list: [],
		submit: function(name) {
			socket.emit("load", name);
		},
		delete: function(name) {
			socket.emit("delete", name);
		}
	}

	function refresh(){
		console.log($scope.hoveredConnections())
		$timeout(function() {
			$scope.nodeGroups = network.nodeGroups;
		});
	}

	$scope.hoveredConnections = network.getHoveredConnections;

	function liClick(node, $event) {
		if ($event.shiftKey) {
			// don't call event if node is selected
			if (!node.selected) network.nodeShiftClick(node);
		} else {
			// only call event if node is activated
			if (node.activated) network.nodeClick(node);
		}
	}

	function reorderGroup(group) {
		return [0,2,1][+group.key - 1];
	}

	function hoverStart(node) {
		console.log(node)
	}

	function newVoltage(current, index) {
		network.nodeSlide(current, index);
	}

}]);
