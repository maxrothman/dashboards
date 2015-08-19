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
            retry({
                'initialDelay': config.startBoostrapRetryDelay,
                'maxDelay': config.maxBootstrapRetryDelay,
                'giveupDelay': config.boostrapGiveupDelay,
                'backoff': 2
                //,'logLevel': 1
            },
                $.get('widgets/' + widget.name + '/config.js')
            )
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
    widget.el.attributes.forEach(function(atr) { widget[atr.name] = atr.value; });

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


/*
New approach: wrapper function that supports
$.ajax args and returns deferred with extra "run" method, <-- why is this necessary? omit!
so execution can be controlled separately.
How to deal with options?
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
            dfd.reject(arguments);
            return;
        } else if (currentInterval * backoff >= maxDelay) {
            currentInterval = maxDelay;
        } else {
            currentInterval *= backoff;
        }

        makeAjax();
    }

    function makeAjax() {
        $.ajax(ajaxArgs)
        .done(function() {
            dfd.resolve.apply(this, arguments);
        })
        .fail(function() {
            setTimeout(retry, currentInterval)
        });
    }
}


/*
Retry wrapped XHR using a truncated exponential backoff.
Returns a jQuery deferred object.

Usage: retry(options, xhr).done(doneFunction).fail(failFunction)...
Args:
    - options: an object with any of the following options
        initialDelay: how long to wait before the first retry (default: 100ms)
        maxDelay: maximum delay between retries (default: 1m)
        giveupDelay: fail if the total time exceeds this (default: 5m)
        backoff: exponential backoff factor. 0 means no backoff (default: 2)
        logLevel: 0-4, maps to DEBUG, INFO, WARNING, ERROR respectively (default: 4)
    - xhr: the XHR object to retry
*/
function retry(options, xhr) {
    var maxDelay = options.maxDelay || 60000;
    var giveupDelay = options.giveupDelay || 300000;
    var backoff = options.backoff === undefined ? 2 : options.backoff;
    var logLevel = options.logLevel || 4;
    var currentInterval || options.initialDelay || 100;

    function innerRetry(currentInterval, deferred, arguments) {
        var nextInterval = currentInterval;

        if (currentInterval >= giveupDelay) {
            deferred.reject(arguments);
            return;
        } else if (currentInterval * 2 >= maxDelay) {
            nextInterval = maxDelay;
        } else {
            nextInterval *= backoff;
        }

        setTimeout(TODOthing, nextInterval);
    }

    //this deferred has the user's callbacks, not the actual ajax one
    var newDeferred = new $.Deferred();

    //if all's well, resolve the wrapper deferred, passing arguments through
    xhr.done(function() {
        newDeferred.resolve.apply(this, arguments);
    });
    //otherwise, retry
    xhr.fail(function() {
        setTimeout(function(){ innerRetry(currentInterval); }, currentInterval);
    });

    /*
    1. if xhr.done, resolve wrapper deferred
    2. if xhr.fail:
        1. decide on the next interval
        2. make a copy of the xhr including callbacks
        3. trigger new xhr at next interval

    But! If we can cancel and copy the request,
    1. cancel the request and make a reference to it (abort, copy?)
    2. spawn retries as copies

    Can't copy, but could proxy: take options, spawn as needed.
    They attach handlers to the deferred returned by the proxy.
    */






        if (thisArg.timeoutInterval*2 >= config.maxBootstrapRetryDelay) {
            thisArg.timeoutInterval = config.maxBootstrapRetryDelay;
        } else {
            thisArg.timeoutInterval *= 2;
        }

        //if it's taken too long and the give-up delay is set, give up
        if (config.boostrapGiveupDelay) {
            if (thisArg.totalTime === undefined) {
                thisArg.totalTime = 0;
            }
            if (thisArg.totalTime + thisArg.timeoutInterval > config.boostrapGiveupDelay) {
                console.log('Failed to download ' + thisArg.url + ' for more than ' +
                    config.boostrapGiveupDelay/1000 + 's. Giving up');
                return;
            } else {
                thisArg.totalTime += thisArg.timeoutInterval;
            }
        } 
    });
}








/*  
Retry failed bootstrap requests with a truncated exponential binary backoff
Args:
  - widget: widget object, passed to bootstrapWidget
  - thisArg: `this` of actual fail callback (needed to retry)
Config:
  - startBoostrapRetryDelay: initial retry delay
  - maxBootstrapRetryDelay: maximum retry delay
  - bootstrapGiveupDelay: maximum amount of time before halting retries.
    If falsy, never stops retrying.
*/
function retryBootstrap(widget, thisArg) {
    //start with config.startBoostrapRetryDelay,
    //double backoff every time until hitting config.maxBootstrapRetryDelay
    if (! thisArg.timeoutInterval) {
        thisArg.timeoutInterval = config.startBoostrapRetryDelay;
    } else if (thisArg.timeoutInterval*2 >= config.maxBootstrapRetryDelay) {
        thisArg.timeoutInterval = config.maxBootstrapRetryDelay;
    } else {
        thisArg.timeoutInterval *= 2;
    }

    //if it's taken too long and the give-up delay is set, give up
    if (config.boostrapGiveupDelay) {
        if (thisArg.totalTime === undefined) {
            thisArg.totalTime = 0;
        }
        if (thisArg.totalTime + thisArg.timeoutInterval > config.boostrapGiveupDelay) {
            console.log('Failed to download ' + thisArg.url + ' for more than ' +
                config.boostrapGiveupDelay/1000 + 's. Giving up');
            return;
        } else {
            thisArg.totalTime += thisArg.timeoutInterval;
        }
    }

    var makeAjax = function(thisArg) {
        return $.ajax(thisArg)
            .done(function(downloaded) { 
               bootstrapWidget(widget, downloaded);
            })
            .fail(function() {
                retryBootstrap(widget, this);
            });
    }

    console.log('Failed to download ' + thisArg.url + ', retrying in ' +
        thisArg.timeoutInterval/1000 + 's');
    window.setTimeout(makeAjax, thisArg.timeoutInterval, thisArg)
}

//---------------------------------------
function updateWidget(widget) {
    //TODO: memoize
    var dataResults = {};
    var promises = [];
    widget.data.forEach(function(file) {
        promises.push($.get('data/' + file + '.json'));
    });
    
    //If any of the files fail to download, don't update the widget
    $.when.apply(this, promises).done(function() {
        for (var i=0; i<arguments.length; i++) {
            var file = widgets.data[i];
            var data = arguments[i];
            dataResults[file] = JSON.parse(data);
        }
        widget.update(dataResults);
    });
}

function setCurrentDash(index) {
    //Set the dashboard at `index` as visible and hide all others
}