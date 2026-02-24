// backend/src/config/initDB.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); 
const pool = require('./db');

const createTables = async () => {
  try {
    console.log('⏳ Initializing Aura ABA Database (Enterprise Edition)...');

    // --- CLEAN SLATE ---
    console.log('🧹 Clearing old/corrupted tables...');
    await pool.query(`
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS action_items CASCADE;
      DROP TABLE IF EXISTS appointments CASCADE;
      DROP TABLE IF EXISTS trials CASCADE;
      DROP TABLE IF EXISTS sessions CASCADE;
      DROP TABLE IF EXISTS programs CASCADE;
      DROP TABLE IF EXISTS learners CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // 1. USERS TABLE
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        clinic_name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'BCBA',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table ready.');

    // 2. LEARNERS TABLE
    await pool.query(`
      CREATE TABLE learners (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        dob DATE NOT NULL,
        assigned_bcba_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_learners_bcba ON learners(assigned_bcba_id);
    `);
    console.log('✅ Learners table ready.');

    // 3. PROGRAMS TABLE
    await pool.query(`
      CREATE TABLE programs (
        id SERIAL PRIMARY KEY,
        learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_programs_learner ON programs(learner_id);
    `);
    console.log('✅ Programs table ready.');

    // 4. SESSIONS TABLE
    await pool.query(`
      CREATE TABLE sessions (
        id SERIAL PRIMARY KEY,
        learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
        clinician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        start_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMPTZ,
        ai_summary_note TEXT,
        status VARCHAR(50) DEFAULT 'In Progress',
        CHECK (end_time IS NULL OR end_time >= start_time)
      );
      CREATE INDEX idx_sessions_learner ON sessions(learner_id);
      CREATE INDEX idx_sessions_clinician ON sessions(clinician_id);
    `);
    console.log('✅ Sessions table ready.');

    // 5. TRIALS TABLE (The High-Volume Table)
    await pool.query(`
      CREATE TABLE trials (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
        program_id INTEGER REFERENCES programs(id) ON DELETE CASCADE,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        value NUMERIC DEFAULT 1
      );
      CREATE INDEX idx_trials_session ON trials(session_id);
      CREATE INDEX idx_trials_program ON trials(program_id);
    `);
    console.log('✅ Trials table ready (Optimized for high-speed writes).');

    // 6. APPOINTMENTS TABLE (Scheduling)
    await pool.query(`
      CREATE TABLE appointments (
        id SERIAL PRIMARY KEY,
        learner_id INTEGER REFERENCES learners(id) ON DELETE CASCADE,
        clinician_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        appointment_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status VARCHAR(50) DEFAULT 'Scheduled',
        CHECK (end_time > start_time)
      );
      CREATE INDEX idx_appointments_clinician_date ON appointments(clinician_id, appointment_date);
    `);
    console.log('✅ Appointments table ready.');

    // 7. ACTION ITEMS TABLE (Task Management)
    await pool.query(`
      CREATE TABLE action_items (
        id SERIAL PRIMARY KEY,
        assigned_to INTEGER REFERENCES users(id) ON DELETE CASCADE,
        task_type VARCHAR(100) NOT NULL,
        description TEXT,
        urgency VARCHAR(50) DEFAULT 'Medium',
        is_completed BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_action_items_assigned ON action_items(assigned_to);
    `);
    console.log('✅ Action Items table ready.');

    // 8. MESSAGES TABLE (Communication)
    await pool.query(`
      CREATE TABLE messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_messages_receiver ON messages(receiver_id);
    `);
    console.log('✅ Messages table ready.');

    console.log('🎉 Database initialization complete! Enterprise constraints and indexes applied.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    process.exit(1);
  }
};

createTables();