"use strict"

document.addEventListener("DOMContentLoaded", bootstrap);

function bootstrap() {
    dashboards = [];
    currentDash = 0;

    $.each(document.getElementsByTagName('dashboard'), function(_, dashEl) {
        var dash = {"el": dashEl, widgets: []};
        dashboards.push(dash);

        $.each(dash.el.getElementsByTagName('widget'), function(_, widgetEl) {
            var widget = {"el": widgetEl, "name": widget.getAttribute('name')}
            dash.widgets.push(widget);

            //download widget config object
            download('widgets/' + widget.name + '/config.js')
            .done(function(downloaded) {
                bootstrapWidget(widget, downloaded);
            });
        });
    });

    setCurrentDash(currentDash);

    window.setInterval(function() {
        setCurrentDash(currentDash < dashboards.length ? currentDash + 1 : 0);
    }, config.dashRotationInterval);
}

/*
Args:
    - widget: the widget to bootstrap
    - downloaded: the result of the XHR
*/
//TODO: retries on failed widget.bootstrap calls
function bootstrapWidget(widget, downloaded) {
    console.log('boostrapping ' + widget.name);
    //eval the object & merge it with the widget config
    $.extend(widget, eval(downloaded));

    //add in properties defined in dash. Will override any conflicting properties.
    $.each(widget.el.attributes, function(_, atr) { widget[atr.name] = atr.value; });

    //bootstrap defined in widget's config.js
    var promise = widget.bootstrap(widget.el);
    
    //If widget.bootstrap returns a promise, wait until it's done to update
    var update = function() {
        updateWidget(widget);
        window.setInterval(function() { updateWidget(widget); }, 
            widget.updateInterval || config.widgetUpdateInterval
        );
    }

    if (promise !== undefined) {
        //assume a jquery deferred object
        promise.done(update);
    } else {
        update();
    }
}

function updateWidget(widget) {
    //TODO: memoize for multiple requests for the same file in a single update pass (use a timeout?)
    //TODO: don't call widget.update when nothing has changed
    var dataResults = {};
    var promises = [];
    $.each(widget.data, function(_, file) {
        promises.push($.get('data/' + file + '.json'));
    });
    
    //If any of the files fail to download, don't update the widget
    $.when.apply(this, promises).done(function() {
        for (var i=0; i<arguments.length; i++) {
            var file = widget.data[i];
            var data = arguments[i];
            dataResults[file] = JSON.parse(data);
        }
        widget.update(dataResults);
    });
}

function setCurrentDash(index) {
    //Set the dashboard at `index` as visible and hide all others
}

/*
Wrapper around $.ajax that handles retries
Takes the same args as $.ajax and returns a similar deferred object.
*/
function download() {
    var ajaxArgs        = arguments;
    var maxDelay        = config.maxBootstrapRetryDelay;
    var giveupDelay     = config.bootstrapGivupDelay;
    var backoff         = config.bootstrapBackoffFactor;
    var logLevel        = config.logLevel;
    var currentInterval = config.startBoostrapRetryDelay;

    var dfd = new $.Deferred();
    makeAjax();
    return dfd;

    function retry() {
        if (giveupDelay && (currentInterval >= giveupDelay)) {
            dfd.reject.apply(this, arguments);
            return;
        } else if (currentInterval * backoff >= maxDelay) {
            currentInterval = maxDelay;
        } else {
            currentInterval *= backoff;
        }

        makeAjax();
    }

    function makeAjax() {
        $.ajax.apply(this, ajaxArgs)
        .done(function() {
            dfd.resolve.apply(this, arguments);
        })
        .fail(function() {
            setTimeout(retry, currentInterval)
        });
    }
}