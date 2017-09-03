
let vocab = require('ema-lib/vocab-common.js');

let database = [
  { [vocab.eventKeys.OFFER_DESC]: 'Back-to-school: gym shorts and backpacks, 15% off',
    [vocab.eventKeys.OFFER_SCORE]: 10,
    [vocab.eventKeys.OFFER_CODE]: 'back1' },
  { [vocab.eventKeys.OFFER_DESC]: 'Any official licensed soccer jersey, 10% off',
    [vocab.eventKeys.OFFER_SCORE]: 8,
    [vocab.eventKeys.OFFER_CODE]: 'futbol1' },
];


function getOfferFromDatabase() {
  let idx = Math.trunc(Math.random() * database.length);
  return database[idx];
}

module.exports = {
  getOfferFromDatabase,
};

