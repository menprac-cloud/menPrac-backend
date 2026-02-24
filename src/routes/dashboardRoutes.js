const express = require('express');
const router = express.Router();
const { getDashboardData, createAppointment } = require('../controllers/dashboardController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, getDashboardData);
router.post('/appointment', auth, createAppointment); // <-- NEW ROUTE

module.exports = router;