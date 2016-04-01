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

}]);




