
'use strict';

let ema = require('ema-lib/ema.js');
let util = require('util');

ema.agentMain(
  'EventStreamWatcher',
  (event, timestamp /*, postEvent not used */) => {
    //ema.log(`${timestamp.toLocaleString()}: ${JSON.stringify(event)}`);
    let from = event.eventSource;
    let type = event.eventName;
    if (!from || !type) {
      ema.log(`warning: event missing mandatory fields: ${JSON.stringify(event)}`);
      return;
    }

    //ema.log(util.inspect(event, {colors: true}));
    ema.log(JSON.stringify(event));
  },
  (error) => {
    ema.log(`error: ${error}`);
  });


