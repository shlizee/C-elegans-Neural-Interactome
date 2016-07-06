// tracks the state of neuron nodes
angular.module("App")
.factory("NetworkService", ["SocketService", "$rootScope", "$timeout", function(socket, $rootScope, $timeout) {

	// data loaded flag so we don't do it again
	var dataLoaded = false;

	socket.on("data loaded", initialData);

	socket.on("file loaded", fileLoaded);

	var Factory = {};

	var nodes = [];
	var links = [];
	var nodeGroups = [];
	var initialDegrees = [];

	var _hovered;
	var _isHovered;

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
		calcHoveredConnections();
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

	function fileLoaded(json) {
		// nodes = JSON.parse(json);
		var loaded = JSON.parse(json);
		nodes.forEach(function(node) {
			node.activated = loaded[node.name].activated;
			node.selected = loaded[node.name].selected;
			node.inputCurrent = loaded[node.name].inputCurrent;
		});
		socket.emit("update", nodes.map(function(d) { return d.inputCurrent; }));
		socket.emit("modify connectome", nodes.map(function(d) { return d.activated; }));
		$rootScope.$broadcast("new selection");
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
			socket.emit("update", nodes.map(function(d) { return d.inputCurrent; }));
		});
		$rootScope.$broadcast("new selection");
	}

	function nodeSlide(current, index) {
		socket.emit("update", nodes.map(function(d) { return d.inputCurrent; }));
		$rootScope.$broadcast("new selection");
	}

	// $rootScope.$on("input changed", function(node) {
	// 	socket.emit("update", node.index, node.inputCurrent);
	// });

	function nodeShiftClick(node) {
		nodes[node.index].activated = !nodes[node.index].activated;
		socket.emit("modify connectome", nodes.map(function(d) { return d.activated; }));
		// nodes[node.index].activated ? socket.emit("activate", node.index) : socket.emit("deactivate", node.index);
		$rootScope.$broadcast("new selection");
	}

	function nodeHoverStart(node) {
		nodes[node.index].hovered = true;
		_isHovered = true;
		calcHoveredConnections();
		$rootScope.$broadcast("new hover", node.name);
	}

	function nodeHoverEnd(node) {
		nodes[node.index].hovered = false;
		_isHovered = false;
		calcHoveredConnections();
		$rootScope.$broadcast("new hover", "");
	}

	function calcHoveredConnections() {

		if (!_isHovered) {
			console.log("NO HOVER");
			_hovered = {};
			return;
		}

		var hovered = nodes.filter(function(d) {
			return d.hovered;
		})[0];

		if (!hovered) {
			_hovered = {};
			return;
		}

		var connections = _.uniq(links.filter(function(d) {
			return d.source.name == hovered.name || d.target.name == hovered.name;
		}).map(function(d) {
			test = [d.source, d.target].filter(function(d) {
				return d.name !== hovered.name;
			});
			return test[0];
		}));

		_hovered = {
			name: hovered.name,
			connections: connections,
			voltage: hovered.voltage
		};
	}

	function getHoveredConnections() {
		return _hovered;
	}

}]);
