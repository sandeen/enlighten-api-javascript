// Enphase Enlighten API helpers for widget/gadget use.
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

// Requires jquery


// Main helper to retrieve enlighten API data
// use, i.e.:
//    var apiRequest = new enphaseApiRequest();
//    apiRequest.apiKey = apiKey;
//    apiRequest.systemID = systemID;
//    apiRequest.getSummary(callbackFunction);


function enphaseApiRequest(apiKey, systemID, callback) {
        // Public Variables
        this.apiKey = apiKey;
        this.systemID = systemID;

        // Public Methods
        // Each takes a success callback as first param;
        // other params may be available for the API call, and come at the end.
        // XXX ERS should take failure callback too!
        this.getSystems = getSystems;
        this.getSummary = getSummary;
        this.getStats = getStats;
        this.getAlerts = getAlerts;
        this.getApiUrl = getApiUrl;

        // Private Variables
        
        // Basis for all URLS:
        var apiUrl = "http://api.enphaseenergy.com/api/systems/";
        // Private Methods
        function getApiUrl(apiUrl, apiKey, args, callback) {
                // Add the apiKey to the list of arguments
                $.extend(args, { key: apiKey });
                // The callback business here is a jquery special for JSONP,
                // needed for web apps, not so much for a widget.
                // see JSONP discussion at http://api.jquery.com/jQuery.getJSON/
                new jQuery.getJSON(apiUrl + "?callback=?",
                   args, callback);
                   
// XXX ERS should use ajax like this to get failure callbacks too
//$.ajax({
//    url: apiUrl + "&callback=?");,
//    dataType: 'json',
//    data: { key: apiKey },
//    success: function () { alert("success"); },
//    error: function (XMLHttpRequest, textStatus, errorThrown) { alert("death: " + textStatus); }
//});

        }

        // Define the public methods

        // Get a list of systems associated with this api key
        // Takes no arguments.
        
        function getSystems(callback) {
            var url = apiUrl;
            var args = {};
            getApiUrl (url, this.apiKey, args, callback);
        }

        // Get system summary
        //
        // summary_date is ISO8601 datetime+offset string for
        // start of period to report on.	
        
        function getSummary(callback, summary_date) {
            var url = apiUrl + this.systemID + "/summary";
            var args = { summary_date : summary_date };
            getApiUrl(url, this.apiKey, args, callback);
        }

        // Get system statistics
        //
        // start, and are ISO8601 datetime+offset strings
        // for period to report on.  Max 24h (not enforced
        // by this function)
        function getStats(callback, start, end) {
            var url = apiUrl + this.systemID + "/stats";
	    var args = { start: start, end: end };
            getApiUrl(url, this.apiKey, args, callback);
        }

        // Get system alerts
        // level a string representing the minimum level
        // of alerts to return:
        // "low" "medium" or "high"
        function getAlerts(callback, level) {
            var url = apiUrl + this.systemID + "/alerts";
	    var args = { level : level };
            getApiUrl(url, this.apiKey, args, callback);
        }

}

// Takes JSON data from the stats call & returns summed watthour production
function sumStatsEnergy(stats)
{
    var intervals = stats.intervals;
    var totalEnergy = 0;
    
    for (var i = 0; i < intervals.length; i++) {
        totalEnergy += intervals[i].enwh;
    }

    return totalEnergy.toFixed(2);
}

// Convert singular units to Kilo or Giga or Mega ...
function toKGM(value) {

    if (value > 1000000000) {
        num = value / 1000000000;
        return num.toPrecision(3) + ' G';
    } else if (value > 1000000) {
        num = value / 1000000;
        return num.toPrecision(3) + ' M';
    } else if (value > 1000) {
        num = value / 1000;
        return num.toPrecision(3) + ' K';
    } else {
        return value + ' ';
    }

}

// ... Watts (power)
function toKGMW(value) {
    return toKGM(value) + "W";
}

// ... Watt-Hours (energy)
function toKGMWh(value) {
    return toKGM(value) + "Wh";
}

// (very) rough estimate of total array capacity
function arrayCapacity(modules) {
    return modules * 200;
}

// The Enphase API expects and returns ISO8601 dates, i.e.
// "2011-04-01T00:00:00-05:00"

// For consistency, we store all timestamps in UTC, and convert
// back to the local time of the machine running this script.

// We could glean the *array's* timezone from the timestamp
// returned by enlighten, and always present array-local
// time... that'd take a little thought.  :)

// Convert an ISO8601 date string to a javascript date
// From http://delete.me.uk/2005/03/iso8601.html
Date.prototype.setISO8601 = function (string) {
    var regexp = "([0-9]{4})(-([0-9]{2})(-([0-9]{2})" +
        "(T([0-9]{2}):([0-9]{2})(:([0-9]{2})(\.([0-9]+))?)?" +
        "(Z|(([-+])([0-9]{2}):([0-9]{2})))?)?)?)?";
    var d = string.match(new RegExp(regexp));

    var offset = 0;
    var date = new Date(d[1], 0, 1);

    if (d[3])  { date.setMonth(d[3] - 1); }
    if (d[5])  { date.setDate(d[5]); }
    if (d[7])  { date.setHours(d[7]); }
    if (d[8])  { date.setMinutes(d[8]); }
    if (d[10]) { date.setSeconds(d[10]); }
    if (d[12]) { date.setMilliseconds(Number("0." + d[12]) * 1000); }
    if (d[14]) {
        offset = (Number(d[16]) * 60) + Number(d[17]);
        offset *= ((d[15] == '-') ? 1 : -1);
    }

    // Don't adjust for our TZ; keep it in UTC - ERS
    //offset -= date.getTimezoneOffset();
    time = (Number(date) + (offset * 60 * 1000));
    this.setTime(Number(time));
}

// And vice versa.  Only one format to accept so
// this function is simplified.
Date.prototype.toISO8601String = function (offset) {
    if (!offset) {
        var offset = 'Z';
        var date = this;
    } else {
        var d = offset.match(/([-+])([0-9]{2}):([0-9]{2})/);
        var offsetnum = (Number(d[2]) * 60) + Number(d[3]);
        offsetnum *= ((d[1] == '-') ? -1 : 1);
        var date = new Date(Number(Number(this) + (offsetnum * 60000)));
    }

    var zeropad = function (num) { return ((num < 10) ? '0' : '') + num; }

    var str = "";
    str += date.getUTCFullYear();
    str += "-" + zeropad(date.getUTCMonth() + 1);
    str += "-" + zeropad(date.getUTCDate());
    str += "T" + zeropad(date.getUTCHours()) +
           ":" + zeropad(date.getUTCMinutes());
    str += ":" + zeropad(date.getUTCSeconds());
    str += offset;
    
    return str;
}

