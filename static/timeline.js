angular.module("App")
.directive("timeline", ["AnimationService", function(animation) {

	return {
		restrict: "A",
    link: function(scope, element) {

      var container, axisg, label, bufferGroup, changesGroup, progressGroup;

      var hoverLabel, timeLabel;
      var timeLabel;

      var width, height;
      var margin = 10;

      var frameHeight = 10;

      var frameWidth = 10;
      var nFrames;
      var framesPerRow;
      var nRows = 1;

      var secondScale = d3.scale.linear()
        .domain([0,1]);

      setTimeout(function() {

        container = d3.select(element[0]);

        axisg = container.select("svg").append("g");
        bufferGroup = axisg.append("g");
        changesGroup = axisg.append("g");
        progressGroup = axisg.append("g");

        hoverLabel = axisg.append("text")
          .attr("class", "hover-label")
          .attr("text-anchor", "middle")
          .attr("y", -9);

        timeLabel = axisg.append("text")
          .attr("class", "time-label")
          .attr("text-anchor", "start")
          .attr("y", -30)
          .attr("x", 10);

        label = axisg.append("text")
          .attr("y", 2)
          .attr("x", 10)
          .style("font-weight","bold")
          .style("font-size","12px");

        label2 = axisg.append("text")
          .attr("y", 2)
          .attr("x", 10)
          .attr("visibility", "hidden")
          .style("font-weight","bold")
          .style("font-size","12px")
          .style("fill", "#BBB");

        scope.$watch(function() {
          return animation.getFrameIndex();
        }, function(time) {
          // scale.domain([time,time+1]);
          console.log(time);
          tick();
        });

        render();

      }, 0);


      var axis = d3.svg.axis().orient("top").ticks(10);


      var scale = d3.scale.linear()
        .domain([0,1]);

      function render() {

        if (!container) return;

        width = +container.style("width").replace("px","");
        height = +container.style("height").replace("px","");

        axisg.attr("transform", "translate(0," + (height - 20) + ")");

        secondScale.range([20, width-40]);
        axis.scale(secondScale);

        tick();

      }

      

      function tick() {

        var data = animation.getBufferSummary();

        // Comparing domains
        var d1 = secondScale.domain();

        // Update domain
        secondScale.domain([0,Math.max(Math.ceil((data.nFrames)/100),1)]);

        // Comparing domains
        var d2 = secondScale.domain();

        // Update axis scale
        axis.scale(secondScale);
        
        if (d1[0] !== d2[0] || d1[1] !== d2[1] || d2[1] === 1) {
          axisg.transition().duration(250).ease("linear").call(axis);
        }
        
        timeLabel.text(data.frame/100);
        // timeLabel.transition().duration(150).ease("linear").attr("x",secondScale(data.frame/100));

        var buffer = bufferGroup.selectAll(".buffer")
          .data([data]);

        buffer
          .enter().append("rect").attr("class","buffer")
          .attr("y", -1)
          .attr("height", 8)
          .attr("x", secondScale(0))
          .on("mousemove", function() {
            var frame = Math.floor(secondScale.invert(d3.event.offsetX) * 100);
            hoverLabel.text(frame/100);
            hoverLabel.attr("x",d3.event.offsetX)
            hoverLabel.attr("visibility", "visible")
            tracker.attr("width", d3.event.offsetX - 20)
          })
          .on("mouseout", function() {
            tracker.attr("width", 0)
            hoverLabel.attr("visibility", "hidden")
          })
          .on("click", function() {
            var frame = Math.floor(secondScale.invert(d3.event.offsetX) * 100);
            animation.setFrame(frame);
          })

        buffer
          .transition()
          .duration(150)
          .ease("linear")
          .attr("width", secondScale(data.nFrames/100) - secondScale(0))

        buffer.exit().remove();


        var changes = changesGroup.selectAll(".changes")
          .data(data.changes);

        changes
          .enter()
          .append("rect").attr("class", "changes")
          .attr("y", 8)
          .attr("height", 5)

        changes
          .attr("x", function(d) {
            return secondScale(d/100)
          })
          .attr("width", function(d) {
            return secondScale(d/100 + 0.15) - secondScale(d/100)
          })

        changes.exit().remove();
          
        var progress = progressGroup.selectAll(".progress")
          .data([data]);

        progress
          .enter().append("rect").attr("class","progress")
          .attr("y", -1)
          .attr("height", 8)
          .attr("x", secondScale(0));

        progress
          .transition()
          .duration(150)
          .ease("linear")
          .attr("width", secondScale((data.frame)/100) - secondScale(0));

        progress.exit().remove();



        var tracker = progressGroup.selectAll(".tracker")
          .data([data])

        tracker
          .enter().append("rect").attr("class","tracker")
          .attr("y", -1)
          .attr("height", 8)
          .attr("x", secondScale(0))
          .attr("width", 0);

        // console.log(data.changes)

      }

      window.addEventListener("resize", render)

      render();

    }
	}

}]);