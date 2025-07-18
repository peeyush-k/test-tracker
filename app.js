// app.js - Main server file
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Test = require('./models/Test');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5000', // Or your frontend origin
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static('public')); // Serve static files

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// API Routes
app.post('/api/tests', async (req, res) => {
  try {
    const rawData = req.body;
    console.log('Received test data:', rawData); // Log incoming data

    // Validate required fields
    const requiredFields = ['date', 'testName', 'totalQuestions', 
                           'confidentAttempts', 'correctConfident',
                           'guessedAttempts', 'correctGuesses', 'unattempted'];
    
    const missingFields = requiredFields.filter(field => !(field in rawData));
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing fields: ${missingFields.join(', ')}` 
      });
    }

    // Validate numbers are non-negative
    const numberFields = ['totalQuestions', 'confidentAttempts', 'correctConfident',
                         'guessedAttempts', 'correctGuesses', 'unattempted'];
    
    const negativeFields = numberFields.filter(field => rawData[field] < 0);
    if (negativeFields.length > 0) {
      return res.status(400).json({ 
        error: `Negative values not allowed for: ${negativeFields.join(', ')}` 
      });
    }

    // Compute derived metrics
    const computedData = {
      confidentAccuracy: rawData.confidentAttempts > 0 
        ? (rawData.correctConfident / rawData.confidentAttempts) * 100 
        : 0,
      guessAccuracy: rawData.guessedAttempts > 0 
        ? (rawData.correctGuesses / rawData.guessedAttempts) * 100 
        : 0,
      totalCorrect: rawData.correctConfident + rawData.correctGuesses,
      totalIncorrect: (rawData.confidentAttempts - rawData.correctConfident) + 
                     (rawData.guessedAttempts - rawData.correctGuesses),
      netScore: (rawData.correctConfident * 2) + (rawData.correctGuesses * 2) - 
               ((rawData.confidentAttempts - rawData.correctConfident + 
                 rawData.guessedAttempts - rawData.correctGuesses) * (2/3)),
      attemptRate: ((rawData.confidentAttempts + rawData.guessedAttempts) / rawData.totalQuestions) * 100,
      overallAccuracy: (rawData.confidentAttempts + rawData.guessedAttempts) > 0 
        ? ((rawData.correctConfident + rawData.correctGuesses) / 
           (rawData.confidentAttempts + rawData.guessedAttempts)) * 100 
        : 0
    };

    const testEntry = new Test({...rawData, ...computedData});
    const savedTest = await testEntry.save();
    
    console.log('Test saved to MongoDB:', savedTest); // Log saved document
    
    res.status(201).json(savedTest);
  } catch (error) {
    console.error('Error saving test:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.get('/api/tests', async (req, res) => {
  try {
    const { startDate, endDate, theme, source } = req.query;
    const filters = {};
    
    if (startDate && endDate) {
      filters.date = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }
    if (theme) filters.theme = theme;
    if (source) filters.testSeriesSource = source;
    
    const tests = await Test.find(filters).sort({ date: -1 });
    res.json(tests);
  } catch (error) {
    console.error('Error fetching tests:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/insights', async (req, res) => {
  try {
    const { startDate, endDate, theme, source } = req.query;
    const filters = {};
    
    if (startDate && endDate) {
      filters.date = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    }
    if (theme) filters.theme = theme;
    if (source) filters.testSeriesSource = source;
    
    const tests = await Test.find(filters).sort({ date: 1 });
    
    if (tests.length === 0) {
      return res.json({
        summary: {
          totalTests: 0
        },
        themePerformance: {},
        bestTheme: null,
        worstTheme: null,
        accuracyTrend: [],
        scoreTrend: []
      });
    }
    
    // Calculate summary statistics
    const summary = {
      totalTests: tests.length,
      avgAccuracy: tests.reduce((sum, test) => sum + test.overallAccuracy, 0) / tests.length,
      avgNetScore: tests.reduce((sum, test) => sum + test.netScore, 0) / tests.length,
      avgAttemptRate: tests.reduce((sum, test) => sum + test.attemptRate, 0) / tests.length,
      avgConfidentAccuracy: tests.reduce((sum, test) => sum + test.confidentAccuracy, 0) / tests.length,
      avgGuessAccuracy: tests.reduce((sum, test) => sum + test.guessAccuracy, 0) / tests.length
    };
    
    // Theme performance analysis
    const themePerformance = {};
    tests.forEach(test => {
      if (!themePerformance[test.theme]) {
        themePerformance[test.theme] = { total: 0, correct: 0, count: 0 };
      }
      themePerformance[test.theme].total += test.totalCorrect + test.totalIncorrect;
      themePerformance[test.theme].correct += test.totalCorrect;
      themePerformance[test.theme].count++;
    });
    
    // Calculate accuracy for each theme
    const themeAccuracy = {};
    Object.keys(themePerformance).forEach(theme => {
      const { total, correct, count } = themePerformance[theme];
      themeAccuracy[theme] = {
        accuracy: (correct / total) * 100,
        avgNetScore: correct * 2 - (total - correct) * (2/3),
        testCount: count
      };
    });
    
    // Find best/worst performing themes
    const sortedThemes = Object.entries(themeAccuracy)
      .sort((a, b) => b[1].accuracy - a[1].accuracy);
    
    const insights = {
      summary,
      themePerformance: themeAccuracy,
      bestTheme: sortedThemes.length > 0 ? sortedThemes[0] : null,
      worstTheme: sortedThemes.length > 0 ? sortedThemes[sortedThemes.length - 1] : null,
      accuracyTrend: tests.map(test => ({
        date: test.date,
        confidentAccuracy: test.confidentAccuracy,
        guessAccuracy: test.guessAccuracy,
        overallAccuracy: test.overallAccuracy
      })),
      scoreTrend: tests.map(test => ({
        date: test.date,
        netScore: test.netScore,
        totalCorrect: test.totalCorrect
      }))
    };
    
    res.json(insights);
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`Add Test Form: http://localhost:${PORT}/add-test.html`);
});

// Start keep-alive only in production
if (process.env.NODE_ENV === 'production') {
  require('./keepAlive');
}