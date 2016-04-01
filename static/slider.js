angular.module("App")
.directive("slider", ["$rootScope", function($rootScope){

	return {
    restrict: "A",
    scope: {
    	inputCurrent: "=",
    	index: "=", // index of this node
    	visible: "=",
    	commitChange: "&" // when a user stops dragging the slider
    },
    link: function(scope, element) {

    	scope.$watch("visible", function(visible, old) {
    		if (visible) drawSlider(xScale(scope.inputCurrent));
    	});

    	// d3 selection of canvas
    	var el = d3.select(element[0]);
    	// canvas 2d context
      var ctx = element[0].getContext('2d');

      // get css styles
      var width = element[0].getBoundingClientRect().width;
      var height = element[0].getBoundingClientRect().height;

      // resize canvas
      element[0].width = width;
      element[0].height = height;

      var xScale = d3.scale.linear()
	      .domain([0,1])
	      .range([10,width-10]);

      var mouseIsDown = false;

      // Event handlers
      el.on("click", function() {
      	d3.event.stopPropagation();
      })
			.on("mousedown", function(d) {
	      mouseIsDown = true;
	      update(d3.event);
	    })
	    .on("mousemove", function(d) {
	      if (mouseIsDown) {
	      	update(d3.event);
	      }
	    })
	    .on("mouseup", function(d) {
	      mouseIsDown = false;
	      // on mouseup, commit to whatever the new voltage is
	      scope.commitChange();
        // $rootScope.$broadcast("input changed", d);
	    })
	    .on("mouseleave", function() {
	      mouseIsDown = false;
	    });

	    function update(event) {
	    	var x = getX(event);
      	var inputCurrent = xScale.invert(x);
      	drawSlider(x);
      	scope.inputCurrent = Math.round(xScale.invert(x) * 100) / 100;
      	scope.$apply();
	    }

	    function getX(event) {
	      var x = event.offsetX;
	      x = x < xScale.range()[0] ? xScale.range()[0] : x;
	      x = x > xScale.range()[1] ? xScale.range()[1] : x;
	      return x;
	    }

	    function drawSlider(x) {
	    	ctx.clearRect(0,0,width,height);
	    	ctx.fillStyle = "white";
	    	ctx.fillRect(x-7.5,0,15,height);
	    }

    }
  }

}]);
