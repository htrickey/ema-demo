
let vocab = require('ema-lib/vocab-common.js');

let Stores = {
  store001: {
    storeName: "IL - Naperville - Downtown",
    currentOffers: [
      { [vocab.eventKeys.OFFER_DESC]: '$75 off any kayak or personal boat',
        [vocab.eventKeys.OFFER_SCORE]: 15,
        [vocab.eventKeys.OFFER_CODE]: 'kayak1' },
    ],
  },
  store002: {
    storeName: "IL - Chicago - Hyde Park",
    currentOffers: [
      { [vocab.eventKeys.OFFER_DESC]: '50% off all baseball gear',
        [vocab.eventKeys.OFFER_SCORE]: 15,
        [vocab.eventKeys.OFFER_CODE]: 'baseball1' },
    ],
  },
  store003: {
    storeName: "IL - Chicago - West Town",
    currentOffers: [
      // none for now
    ],
  },
};

let StoreIDs = Object.keys(Stores);

function randomStoreID() {
  return StoreIDs[Math.trunc(Math.random() * StoreIDs.length)];
}

module.exports = {
  Stores,
  StoreIDs,
  randomStoreID,
};


