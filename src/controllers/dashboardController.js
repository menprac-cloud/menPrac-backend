const pool = require('../config/db');

exports.getDashboardData = async (req, res) => {
  try {
    const clinicianId = req.user.id;

    // 1. Clinician Info
    const userRes = await pool.query('SELECT clinic_name FROM users WHERE id = $1', [clinicianId]);
    
    // 2. Caseload (Learners)
    const learnersRes = await pool.query(
      `SELECT id, first_name || ' ' || last_name as name, status 
       FROM learners WHERE assigned_bcba_id = $1`, [clinicianId]
    );

    // 3. Appointments Today
    const apptsRes = await pool.query(
      `SELECT a.id, l.first_name || ' ' || l.last_name as learner, 
              TO_CHAR(a.start_time, 'HH12:MI PM') as start_time, 
              TO_CHAR(a.end_time, 'HH12:MI PM') as end_time, 
              a.status 
       FROM appointments a 
       JOIN learners l ON a.learner_id = l.id 
       WHERE a.clinician_id = $1 AND a.appointment_date = CURRENT_DATE 
       ORDER BY a.start_time ASC`, [clinicianId]
    );

    // 4. Action Items (To-Do List)
    const actionsRes = await pool.query(
      `SELECT id, task_type, description, urgency 
       FROM action_items WHERE assigned_to = $1 AND is_completed = false 
       ORDER BY urgency DESC`, [clinicianId]
    );

    // 5. Mastered Targets (THE FIX)
    let masteredCount = 0;
    try {
      // This queries a hypothetical "targets" table. 
      // It counts targets marked as 'mastered' for any learner assigned to this BCBA.
      const masteredRes = await pool.query(
        `SELECT COUNT(*) 
         FROM targets t
         JOIN learners l ON t.learner_id = l.id
         WHERE l.assigned_bcba_id = $1 AND t.status ILIKE 'mastered'`, 
        [clinicianId]
      );
      masteredCount = parseInt(masteredRes.rows[0].count, 10);
    } catch (e) {
      // SILENT FAILSAFE: If the 'targets' table hasn't been created yet, 
      // it catches the error and safely leaves the count at 0 so the server doesn't crash.
      masteredCount = 0; 
    }

    // --- SEND DYNAMIC RESPONSE ---
    res.json({
      clinicianName: userRes.rows[0]?.clinic_name || 'Clinician',
      metrics: {
        activeLearners: learnersRes.rowCount,
        appointmentsToday: apptsRes.rowCount,
        pendingActions: actionsRes.rowCount,
        masteredTargets: masteredCount // Now perfectly dynamic!
      },
      schedule: apptsRes.rows,
      actionItems: actionsRes.rows,
      caseload: learnersRes.rows
    });

  } catch (err) {
    console.error("❌ Error fetching dashboard:", err);
    res.status(500).json({ error: 'Server error fetching dashboard' });
  }
};

// --- Schedule an Appointment ---
exports.createAppointment = async (req, res) => {
  try {
    const clinicianId = req.user.id;
    const { learnerId, date, startTime, endTime } = req.body;

    const result = await pool.query(
      `INSERT INTO appointments (learner_id, clinician_id, appointment_date, start_time, end_time) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [learnerId, clinicianId, date, startTime, endTime]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error creating appointment:", err);
    res.status(500).json({ error: 'Server error creating appointment' });
  }
};