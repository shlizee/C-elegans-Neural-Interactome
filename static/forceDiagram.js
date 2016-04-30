angular.module("App")
.directive("forceDiagram", ["NetworkService", "AnimationService", function(network, animation) {

	return {
		restrict: "A",
    link: function(scope, element) {

    	// get css styles
      var width, height;


    	var canvas = d3.select(element[0]).append("canvas");

    	// canvas 2d context
      var context = canvas
      	.node()
      	.getContext('2d');

      var svg = d3.select(element[0])
    		.append("svg");

    	var svgGroup = svg.append("g");

    	resize();


			var x = d3.scale.linear()
			    .domain([0, width])
			    .range([0, width]);

			var y = d3.scale.linear()
			    .domain([0, height])
			    .range([0, height]);

    	svg.call(d3.behavior.zoom().x(x).y(y).scaleExtent([0.25, 8]).on("zoom", tick));
    	
    	
    	// Keep track of this so we can easily trigger hover event for canvas
    	var hoveredNodeName = "";

      scaleCanvas();


      ////////////
      // SCALES
      ////////////


      window.addEventListener("resize", resize);

      resize();

      scope.$on("data loaded", function() {
      	initialize();
      });
      scope.$on("data updated", function() {
      	tickSVG();
      });
      scope.$on("new selection", function() {
      	tickSVG();
      });
      scope.$on("reset", function() {
        tickSVG();
      })
      scope.$on("new hover", function(event, name) {
      	hoveredNodeName = name;
      	tickCanvas();
      	tickSVG();
      });

      var force = d3.layout.force()
		    .charge(-170)
		    .linkDistance(70)
		    .size([width, height])
		    .nodes([])
		    .links([])
		    .on("tick", tick);


      function resize() {

	     	width = element[0].getBoundingClientRect().width;
	      height = element[0].getBoundingClientRect().height;

	      // resize canvas
	      canvas.attr("width", width);
	      canvas.attr("height", height);

	      svg.attr("width", width);
	      svg.attr("height", height);

	      tick();

      }

      function initialize() {

      	force
		      .nodes(network.nodes())
		      .links(network.links())
		      .start();

        setTimeout(force.stop, 4000);

      }

			function tick() {
				tickSVG();
				tickCanvas();
			}

			function tickSVG() {

        var hasStarted = animation.hasStarted();

				// console.log(network.nodes()[0])

		    var nodes = svgGroup.selectAll(".node")
		    	.data(network.nodes());

		    nodes.enter()
		    	.append("circle")
		    	.on("click", nodeClick)
		    	.on("mouseover", network.nodeHoverStart)
		    	.on("mouseout", network.nodeHoverEnd);

		   	nodes.attr("cx", function(d) {
          return x(d.x);
        })
        .attr("cy", function(d) {
          return y(d.y);
        })
        .attr("class", nodeClass)
        .transition()
        .duration(animation.getAnimationDelay())
        .ease("linear")
        .attr("r", function(d) {
          return hasStarted ? voltageScale(d) : degreeScale(d);
        });

			}

      function scaleCanvas() {

        var devicePixelRatio = window.devicePixelRatio || 1;
        var backingStoreRatio = context.webkitBackingStorePixelRatio ||
                            context.mozBackingStorePixelRatio ||
                            context.msBackingStorePixelRatio ||
                            context.oBackingStorePixelRatio ||
                            context.backingStorePixelRatio || 1;
        var pixelRatio = ratio = devicePixelRatio / backingStoreRatio;

        var oldWidth = canvas.width;
        var oldHeight = canvas.height;

        canvas.width = oldWidth * ratio;
        canvas.height = oldHeight * ratio;

        canvas.style.width = oldWidth + 'px';
        canvas.style.height = oldHeight + 'px';

      }


      function tickCanvas(hovered) {
      	
      	context.clearRect(0, 0, width, height);

		    // render NON HOVERED links
		    network.links().forEach(function(d) {
          drawLines(d, 0.5, "#CCC");
        });

		    // style for NON HOVERED links
		    network.links().filter(function(d) {
		    	return d.source.name == hoveredNodeName || d.target.name == hoveredNodeName;
		    }).forEach(function(d) {
          drawLines(d, 1, "#888");
        });

		    function drawLines(d, alpha, col) {
          context.globalAlpha = alpha;
          context.strokeStyle = col;
          context.lineWidth = Math.ceil(Math.pow(d.value, 0.3));
          context.beginPath();
		    	var cx1 = x(d.source.x);
		    	var cy1 = y(d.source.y);
		    	var cx2 = x(d.target.x);
		    	var cy2 = y(d.target.y);
		      context.moveTo(cx1, cy1);
		      context.lineTo(cx2, cy2);
          context.stroke();
		    }

      }

      
      // Initial scale for node radius based on degree
      function degreeScale(d) {
      	return d.degree / 20 + 4
      }

      // Run scale for node radius based on voltage
      function voltageScale(d) {
      	return Math.round(15 * (Math.pow(d.voltage, 2) / (1 + Math.pow(d.voltage, 2))));
      }

      // determine a nodes class based on its attributes
      function nodeClass(d) {
      	var base = "node g" + d.group;
      	if (d.selected) base += " selected";
      	if (!d.activated) base += " deactivated";
      	if (d.hovered) base += " hover";
        if (d.voltage < 0) base += " negative";
      	return base;
      }

      // When a node circle is clicked
      function nodeClick(d) {
				if (d3.event.shiftKey) {
					// don't call event if node is selected
					if (!d.selected) network.nodeShiftClick(d);
				} else {
					// only call event if node is activated
					if (d.activated) network.nodeClick(d);
				}
			}

    }
	}

}]);