angular.module("App")
.directive("timeline", ["AnimationService", function(animation) {

	return {
		restrict: "A",
    link: function(scope, element) {

      var container, axisg, label;

      var width, height;
      var margin = 10;

      var frameHeight = 10;

      var frameWidth = 2;
      var nFrames;
      var framesPerRow;
      var nRows = 1;

      function Layout(frameHeight, frameWidth, margin) {

        var width;
        var height;
        var nFrames = 0;
        var nRows = 1;
        var framesPerRow = 1;

        this.setWidth = function(_width) {
          width = _width;
          var availableSpace = width - (margin * 2);
          framesPerRow = Math.floor(availableSpace / frameWidth);
          this.setFrames(nRows);
        }

        this.setHeight = function(_height) {
          height = _height
        }

        // Set how many frames are active, which detemines the layout
        this.setFrames = function(n) {
          nFrames = n;
          nRows = Math.ceil(nFrames / framesPerRow);
        }

        this.getWidth = function() {
          return frameWidth;
        }

        this.getHeight = function() {
          return frameHeight;
        }

        this.getX = function(i) {
          var prevRow = Math.floor(i / framesPerRow);
          var xFrame = i - (prevRow * framesPerRow) ;
          return margin + (xFrame * frameWidth)
        }

        this.getY = function(i) {
          var row = Math.ceil((i+1) / framesPerRow);
          return (row * (frameHeight + 1));
        }

        this.offset = function(){
          // console.log((nRows - 1) * (frameHeight + 1))
          return (nRows - 1) * (frameHeight + 1);
        }

      };

      var layout = new Layout(10, 2, 10);

      setTimeout(function() {

        container = d3.select(element[0]);

        axisg = container.select("svg").append("g");

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
            tick();
          });

        render();

      }, 0);
      

      // var axisg = container.append("svg")
      //   .attr("class", "axis")
      //   .append("g");

     

      var axis = d3.svg.axis().orient("bottom").ticks(10);

      var scale = d3.scale.linear()
        .domain([0,1]);

      function render() {

        if (!container) return;

        width = +container.style("width").replace("px","");
        height = +container.style("height").replace("px","");

        layout.setWidth(width);
        layout.setHeight(height);

        scale.range([20, width-20]);

        // d3.select(".axis")
        //   .attr("width", width)
        //   .attr('height', height);

        tick();

      }

      function tick() {



        var data = animation.getBufferSummary()

        layout.setFrames(data.length);

        axisg.attr("transform", "translate(0," + (height - 70 - layout.offset()) + ")");

        label.attr("x", layout.getX(animation.getFrameIndex()));

        var squares = axisg.selectAll(".frame-square")
          .data(data);

        squares
          .enter()
          .append("rect")
          .attr("height", layout.getHeight())
          .attr("width", layout.getWidth())
          .attr("x", function(d,i) {
            return layout.getX(i);
          })
          .attr("class", "frame-square")
          .on("mouseover", function(d,i) {
            label2.attr({
              x: d3.select(this).attr("x"),
              visibility: "visible"
            })
            .text((Math.round(i)/100) + "s");
          })
          .on("mouseout", function(d,i) {
            label2.attr({
              visibility: "hidden"
            });
          })
          
          // .on("mouseover", function(d,i) {
          //   d3.select(this).attr({
          //     y: 0,
          //     height: frameHeight + 4
          //   });
          // })
          // .on("mouseout", function(d,i) {
          //   d3.select(this).attr({
          //     y: 4,
          //     height: frameHeight
          //   });
          // })
          .on("click", function(d,i) {
            animation.setFrame(i);
          });
          

        // Add classes
        squares
          .attr("y", function(d,i) {
            return layout.getY(i);
          })
          .classed("active", function(d) {
            return d.active;
          })
          .classed("change", function(d) {
            return d.change;
          })
          .classed("transition", function(d) {
            return d.transition;
          });

        squares.exit()
          .remove();

        label.text((Math.round(animation.animationTime()*100)/100) + "s");

        // axis.scale(scale);
        // axisg.transition()
        // .duration(animation.getAnimationDelay())
        // .ease("linear")
        // .call(axis);

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