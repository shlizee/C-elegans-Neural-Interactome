angular.module("App")
.directive("timeline", ["AnimationService", function(animation) {

	return {
		restrict: "A",
    link: function(scope, element) {

      scope.$watch(function() {
        return animation.animationTime();
      }, function(time) {
        scale.domain([time,time+1]);
        tick();
      });

      var container = d3.select(element[0]);

      var axisg = container.append("svg")
        .attr("class", "axis")
        .append("g");

      var label = axisg.append("text")
        .attr("transform", "translate(16,-8)")
        .style("font-weight","bold")
        .style("font-size","12px");

      var axis = d3.svg.axis().orient("bottom").ticks(10);

      var scale = d3.scale.linear()
        .domain([0,1]);

      function render() {

        var width = +container.style("width").replace("px","");
        var height = +container.style("height").replace("px","");

        scale.range([20, width-20]);

        d3.select(".axis")
          .attr("width", width)
          .attr('height', height);

        axisg.attr("transform", "translate(20," + (height - 30) + ")");

        tick();

      }

      function tick() {

        label.text("↓ " + (Math.round(animation.animationTime()*100)/100) + "s");

        axis.scale(scale);
        axisg.transition()
        .duration(animation.getAnimationDelay())
        .ease("linear")
        .call(axis);

        // d3.selectAll("circle").remove()

        // d3.selectAll(".tick")
        //   .insert("circle",":first-child")
        //   .attr("r", 12)
        //   .attr("cy", 12)

      }

      window.addEventListener("resize", render)

      render();

    }
	}

}]);