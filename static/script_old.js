










  $(document).ready(function() {

  var DEBUG = window.location.search.indexOf("debug") > -1;

  if (!DEBUG) $("#buffer").hide();

  // Global dataset object
  var _dataset;
  var initDegree;

  namespace = '/test'; // change to an empty string to use the global namespace

  // the socket.io documentation recommends sending an explicit package upon connection
  // this is specially important when using the global namespace
  var socket = io.connect('http://' + document.domain + ':' + location.port + namespace);

  // socket.on('connect', function() {});

  // Returns whether or not the shift key is currently down
  var isShiftDown = (function() {

    var shiftDown = false;

    document.addEventListener('keydown', function (event) {
      if (event.keyCode == 16) shiftDown = true;
    });

    document.addEventListener('keyup', function (event) {
      if (event.keyCode == 16) shiftDown = false;
    });

    return function() {
      return shiftDown;
    }

  })();

  // event handler for server sent data
  // the data is displayed in the "Received" section of the page
  socket.on('data loaded', function(data) {
    _dataset = JSON.parse(data.data);

    // Set voltage to default, 0.2
    _dataset.nodes.forEach(function(d) {
      d.inputCurrent = 0.05;
    });

    initDegree = _dataset.nodes.map(function(d) {
      return d.degree;
    });
    addNodesToMenu(_dataset.nodes);
    initialize(_dataset);
    addNodesToMenu(_dataset.nodes);
    force.alpha(0.05); // how rapidly it changes when loaded
    force.tick(); // let it tick once so it adopts the positions
    window.setTimeout(force.stop, 2500); // stop after 2 seconds

    // TO GENERATE A NEW PERMANENT LAYOUT
    // comment out window.setTimeout(force.stop, 2000);
    // keep refreshing page until you see a layout you like
    // open up the console
    // paste in the follow command: 

    // JSON.stringify(
    //   d3.selectAll(".node").data().map(function(d) {
    //     delete d.px;
    //     delete d.py;
    //     delete d.weight;
    //     d.x = Math.round(+d.x);
    //     d.y = Math.round(+d.y);
    //     return d;
    //   })
    // );
    
    // in "chem.json" replace the node array with the output from the command above
    // uncomment the stop function

  });

  var width = $("#vis").width();
  var height = $("#vis").height();

  var ocol = d3.scale.ordinal()
    .domain([1, 2, 3])
    .range(["1f77b4", "ff7f0e", "9c9ede"]);

  var force = d3.layout.force()
    .charge(-170)
    .linkDistance(70)
    .size([width, height]);
    
  var timesvg = d3.select("#vis")
    .append("svg")
    .attr("class", "timesvg")
    .attr("width", width)
    .attr("height", height)
    .attr("pointer-events", "none");

  var outer = d3.select("#vis")
    .append("svg:svg")
    .attr("width", width)
    .attr("height", height)
    .attr("pointer-events", "all");
    
  var svg = outer
      .append('svg:g')
      .call(d3.behavior.zoom()
        .scaleExtent([0.8, 1.8])
        .on("zoom", rescale)
      )
      .on("dblclick.zoom", null)
      .append('svg:g');
      
  
  svg.append('svg:rect')
    .attr('width', width * 2)
    .attr('height', height * 2)
    .attr('x', -width/2)
    .attr('y', -height/2)
    .attr('fill', 'transparent');
      
  function rescale() {
    trans=d3.event.translate;
    scale=d3.event.scale;
    svg.attr("transform",
        "translate(" + trans + ")"
        + " scale(" + scale + ")");
  }


  // var svg = d3.select("#vis").append("svg")
  //   .attr("width", width)
  //   .attr("height", height);

  var timescale = d3.scale.linear().domain([0,1]).range([20,width-40]);
  var timeaxis = d3.svg.axis().scale(timescale);
  var timelabel = timesvg.append("svg:foreignObject")
    .attr("x", 25)
    .attr("y", height-50)
    .attr("width", 200)
    .text("↓ 0.0 seconds")
    .style("font-weight", "bold")
    .style("font-size", 12)

  var timebar = timesvg.append("g").call(timeaxis).attr("transform","translate(10," + (height-25) + ")")
    .attr("class", "x axis");

  var stopRun = true;
  var slowCountdown = 0; // How many frames are there left that should be
                         // renderered at a slower framerate
  var buffer = []; // The buffer of voltage arrays from python
  var framerate = 100;
  var visTime = 0; // The cumulative visualization time

  var animationFrame = false;

  function initialize(graph) {

    force
      .nodes(graph.nodes)
      .links(graph.links)
      .start();

    var link = svg.selectAll(".link")
      .data(graph.links)
      .enter().append("line")
      .attr("class", "link")
      .style("stroke-width", function(d) {
        return Math.sqrt(d.value);
      });

    var node = svg.selectAll(".node")
      .data(graph.nodes)
      .enter().append("circle")
      .attr("class", function(d) {
        return "node g" + d.group;
      })
      .attr("r", function(d) {
        return d.degree / 20 + 4;
      })
      // .style("fill", function(d) {
      //   return ocol(d.group);
      // })
      .on("mouseover", function(d, i) {
        onNodeHover(d);
        d3.selectAll(".link")
          .attr("class", function(d1) {
            if (d1.source.ind === i || d1.target.ind === i) {
              return "link highlighted";
            }
            return "link hidden";
          });
      })
      .on("mouseout", function(d, i) {
        onNodeHover(false);
        d3.selectAll(".link")
          .attr("class", "link");
      })
      .on("click", function(d, i) {
        toggleNode(d, i);
      });
    // .call(force.drag);


    force.on("tick", function() {
      link.attr("x1", function(d) {
          return d.source.x;
        })
        .attr("y1", function(d) {
          return d.source.y;
        })
        .attr("x2", function(d) {
          return d.target.x;
        })
        .attr("y2", function(d) {
          return d.target.y;
        });

      node.attr("cx", function(d) {
          return d.x;
        })
        .attr("cy", function(d) {
          return d.y;
        });

      $(".vis-cover").hide();

      // force.start();
      // force.tick();

    });

    // ms

    
    
    var interval;

    function update(arr, transitionDur) {

      for (var i = 0; i < graph.nodes.length; i++) {
        graph.nodes[i].voltage = arr[i]
      }

      svg.selectAll(".node")
        .data(graph.nodes)
        .transition()
        .duration(transitionDur)
        .attr("r", function(d) {
          return Math.round(15 * (Math.pow(d.voltage, 2) / (1 + Math.pow(d.voltage, 2))));
        });

    }

    function updateAxis(t, transitionDur) {

      timelabel.text("↓ " +  (Math.round(t*100) / 100).toFixed(2) + " seconds");

      timescale.domain([t,t+1]);
      timeaxis.scale(timescale);

      d3.select(".x.axis")
        .transition()
        .duration(transitionDur)
        .call(timeaxis);
    }

    window.addEventListener('resize', resize);

    // Event when window is resized
    function resize() {

    	// Get new width and height
    	width = $("#vis").width();
  		height = $("#vis").height();

  		// Resize SVGs
  		timesvg
  		.attr("width", width)
    	.attr("height", height);
    	outer
  		.attr("width", width)
    	.attr("height", height);

    	// Move time label to new bottom
    	timelabel
	    .attr("y", height-50)

	    // Rescale the time scale
			timescale.range([20,width-40]);
			timeaxis.scale(timescale);

			// Move time bar to new bottom
  		timebar.attr("transform","translate(10," + (height-25) + ")").call(timeaxis);

    }

    // When new data comes in...
    socket.on('new data', function(data) {
      
      if (!animationFrame) return;

      buffer = buffer.concat(data);
      var pause = buffer.length > 15 ? 700 : 0
      setTimeout(function() {
        if (animationFrame) socket.emit("continue run");
      }, pause);

    });

    function renderBuffer() {
      var str = "BUFFER = " + buffer.length + " ";

      if (animationFrame && buffer.length < 1) {
        str += "buffering";
        $(".vis-cover").show();
        $(".buffer-message").show();
      } else {
        $(".vis-cover").hide();
        $(".buffer-message").hide();
      }

      // Update the buffer with the current count
      $("#buffer").html(str);
    }

    function run() {
      
      renderBuffer();

      var slowdown = 0;

      if (buffer.length > 0) {

        slowdown = (slowCountdown < 1 || slowCountdown > 30) ? 0 : 150;
        if (slowCountdown > 0) slowCountdown = slowCountdown - 1;

        var timestep = buffer.shift();
        visTime = Math.round((visTime + 0.01)*100)/100;
        updateAxis(visTime, framerate + slowdown);

        update(timestep, framerate + slowdown);

      }

      // Run the next frame
      animationFrame = setTimeout(run, framerate + slowdown);

    }

    function start() {
      animationFrame = setTimeout(run, framerate);
      force.stop();
      socket.emit("startRun", 0.01, 1e-3);
    }

    function stop() {
      console.log("STOPPING");
      clearTimeout(animationFrame);
      animationFrame = false;
      socket.emit("stop");
      buffer = [];
      renderBuffer();
      visTime = 0;
      updateAxis(visTime, 0);
      setTimeout(function() {
        svg.selectAll(".node")
          .transition()
          .duration(1000)
          .attr("r", function(d) {
            return d.degree / 20 + 4;
          });
      }, 10);
      $(".vis-cover").hide();
    }

    function reset() {
      // deselect all nodes
      node.classed("selected",false);
      node.classed("deactivated",false);
      $(".node-li.selected").each(function() {
        removeSlider(d3.select(this));
      });
      $(".node-li").removeClass("selected").removeClass("deactivated");
      stop();
      // reset the input currents
      _dataset.nodes.forEach(function(d) {
        d.inputCurrent = 0.05;
      });
      socket.emit("reset");
    }


    $("#start").click(start);
    $("#stop").click(stop);
    $("#reset").click(reset);

  }

  // When a node or list item is clicked, the corresponding node
  // and list item are either selected or deselected. If the animation
  // is running, the slowCountdown will be set.
  function toggleNode(d, i) {

    // The node and list element selections
    var node, li;

    var nodes = d3.selectAll(".node")[0];
    var lis = d3.selectAll(".node-li")[0];

    // TODO move this DOWN
    
    if (animationFrame) slowCountdown = 20 + buffer.length;

    // Loop through and find the NODE by index
    nodes.forEach(function(n) {
      n = d3.select(n);
      if (n.datum().ind === d.ind) node = n;
    })

    // Loop through and find the LIST ITEM by index
    lis.forEach(function(n) {
      n = d3.select(n);
      if (n.datum().ind === d.ind) li = n;
    })

    // Current selection classes
    var nodeClass = node.attr("class");
    var liClass = li.attr("class");

    // Only select or deselect nodes if node isn't deactivated
    if (!isShiftDown()) {

    	if (nodeClass.indexOf("deactivated") > -1) return;

      // IF ELEMENT WILL NO LONGER BE SELECTED
      if (nodeClass.indexOf("selected") > -1) {

        node.classed("selected",false);
        li.classed("selected",false);
        d.inputCurrent = 0.05;
        socket.emit("update", d.ind, 0);
        // socket.emit("update", d.ind);
        removeSlider(li);

      } 

      // IF ELEMENT WILL NOW BE SELECTED
      else {

        node.classed("selected",true);
        li.classed("selected",true);
        socket.emit("update", d.ind, d.inputCurrent);
        // socket.emit("update", d.ind);
        addSlider(li);

      }

    // Only deactivate nodes if they aren't selected
    } else {

    	if (nodeClass.indexOf("selected") > -1) return;

      // IF NODE IS CURRENTLY DEACTIVATED
      if (nodeClass.indexOf("deactivated") > -1) {

        node.classed("deactivated",false);
        li.classed("deactivated",false);
        // console.log(d.ind)
        socket.emit("activate", d.ind);

      }

      // NODE WILL NOW BE DEACTIVATED
      else {

        node.classed("deactivated",true);
        li.classed("deactivated",true);
        socket.emit("deactivate", d.ind);

      }

    }


  }


  // Initialize the node menu with deselected nodes
  function addNodesToMenu(nodes) {

    // Nest nodes by group
    var nested = d3.nest()
      .key(function(d) {
        return d.group;
      })
      .entries(nodes);
     
     // Alphabetize each group divided list of nodes
     nested.forEach(function(level) {
       level.values.sort(function(a,b) {
         if (a.name < b.name) return -1;
         if (a.name > b.name) return 1;
         return 0;
       });
     });

    // Select the list wrapper and bind the nodes groupings
    // to unordered lists
    var groupList = d3.select(".node-list-wrapper")
      .selectAll(".node-ul")
      .data(nested)
      .enter()
      .append("ul")
      .attr("class", "node-ul");

    // For each grouping, bind the nodes to list items
    groupList.selectAll(".node-li")
      .data(function(d) {
        return d.values;
      })
      .enter()
      .append("li")
      .attr("class", function(d) {
        return "node-li g" + d.group;
      })
      .html(function(d) {
        return d.name;
      })
      .on("click", toggleNode);

  }




  // Remove the slider from a given element
  function removeSlider(ele) {
    ele.select(".slider-wrapper")
      .remove();
    ele.select(".voltage-label")
      .remove();
  }


  // Add a slider to the given element
  function addSlider(li) {

    var voltageLabel = li.append("span")
      .attr("class", "voltage-label")
      .html(function(d) {
        return Math.round(d.inputCurrent * 100) + "k";
      });

    var width = li.node().getBoundingClientRect().width - 7;
    var height = 20;

    var xScale = d3.scale.linear()
      .domain([0,1])
      .range([5,width-5]);

    var wrapper = li.append("div")
      .attr("class", "slider-wrapper")
      .on("click", function(d) {
        d3.event.stopPropagation();
      });

    var slider = wrapper.append("svg")
      .attr("width", width)
      .attr("height", height);

      
    var bar = slider.append("rect")
      .attr("x", 0)
      .attr("y", height/2 - 2)
      .attr("width", width)
      .attr("height", 10)
      .attr("class", "slider-bar");

    var mouseIsDown = false;

    var rect = slider.append("rect")
      .attr("x", function(d) {
        return xScale(d.inputCurrent);
      })
      .attr("y", height/2 - 4)
      .attr("width", 10)
      .attr("height", 16)
      .attr("class", "slider-rect")
      .attr("fill", "white")

    //////////////////////////////
    // Drag behavior for rectangle
    //////////////////////////////
    slider.on("mousedown", function(d) {
      mouseIsDown = true;
      var x = getX(d3.event);
      rect.attr("x", x -5);
      d.inputCurrent = xScale.invert(x);
      setLabelText(d.inputCurrent);
    })
    .on("mousemove", function(d) {
      var x = getX(d3.event);
      if (mouseIsDown) {
        rect.attr("x", x -5);
        d.inputCurrent = xScale.invert(x);
        setLabelText(d.inputCurrent);
      }
    })
    .on("mouseup", function(d) {
      mouseIsDown = false;
      var x = getX(d3.event);
      socket.emit("update", d.ind, d.inputCurrent);
      // socket.emit("update", d.ind);
      slowCountdown = 20 + buffer.length;
    })
    .on("mouseleave", function() {
      mouseIsDown = false;
    });

    function setLabelText(voltage) {
      voltageLabel.html(Math.round(voltage * 100) + "k");
    }

    function getX(event) {
      var x = event.offsetX;
      x = x < xScale.range()[0] ? xScale.range()[0] : x;
      x = x > xScale.range()[1] ? xScale.range()[1] : x;
      return x;
    }



  }


  function onNodeHover(d) {

    if (!d) {
      $("#hovered").empty();
      $("#hovered-connections").empty();
      return;
    }

    var name = d.name;
    $("#hovered").html(d.name);

    // get all connections
    var connections = [].concat.apply([],_dataset.links.filter(function(d) {
      return d.source.name === name || d.target.name === name;
    }).map(function(d) {
      return [d.source.name, d.target.name]
    })).filter(function(d) {
      return d !== name;
    });

    // Alphabetize the list
    connections = connections.sort(function(a,b) {
       if (a < b) return -1;
       if (a > b) return 1;
       return 0;
    });

    connections.forEach(function(c){
      $("#hovered-connections").append("<li>" + c + "</li>")
    })
  }




});
