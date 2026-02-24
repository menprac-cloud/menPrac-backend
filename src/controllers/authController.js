const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// --- HELPER: SET SECURE COOKIE ---
const setTokenCookie = (res, user) => {
  // Failsafe: Ensure JWT_SECRET exists
  if (!process.env.JWT_SECRET) {
    console.error(
      "❌ CRITICAL ERROR: JWT_SECRET is missing from your .env file!",
    );
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );

  // 🚨 THE CRITICAL FIX: Cross-Domain Cookie Settings 🚨
  res.cookie("aura_token", token, {
    httpOnly: true, // Shields from XSS attacks
    secure: true, // MUST be true for cross-domain cookies over HTTPS
    sameSite: "none", // ALLOWS Vercel to store the Render cookie
    maxAge: 24 * 60 * 60 * 1000, // 1 Day
  });
};

// --- REGISTER ROUTE ---
exports.register = async (req, res) => {
  try {
    const { clinicName, email, password, role } = req.body;

    // 1. Check if the user already exists in Supabase
    const userExists = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    if (userExists.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "User with this email already exists." });
    }

    // 2. Hash the password securely
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Save the new user to the database
    const newUser = await pool.query(
      "INSERT INTO users (clinic_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, clinic_name, email, role",
      [clinicName, email, passwordHash, role || "BCBA"],
    );

    // 4. Create session cookie and send success response
    setTokenCookie(res, newUser.rows[0]);
    res
      .status(201)
      .json({ user: newUser.rows[0], message: "Registration successful!" });
  } catch (err) {
    console.error("❌ Registration Error:", err.message);
    res.status(500).json({ error: "Server error during registration." });
  }
};

// --- LOGIN ROUTE ---
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find user by email
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const user = userResult.rows[0];

    // 2. Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    // 3. Create session cookie and send success response
    setTokenCookie(res, user);
    res.json({
      user: {
        id: user.id,
        clinic_name: user.clinic_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ Login Error:", err.message);
    res.status(500).json({ error: "Server error during login." });
  }
};

// --- LOGOUT ROUTE ---
exports.logout = (req, res) => {
  // To securely delete a cross-domain cookie, the options must match exactly how it was created
  res.clearCookie("aura_token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  res.json({ message: "Logged out successfully" });
};
