const pool = require('../config/db');

// Get all other users in the clinic to chat with
exports.getContacts = async (req, res) => {
  try {
    const myId = req.user.id;
    const result = await pool.query(
      'SELECT id, clinic_name as name, role FROM users WHERE id != $1 ORDER BY clinic_name ASC',
      [myId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
};

// Get chat history between the logged-in user and a selected contact
exports.getMessages = async (req, res) => {
  try {
    const myId = req.user.id;
    const { contactId } = req.params;

    const result = await pool.query(
      `SELECT id, sender_id, receiver_id, content, TO_CHAR(sent_at, 'HH12:MI PM') as time 
       FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2) 
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY sent_at ASC`,
      [myId, contactId, myId, contactId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Save message to DB and broadcast via WebSockets
exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, content } = req.body;

    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, content) 
       VALUES ($1, $2, $3) 
       RETURNING id, sender_id, receiver_id, content, TO_CHAR(sent_at, 'HH12:MI PM') as time`,
      [senderId, receiverId, content]
    );

    const newMessage = result.rows[0];

    // REAL-TIME MAGIC: Emit the message directly to the receiver's private socket room
    const io = req.app.get('io');
    io.to(`user_${receiverId}`).emit('receive_message', newMessage);

    res.status(201).json(newMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};