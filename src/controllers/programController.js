const pool = require('../config/db');

// --- 1. Get all programs for the logged-in clinician's learners ---
exports.getPrograms = async (req, res) => {
  try {
    const clinicianId = req.user.id;
    const query = `
      SELECT p.id, p.title, p.target_type, p.is_active, 
             l.first_name || ' ' || l.last_name AS learner_name, l.id as learner_id
      FROM programs p
      JOIN learners l ON p.learner_id = l.id
      WHERE l.assigned_bcba_id = $1
      ORDER BY p.created_at DESC
    `;
    const result = await pool.query(query, [clinicianId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching programs:", err);
    res.status(500).json({ error: 'Server error fetching programs' });
  }
};

// --- 2. Create a new program (WITH SECURITY LOCK) ---
exports.createProgram = async (req, res) => {
  try {
    const clinicianId = req.user.id; // Get the ID from the secure HTTP-Only cookie
    const { learnerId, title, targetType } = req.body;

    // 🛡️ SECURITY CHECK: Verify the learner belongs to THIS clinician
    const learnerCheck = await pool.query(
      `SELECT first_name || ' ' || last_name AS learner_name 
       FROM learners 
       WHERE id = $1 AND assigned_bcba_id = $2`, 
      [learnerId, clinicianId]
    );

    // If the learner doesn't exist or belongs to someone else, reject the request!
    if (learnerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized. This client is not assigned to you.' });
    }

    // Insert the new target
    const insertQuery = `
      INSERT INTO programs (learner_id, title, target_type, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, title, target_type, is_active
    `;
    const result = await pool.query(insertQuery, [learnerId, title, targetType]);
    
    // Package it up perfectly for the React frontend
    const newProgram = { 
      ...result.rows[0], 
      learner_name: learnerCheck.rows[0].learner_name,
      learner_id: learnerId
    };

    res.status(201).json(newProgram);
  } catch (err) {
    console.error("Error creating program:", err);
    res.status(500).json({ error: 'Server error creating program' });
  }
};