angular.module("App")
.directive("dynPlot", ["NetworkService", "AnimationService", function(network, animation) {

return {
    restrict: "A",
    link: function(scope, element) {

    var dps = []; // dataPoints
    var chart = new CanvasJS.Chart("chartContainer", {
        theme: "light2",
        title :{
            text: "Membrane Voltage"
        },

        axisX: {
            suffix: "s"
        },

        axisY: {
            suffix: "mV",
            includeZero: false

        },      
        data: [{
            type: "line",
            dataPoints: dps
        }]
    });

    var xVal = 0;
    var yVal = 0; 
    var updateInterval = 100;
    var dataLength = 500; // number of dataPoints visible at any point

    var updateChart = function (count) {
        count = count || 1;
        if (scope.hoveredConnections()){
        for (var j = 0; j < count; j++) {
            xVal = animation.getFrameIndex() / 100;
            yVal = scope.hoveredConnections().voltage;
            dps.push({
                x: xVal,
                y: yVal
            });
        }

        if (dps.length > dataLength) {
            dps.shift();
        }

        chart.render();
    }
    };

    updateChart(dataLength);
    setInterval(function(){updateChart()}, updateInterval);
    }
}
}]);