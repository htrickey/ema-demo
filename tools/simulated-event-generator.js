
'use strict';

let ema = require('ema-lib/ema.js');
let vocab = require('ema-lib/vocab-common.js');

let StoreData = require('ema-sim-data/stores.js');

//////////////////////////////////////////////////////////////////////////////
// Simple User class

let usernum = 1;

// Create a user with the specified name and frequency of physical store
// visits and Web logins. Frequencies are expressed per 100 clocks. To create
// an anonymous user, simply pass undefined for the userId.
//
function User(name, sessionId, visitFrequency, loginFrequency) {
  this.userSessionId = sessionId;
  this.userId = name;
  this.userNumber = usernum++;

  this.targetFrequency = {
    visits: visitFrequency / 100.0,
    logins: loginFrequency / 100.0,
  };
  this.counts = {
    visits: 0,
    logins: 0,
  };
}

User.prototype.makeEvent = function(etype) {
  let e = undefined;

  switch (etype) {
  case 'visits':
    e = new ema.Event(vocab.eventTypes.USER_VISITS_STORE);
    e.eventSource = 'mobile';
    e[vocab.eventKeys.STORE_ID] = StoreData.randomStoreID();
    break;

  case 'logins':
    e = new ema.Event(vocab.eventTypes.USER_SESSION_START);
    e.eventSource = 'web';
    e[vocab.eventKeys.USER_ID] = this.userId;
    break;
  }

  if (e !== undefined) {
    e[vocab.eventKeys.USER_SESSION_ID] = this.userSessionId;
    this.counts[etype] += 1;
  }
  return e;
}

User.prototype.eventDue = function(clock) {
  if (clock < 1) {
    return undefined;
  }
  for (let etype of ['visits', 'logins']) {
    let currentFreq = this.counts[etype] / clock;
    let targetFreq = this.targetFrequency[etype];
    if (currentFreq < targetFreq && Math.random() < 0.3) {
      return this.makeEvent(etype);
    }
  }
}

//////////////////////////////////////////////////////////////////////////////
// My Simulated Users

let users = [
  //       User name  Session ID                              Visit freq  Login
  new User('Alice',   '47463f02-2ff9-4246-9b71-f9f9fb7d4908', 5,          5),
  new User('Bob',     '75726402-ba75-49b7-96f9-f6f0afca9fbc', 2,          30),
  new User('Charles', '8af95aa9-783a-4c1c-8b55-bad0801696dc', 30,         2),
  new User('Dan',     '86c9e014-f3aa-48ba-8301-d04da4652308', 40,         40),
];

//////////////////////////////////////////////////////////////////////////////
// Main logic

function errorHandler(err) {
  ema.log(`error: ${err}`);
}

// Called on a timer.
let clock = 0;
function generateEvents() {
  clock += 1;
  ema.log(`Simulation: Day ${clock}`);

  for (let user of users) {
    let e = user.eventDue(clock);
    if (typeof e === 'object') {
      ema.postEvent(e).catch(errorHandler);
    }
  }
}

ema.log('Starting simulation');
setImmediate(generateEvents);
setInterval(generateEvents, 8000);



