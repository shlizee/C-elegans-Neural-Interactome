// controller for the menu
angular.module("App")
.controller("navController", ["$scope", "NetworkService", "$timeout", "AnimationService", function($scope, network, $timeout, animation) {

	$scope.start = animation.start;
	$scope.pause = animation.pause;
	$scope.stop = animation.stop;
	$scope.resume = animation.resume;
	$scope.reset = function() {
		animation.reset();
		$timeout(function() {
			network.reset();
		});
	}

	$scope.isPaused = animation.isPaused;
	$scope.isRunning = animation.isRunning;


}]);

