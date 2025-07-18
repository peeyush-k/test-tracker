const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  testName: { type: String, required: true },
  theme: { type: String, enum: ['GS', 'Current Affairs', 'CSAT', 'Others'] },
  testSeriesSource: String,
  totalQuestions: { type: Number, required: true },
  confidentAttempts: { type: Number, required: true },
  correctConfident: { type: Number, required: true },
  guessedAttempts: { type: Number, required: true },
  correctGuesses: { type: Number, required: true },
  unattempted: { type: Number, required: true },
  confidentAccuracy: Number,
  guessAccuracy: {type: Number, default: -1},
  totalCorrect: Number,
  totalIncorrect: Number,
  netScore: Number,
  attemptRate: Number,
  overallAccuracy: Number
});


module.exports = mongoose.model('Test', testSchema);