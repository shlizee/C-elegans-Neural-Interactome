// controller for the menu
angular.module("App")
.controller("navController", ["$scope", "NetworkService", "$timeout", "AnimationService", function($scope, network, $timeout, animation) {

	$scope.nodeGroups = network.nodeGroups;

	$scope.liClick = liClick;
	$scope.hoverStart = network.nodeHoverStart;
	$scope.hoverEnd = network.nodeHoverEnd;

	$scope.start = animation.start;
	$scope.stop = animation.stop;
	$scope.reset = function() {
		animation.reset();
		$timeout(network.reset);
	}


}]);

