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
  const sql = `
  SELECT 
    users.*,
    technician.technician_status
  FROM users
  LEFT JOIN technician 
    ON users.user_id = technician.user_id
  WHERE users.email = ? 
    AND users.password = ?
`;
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

// Calling the route
app.post("/user/update-status", (req, res) => {
  const { userId, status } = req.body;
  
  const sql = "UPDATE technician SET technician_status = ? WHERE user_id = ?";
  
  db.query(sql, [status, userId], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, message: "Status updated successfully" });
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
// 🎫 GET TICKETS BY USER
// ────────────────────────────────────────────
app.get("/tickets/user/:user_id", (req, res) => {
  const sql = `
    SELECT
      t.ticket_id,
      t.title,
      t.description,
      t.priority,
      t.status_id,
      DATE_FORMAT(t.date_created, '%Y-%m-%d') AS date,
      COALESCE(a.asset_type, 'Other') AS category,
      CONCAT(COALESCE(l.street, ''), ', ', COALESCE(l.suburb, '')) AS location
    FROM ticket t
    LEFT JOIN asset a ON t.asset_id = a.asset_id
    LEFT JOIN location l ON a.location_id = l.location_id
    WHERE t.user_id = ?
    ORDER BY t.ticket_id DESC
  `;

  db.query(sql, [req.params.user_id], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, tickets: result });
  });
});

// ────────────────────────────────────────────
// 🎫 GET TICKETS BY TECHNICIAN (For Worker Dashboard)
// ────────────────────────────────────────────
app.get("/tickets/technician/:tech_id", (req, res) => {
  const sql = `
    SELECT
      t.ticket_id AS id,
      t.title,
      t.description,
      t.priority,
      CASE 
        WHEN t.status_id = 1 THEN 'pending'
        WHEN t.status_id = 2 THEN 'assigned'
        WHEN t.status_id = 3 THEN 'inprogress'
        WHEN t.status_id = 4 THEN 'completed'
        ELSE 'pending'
      END AS status,
      DATE_FORMAT(t.date_created, '%Y-%m-%d') AS date,
      COALESCE(a.asset_type, 'Other') AS category,
      CONCAT(COALESCE(l.street, ''), ', ', COALESCE(l.suburb, '')) AS location,
      t.technician_id
    FROM ticket t
    LEFT JOIN asset a ON t.asset_id = a.asset_id
    LEFT JOIN location l ON a.location_id = l.location_id
    WHERE t.technician_id = ?
    ORDER BY t.ticket_id DESC
  `;

  db.query(sql, [req.params.tech_id], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, tickets: result });
  });
});

// ────────────────────────────────────────────
// 🎫 GET TICKET BY ID
// ────────────────────────────────────────────
app.get("/tickets/id/:ticketId", (req, res) => {
  let ticketId = req.params.ticketId;
  if (ticketId && ticketId.startsWith('TK-')) {
    ticketId = ticketId.slice(3);
  }

  if (!ticketId || isNaN(ticketId)) {
    return res.status(400).json({ success: false, message: 'Invalid ticket identifier' });
  }

  const sql = `
    SELECT
      t.ticket_id,
      t.title,
      t.description,
      t.priority,
      t.status_id,
      DATE_FORMAT(t.date_created, '%Y-%m-%d') AS date,
      COALESCE(a.asset_type, 'Other') AS category,
      CONCAT(COALESCE(l.street, ''), ', ', COALESCE(l.suburb, '')) AS location
    FROM ticket t
    LEFT JOIN asset a ON t.asset_id = a.asset_id
    LEFT JOIN location l ON a.location_id = l.location_id
    WHERE t.ticket_id = ?
    LIMIT 1
  `;

  db.query(sql, [ticketId], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    if (!result.length) {
      return res.json({ success: false, message: 'Ticket not found' });
    }
    res.json({ success: true, ticket: result[0] });
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
  const statusMap = {
    pending: 1,
    assigned: 2,
    inprogress: 3,
    completed: 4,
    rejected: 5
  };

  const statusId = statusMap[String(status).toLowerCase()];
  if (!statusId) {
    return res.status(400).json({ success: false, message: "Invalid ticket status" });
  }

  let ticketId = req.params.id;
  if (ticketId && ticketId.startsWith('TK-')) {
    ticketId = ticketId.slice(3);
  }
  if (!ticketId || isNaN(ticketId)) {
    return res.status(400).json({ success: false, message: 'Invalid ticket identifier' });
  }

  const sql = "UPDATE ticket SET status_id = ? WHERE ticket_id = ?";
  db.query(sql, [statusId, ticketId], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, status_id: statusId, message: "Ticket status updated" });
  });
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});