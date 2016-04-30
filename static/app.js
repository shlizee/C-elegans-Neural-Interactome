angular.module("App",["ngAnimate"])

// .config(function($interpolateProvider) {
//   $interpolateProvider.startSymbol('//');
//   $interpolateProvider.endSymbol('//');
// });

// handles socket emit and on functions
angular.module("App")
.factory("SocketService", ["$rootScope", function($rootScope) {

	var namespace = '/test';
	var socket = io.connect('http://' + document.domain + ':' + location.port + namespace);

	return socket;

}])

.controller("main", function($scope) {
	this.view = "vis";
})

.directive("dropdown", function() {
	return {

		restrict: "E",
		scope: {
			onSelect: "&",
			onRemove: "&",
			opts: "=",
			title: "@"
		},
		template: '<div class="dropdown">' + 
        '<span class="dropdown-header" ng-click="toggle()">' + 
          '<button>{{title}}</button>' + 
          '<i class="material-icons">expand_more</i>' + 
        '</span>' + 
        '<ul class="dropdown-body" ng-show="showBody">' + 
          '<li ng-repeat="item in opts" >' + 
            '<span ng-click="select(item)">{{item}}</span>' + 
            '<i ng-click="remove(item);$event.stopPropogation();" class="material-icons">cancel</i>' + 
          '</li>' + 
        '</ul>' + 
      '</div>',
		link: function($scope, ele, attr) {

			$scope.showBody = false;

			$scope.toggle = function() {
				$scope.showBody = !$scope.showBody;
			}

			$scope.select = function(item) {
				$scope.toggle();
				$scope.onSelect()(item);
			}

			$scope.remove = function(item) {
				$scope.onRemove()(item);
			}

		}

	}
})


