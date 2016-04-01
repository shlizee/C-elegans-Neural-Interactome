// controller for the menu
angular.module("App")
.controller("menuController", ["$scope", "NetworkService", "$timeout", "AnimationService", function($scope, network, $timeout, animation) {

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

	$scope.getHoveredConnections = network.getHoveredConnections;

	$scope.reorderGroup = reorderGroup;

	$scope.isPaused = animation.isPaused;

	function refresh(){
		$timeout(function() {
			$scope.nodeGroups = network.nodeGroups;
		});
	}

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

