const pool = require('../config/db');

// Get the logged-in user's profile
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT id, clinic_name, email, role, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
};

// Update the user's profile
exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { clinicName, email } = req.body;

    const result = await pool.query(
      'UPDATE users SET clinic_name = $1, email = $2 WHERE id = $3 RETURNING id, clinic_name, email, role',
      [clinicName, email, userId]
    );

    res.json({ message: 'Profile updated successfully', user: result.rows[0] });
  } catch (err) {
    console.error("Error updating user profile:", err);
    res.status(500).json({ error: 'Server error updating profile' });
  }
};