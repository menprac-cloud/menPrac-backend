const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');

// --- 1. INITIALIZATION & FAILSAFE ---
if (!process.env.GEMINI_API_KEY) {
  console.error("🚨 CRITICAL: GEMINI_API_KEY is missing from your .env file!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateSessionNote = async (req, res) => {
  try {
    const { sessionId, sessionDuration, behaviors, skills } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required to generate a note." });
    }

    // --- 2. THE CLINICAL PROMPT ---
    const prompt = `
      You are an expert Board Certified Behavior Analyst (BCBA). 
      Write a highly professional, objective, and insurance-compliant clinical SOAP note for an ABA therapy session. 
      CRITICAL RULE: Do not invent a name. Always refer to the patient strictly as "the client".
      
      Here is the raw data collected during the session:
      - Session Duration: ${sessionDuration} minutes
      - Behaviors Tracked (Frequency/Duration): ${JSON.stringify(behaviors)}
      - Skills/Targets Tracked (Success Rate): ${JSON.stringify(skills)}
      
      Please write a concise, 1-to-2 paragraph narrative summary detailing the client's performance, behavior interventions used, and overall progress. Keep the tone strictly medical and objective.
    `;

    // --- 3. GOOGLE GEMINI API CALL ---
    // UPDATED: Now using the active Gemini 2.5 Flash model!
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const aiGeneratedNote = result.response.text();

    // --- 4. SAVE TO DATABASE ---
    const updateRes = await pool.query(
      `UPDATE sessions SET ai_summary_note = $1, status = 'Completed' WHERE id = $2 RETURNING *`,
      [aiGeneratedNote, sessionId]
    );

    // --- 5. WEBSOCKET BROADCAST (LIVE INTELLIGENCE) ---
    const io = req.app.get('io');
    if (io) {
      io.emit('live_activity', {
        id: Date.now(),
        text: `🤖 AI successfully drafted a clinical note for session #${sessionId}.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    // --- 6. SEND SUCCESS TO FRONTEND ---
    res.status(200).json({ 
      message: "Note generated successfully", 
      note: aiGeneratedNote 
    });

  } catch (err) {
    console.error("❌ Gemini API Error Details:", err.message || err);
    res.status(500).json({ error: "Failed to generate AI session note. Please check your API key and model limits." });
  }
};