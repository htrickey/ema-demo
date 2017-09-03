/*
  agent-user-profile-manager.js: User Profile Agent
  Part of ema-demo - Emergent Microservice Architecture Demo

  Copyright (c) 2017 Hemi Trickey; released under the "MIT license". See the
  LICENSE file packaged with this software for details.

  This agent looks for tags produced by other agents for a given user or user
  session and retains them in memory; it also looks for user logins or store
  visits, at which point it advertises the stored accumulated profiles.

  A real-world implementation of this would use a database rather than an
  in-memory hash.
 */

'use strict';

let ema = require('ema-lib/ema.js');
let vocab = require('ema-lib/vocab-common.js');

const AGENT_NAME = 'UserProfileManagerAgent';

// If a tag arrives without an expiration date, we add this (milliseconds
// wall-clock) to "now" to compute a default.
const DEFAULT_TAG_TTL_MS = 30000;

// My "database" of user profiles
let userProfiles = {
  /* example:
  userId, userSessionId: {
    userId: "userId"
    knownUserSessions: [ "userSessionId", ... ],
    knownTags: {
      tag1: { expires: <Date object> },
      ...
    },
    knownStoresVisited: [ "store", ... ],
  }
  */

};


function createNewProfile() {
  return {
    knownUserSessions: [ ],
    knownTags: { },
    knownStoresVisited: [ ],

    profileName() {
      return `${this.userId}/${this.knownUserSessions[0]}`;
    },
  };
}

function addToArray(array, value) {
  if (value !== undefined && !array.includes(value)) {
    array.push(value);
  }
}

function mergeProfiles(into, from) {
  if (from !== undefined) {
    Object.assign(into.knownTags, from.knownTags);
    from.knownStoresVisited.forEach(tag => addToArray(into.knownStoresVisited, tag));
  }
}

function findOrCreateProfile(userId, userSessionId) {
  // 1. find a profile under username or session, or create a new one
  let profile = undefined;
  if (userId !== undefined) {
    profile = userProfiles[userId];
  }
  if (profile === undefined && userSessionId !== undefined) {
    profile = userProfiles[userSessionId];
  }
  if (profile === undefined) {
    profile = createNewProfile();
  }

  // 2. ensure it's linked in to both
  if (userId !== undefined && userProfiles[userId] !== profile) {
    mergeProfiles(profile, userProfiles[userId]);
    userProfiles[userId] = profile;
  }
  if (userSessionId !== undefined && userProfiles[userSessionId] !== profile) {
    mergeProfiles(profile, userProfiles[userSessionId]);
    userProfiles[userSessionId] = profile;
  }
  
  // 3. ensure it's populated with user sessions and names
  if (userId !== undefined && profile.userId !== userId) {
    profile.userId = userId;
  }
  addToArray(profile.knownUserSessions, userSessionId);

  return profile;
}

function computeExpiration(suppliedExpiry) {
  if (typeof suppliedExpiry === 'string') {
    let d = Date.parse(suppliedExpiry);
    if (d > 0) {
      return new Date(d);
    }
  }
  return new Date(Date.now() + DEFAULT_TAG_TTL_MS);
}

function purgeExpiredTags() {
  let now = Date.now();
  for (let user in userProfiles) {
    let profile = userProfiles[user];
    for (let tag in profile.knownTags) {
      let tagEntry = profile.knownTags[tag];
      let exp = tagEntry.expires;
      if (exp instanceof Date) {
        if (exp.getTime() < now) {
          //ema.log(`*** expiring tag for ${user}: ${JSON.stringify(tagEntry)}`);
          delete profile.knownTags[tag];
        }
      }
    }
  }
}


ema.agentMain(
  AGENT_NAME,
  (event, timestamp, postEvent) => {
    // use each event as an excuse to clean up expired tags
    // in a real-world system, this would be done by some regular housekeeping
    // events
    purgeExpiredTags();

    // irrespective of event type, try to correlate user IDs and session IDs
    // if they have them, and get a profile ready for special handling below
    let userId = event[vocab.eventKeys.USER_ID];
    let userSessionId = event[vocab.eventKeys.USER_SESSION_ID];
    let profile = findOrCreateProfile(userId, userSessionId);
    if (profile === undefined) {
      return;
    }

    switch (event.eventName) {
    case vocab.eventTypes.USER_VISITS_STORE:
      {
        let storeId = event[vocab.eventKeys.STORE_ID];
        addToArray(profile.knownStoresVisited, storeId);
      }

      // FALL THROUGH, so we advertise as well...

    case vocab.eventTypes.USER_SESSION_START:
      {
        let e = new ema.Event(vocab.eventTypes.USER_SESSION_PROFILE);
        e[vocab.eventKeys.USER_ID] = profile.userId;
        e[vocab.eventKeys.USER_SESSION_ID] = userSessionId;
        e[vocab.eventKeys.USER_TAG_LIST]
            = profile.knownTags !== undefined
                ? Object.keys(profile.knownTags)
                : [];
        e[vocab.eventKeys.USER_STORE_LIST] = profile.knownStoresVisited;

        postEvent(e);
      }
      break;

    case vocab.eventTypes.USER_TAGGED:
      {
        let tag = event[vocab.eventKeys.USER_TAG];
        profile.knownTags[tag] = {
          expires: computeExpiration(event[vocab.eventKeys.TAG_EXPIRES]),
        };
      }
      break;
    }
  });




