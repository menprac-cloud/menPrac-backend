require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const pool = require("./config/db");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");

// --- CONTROLLERS & MIDDLEWARE ---
const aiController = require("./controllers/aiController");
const authMiddleware = require("./middleware/authMiddleware");

// --- 1. INITIALIZE APP ---
const app = express();

// 🚨 CRITICAL FIX: Trust Render proxy (must be high up)
app.set("trust proxy", 1);

const server = http.createServer(app);

// --- 2. CORS CONFIGURATION (MUST BE BEFORE HELMET/ROUTES) ---
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://men-prac-frontend.vercel.app",
  "https://menprac.com",
  "https://www.menprac.com",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// --- 3. WEBSOCKETS ---
const io = new Server(server, {
  cors: corsOptions, // Reuse the same logic for Socket.io
});
app.set("io", io);

// --- 4. GLOBAL MIDDLEWARE ---
app.use(helmet()); // Security headers
app.use(cookieParser());
app.use(express.json());

// --- 5. RATE LIMITERS ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general limiter to all api routes
app.use("/api/", apiLimiter);

// --- 6. ROUTES ---
app.use("/api/auth", authLimiter, require("./routes/authRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/learners", require("./routes/learnerRoutes"));
app.use("/api/programs", require("./routes/programRoutes"));
app.use("/api/session", require("./routes/sessionRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

// AI Route
app.post(
  "/api/sessions/generate-note",
  authMiddleware,
  aiController.generateSessionNote,
);

// --- 7. WEBSOCKET LOGIC ---
io.on("connection", (socket) => {
  console.log("⚡ Client connected to Real-Time Engine");
  socket.on("register_user", (userId) => {
    socket.join(`user_${userId}`);
  });
  socket.on("disconnect", () => console.log("Client disconnected"));
});

// --- 8. START SERVER ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`🚀 Secure Server & WebSockets running on port ${PORT}`);
  try {
    await pool.query("SELECT 1");
    console.log("📦 PostgreSQL firmly connected.");
  } catch (err) {
    console.error("❌ DB connection failed:", err.message);
  }
});
