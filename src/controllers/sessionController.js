const pool = require('../config/db');

// --- 1. Start a new session (WITH SECURITY LOCK) ---
exports.startSession = async (req, res) => {
  try {
    const clinicianId = req.user.id; // From secure HTTP-Only cookie
    const { learnerId } = req.body;

    // 🛡️ SECURITY: Verify clinician owns this learner
    const verify = await pool.query(
      'SELECT id FROM learners WHERE id = $1 AND assigned_bcba_id = $2', 
      [learnerId, clinicianId]
    );
    if (verify.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized. This client is not assigned to you.' });
    }

    // Start the session
    const result = await pool.query(
      'INSERT INTO sessions (learner_id, clinician_id, status) VALUES ($1, $2, $3) RETURNING id, start_time',
      [learnerId, clinicianId, 'In Progress']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error starting session:", err);
    res.status(500).json({ error: 'Server error starting session' });
  }
};

// --- 2. Get programs for a specific learner ---
exports.getSessionPrograms = async (req, res) => {
  try {
    const clinicianId = req.user.id;
    const { learnerId } = req.params;
    
    // 🛡️ SECURITY: Fetch Learner info ONLY if they belong to this clinician
    const learnerRes = await pool.query(
      'SELECT first_name, last_name FROM learners WHERE id = $1 AND assigned_bcba_id = $2', 
      [learnerId, clinicianId]
    );

    if (learnerRes.rows.length === 0) {
      return res.status(403).json({ error: 'Learner not found or unauthorized' });
    }

    // Fetch active programs
    const programsRes = await pool.query(
      'SELECT id, title, target_type FROM programs WHERE learner_id = $1 AND is_active = true', 
      [learnerId]
    );

    res.json({
      learner: learnerRes.rows[0],
      programs: programsRes.rows
    });
  } catch (err) {
    console.error("Error fetching session data:", err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- 3. Log a granular data point (Button Click / Timer) ---
exports.logTrial = async (req, res) => {
  try {
    const { sessionId, programId, value } = req.body; 

    // Insert the trial data with the newly added session_id column!
    const result = await pool.query(
      'INSERT INTO trials (session_id, program_id, value) VALUES ($1, $2, $3) RETURNING id, timestamp, value',
      [sessionId, programId, value]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error logging trial:", err);
    res.status(500).json({ error: 'Server error logging trial' });
  }
};

// Note: The old 'endSession' function has been safely deleted. 
// Session ending and note generation is now handled perfectly by aiController.js!