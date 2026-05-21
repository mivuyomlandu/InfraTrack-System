const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

// ── MIDDLEWARE ─────────────────────────────
app.use(cors());
app.use(express.json());

// ── DATABASE CONNECTION ────────────────────
const db = mysql.createConnection({
  host: "105.228.61.32",
  user: "group",
  password: "p@$$.w03d!",
  database: "infratrack"
});

db.connect(err => {
  if (err) {
    console.log("❌ MySQL connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL");
  }
});

// ────────────────────────────────────────────
// 🔐 LOGIN ROUTE
// ────────────────────────────────────────────
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM users WHERE email = ? AND password = ?";

  db.query(sql, [email, password], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    if (result.length > 0) {
      res.json({
        success: true,
        user: result[0]
      });
    } else {
      res.json({
        success: false,
        message: "Invalid credentials"
      });
    }
  });
});

// ────────────────────────────────────────────
// 📝 SIGNUP ROUTE
// ────────────────────────────────────────────
app.post("/signup", (req, res) => {
  const { role, name, surname, email, password } = req.body;

  const sql =
    "INSERT INTO users (role, name, surname, email, password) VALUES (?, ?, ?, ?, ?)";

  db.query(sql, [role, name, surname, email, password], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }

    res.json({
      success: true,
      message: "User created"
    });
  });
});

// ────────────────────────────────────────────
// 🎫 GET ALL TICKETS
// ────────────────────────────────────────────
app.get("/tickets", (req, res) => {
  db.query("SELECT * FROM tickets ORDER BY id DESC", (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }
    res.json(result);
  });
});

// ────────────────────────────────────────────
// ➕ CREATE TICKET
// ────────────────────────────────────────────
app.post("/tickets", (req, res) => {
  const { title, category, description, location } = req.body;

  const sql = `
    INSERT INTO tickets (title, category, description, location, status, priority, date)
    VALUES (?, ?, ?, ?, 'pending', 'medium', CURDATE())
  `;

  db.query(sql, [title, category, description, location], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json({
      success: true,
      id: result.insertId
    });
  });
});

// ────────────────────────────────────────────
// 🔄 UPDATE TICKET STATUS
// ────────────────────────────────────────────
app.put("/tickets/:id", (req, res) => {
  const { status } = req.body;

  const sql = "UPDATE tickets SET status = ? WHERE id = ?";

  db.query(sql, [status, req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json({
      success: true,
      message: "Ticket updated"
    });
  });
});

// ────────────────────────────────────────────
// 🚀 START SERVER
// ────────────────────────────────────────────
app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});