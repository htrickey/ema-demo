/*
  agent-offer-collector.js: User Offer Collector
  Part of ema-demo - Emergent Microservice Architecture Demo

  Copyright (c) 2017 Hemi Trickey; released under the "MIT license". See the
  LICENSE file packaged with this software for details.

  This agent looks for offer events on the bus, collecting them on a
  per-user-session basis, and selecting the top few choices (based on
  self-advertised "offer score" ratings) to present to the user. In this
  version, the presented offers are simply written out via `console`.
 */

'use strict';

let ema = require('ema-lib/ema.js');
let vocab = require('ema-lib/vocab-common.js');

const AGENT_NAME = 'OfferCollectorAgent';

// Accumulate offers for a few seconds, so we make sure to get only the best
// one.
//
const MAX_OFFERS_PER_USER_PER_WINDOW = 1;
const COLLECTION_WINDOW_SECONDS = 5;

let pendingOffers = {
  // userSession: [ offer1, offer2, ... ]
};

function offerWindowExpired(userSession) {
  let offers = pendingOffers[userSession];
  delete pendingOffers[userSession];
  
  offers.sort((a, b) => {
    return a[vocab.eventKeys.OFFER_SCORE] - b[vocab.eventKeys.OFFER_SCORE];
  });

  if (offers.length > MAX_OFFERS_PER_USER_PER_WINDOW) {
    offers.length = MAX_OFFERS_PER_USER_PER_WINDOW;
  }

  ema.setLoggingUserContext(null, userSession);

  ema.log(`User session ${userSession} received these offers:`);
  offers.forEach(offer => {
    let desc = offer[vocab.eventKeys.OFFER_DESC];
    let code = offer[vocab.eventKeys.OFFER_CODE];
    ema.log(`  ${desc} (${code})`);
  });

  ema.setLoggingUserContext(null, null);
}

ema.agentMain(
  AGENT_NAME,
  (event /*, timestamp, postEvent not used */) => {
    if (event.eventName === vocab.eventTypes.OFFER) {
      let userSession = event[vocab.eventKeys.USER_SESSION_ID];
      if (!pendingOffers.hasOwnProperty(userSession)) {
        //ema.log(`offer for ${userSession}... waiting for more`);
        pendingOffers[userSession] = [event];
        setTimeout(() => offerWindowExpired(userSession),
                                            COLLECTION_WINDOW_SECONDS * 1000);

      } else {
        //ema.log(`got another offer for ${userSession}... waiting for more`);
        pendingOffers[userSession].push(event);
      }
    }
  });




