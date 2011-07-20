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

// Goes with enlighten-api.js and enlighten-graph.js, and requires
// jquery and flot javascript libraries as well.

// The functions below act on these elements:
//
// apiKeyInput      text entry      - the user's API key
// systemSelect     popup           - a list of systems available for this API
// inner_image1     image           - API key correctness indicator image [1]
// done             button          - the button pressed after api entered & system chosen
// dataTime         text            - the timestamp for the most current data available
// stackLayout      stacklayout(?)  - a dual-view stack
// currentPower     text            - most recent power output
// dailyEnergy      text            - energy produced today
// weeklyEnergy     text            - energy produced this week
// monthlyEnergy    text            - energy produced this month
// lifetimeEnergy   text            - energy produced in array's lifetime
// systemStatus     text            - status - normal, warning, error
// graph            div             - <div> for flot graph

// [1] "inner_image1" is dashcode-generated, and I don't yet know how to
// change it.  sorry!

// The script also expects a few images to be available:
// Images/ok.png        - "good" green image, API key is ok
// Images/alert.png     - "bad" red image, API key is incorrect
// Images/blank.png     - blank image, same size as above

// A few functions here need to be spliced into your widget:
//
// showConfigView(event) - whatever gets you to your configuration view


/////////////////////////////////////////
// End introduction; code begins here. //
/////////////////////////////////////////


// Timer for automatic reloads of data
var fetchTimer;


// Callback for api text entry box element
// onblur, onchange, onkeyup
function apiKeyChanged(event) {

    // Do nothing for left/right arrow cursor movement
    if (event.keyCode == 37 || event.keyCode == 39)
        return;
    
    // It's a real change and we don't have systems for
    // this new api key, so hide the list.
    $('#systemSelect').hide();

    // If nothing is entered, no need for an alert or
    // anything else
    var apiKey = document.getElementById('apiKeyInput').value;
    if (apiKey.length <= 0) {
        $("#inner_image1").attr("src", "Images/blank.png");
        return;
    }
    
    // Only hexadecimal chars are valid for the api key;
    if (event.keyCode == 93) {
        // but "select" is ok, keep going
        ;
    } else if (event.keyCode < 48 || event.keyCode > 71) {
        $("#inner_image1").attr("src", "Images/alert.png");
        return;
    }

    // Only let 32-char API keys through for a query

    if (apiKey.length != 32) {
        $("#inner_image1").attr("src", "Images/alert.png");
        return;
    }
    
    // Seems valid, try it.
    fetchApiKeySystems();
}

// With apiKey, we can load the list of systems by issuing
// an API requst.
// The updateSystemsList callback will populate the actual list.
function fetchApiKeySystems() {

    $('#systemSelect').hide();
    
    var apiKey = document.getElementById('apiKeyInput').value;
    
    if (apiKey.length <= 0) {
        $("#inner_image1").attr("src", "Images/blank.png");
        ////showConfigView();
        return;
    }
    
    var apiRequest = new enphaseApiRequest();
    apiRequest.apiKey = apiKey;
    apiRequest.getSystems(updateSystemsList);
}

// Updates the popup of systems on the configuration view,
// and selects either the preferred systemID (if set),
// or the first one in the list.
function updateSystemsList(data) {

    // Dashcode images are a div containing an image; we have to
    // look at the html file to see what id the image actually
    // has.  Here it's "inner_image1".  Bleah.  Better way?
    if (!data) {
        $('#inner_image1').attr("src", "Images/alert.png");
        return;
    }
    
    $("#inner_image1").attr("src", "Images/ok.png");

    if (window.widget) {
        widget.setPreferenceForKey(document.getElementById('apiKeyInput').value,'apiKey');
    }

    var systemList = data.systems;

    var systemSelect = document.getElementById('systemSelect');
    var prefSystemID = 0;

	if (window.widget) {
		prefSystemID = widget.preferenceForKey('systemID');
	}

    // Remove all previous systems
    systemSelect.options.length = 0;

	for (var i = 0; i < systemList.length; i++) {
  
		var theSystem = systemList[i];
		
		var option = new Option;
		option.value = theSystem.system_id;
		option.text = theSystem.system_name + " - " + theSystem.city + ", " + theSystem.state;

        // Set the first one as selected; if we find our preference,
        // set it to that later.
        if ((i == 0) || (theSystem.system_id == prefSystemID)) {
			option.selected = true;
        }
		
		systemSelect.options.add(option);
	}

    document.getElementById('done').object.setEnabled(1);

    // Make the system list visible now that it's filled in.
    $('#systemSelect').show();

    if (!prefSystemID)
        systemIdChanged();

    // By now we should have the list filled in, and something selected.
}

// onchange callback for systemSelect element; get chosen system's data.
function systemIdChanged() {

	if (window.widget) {
        var systemID = document.getElementById('systemSelect').options[document.getElementById('systemSelect').selectedIndex].value;
		widget.setPreferenceForKey(systemID, 'systemID');
	}
    // call system summary updater
    getSystemData();
}

