const pool = require('../config/db');

// --- 1. Get all learners for the logged-in clinician ---
exports.getLearners = async (req, res) => {
  try {
    const clinicianId = req.user.id;
    const result = await pool.query(
      'SELECT id, first_name, last_name, dob, status FROM learners WHERE assigned_bcba_id = $1 ORDER BY created_at DESC',
      [clinicianId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching learners:", err);
    res.status(500).json({ error: 'Server error fetching learners' });
  }
};

// --- 2. Create a new learner ---
exports.createLearner = async (req, res) => {
  try {
    const clinicianId = req.user.id;
    const { firstName, lastName, dob } = req.body;

    const result = await pool.query(
      'INSERT INTO learners (first_name, last_name, dob, assigned_bcba_id) VALUES ($1, $2, $3, $4) RETURNING id, first_name, last_name, dob, status',
      [firstName, lastName, dob, clinicianId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating learner:", err);
    res.status(500).json({ error: 'Server error creating learner' });
  }
};

// --- 3. Get specific Learner Profile (Graph Data & AI Notes) ---
exports.getLearnerProfile = async (req, res) => {
  try {
    const learnerId = req.params.id;

    // A. Get Learner Info
    const learnerRes = await pool.query('SELECT * FROM learners WHERE id = $1', [learnerId]);
    if (learnerRes.rows.length === 0) return res.status(404).json({ error: 'Learner not found' });

    // B. Get Real AI Session Notes
    const sessionsRes = await pool.query(
      `SELECT id, TO_CHAR(start_time, 'Mon DD, YYYY - HH12:MIPM') as date, ai_summary_note as note 
       FROM sessions 
       WHERE learner_id = $1 AND status = 'Completed' 
       ORDER BY start_time DESC`, 
      [learnerId]
    );

    // C. Aggregate Real Trial Data for the Graph!
    // This groups clicks by Date and by Program Name
    const trialsRes = await pool.query(
      `SELECT 
         TO_CHAR(t.timestamp, 'Mon DD') as date, 
         p.title as program, 
         SUM(t.value) as total
       FROM trials t
       JOIN programs p ON t.program_id = p.id
       WHERE p.learner_id = $1
       GROUP BY TO_CHAR(t.timestamp, 'Mon DD'), p.title
       ORDER BY MIN(t.timestamp) ASC`,
      [learnerId]
    );

    // Format the trial data so Recharts can read it: [{ date: "Feb 22", Manding: 15, Tantrum: 2 }]
    const graphMap = {};
    trialsRes.rows.forEach(row => {
      if (!graphMap[row.date]) graphMap[row.date] = { date: row.date };
      graphMap[row.date][row.program] = Number(row.total);
    });

    res.json({
      learner: learnerRes.rows[0],
      sessions: sessionsRes.rows,
      graphData: Object.values(graphMap) // Converts map to array
    });

  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
};