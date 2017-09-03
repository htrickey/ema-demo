/*
  agent-personalized-offers.js: Personalized Offers Agent
  Part of ema-demo - Emergent Microservice Architecture Demo

  Copyright (c) 2017 Hemi Trickey; released under the "MIT license". See the
  LICENSE file packaged with this software for details.

  This agent looks for user profiles and responds by selecting "personalized"
  offers based on the tags in those profiles.
 */

'use strict';

let ema = require('ema-lib/ema.js');
let vocab = require('ema-lib/vocab-common.js');

const AGENT_NAME = 'PersonalizedOffersAgent';

const personalizedOffers = [
  { forTags: ['isFrequentVisitor'],
    offer: {
      [vocab.eventKeys.OFFER_DESC]: '$100 off for being such a great customer!',
      [vocab.eventKeys.OFFER_SCORE]: 20,
      [vocab.eventKeys.OFFER_CODE]: 'frequent1'
    }
  },
];

ema.agentMain(
  AGENT_NAME,
  (event, timestamp, postEvent) => {
    if (event.eventName === vocab.eventTypes.USER_SESSION_PROFILE) {
      let userTags = event[vocab.eventKeys.USER_TAG_LIST];

      for (let offer of personalizedOffers) {
        let matches = true;
        for (let tag of offer.forTags) {
          if (!userTags.includes(tag)) {
            matches = false;
            break;
          }
        }

        if (matches) {
          let e = new ema.Event(vocab.eventTypes.OFFER, offer.offer);
          e[vocab.eventKeys.USER_SESSION_ID] = event[vocab.eventKeys.USER_SESSION_ID];
          e[vocab.eventKeys.USER_ID] = event[vocab.eventKeys.USER_ID];
          postEvent(e);
        }
      }
    }
  });