// Get all necessary data for this system.
// 3 API calls to get it all!  summary, alerts, and stats
function getSystemData() {

    window.clearTimeout(fetchTimer);

	var apiKey = document.getElementById('apiKeyInput').value;
    if (apiKey.length <= 0 ||
        document.getElementById('systemSelect').options.length == 0) {
        return;
    }

	var systemID = document.getElementById('systemSelect').options[document.getElementById('systemSelect').selectedIndex].value;

    getSystemSummary(apiKey, systemID);
    getSystemAlerts(apiKey, systemID);
    getSystemStats(apiKey, systemID);

    // Update again in 5 minutes.
    fetchTimer = window.setTimeout('getSystemData',1000 * 60 * 5);    
}


// API call to fetch system summary
function getSystemSummary(apiKey, systemID) {
    var apiRequest = new enphaseApiRequest();
    apiRequest.apiKey = apiKey;
    apiRequest.systemID = systemID;
    apiRequest.getSummary(updateSystemSummaryDisplay);
}

// Callback for getSystemSummary JSON request
// XXX ERS some of this (commented out) comes from stats instead,
// because it is more recent than the summary data
function updateSystemSummaryDisplay(summary) {

    //document.getElementById('currentPower').innerHTML   = toKGMW(summary.current_power);
    //document.getElementById('dailyEnergy').innerHTML    = toKGMWh(summary.energy_today);
    document.getElementById('weeklyEnergy').innerHTML   = toKGMWh(summary.energy_week);
    document.getElementById('monthlyEnergy').innerHTML  = toKGMWh(summary.energy_month);
    document.getElementById('lifetimeEnergy').innerHTML = toKGMWh(summary.energy_lifetime);
    
    // The date returned in summary is actually really coarse.  Oh well.
    //var date = new Date();
    //date.setISO8601(summary.summary_date);
    //document.getElementById('dataTime').innerHTML = date.toLocaleString();
}

// API call to fetch system alert status
function getSystemAlerts(apiKey, systemID) {
    var apiRequest = new enphaseApiRequest();

    apiRequest.apiKey = apiKey;
    apiRequest.systemID = systemID;
    apiRequest.getAlerts(updateSystemAlertsDisplay);
}

// Callback for getSystemAlerts JSON request
// Choose text, color, style, and URL for status message
// Would be nice to show alerts in the widget, I suppose,
// but there's only so much space!  We do make the alert
// text into a hyperlink to take us to Enlighten
function updateSystemAlertsDisplay(data) {

    // Well, what do we want to display...? let's
    // just choose Normal/Warning/Error and parse
    // that up the same as the systems/ API would
    // return.  the only thing we can't get from
    // this is "Expired..."

    var alerts = data.alerts;
    var statusText ="Normal";
    var statusColor = "Black";
    var statusDecoration = "";
    var statusHref = "";

    if (alerts.length) {
        var systemID = document.getElementById('systemSelect').options[document.getElementById('systemSelect').selectedIndex].value;
        statusDecoration = "underline";
        statusHref = "https://enlighten.enphaseenergy.com/systems/" + systemID + "/events";
    }

    for (var i = 0; i < alerts.length; i++) {
		var theAlert = alerts[i];

        if (theAlert.level == "high") {
            statusText = "Error";
            statusColor = "Red";
        } else {
            statusText = "Warning";
            statusColor = "Yellow";
        }
    }

    $("#systemStatus").css({ color: statusColor,
                            href: statusHref,
                            textDecoration: statusDecoration});

    $("#systemStatus").attr({ href: statusHref });


    document.getElementById('systemStatus').innerHTML = statusText;
}

// onClick callback for systemStatus element
// Open browser to see status issues
function systemStatusClick(event) {

    var statusUrl = $('#systemStatus').attr('href');

    if (statusUrl && statusUrl != "") {
        if (window.widget) {
            widget.openURL(getLocalizedString(statusUrl));
        }
    }
}


function getSystemStats(apiKey, systemID) {
    var apiRequest = new enphaseApiRequest();

    apiRequest.apiKey = apiKey;
    apiRequest.systemID = systemID;
    apiRequest.getStats(updateSystemStatsDisplay);
}

// Callback for getSystemStats JSON request
function updateSystemStatsDisplay(stats) {
    plotGraph(stats);
    updateCurrentData(stats);
}

// Using data from getSystemStats callback, update some
// textual elements on the text display
function updateCurrentData(stats) {

    var last = stats.intervals.length - 1;
    var statsCurrentPower = stats.intervals[last].powr;
    var statsDailyEnergy = sumStatsEnergy(stats);
    var date = new Date();
    date.setISO8601(stats.intervals[last].end_date);
    var statsDataTime = date.toLocaleString();

    document.getElementById('currentPower').innerHTML = toKGMW(statsCurrentPower);
    document.getElementById('dailyEnergy').innerHTML  = toKGMWh(statsDailyEnergy);
    document.getElementById('dataTime').innerHTML     = statsDataTime;
}

// onClick callback for the Enphase logo element
// Open browser to homepage
function enphaseLogoClick(event) {

    if (window.widget) {
        widget.openURL(getLocalizedString("http://www.enphaseenergy.com"));
    }
}
