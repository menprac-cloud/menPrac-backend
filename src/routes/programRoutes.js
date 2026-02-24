const express = require('express');
const router = express.Router();
const { getPrograms, createProgram } = require('../controllers/programController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, getPrograms);
router.post('/', auth, createProgram);

module.exports = router;