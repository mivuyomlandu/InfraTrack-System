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
// 📍 GET ALL LOCATIONS (include id)
// ────────────────────────────────────────────
app.get("/locations", (req, res) => {
  const sql = "SELECT location_id, street, suburb FROM location ORDER BY suburb ASC, street ASC";

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    res.json({
      success: true,
      locations: result
    });
  });
});

// ────────────────────────────────────────────
// 🎫 GET ALL TICKETS
// ────────────────────────────────────────────
app.get("/tickets", (req, res) => {
  db.query("SELECT * FROM ticket ORDER BY id DESC", (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }
    res.json(result);
  });
});

// ────────────────────────────────────────────
// ➕ CREATE TICKET (asset lookup by location + category, and user_id)
// ────────────────────────────────────────────
app.post("/tickets", (req, res) => {
  const { title, category, description, location, priority, user_id } = req.body;

  if (!title || !description || !location) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  // Parse location string "Street, Suburb"
  const parts = String(location).split(',').map(p => p.trim());
  const street = parts[0] || '';
  const suburb = parts[1] || '';

  // 1) Find location id
  const locSql = "SELECT * FROM location WHERE street = ? AND suburb = ? LIMIT 1";
  db.query(locSql, [street, suburb], (locErr, locRes) => {
    if (locErr) return res.status(500).json({ success: false, message: locErr.message });

    const locRow = (locRes && locRes[0]) || null;
    const locationId = locRow ? (locRow.id || locRow.location_id) : null;

    // 2) Find matching asset by asset_type (category) and location_id
    const assetSql = "SELECT * FROM asset WHERE asset_type = ? AND location_id = ? LIMIT 1";
    db.query(assetSql, [category, locationId], (assetErr, assetRes) => {
      if (assetErr) return res.status(500).json({ success: false, message: assetErr.message });

      const assetRow = (assetRes && assetRes[0]) || null;
      const assetId = assetRow ? (assetRow.id || assetRow.asset_id) : null;

      // 3) Insert into tickets table
      const insertSql = `INSERT INTO ticket (status_id, title, description, priority, asset_id, user_id, date_created) VALUES (?, ?, ?, ?, ?, ?, CURDATE())`;
      const insertVals = [1, title, description, priority || 'medium', assetId, user_id || null];

      db.query(insertSql, insertVals, (insErr, insRes) => {
        if (insErr) return res.status(500).json({ success: false, message: insErr.message });

        res.json({ success: true, id: insRes.insertId, asset_id: assetId });
      });
    });
  });
});

// ────────────────────────────────────────────
// 🔄 UPDATE TICKET STATUS
// ────────────────────────────────────────────
app.put("/tickets/:id", (req, res) => {
  const { status } = req.body;

  const sql = "UPDATE ticket SET status = ? WHERE id = ?";

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