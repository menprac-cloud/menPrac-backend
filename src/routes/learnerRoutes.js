const express = require('express');
const router = express.Router();
const { getLearners, createLearner } = require('../controllers/learnerController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, getLearners);
router.post('/', auth, createLearner);
// Add this line to backend/src/routes/learnerRoutes.js
router.get('/:id/profile', auth, require('../controllers/learnerController').getLearnerProfile);

module.exports = router;