const express = require('express');
const router = express.Router();
const { getContacts, getMessages, sendMessage } = require('../controllers/messageController');
const auth = require('../middleware/authMiddleware');

router.get('/contacts', auth, getContacts);
router.get('/:contactId', auth, getMessages);
router.post('/', auth, sendMessage);

module.exports = router;