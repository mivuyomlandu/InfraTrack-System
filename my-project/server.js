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
  const validStatuses = ['Active', 'Inactive', 'On Leave'];
  const normalizedStatus = String(status || '').trim();
  const finalStatus = validStatuses.find(s => s.toLowerCase() === normalizedStatus.toLowerCase());

  if (!finalStatus) {
    return res.status(400).json({ success: false, message: 'Status must be one of Active, Inactive or On Leave' });
  }

  const sql = "UPDATE technician SET technician_status = ? WHERE user_id = ?";

  db.query(sql, [finalStatus, userId], (err, result) => {
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

app.get("/users/technician-candidates", (req, res) => {
  const sql = `
    SELECT u.user_id, u.name, u.surname, u.email
    FROM users u
    LEFT JOIN technician t ON u.user_id = t.user_id
    WHERE u.role = 'Technician' AND t.user_id IS NULL
    ORDER BY u.name ASC, u.surname ASC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, users: result });
  });
});

app.get("/locations", (req, res) => {
  const sql = `
    SELECT
      l.location_id,
      l.street,
      l.suburb,
      GROUP_CONCAT(DISTINCT COALESCE(a.asset_type, 'Other') ORDER BY COALESCE(a.asset_type, 'Other') SEPARATOR ',') AS asset_types
    FROM location l
    INNER JOIN asset a ON l.location_id = a.location_id
    GROUP BY l.location_id
    ORDER BY l.suburb ASC, l.street ASC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    const locations = result.map(row => ({
      location_id: row.location_id,
      street: row.street,
      suburb: row.suburb,
      asset_types: row.asset_types ? row.asset_types.split(',').map(type => type.trim()) : []
    }));

    res.json({
      success: true,
      locations
    });
  });
});

app.get("/companies", (req, res) => {
  const sql = `
    SELECT
      company_id,
      company_name,
      company_info,
      company_email,
      company_phone,
      company_address
    FROM company
    ORDER BY company_name ASC
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, companies: result });
  });
});

app.post("/companies", (req, res) => {
  const { company_name, company_info, company_email, company_phone, company_address } = req.body;
  if (!company_name) {
    return res.status(400).json({ success: false, message: 'Company name is required' });
  }

  const sql = `
    INSERT INTO company (company_name, company_info, company_email, company_phone, company_address)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(sql, [company_name, company_info || '', company_email || '', company_phone || '', company_address || ''], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, company_id: result.insertId });
  });
});

app.put("/companies/:id", (req, res) => {
  const { company_name, company_info, company_email, company_phone, company_address } = req.body;
  if (!company_name) {
    return res.status(400).json({ success: false, message: 'Company name is required' });
  }

  const sql = `
    UPDATE company
    SET company_name = ?, company_info = ?, company_email = ?, company_phone = ?, company_address = ?
    WHERE company_id = ?
  `;
  db.query(sql, [company_name, company_info || '', company_email || '', company_phone || '', company_address || '', req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true });
  });
});

app.delete("/companies/:id", (req, res) => {
  const companyId = req.params.id;
  const checkSql = "SELECT COUNT(*) AS count FROM technician WHERE company_id = ?";
  db.query(checkSql, [companyId], (err, checkResult) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (checkResult[0].count > 0) {
      return res.status(400).json({ success: false, message: 'Company cannot be deleted while technicians are assigned' });
    }

    const sql = "DELETE FROM company WHERE company_id = ?";
    db.query(sql, [companyId], (deleteErr, deleteResult) => {
      if (deleteErr) return res.status(500).json({ success: false, message: deleteErr.message });
      if (deleteResult.affectedRows === 0) return res.status(404).json({ success: false, message: 'Company not found' });
      res.json({ success: true });
    });
  });
});

app.get("/technicians/all", (req, res) => {
  const sql = `
    SELECT
      t.technician_id,
      t.user_id,
      t.company_id,
      t.skill_type,
      t.technician_status,
      u.name,
      u.surname,
      u.email
    FROM technician t
    JOIN users u ON t.user_id = u.user_id
    LEFT JOIN company c ON t.company_id = c.company_id
    ORDER BY u.name ASC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, technicians: result });
  });
});

app.post("/technicians", (req, res) => {
  const { user_id, company_id, skill_type, technician_status } = req.body;
  if (!user_id || !company_id || !skill_type) {
    return res.status(400).json({ success: false, message: 'User ID, company ID, and skill type are required' });
  }

  const sql = `
    INSERT INTO technician (user_id, company_id, skill_type, technician_status)
    VALUES (?, ?, ?, ?)
  `;
  db.query(sql, [user_id, company_id, skill_type, technician_status || 'Active'], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, technician_id: result.insertId });
  });
});

app.put("/technicians/:id", (req, res) => {
  const { skill_type, technician_status, company_id } = req.body;
  const updates = [];
  const values = [];

  if (skill_type !== undefined) {
    updates.push('skill_type = ?');
    values.push(skill_type);
  }
  if (technician_status !== undefined) {
    updates.push('technician_status = ?');
    values.push(technician_status);
  }
  if (company_id !== undefined) {
    updates.push('company_id = ?');
    values.push(company_id);
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: 'No technician data provided for update' });
  }

  const sql = `UPDATE technician SET ${updates.join(', ')} WHERE technician_id = ?`;
  values.push(req.params.id);
  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Technician not found' });
    res.json({ success: true });
  });
});

app.delete("/technicians/:id", (req, res) => {
  const sql = "DELETE FROM technician WHERE technician_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Technician not found' });
    res.json({ success: true });
  });
});

// ────────────────────────────────────────────
// 🎫 GET ALL TICKETS
// ────────────────────────────────────────────
app.get("/tickets", (req, res) => {
  const sql = `
    SELECT
      t.ticket_id,
      t.title,
      t.description,
      t.priority,
      t.status_id,
      t.technician_id,
      t.asset_id,
      t.user_id,
      DATE_FORMAT(t.date_created, '%Y-%m-%d') AS date_created,
      COALESCE(a.asset_type, 'Other') AS asset_type,
      CONCAT(COALESCE(l.street, ''), ', ', COALESCE(l.suburb, '')) AS location
    FROM ticket t
    LEFT JOIN asset a ON t.asset_id = a.asset_id
    LEFT JOIN location l ON a.location_id = l.location_id
    ORDER BY t.ticket_id DESC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json(result);
  });
});

