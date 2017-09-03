/*
  ema.js - EMA core JavaScript library
  Part of the EMA (Emergent Microservice Architecture) Demo
  Copyright (c) 2017 Hemi Trickey

  Requires a recent version Node.js, plus the Amazon Web Services (AWS) SDK
  for JavaScript.

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
 */

let aws = require('aws-sdk');

// I only use a single-shard stream for this demo.
//
const KINESIS_STREAM_NAME = 'ema-event-stream';

// Shard iteration limits. Ideally these would be adaptive; for now,
// hand-tuned.
//
const ITEM_LIMIT_PER_READ = 100;
const DELAY_BETWEEN_READS_MEAN = 1100;
const DELAY_BETWEEN_READS_FUZZ = 600;
const DELAY_AFTER_RATE_EXCEEDED = 2000; // milliseconds after getting a RateExceeded

// My one global Kinesis connection. This is private global state for this
// module.
//
let kinesis = getKinesis();

// If this is set, postEvent() simply logs to console, and consumeEvents()
// yields no events.
//
let disableKinesis = process.argv.includes('--nokinesis');


//////////////////////////////////////////////////////////////////////////////
// Generic Kinesis API utilities

// Configure a Kinesis client connection.
//
function getKinesis() {
  let params = {
    apiVersion: '2013-12-02',
    region: 'us-east-2',
  };

  return new aws.Kinesis(params);
}

// Asynchronously queries a stream for its shard map, returning a Promise which
// resolves to a list of all shard IDs.
//
function getShardsForStream(streamName) {
  let params = {
    StreamName: streamName,
  };
  return kinesis.describeStream(params).promise()
    .then((data) => {
      let shards = [];
      data.StreamDescription.Shards.forEach((shard) => {
        if (shard.ParentShardId) {
          let i = shards.indexOf(shard.ParentShardId);
          if (i >= 0) {
            shards.splice(i, 1);
          }
        }
        shards.push(shard.ShardId);
      });

      if (data.StreamDescription.HasMoreShards) {
        // I don't handle this right now...
        log(`got ${shards.length} shards, but stream has more!`);
      }
      return shards;
    });
}

// Consume records from a single shard. Pass in the shard ID, and this
// establishes an iterator and starts consuming records asynchronously.
//
// For each record, eachRecord(recordData, recordTimestamp) is called.
// recordData is the deserialized record, but if it's JSON, it is not decoded.
//
// If there is an error, onError(err) is called.
//
function consumeShard(streamName, shardId, eachRecord, onError) {
  let getShardParams = {
    StreamName: streamName,
    ShardId: shardId,
    ShardIteratorType: 'LATEST',
  };

  //log(`starting consumer for ${streamName}::${shardId}`);

  kinesis.getShardIterator(getShardParams).promise()
    .then((result) => {
      consumeShardFromIterator(result.ShardIterator, eachRecord, onError);
    })
    .catch((err) => {
      if (typeof onError == 'function') {
        onError(err);
      }
    });
}

// Consume records from a single shard, starting at a given shard iterator.
// See consumeShard() for details.
//
function consumeShardFromIterator(shardIterator, eachRecord, onError) {
  let getRecordsParams = {
    ShardIterator: shardIterator,
    Limit: ITEM_LIMIT_PER_READ,
  };
  kinesis.getRecords(getRecordsParams, (err, result) => {
    if (err) {
      if (err.code == 'ProvisionedThroughputExceededException') {
        // slow down a bit and retry
        log('read rate exceeded; slowing down');
        setTimeout(() => consumeShardFromIterator(shardIterator, eachRecord, onError),
                   DELAY_AFTER_RATE_EXCEEDED);
        return;
      }
      if (typeof onError == 'function') {
        onError(err);
      }
      return;
    }
    result.Records.forEach((rec) => {
      let when = rec.ApproximateArrivalTimestamp;
      let data = rec.Data;
      eachRecord(data, when);
    });

    // throttle:
    setTimeout(() => consumeShardFromIterator(result.NextShardIterator, eachRecord, onError),
               DELAY_BETWEEN_READS_MEAN + DELAY_BETWEEN_READS_FUZZ * (Math.random() - 0.5));
  });
}

//////////////////////////////////////////////////////////////////////////////
// EMA Event utilities

// Event constructor. You will call this and then add any other desired
// properties.
//
function Event(eventName, additionalProperties) {
  this.eventName = eventName;
  if (typeof additionalProperties == 'object') {
    for (let key in additionalProperties) {
      if (!this[key]) {
        this[key] = additionalProperties[key];
      }
    }
  }
}

// Event parser. May throw an error.
//
Event.fromJSON = function(json) {
  let obj = JSON.parse(json);
  if (typeof obj != 'object') {
    throw new Error('JSON was not an event object');
  }
  if (!obj.eventName || !obj.eventSource) {
    throw new Error('JSON object did not include eventName or eventSource');
  }
  let e = new Event(obj.eventName);
  Object.assign(e, obj);
  return e;
};

