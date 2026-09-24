# 🏗️ InfraTrack — City of Johannesburg Public Works Maintenance System

> A full-stack web application for logging, tracking, and managing public infrastructure maintenance requests across Johannesburg.

Built as a university project for **Database Systems 3 (DSS370S)** at the Cape Peninsula University of Technology, Graduate Attribute 9 — *Independent Learning / Lifelong Learning*.

---

## 🌐 Live Demo

Try the live application here:
**[https://www.datcom.co.za/infratrack/](https://www.datcom.co.za/infratrack/)**

---

## 📸 Screenshots

### Landing Page
![InfraTrack Landing Page](img/landing.PNG)

### Citizen Dashboard
![Citizen Dashboard](img/citizen%20dash.PNG)

### Create a Ticket
![Create Ticket](img/Log%20ticket.PNG)

### Admin Dashboard
![Admin Dashboard](img/admin%20dash.PNG)

### Assign Workers
![Assign Workers](img/Assign.PNG)

### Before & After Photos (MongoDB)
![Before and After Images](img/preview.PNG)

### Approve work
![Approve work](img/approve.PNG)

### Reports & Charts
![Reports](img/report.PNG)

---

## 🗂️ Overview

InfraTrack allows:

- **Citizens** to report infrastructure faults (burst pipes, potholes, faulty streetlights, etc.) with photo uploads and location selection
- **Technicians / Contractors** to view assigned jobs, update job status, and upload proof-of-completion photos
- **Administrators** to manage tickets, assign workers, approve completions, view live reports, and manage users and companies

The system takes a ticket through a full lifecycle:

```
Pending → Assigned → In Progress → Completed (worker) → Admin Approval → Archived
```

---

## 🛠️ Tech Stack

| Technology | Role |
|---|---|
| **HTML5 / CSS3 / JavaScript (ES2025)** | Frontend — single-page application |
| **Node.js v24 + Express.js** | Backend REST API server |
| **MySQL 8.0** | Relational database (users, tickets, assets, locations, technicians) |
| **MongoDB 4.4 + GridFS** | Document store for before/after ticket images |
| **Multer** | File upload middleware |
| **Rocky Linux 9.5** | Self-hosted server (repurposed desktop PC) |
| **Microsoft Power BI** | External BI dashboard connected to MySQL |
| **GitHub** | Version control and team collaboration |

---

## 🏛️ Architecture

The system uses **polyglot persistence** — two databases with different responsibilities:

- **MySQL** stores all structured, relational data: users, tickets, assets, locations, technician assignments, companies, and ticket statuses. Foreign key constraints and ACID transactions enforce data integrity throughout the maintenance workflow.
- **MongoDB** stores unstructured binary media (the before and after photos) via GridFS, keeping blob storage separate from the relational schema.

The backend exposes a unified REST API (via Express.js) that the frontend communicates with for all operations.

---

## 📁 Project Structure

```
├── index.html          # Single-page application shell
├── style.css           # All styling (custom design system)
├── app.js              # Frontend logic, routing, API calls
├── server.js           # MySQL REST API server (port 3000)
└── mongo-server.js     # MongoDB image upload/fetch server (port 3001)
```

---

## 🗄️ Database Schema (MySQL)

Key tables:

| Table | Description |
|---|---|
| `users` | Citizens, technicians, admins |
| `technician` | Links users to companies with skill and status |
| `company` | Contractor companies |
| `location` | Street and suburb records |
| `asset` | Infrastructure assets tied to locations (Water, Road, Electric, Other) |
| `ticket` | Maintenance requests with status, priority, and assignment |
| `ticket_status` | Status reference: Pending → Assigned → In Progress → Completed → Rejected |
| `completed_tickets` | Archive table — tickets moved here after admin approval |
| `notification` | System notifications per user |

A stored procedure `move_ticket(ticket_id)` copies a completed ticket to `completed_tickets`, then deletes it from `ticket` (along with its comments and notifications). A scheduled MySQL **Event** auto-deletes archived tickets older than 12 months.

---

## 🚀 Running Locally

### Prerequisites

- Node.js v18+
- MySQL 8.0
- MongoDB 4.4

### 1. Clone the repo

```bash
git clone https://github.com/allen-vandieman/InfraTrack-System.git
cd InfraTrack-System
```

### 2. Install dependencies

```bash
npm install express mysql2 cors multer mongodb
```

### 3. Set up MySQL

Run the SQL setup script to create the `infratrack` database, all tables, and seed location/asset data. Update credentials in `server.js`:

```js
const db = mysql.createConnection({
  host: "localhost",
  user: "your_user",
  password: "your_password",
  database: "infratrack"
});
```

### 4. Set up MongoDB

Update the connection string in `mongo-server.js`:

```js
const MONGO_URL = 'mongodb://your_user:your_password@localhost:27017';
```

### 5. Configure the frontend

In `app.js`, set the API URLs to point to `localhost`:

```js
const API_URL = `http://localhost:3000`;
const MONGO_API_URL = `http://localhost:3001`;
```

### 6. Start the servers

```bash
node server.js        # MySQL API on port 3000
node mongo-server.js  # MongoDB image server on port 3001
```

Open `index.html` with a live server (e.g. VS Code Live Server extension).

---

## 🧑‍💻 My Contribution — M.S. Mlandu

This was a group project (Group 23). My individual contributions spanned frontend application logic, backend API work, and system design:

**Frontend application logic (`app.js`)**
- Contributed approximately 1,750 lines across multiple commits to the main application JavaScript
- Built the ticket status update system, including the frontend controls and state handling
- Developed the Worker (Contractor) dashboard — linking workers to the system, loading assigned tickets, and displaying worker-side ticket data
- Implemented the Citizen profile section and the notification system
- Connected the frontend to the backend REST API for ticket, worker, and notification operations

**Backend API (`my-project/server.js`)**
- Contributed to the Express.js backend, including routes and handlers supporting ticket status updates, worker dashboard operations, and notification delivery

**System design**
- Designed and documented the complete system flow diagram covering login and role detection, and the full navigation structure for the Citizen, Technician, and Admin dashboards — including sub-flows for ticket creation, ticket status transitions, technician assignment, and notifications

---

## 👥 Team — Group 23

| Name | Student Number |
|---|---|
| A.W. Van Dieman | 222919558 |
| M.S. Mlandu | 240379721 |
| A. Tyityi | 240304012 |
| S. Mafuta | 220488428 |
| A. Masedi | 230289606 |

**Cape Peninsula University of Technology**
Department of Electrical, Electronic and Computer Engineering
Bachelor of Engineering Technology: Computer Engineering

---

## 📄 License

This project was developed for academic purposes at CPUT. All rights reserved by the respective authors.
