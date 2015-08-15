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
            $.get('widgets/' + widget.name + '/config.js')
            .done(function(downloaded) {
                bootstrapWidget(widget, downloaded);
            })
            .fail(function() {
                retryBootstrap(widget, this);
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