app.get("/tickets/status/:statusId", (req, res) => {
  const statusId = Number(req.params.statusId);
  if (![1, 2, 3, 4, 5].includes(statusId)) {
    return res.status(400).json({ success: false, message: 'Invalid ticket status filter' });
  }

  const sql = `
    SELECT
      t.ticket_id,
      t.user_id,
      t.technician_id,
      t.title,
      t.priority,
      t.status_id
    FROM ticket t
    WHERE t.status_id = ?
    ORDER BY t.ticket_id DESC
  `;

  db.query(sql, [statusId], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, tickets: result });
  });
});

app.put("/tickets/:id/complete", (req, res) => {
  let ticketId = req.params.id;
  if (ticketId && ticketId.startsWith('TK-')) {
    ticketId = ticketId.slice(3);
  }
  if (!ticketId || isNaN(ticketId)) {
    return res.status(400).json({ success: false, message: 'Invalid ticket identifier' });
  }

  const sql = `UPDATE ticket SET completion_date = CURDATE(), status_id = 4 WHERE ticket_id = ?`;
  db.query(sql, [ticketId], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    res.json({ success: true, message: 'Ticket completion updated' });
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
      CONCAT(COALESCE(l.street, ''), ', ', COALESCE(l.suburb, '')) AS location,
      t.user_id AS reporter_id,
      CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.surname, '')) AS reporter_name
    FROM ticket t
    LEFT JOIN users u ON t.user_id = u.user_id
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
      t.technician_id,
      t.user_id AS reporter_id,
      CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.surname, '')) AS reporter_name
    FROM ticket t
    LEFT JOIN users u ON t.user_id = u.user_id
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
      CONCAT(COALESCE(l.street, ''), ', ', COALESCE(l.suburb, '')) AS location,
      t.user_id AS reporter_id,
      CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.surname, '')) AS reporter_name
    FROM ticket t
    LEFT JOIN users u ON t.user_id = u.user_id
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
// ────────────────────────────────────────────
// 👷 GET ALL ACTIVE TECHNICIANS
// ────────────────────────────────────────────
app.get("/technicians", (req, res) => {
  const sql = `
    SELECT 
      t.technician_id,
      t.skill_type,
      t.technician_status,
      u.name,
      u.surname,
      u.email
    FROM technician t
    JOIN users u ON t.user_id = u.user_id
    WHERE t.technician_status = 'Active'
    ORDER BY u.name ASC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, technicians: result });
  });
});

// ────────────────────────────────────────────
// 👷 ASSIGN TICKET TO TECHNICIAN
// ────────────────────────────────────────────
app.post("/assign-ticket", (req, res) => {
  const { ticket_id, technician_id } = req.body;

  // status_id 2 = assigned
  const sql = `
    UPDATE ticket 
    SET technician_id = ?, status_id = 2 
    WHERE ticket_id = ?
  `;
  db.query(sql, [technician_id, ticket_id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (result.affectedRows === 0) {
      return res.json({ success: false, message: "Ticket not found" });
    }
    res.json({ success: true, message: "Ticket assigned successfully" });
  });
});
// ────────────────────────────────────────────
// ✏️ UPDATE USER DETAILS
// ────────────────────────────────────────────
app.put("/users/:id", (req, res) => {
  const { name, surname, email, cellphone, password } = req.body;
  const sql = `
    UPDATE users 
    SET name = ?, surname = ?, email = ?, cellphone = ?, password = ?
    WHERE user_id = ?
  `;
  db.query(sql, [name, surname, email, cellphone, password, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (result.affectedRows === 0) return res.json({ success: false, message: "User not found" });
    res.json({ success: true, message: "User updated successfully" });
  });
});
// ────────────────────────────────────────────
// 🗑️ DELETE USER
// ────────────────────────────────────────────
app.delete("/users/:id", (req, res) => {
  const sql = "DELETE FROM users WHERE user_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (result.affectedRows === 0) return res.json({ success: false, message: "User not found" });
    res.json({ success: true, message: "User deleted successfully" });
  });
});
// ────────────────────────────────────────────
// 🗑️ DELETE TICKET
// ────────────────────────────────────────────
app.delete("/tickets/:id", (req, res) => {
  const sql = "DELETE FROM ticket WHERE ticket_id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (result.affectedRows === 0) return res.json({ success: false, message: "Ticket not found" });
    res.json({ success: true, message: "Ticket deleted successfully" });
  });
});
// ────────────────────────────────────────────
// 📊 GET TICKET STATUS COUNTS (for Reports)
// ────────────────────────────────────────────
app.get("/reports/ticket-status-counts", (req, res) => {
  const sql = `
    SELECT
      ts.status_id,
      ts.status_name,
      COUNT(t.ticket_id) AS count
    FROM ticket_status ts
    LEFT JOIN ticket t ON ts.status_id = t.status_id
    GROUP BY ts.status_id, ts.status_name
    ORDER BY ts.status_id ASC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, statuses: result });
  });
});
app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});