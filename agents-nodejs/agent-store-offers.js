/*
  agent-store-offers.js: Store Offers Agent
  Part of ema-demo - Emergent Microservice Architecture Demo

  Copyright (c) 2017 Hemi Trickey; released under the "MIT license". See the
  LICENSE file packaged with this software for details.

  This agent looks for user store visits and selects offers from the
  corresponding store ID.
 */

'use strict';

let ema = require('ema-lib/ema.js');
let vocab = require('ema-lib/vocab-common.js');

let storeData = require('ema-sim-data/stores.js');

const AGENT_NAME = 'StoreOffersAgent';

function getOfferFromDatabase(storeID) {
  let store = storeData.Stores[storeID];
  if (!store) {
    return null;
  }

  let offers = store.currentOffers;

  // and randomly pick one
  let idx = Math.trunc(Math.random() * offers.length);
  return offers[idx];
}

ema.agentMain(
  AGENT_NAME,
  (event, timestamp, postEvent) => {
    if (event.eventName === vocab.eventTypes.USER_VISITS_STORE) {
      let offer = getOfferFromDatabase(event[vocab.eventKeys.STORE_ID]);

      if (offer) {
        // optional third constructor parameter provides additional values
        let response = new ema.Event(vocab.eventTypes.OFFER, offer);

        // copy over the user session
        response[vocab.eventKeys.USER_SESSION_ID]
            = event[vocab.eventKeys.USER_SESSION_ID];

        postEvent(response);
      }
    }
  });



