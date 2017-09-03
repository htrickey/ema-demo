/*
  agent-national-offers.js: National Offers Agent
  Part of ema-demo - Emergent Microservice Architecture Demo

  Copyright (c) 2017 Hemi Trickey; released under the "MIT license". See the
  LICENSE file packaged with this software for details.

  This agent responds to new user sessions, e.g. from the Web, by posting
  offers for that user session based on a global database of offers. It does
  not care about user profiles or specific user activity. The assumption is
  that if the user deserves some better offer, that better offer will
  independently be posted and selected for them.
 */

'use strict';

let ema = require('ema-lib/ema.js');
let vocab = require('ema-lib/vocab-common.js');
let offers = require('ema-sim-data/national-offers.js');

const AGENT_NAME = 'NationalOffersAgent';

ema.agentMain(
  AGENT_NAME,
  (event, timestamp, postEvent) => {
    if (event.eventName === vocab.eventTypes.USER_SESSION_START) {
      let offer = offers.getOfferFromDatabase();

      // optional second constructor parameter provides additional values
      let response = new ema.Event(vocab.eventTypes.OFFER, offer);

      // copy over the user session
      response[vocab.eventKeys.USER_SESSION_ID]
          = event[vocab.eventKeys.USER_SESSION_ID];

      postEvent(response);
    }
  });



