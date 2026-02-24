const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const authMiddleware = require('../middleware/authMiddleware'); // Assuming you secure these!

// Start a new therapy session
router.post('/start', authMiddleware, sessionController.startSession);

// Get the specific programs assigned to a learner for the session
router.get('/programs/:learnerId', authMiddleware, sessionController.getSessionPrograms);

// Log a single data point (frequency click or duration timer)
router.post('/trial', authMiddleware, sessionController.logTrial);

// NOTE: The '/end' route is gone! 
// Ending a session is now handled by the AI Controller in server.js

module.exports = router;