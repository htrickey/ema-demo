
// Minimal set of core common events

// In the real world, there would be multiple vocabularies defined, along with
// a mechanism for distributed extensibility

exports.eventTypes = {
  USER_SESSION_START: 'userSessionBecomesActive',
  USER_NEAR_STORE: 'userNearStore',
  USER_VISITS_STORE: 'userVisitsStore',
  USER_TAGGED: 'userTag',
  USER_SESSION_PROFILE: 'userProfile',
  OFFER: 'offer',
};

exports.eventKeys = {
  USER_SESSION_ID: 'userSessionId',
  USER_ID: 'userId',
  USER_TAG: 'tag',
  USER_TAG_LIST: 'knownTags',
  USER_STORE_LIST: 'knownStoresVisited',
  STORE_ID: 'storeId',
  OFFER_DESC: 'offerDescription',
  OFFER_CODE: 'offerCode',
  OFFER_SCORE: 'offerScore',
  TAG_EXPIRES: 'expires',
};


