// tracks the state of neuron nodes
angular.module("App")
.factory("NetworkService", ["SocketService", "$rootScope", "$timeout", function(socket, $rootScope, $timeout) {

	// data loaded flag so we don't do it again
	var dataLoaded = false;

	socket.on("data loaded", initialData);

	var Factory = {};

	var nodes = [];
	var links = [];
	var nodeGroups = [];
	var initialDegrees = [];

	Factory.nodeClick = nodeClick;
	Factory.nodeShiftClick = nodeShiftClick;
	Factory.nodeHoverStart = nodeHoverStart;
	Factory.nodeHoverEnd = nodeHoverEnd;
	Factory.nodeSlide = nodeSlide;

	Factory.getHoveredConnections = getHoveredConnections;

	Factory.reset = reset;

	Factory.updateData = updateData;

	Factory.nodes = function() { return nodes; };
	Factory.links = function() { return links; };
	Factory.nodeGroups = function() { return nodeGroups; };

	return Factory;

	// add a new dataset
	function updateData(data) {
		nodes.forEach(function(node,i) {
			node.voltage = data[i];
		});
		$rootScope.$broadcast("data updated");
	}

	function initialData(data) {

		if (dataLoaded) return;

		dataLoaded = true;

		data = JSON.parse(data.data);

		nodes = data.nodes;
		links = data.links;

    reset()

    initialDegrees = nodes.map(function(d) {
      return d.degree;
    });

    nestNodes();

    $rootScope.$broadcast("data loaded");

	}

	// Creates a nested node array for the menu
	function nestNodes() {
		nodeGroups = d3.nest()
      .key(function(d) {
        return d.group;
      })
      .entries(nodes);
	}

	function getConnections(node) {
		console.log(node)
		console.log(links)
	}

	// Set input current to default, 0.05
	// Set default selected and activated properties
	function reset() {
		nodes.forEach(function(d) {
			d.voltage = 0;
      d.inputCurrent = 0;
      d.selected = false;
      d.activated = true;
      d.hovered = false;
      d.negative = false;
    });
    $rootScope.$broadcast("reset");
	}

	function nodeClick(node) {
		nodes[node.index].selected = !nodes[node.index].selected;
		if (!nodes[node.index].selected) {
			nodes[node.index].inputCurrent = 0;
		} else {
			nodes[node.index].inputCurrent = 0.05;
		}
		$timeout(function(){
			socket.emit("update", node.index, node.inputCurrent);
		});
		$rootScope.$broadcast("new selection");
	}

	function nodeSlide(current, index) {
		socket.emit("update", index, current);
		$rootScope.$broadcast("new selection");
	}

	// $rootScope.$on("input changed", function(node) {
	// 	socket.emit("update", node.index, node.inputCurrent);
	// });

	function nodeShiftClick(node) {
		nodes[node.index].activated = !nodes[node.index].activated;
		nodes[node.index].activated ? socket.emit("activate", node.index) : socket.emit("deactivate", node.index);
		$rootScope.$broadcast("new selection");
	}

	function nodeHoverStart(node) {
		nodes[node.index].hovered = true;
		$rootScope.$broadcast("new hover", node.name);
	}

	function nodeHoverEnd(node) {
		nodes[node.index].hovered = false;
		$rootScope.$broadcast("new hover", "");
	}

	function getHoveredConnections() {

		var hovered = nodes.filter(function(d) {
			return d.hovered;
		}).map(function(d) {
			return d.name;
		})[0];

		var connections = _.uniq(links.filter(function(d) {
			return d.source.name == hovered || d.target.name == hovered;
		}).map(function(d) {
			return (d.source.name + d.target.name).replace(hovered,"");
		}));

		return {
			name: hovered,
			connections: connections
		};

	}

}]);