Event.prototype.describe = function() {
  return `event '${this.eventName}' from '${this.eventSource}'`;
};


//////////////////////////////////////////////////////////////////////////////
// Event consumers and producers

// Posts an event to Kinesis asynchronously. Returns a Promise which resolves
// to the posted event on success, in case you need to chain.
//
function postEvent(event) {
  let data = JSON.stringify(event);

  if (disableKinesis) {
    //log(`Kinesis disabled: POST ${data}`);
    return Promise.resolve(event);
  }

  let partitionKey = event.userSessionId;
  if (partitionKey === undefined) {
    partitionKey = event.eventName;
  }

  let params = {
    StreamName: KINESIS_STREAM_NAME,
    PartitionKey: partitionKey,
    Data: data,
  };

  return kinesis.putRecord(params).promise()
    .then(() => { return event; });
}


// Starts an async event-consumer loop.  For each event, calls
// eachRecord(eventObject, timestamp); if an error does occur, calls
// onError(error).
//
function consumeEvents(eachRecord, onError) {
  if (disableKinesis) {
    log('Kinesis disabled; nothing to consume');
    return;
  }

  let filter = (data, timestamp) => {
    let obj;
    try {
      obj = Event.fromJSON(data);
    } catch (error) {
      log(`JSON parsing error; skipping record: ${error}`);
    }
    if (obj != undefined) {
      try {
        eachRecord(obj, timestamp);
      } catch (error) {
        onError(error);
      }
    }
  };

  getShardsForStream(KINESIS_STREAM_NAME)
    .then((shards) => {
      shards.forEach((shard) => {
        consumeShard(KINESIS_STREAM_NAME, shard, filter, onError);
      });
    });
}

//////////////////////////////////////////////////////////////////////////////
// High-level agent wrapper.

// "Agent main". Your agent should normally just initialize any required data
// and then call this.
// - agentName should be the name of your agent, as posted in events. Will
//   automatically be added to any event you post via postEvent().
// - eventCallback(event,timestamp,postEvent) gets called for each event on
//   the bus.  Exactly as the callback for consumeEvents(). Use the supplied
//   postEvent() call to post events back to the bus.
// - errorCallback, if defined, will be called with an Error object for any
//   error. Not required.
function agentMain(agentName, eventCallback, errorCallback) {
  if (process.argv.includes('--name')) {
    log(agentName);
    return;
  }

  setLogPrefix(agentName);

  let postEventWrapper = (event) => {
    event.eventSource = agentName;
    setLoggingUserContext(event.userId, event.userSessionId);
    postEvent(event);
  };

  consumeEvents(
    (event, timestamp) => {
      setLoggingUserContext(event.userId, event.userSessionId);
      eventCallback(event, timestamp, postEventWrapper);
      setLoggingUserContext(null, null);
    },
    (error) => {
      log('error: ' + error);
      if (typeof errorCallback == 'function') {
        errorCallback(error);
      }
      setLoggingUserContext(null, null);
    });
}

//////////////////////////////////////////////////////////////////////////////
// Use this instead of console.log

const CONSOLE_HIGHLIGHT = '\033[48;5;229m';
const CONSOLE_NORMAL = '\033[(B\033[m';
const CONSOLE_BOLD = '\033[1m';

let userToHighlight = process.env['EMA_HIGHLIGHT_USER'];
let sessToHighlight = process.env['EMA_HIGHLIGHT_SESSION'];

let logMessagePrefix = '';
let setMsgAttrs = '';
let clrMsgAttrs = '';

function log(msg) {
  // the message prefix may clear attributes so reset after it
  console.log(setMsgAttrs + logMessagePrefix + setMsgAttrs + msg + clrMsgAttrs);
}

function setLogPrefix(prefix) {
  if (typeof prefix === 'string') {
    logMessagePrefix = CONSOLE_BOLD + prefix + ': ' + CONSOLE_NORMAL;
  } else {
    logMessagePrefix = '';
  }
}

// Within agentMain callbacks, you never need to call this. When you set an
// interval timer to run outside that, however, you may. If so, remember to
// call it again after you're done to clear the context.
//
function setLoggingUserContext(userId, userSessionId) {
  if ((userToHighlight && userId === userToHighlight)
      || (sessToHighlight && userSessionId === sessToHighlight)) {
    highlightLogs(true);
  } else {
    highlightLogs(false);
  }
}

function highlightLogs(enable) {
  if (enable) {
    setMsgAttrs = CONSOLE_HIGHLIGHT;
    clrMsgAttrs = CONSOLE_NORMAL;
  } else {
    setMsgAttrs = '';
    clrMsgAttrs = '';
  }
}

//////////////////////////////////////////////////////////////////////////////
// Module exports

module.exports = {
  Event,
  postEvent,
  consumeEvents,
  agentMain,
  log,
  setLoggingUserContext,
};


