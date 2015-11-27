$(document).ready(function() {

  // Global dataset object
  var _dataset;
  var initD = [];

  namespace = '/test'; // change to an empty string to use the global namespace

  // the socket.io documentation recommends sending an explicit package upon connection
  // this is specially important when using the global namespace
  var socket = io.connect('http://' + document.domain + ':' + location.port + namespace);

  socket.on('connect', function() {});

  // event handler for server sent data
  // the data is displayed in the "Received" section of the page
  socket.on('my response', function(data) {
    _dataset = JSON.parse(data.data);

    // Set voltage to default, 0.2
    _dataset.nodes.forEach(function(d) {
      d.voltage = 0.2;
    });

    $.each(_dataset.nodes, function(i, d) {
      initD.push(d.degree);
    });
    addNodesToMenu(_dataset.nodes);
    initialize(_dataset);
    addNodesToMenu(_dataset.nodes);
    for (var i = 0; i < 150; i++) force.tick();
    force.stop();
  });

  var width = $("#vis").width();
  height = $("#vis").height();

  var ocol = d3.scale.ordinal()
    .domain([1, 2, 3])
    .range(["1f77b4", "ff7f0e", "9c9ede"])

  var force = d3.layout.force()
    .charge(-80)
    .linkDistance(100)
    .size([width, height]);

  var svg = d3.select("#vis").append("svg")
    .attr("width", width)
    .attr("height", height);

  var stopRun = true;

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
      .attr("class", "node")
      .attr("r", function(d) {
        return d.degree / 20 + 4;
      })
      .style("fill", function(d) {
        return ocol(d.group);
      })
      .on("mouseover", function(d, i) {
        d3.selectAll(".link")
          .attr("class", function(d1) {
            if (d1.source.ind === i || d1.target.ind === i) return "link highlighted";
            return "link hidden";
          })
      })
      .on("mouseout", function(d, i) {
        d3.selectAll(".link")
          .attr("class", "link");
      })
      .on("click", function(d, i) {
        selectNode(d, i);
      });
    // .call(force.drag);

    node.append("title")
      .text(function(d) {
        return d.name;
      });

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

      // force.start();
      // force.tick();

    });

    // ms

    var timesteps = [];
    var minBufferSize = 0;
    var framerate = 100;

    function update(arr) {

      for (var i = 0; i < graph.nodes.length; i++) {
        graph.nodes[i].voltage = arr[i]
      }

      svg.selectAll(".node")
        .data(graph.nodes)
        .transition()
        .duration(framerate)
        .attr("r", function(d) {
          return Math.round(15 * (Math.pow(d.voltage, 2) / (1 + Math.pow(d.voltage, 2))));
        });

    }

    socket.on('new data', function(data) {
      console.log("new data of length " + data.length);
      timesteps = timesteps.concat(data);
      var pause = timesteps.length > 30 ? 500 : 0
      setTimeout(function() {
        if (!stopRun) socket.emit("continue run");
      }, pause);

    });

    setInterval(run, framerate);

    function run() {
      var str = "Buffer: " + timesteps.length + " ";

      if (!stopRun && timesteps.length < 1) {
        str += "buffering";
        $(".vis-cover").show()
      } else {
        $(".vis-cover").hide()
      }

      $("#buffer").html(str);

      if (timesteps.length === 0) {
        minBufferSize = 10;
      } else if (timesteps.length > 10) {
        minBufferSize = 0;
      }

      if (timesteps.length > minBufferSize) {
        var timestep = timesteps.shift();
        update(timestep);
      }
    }

  }


  function selectNode(d, i) {

    var node, li;

    var nodes = d3.selectAll(".node")[0];
    var lis = d3.selectAll(".node-li")[0];

    socket.emit("update", d.ind)

    nodes.forEach(function(n) {
      n = d3.select(n);
      if (n.datum().ind === d.ind) node = n;
    })

    lis.forEach(function(n) {
      n = d3.select(n);
      if (n.datum().ind === d.ind) li = n;
    })

    var nodeClass = node.attr("class");
    var liClass = li.attr("class");

    if (nodeClass.indexOf("selected") > -1) {
      node.attr("class", "node");
      li.attr("class", "node-li g" + d.group);
      li.select(".slider-wrapper")
        .remove();
      li.select(".voltage-label")
        .remove();
      
    } else {
      node.attr("class", "node selected");
      li.attr("class", "node-li selected g" + d.group);
      addSlider(li, i);  
    }

  }

  function addNodesToMenu(nodes) {

    var test = d3.nest()
      .key(function(d) {
        return d.group;
      })
      .entries(nodes);

    var groupList = d3.select(".node-list-wrapper")
      .selectAll(".node-ul")
      .data(test)
      .enter()
      .append("ul")
      .attr("class", "node-ul");

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
      .on("click", selectNode);

  }

  function start() {
    stopRun = false;
    force.stop();
    socket.emit("startRun", 0.01, 1e-3);
  }

  function stop() {
    stopRun = true;
    socket.emit("stop");
  }

  function reset() {
    timesteps = [];
    update(initD);
  }

  $("#start").click(start);
  $("#reset").click(reset);
  $("#stop").click(stop);






  function addSlider(li, i) {

    var voltageLabel = li.append("span")
      .attr("class", "voltage-label")
      .html(function(d) {
        return Math.round(d.voltage * 100) + "k";
      });

    var width = li.node().getBoundingClientRect().width - 7;
    var height = 20;

    var xScale = d3.scale.linear()
      .domain([0,1])
      .range([5,width-5])

    var wrapper = li.append("div")
      .attr("class", "slider-wrapper")
      .on("click", function(d) {
        d3.event.stopPropagation();
      });

    var slider = wrapper.append("svg")
      .attr("width", width)
      .attr("height", height)

      
    var bar = slider.append("rect")
      .attr("x", 0)
      .attr("y", height/2 - 2)
      .attr("width", width)
      .attr("height", 10)
      .attr("class", "slider-bar");

    var mouseIsDown = false;

    var rect = slider.append("rect")
      .attr("x", function(d) {
        return xScale(d.voltage);
      })
      .attr("y", height/2 - 2)
      .attr("width", 10)
      .attr("height", 10)
      .attr("class", "slider-rect")

    //////////////////////////////
    // Drag behavior for rectangle
    //////////////////////////////
    slider.on("mousedown", function(d) {
      mouseIsDown = true;
      var x = getX(d3.event);
      rect.attr("x", x -5);
      d.voltage = xScale.invert(x);
      setLabelText(d.voltage);
    })
    .on("mousemove", function(d) {
      var x = getX(d3.event);
      if (mouseIsDown) {
        rect.attr("x", x -5);
        d.voltage = xScale.invert(x);
        setLabelText(d.voltage);
      }
    })
    .on("mouseup", function(d) {
      mouseIsDown = false;
      var x = getX(d3.event);
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





});