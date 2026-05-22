const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: "105.228.61.32",
  user: "group",
  password: "p@$$.w03d!",
  database: "infratrack"
});

db.connect(err => {
  if (err) {
    console.log("MySQL connection failed:", err);
  } else {
    console.log("Connected to MySQL");
  }
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
  db.query(sql, [email, password], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (result.length > 0) {
      res.json({ success: true, user: result[0] });
    } else {
      res.json({ success: false, message: "Invalid credentials" });
    }
  });
});

app.post("/signup", (req, res) => {
  const { role, name, surname, email, cellphone, password } = req.body;
  const sql = "INSERT INTO users (role, name, surname, email, cellphone, password) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(sql, [role, name, surname, email, cellphone, password], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: "User created" });
  });
});

app.get("/users", (req, res) => {
  const sql = "SELECT user_id, name, surname, email, cellphone, password, role FROM users";
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, users: result });
  });
});

app.get("/locations", (req, res) => {
  const sql = "SELECT location_id, street, suburb FROM location ORDER BY suburb ASC, street ASC";
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, locations: result });
  });
});

app.get("/tickets", (req, res) => {
  db.query("SELECT * FROM ticket", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.post("/tickets", (req, res) => {
  const { title, category, description, location, priority, user_id } = req.body;

  if (!title || !description || !location) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const parts = String(location).split(",").map(p => p.trim());
  const street = parts[0] || "";
  const suburb = parts[1] || "";

  const locSql = "SELECT * FROM location WHERE street = ? AND suburb = ? LIMIT 1";
  db.query(locSql, [street, suburb], (locErr, locRes) => {
    if (locErr) return res.status(500).json({ success: false, message: locErr.message });

    const locRow = (locRes && locRes[0]) || null;
    const locationId = locRow ? (locRow.id || locRow.location_id) : null;

    const assetSql = "SELECT * FROM asset WHERE asset_type = ? AND location_id = ? LIMIT 1";
    db.query(assetSql, [category, locationId], (assetErr, assetRes) => {
      if (assetErr) return res.status(500).json({ success: false, message: assetErr.message });

      const assetRow = (assetRes && assetRes[0]) || null;
      const assetId = assetRow ? (assetRow.id || assetRow.asset_id) : null;

      const insertSql = "INSERT INTO ticket (status_id, title, description, priority, asset_id, user_id, date_created) VALUES (?, ?, ?, ?, ?, ?, CURDATE())";
      const insertVals = [1, title, description, priority || "medium", assetId, user_id || null];

      db.query(insertSql, insertVals, (insErr, insRes) => {
        if (insErr) return res.status(500).json({ success: false, message: insErr.message });
        res.json({ success: true, id: insRes.insertId, asset_id: assetId });
      });
    });
  });
});

app.put("/tickets/:id", (req, res) => {
  const { status } = req.body;
  const sql = "UPDATE ticket SET status = ? WHERE id = ?";
  db.query(sql, [status, req.params.id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true, message: "Ticket updated" });
  });
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});