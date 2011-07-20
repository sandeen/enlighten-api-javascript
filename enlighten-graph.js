// Enphase Enlighten API graphing routines for widget/gadget use.
//
// Copyright (c) 2011, Eric Sandeen
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// Requires the flot graphing library, 

// Using data from getSystemStats callback, plot the
// daily production graph

// Handle for the plot
var plot;

function plotGraph(stats) {
    
    var total_devices = stats.total_devices;
    var intervals = stats.intervals;
    
    // Options which define the layout of our graph
    var options = {
        grid: { hoverable: true },
        lines: { show: true },
        points: { show: false },
        xaxis: { mode: 'time', 
                 minTickSize: [2, "hour"],
                 timeformat: "%h%p",
                 twelveHourClock: true },
        yaxis: { tickFormatter: function (v) { return v.toFixed(1) + "kW"; },
                 minTickSize: 0.1 },
        y2axis: { tickFormatter: function (v) { return v.toFixed(1) + "kWh"; },
                  minTickSize: 0.1,
                  position: "right" },
        legend: { noColumns: 1, position: "nw", backgroundOpacity: 0 },
        }

    var power = [];
    var energy = [];
    var totalEnergy = 0;
    var date = new Date();


    // Push all data onto arrays for graphing
    for (var i = 0; i < intervals.length; i++) {

        var jDate;
        // Don't graph intervals where no devices have reported,
        // (i.e. nighttime) or where not -all- devices have yet reported.
        if (intervals[i].devices_reporting == total_devices) {
            date.setISO8601(intervals[i].end_date);
            // Date comes back in UTC; convert to local (or array?) time
            jDate = date.getTime() - date.getTimezoneOffset() * 60 * 1000;
            totalEnergy += intervals[i].enwh;
            power.push([jDate, intervals[i].powr/1000]);
            energy.push([jDate, totalEnergy/1000]);
        }
    }

    // And graph it.  Easy as pie!
    plot = $.plot($("#graph"),
           [ { label: "kWh", data: energy, color: "rgb(0, 99, 255)",  yaxis: 2, lines: { fill: true }},
             { label: "kW",  data: power,  color: "rgb(215, 89, 39)", yaxis: 1 },
           ],
           options);

    // Set up tooltip hover binding
    var previousPoint = null;
    $("#graph").bind("plothover", function (event, pos, item) {
        $("#x").text(pos.x.toFixed(2));
        $("#y").text(pos.y.toFixed(2));

        if (item) {
            if (previousPoint != item.dataIndex) {
                previousPoint = item.dataIndex;
                    
                $("#tooltip").remove();
                var x = item.datapoint[0],
                    y = item.datapoint[1].toFixed(2);
                var dataDate = new Date();
                dataDate.setTime(x + dataDate.getTimezoneOffset() * 60 * 1000);
                dataDateString = dataDate.toLocaleTimeString();
                showTooltip(item.pageX, item.pageY,
                            y + " " + item.series.label + "<br>" + dataDateString);
            }
        }
        else {
            $("#tooltip").remove();
            previousPoint = null;            
        }
    });

}

function redrawGraph() {
    // XXX ERS a bit of a hack here, force grid redraw on every toggle for now
    plot.setupGrid();
    plot.draw();
}

// Hover kW or kWh over the graph in a tooltip
function showTooltip(x, y, contents) {
    $('<div id="tooltip">' + contents + '</div>').css( {
        'font-size': '10px',
        'font-family': 'sans-serif',
        position: 'absolute',
        display: 'none',
        top: y - 15,
        left: x + 15,
        border: '1px solid rgb(175, 175, 175)',
        padding: '2px',
        'background-color': 'rgb(210, 210, 210)',
        opacity: 0.80
    }).appendTo("body").fadeIn(200);
}
