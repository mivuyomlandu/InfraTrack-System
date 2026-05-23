/* ================================================================
   City of Johannesburg – Public Works System
   Main Application JavaScript
   ================================================================ */

'use strict';

// ── STATE ─────────────────────────────────────────────────────
const API_URL = "http://105.228.61.32:3000";

const APP = {
  currentUser: null,
  currentRole: null,
  currentPage: null,
  tickets: [],
  allTickets: [],
  managedUsers: [],
  managedUsersSort: { field: 'user_id', asc: true },
  workers: [],
  technicians: [],
  technicianCandidates: [],
  locations: [],
  companies: []
};

// Initialize Application Lifecycles once DOM contents are ready
document.addEventListener('DOMContentLoaded', () => {
  initGlobalAuthHandlers();
});

// ── SCREEN NAVIGATION CONTROLLER ─────────────────────────────
function showScreen(screenId) {
  document.querySelectorAll('.screen-view').forEach(view => {
    view.classList.add('hidden');
  });
  const targetedView = document.getElementById(screenId);
  if (targetedView) {
    targetedView.classList.remove('hidden');
    targetedView.style.display = screenId === 'home-screen' ? 'flex' : '';
  }

  const logErr = document.getElementById('login-error');
  const signErr = document.getElementById('signup-error');
  if (logErr) logErr.classList.add('hidden');
  if (signErr) signErr.classList.add('hidden');
}

function normalizeRole(role) {
  if (!role) return 'citizen';
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'technician' || normalized === 'worker' || normalized === 'contractor') return 'worker';
  if (normalized === 'admin' || normalized === 'administrator') return 'admin';
  return 'citizen';
}

function handleAuthSuccess(user, role) {
  const normalizedRole = normalizeRole(role);
  APP.currentUser = {
    id: user.user_id || null,
    user_id: user.user_id || null,
    technician_id: null,
    name: `${user.name || ''} ${user.surname || ''}`.trim() || user.email || 'User',
    initials: ((user.name?.[0] || user.email?.[0] || 'U') + (user.surname?.[0] || '')).toUpperCase(),
    email: user.email || '',
    technician_status: user.technician_status ?? (normalizedRole === 'worker' ? 'Active' : null)
  };
  APP.currentRole = normalizedRole;
  loadApp();
}

// ── TOAST MESSAGES ───────────────────────────────────────────
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, 3200);
}

// ── STATUS BADGE HTML ──────────────────────────────────────────
function statusBadge(s) {
  const map = { pending: 'badge-pending', assigned: 'badge-assigned', inprogress: 'badge-inprogress', completed: 'badge-completed', rejected: 'badge-rejected' };
  const label = { pending: 'Pending', assigned: 'Assigned', inprogress: 'In Progress', completed: 'Completed', rejected: 'Rejected' };
  return `<span class="badge ${map[s] || ''}">${label[s] || s}</span>`;
}

// ── PRIORITY HTML ──────────────────────────────────────────────
function priorityHtml(p) {
  return `<span class="priority ${p}"><span class="priority-dot"></span>${p.charAt(0).toUpperCase() + p.slice(1)}</span>`;
}

// ── CATEGORY ICON ──────────────────────────────────────────────
function catIcon(c) {
  return { Water: '💧', Road: '🚧', Electric: '⚡', Other: '📋' }[c] || '📋';
}

// ── INNER APP ROUTER ──────────────────────────────────────────
async function navigate(page) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const link = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (link) link.classList.add('active');

  APP.currentPage = page;
  const main = document.getElementById('main-content');
  if (!main) return;

  if (page === 'dashboard-worker') {
    document.getElementById('main-content').innerHTML = renderWorkerDashboard();
    return;
  }

  const renders = {
    'dashboard-citizen': renderCitizenDashboard,
    'create-ticket': renderCreateTicket,
    'my-tickets': renderMyTickets,
    'dashboard-worker': renderWorkerDashboard,
    'assigned-jobs': renderAssignedJobs,
    'dashboard-admin': renderAdminDashboard,
    'all-tickets': renderAllTickets,
    'assign-worker': renderAssignWorker,
    'contractor-assign': renderContractorAssignments,
    'manage-users': renderManageUsers,
    'reports': renderReports,
    'notifications': renderNotifications,
    'profile': renderProfile,
  };

  if (renders[page]) {
    const result = await renders[page]();
    main.innerHTML = `<div class="page">${result}</div>`;
    bindPageEvents(page);
  }
}

// ── LANDING HOME EVENT HANDLERS ───────────────────────────────
async function handleHomeTrackTicket() {
  const ticketInput = document.getElementById('home-track-id');
  const idValue = ticketInput ? ticketInput.value.trim().toUpperCase() : '';

  if (!idValue) {
    showToast('Please type a valid Ticket ID first.', 'error');
    return;
  }

  const foundTicket = APP.tickets.find(t => t.id === idValue);
  if (foundTicket) {
    showTicketDetail(foundTicket.id);
    return;
  }

  try {
    const res = await fetch(`${API_URL}/tickets/id/${encodeURIComponent(idValue)}`);
    const data = await res.json();

    if (data.success && data.ticket) {
      const ticket = formatTicketRow(data.ticket);
      APP.tickets.unshift(ticket);
      showTicketDetail(ticket.id);
    } else {
      showToast(`No logged infrastructure ticket was found matching code "${idValue}".`, 'error');
    }
  } catch (err) {
    console.error('Ticket lookup error', err);
    showToast('Unable to reach the ticket service. Please try again later.', 'error');
  }
}

function handleGuestLogTicket() {
  showToast('Please sign up or login with your database credentials to submit maintenance reports.', 'info');
  setTimeout(() => {
    showScreen('signup-screen');
  }, 1200);
}

// ── LOGIN & SIGNUP FORMS HANDLERS (REAL BACKEND VERSION) ─────────────────────────────
function initGlobalAuthHandlers() {
  const API_URL = "http://105.228.61.32:3000";

  // =========================
  // LOGIN HANDLER
  // =========================
  const logForm = document.getElementById('login-form');
  if (logForm) {
    logForm.addEventListener('submit', async e => {
      e.preventDefault();

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value.trim();
      const errEl = document.getElementById('login-error');

      errEl.classList.add('hidden');

      if (!email || !password) {
        errEl.textContent = 'Please fill in all fields.';
        errEl.classList.remove('hidden');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!data.success) {
          errEl.textContent = "Invalid email or password.";
          errEl.classList.remove('hidden');
          return;
        }

        const user = data.user;
        handleAuthSuccess(user, user.role);
        showToast(`Welcome back ${user.name || user.email}!`, 'success');

      } catch (err) {
        errEl.textContent = "Server error. Please try again.";
        errEl.classList.remove('hidden');
      }
    });
  }

  // =========================
  // SIGNUP HANDLER
  // =========================
  const signForm = document.getElementById('signup-form');
  if (signForm) {
    signForm.addEventListener('submit', async e => {
      e.preventDefault();

      const role = document.getElementById('signup-role').value;
      const name = document.getElementById('signup-name').value.trim();
      const surname = document.getElementById('signup-surname').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const cellphone = document.getElementById('signup-cellphone').value.trim();
      const password = document.getElementById('signup-password').value.trim();
      const errEl = document.getElementById('signup-error');

      errEl.classList.add('hidden');

      if (!role || !name || !surname || !email || !cellphone || !password) {
        errEl.textContent = 'All fields are required.';
        errEl.classList.remove('hidden');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, name, surname, email, cellphone, password })
        });

        const data = await res.json();

        if (!data.success) {
          errEl.textContent = data.message || "Signup failed.";
          errEl.classList.remove('hidden');
          return;
        }

        showToast("Account created successfully!", "success");
        handleAuthSuccess({ name, surname, email }, role);

        setTimeout(() => {
          signForm.reset();
        }, 800);

      } catch (err) {
        errEl.textContent = "Server error. Please try again.";
        errEl.classList.remove('hidden');
      }
    });
  }
}

// ── LOAD APP SHELL ─────────────────────────────────────────────
async function loadApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('signup-screen').classList.add('hidden');
  document.getElementById('home-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');

  document.getElementById('user-name').textContent = APP.currentUser.name;
  document.getElementById('user-initials').textContent = APP.currentUser.initials;

  await loadLocations();
  try {
    await loadAppData();
  } catch (err) {
    console.error('loadAppData failed:', err);
  }

  // If the logged-in user is a worker, try to resolve their technician record using multiple heuristics
  try {
    if (APP.currentRole === 'worker' && APP.currentUser && Array.isArray(APP.technicians)) {
      const uid = String(APP.currentUser.id || APP.currentUser.user_id || '');
      const uemail = (APP.currentUser.email || '').toLowerCase();
      const uname = (APP.currentUser.name || '').toLowerCase();

      const me = APP.technicians.find(t => {
        // common possible fields linking technician -> user
        const candUserIds = [t.user_id, t.userId, t.user?.user_id, t.user?.id, t.uid, t.user_id];
        for (const cu of candUserIds) {
          if (cu != null && String(cu) === uid) return true;
        }

        // try email
        const te = (t.email || t.user_email || t.user?.email || '').toLowerCase();
        if (te && uemail && te === uemail) return true;

        // try name match
        const tn = ((t.name || '') + ' ' + (t.surname || '')).toLowerCase().trim();
        if (tn && uname && tn === uname) return true;

        return false;
      });

      if (me) {
        APP.currentUser.technician_id = me.technician_id != null ? String(me.technician_id) : (me.technicianId != null ? String(me.technicianId) : (me.id != null ? String(me.id) : null));
        APP.currentUser.technician_status = me.technician_status || APP.currentUser.technician_status;
      }
    }
  } catch (e) {
    console.error('Could not resolve technician id for current user', e);
  }

  await loadUserTickets();
  buildSidebar();

  const defaultPage = {
    citizen: 'dashboard-citizen',
    worker: 'dashboard-worker',
    admin: 'dashboard-admin',
  }[APP.currentRole] || 'dashboard-citizen';
  navigate(defaultPage);
}

// ── SIDEBAR BUILDER ────────────────────────────────────────────
function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  const ticketCount = APP.tickets.length || 0;
  const navs = {
    citizen: `
      <div class="sidebar-section-label">Main</div>
      <a class="nav-link" data-page="dashboard-citizen"><span class="icon">🏠</span>Dashboard</a>
      <a class="nav-link" data-page="my-tickets"><span class="icon">🎫</span>My Tickets <span class="nav-badge">${ticketCount}</span></a>
      <a class="nav-link" data-page="create-ticket"><span class="icon">➕</span>New Ticket</a>
      <div class="sidebar-section-label">Account</div>
      <a class="nav-link" data-page="notifications"><span class="icon">🔔</span>Notifications</a>
      <a class="nav-link" data-page="profile"><span class="icon">👤</span>Profile</a>`,
    worker: `
      <div class="sidebar-section-label">Main</div>
      <a class="nav-link" data-page="dashboard-worker"><span class="icon">🏠</span>Dashboard</a>
      <a class="nav-link" data-page="assigned-jobs"><span class="icon">🔧</span>Assigned Jobs <span class="nav-badge" id="worker-jobs-badge">${ticketCount}</span></a>
      <div class="sidebar-section-label">Account</div>
      <a class="nav-link" data-page="notifications"><span class="icon">🔔</span>Notifications</a>
      <a class="nav-link" data-page="profile"><span class="icon">👤</span>Profile</a>`,
    admin: `
      <div class="sidebar-section-label">Management</div>
      <a class="nav-link" data-page="dashboard-admin"><span class="icon">🏠</span>Dashboard</a>
      <a class="nav-link" data-page="all-tickets"><span class="icon">📋</span>All Tickets</a>
      <a class="nav-link" data-page="assign-worker"><span class="icon">👷</span>Assign Workers</a>
      <a class="nav-link" data-page="contractor-assign"><span class="icon">🏢</span>Contractors</a>
      <a class="nav-link" data-page="manage-users"><span class="icon">👥</span>Manage Users</a>
      <a class="nav-link" data-page="reports"><span class="icon">📊</span>Reports</a>
      <div class="sidebar-section-label">Account</div>
      <a class="nav-link" data-page="notifications"><span class="icon">🔔</span>Notifications</a>
      <a class="nav-link" data-page="profile"><span class="icon">👤</span>Profile</a>`,
  };
  sidebar.innerHTML = navs[APP.currentRole];
  sidebar.querySelectorAll('.nav-link').forEach(l => {
    l.addEventListener('click', () => navigate(l.dataset.page));
  });
}

function refreshMyTicketsBadge() {
  const badge = document.querySelector('.nav-link[data-page="my-tickets"] .nav-badge');
  if (badge) {
    badge.textContent = String(APP.tickets.length || 0);
  }
}

// FIX 1: changed APP.currentUser.user_id to APP.currentUser.id
function refreshWorkerJobsBadge() {
  const badge = document.getElementById('worker-jobs-badge');
  if (badge && APP.currentUser?.technician_id) {
    const activeJobs = APP.tickets.length;
    badge.textContent = String(activeJobs || 0);
  }
}

// ── PAGE RENDERS ───────────────────────────────────────────────
function renderCitizenDashboard() {
  const stats = APP.tickets;
  const myTickets = stats.slice(0, 4);
  // FIX 2: changed APP.currentUser.user_id to APP.currentUser.id
  const userIdDisplay = APP.currentUser.id ? `<span class="user-id-badge">#${APP.currentUser.id}</span>` : '';
  return `
  <div class="page-header">
    <div>
      <div class="page-title">Citizen Dashboard</div>
      <div class="page-subtitle">Welcome back, ${APP.currentUser.name} ${userIdDisplay} — track your submissions here.</div>
    </div>
    <button class="btn btn-primary" onclick="navigate('create-ticket')">➕ New Ticket</button>
  </div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-number">${stats.length}</div><div class="stat-label">Total Submitted</div></div>
    <div class="stat-card orange"><div class="stat-number">${stats.filter(t => t.status === 'pending').length}</div><div class="stat-label">Pending</div></div>
    <div class="stat-card blue"><div class="stat-number">${stats.filter(t => t.status === 'inprogress').length}</div><div class="stat-label">In Progress</div></div>
    <div class="stat-card green"><div class="stat-number">${stats.filter(t => t.status === 'completed').length}</div><div class="stat-label">Completed</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">Recent Tickets</span><a class="btn btn-sm btn-outline" onclick="navigate('my-tickets')">View All</a></div>
    <div class="card-body">
      <div class="ticket-list">
        ${myTickets.map(t => `
        <div class="ticket-item" onclick="showTicketDetail('${t.id}')">
          <div class="ticket-icon ${t.category.toLowerCase()}">${catIcon(t.category)}</div>
          <div class="ticket-info">
            <div class="ticket-title">${t.title}</div>
            <div class="ticket-meta">📍 ${t.location} &nbsp;|&nbsp; ${t.date}</div>
          </div>
          <div class="ticket-right">
            ${statusBadge(t.status)}
            <div class="text-muted" style="margin-top:4px">${t.id}</div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderCreateTicket() {
  const locOptions = buildLocationOptions('');

  return `
  <div class="page-header">
    <div>
      <div class="page-title">Create Ticket</div>
      <div class="page-subtitle">Report a public infrastructure issue in Johannesburg.</div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">Ticket Information</span></div>
    <div class="card-body">
      <form id="create-ticket-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Title / Subject *</label>
            <input class="form-control" id="t-title" type="text" placeholder="e.g. Burst water pipe on Vilakazi St" required>
          </div>
          <div class="form-group">
            <label class="form-label">Category *</label>
            <select class="form-control" id="t-cat">
              <option value="">— Select Category —</option>
              <option>Water</option>
              <option>Road</option>
              <option>Electric</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description *</label>
          <textarea class="form-control" id="t-desc" placeholder="Describe the issue in detail..." rows="4"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Upload Picture</label>
          <input class="form-control" id="t-image" type="file" accept="image/*">
          <div class="form-help">Optional: attach a photo of the issue to help triage the ticket.</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Location / Address *</label>
            <select class="form-control" id="t-loc" required disabled>
              ${locOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priority *</label>
            <select class="form-control" id="t-priority" required>
              <option value="">— Select Priority —</option>
              <option>Low</option>
              <option selected>Medium</option>
              <option>High</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:1rem;margin-top:0.5rem">
          <button type="submit" class="btn btn-primary btn-lg">Submit Ticket 🚀</button>
          <button type="button" class="btn btn-outline" onclick="navigate('dashboard-citizen')">Cancel</button>
        </div>
      </form>
    </div>
  </div>`;
}

function renderMyTickets() {
  return `
  <div class="page-header">
    <div>
      <div class="page-title">My Tickets</div>
      <div class="page-subtitle">Track the status of all your submitted maintenance requests.</div>
    </div>
  </div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <div class="table-wrap">
        <table id="tickets-table">
          <thead><tr><th>Ticket ID</th><th>Title</th><th>Category</th><th>Location</th><th>Date</th><th>Status</th><th>Priority</th><th></th></tr></thead>
          <tbody>
            ${APP.tickets.map(t => `<tr>
              <td style="font-weight:700;color:var(--navy)">${t.id}</td>
              <td>${t.title}</td>
              <td>${catIcon(t.category)} ${t.category}</td>
              <td style="font-size:0.8rem">${t.location}</td>
              <td style="font-size:0.8rem">${t.date}</td>
              <td>${statusBadge(t.status)}</td>
              <td>${priorityHtml(t.priority)}</td>
              <td><button class="btn btn-sm btn-outline" onclick="showTicketDetail('${t.id}')">View</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function renderWorkerDashboard() {
  const assigned = APP.tickets.filter(t => String(t.technician_id) === String(APP.currentUser.technician_id));
  const activeStatus = APP.currentUser.technician_status ?? 'Active';
  const totalAssigned = assigned.length;
  const pendingCount = assigned.filter(t => t.status === 'pending' || t.status === 'assigned').length;
  const progressCount = assigned.filter(t => t.status === 'inprogress').length;
  const completedCount = assigned.filter(t => t.status === 'completed').length;
  return `
  <div class="page-header">
    <div>
      <div class="page-title">Worker Dashboard</div>
      <div class="page-subtitle">Hello, ${APP.currentUser.name}.  Overview.</div>
    </div>
  </div>

  <div class="card" style="margin-bottom: 1.5rem;">
    <div class="card-header">
      <span class="card-title">⚙️ Duty Operational Status</span>
    </div>
    <div class="card-body">
      <div class="form-group" style="max-width: 400px; margin: 0;">
        <label class="form-label">Set Your Current Field State:</label>
        <select id="tech-availability-select" class="form-control" onchange="handleUpdateAvailability(this.value)">
          <option value="Active" ${activeStatus === 'Active' ? 'selected' : ''}>Active / Available on Field</option>
          <option value="Inactive" ${activeStatus === 'Inactive' ? 'selected' : ''}>Inactive / Off-Duty</option>
          <option value="On Leave" ${activeStatus === 'On Leave' ? 'selected' : ''}>On Leave</option>
        </select>
      </div>
    </div>
  </div>

  <div class="stats-grid" style="margin-bottom: 1.5rem;">
    <div class="stat-card">
      <div class="stat-number">${totalAssigned}</div>
      <div class="stat-label">Total Assigned</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-number">${pendingCount}</div>
      <div class="stat-label">Pending</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-number">${progressCount}</div>
      <div class="stat-label">In Progress</div>
    </div>
    <div class="stat-card green">
      <div class="stat-number">${completedCount}</div>
      <div class="stat-label">Completed</div>
    </div>
  </div>

  <div class="card">
    <div class="card-body">
      <div class="ticket-list">
        ${assigned.length === 0 ? `
          <div style="text-align: center; color: var(--muted); padding: 1.5rem;">
            ⚙️ No work orders currently assigned to your account.
          </div>
        ` : assigned.map(t => `
        <div class="ticket-item" onclick="navigate('assigned-jobs')" style="cursor: pointer;">
          <div class="ticket-icon ${t.category ? t.category.toLowerCase() : 'other'}">${catIcon(t.category)}</div>
          <div class="ticket-info">
            <div class="ticket-title">${t.title || 'Untitled Job'}</div>
            <div class="ticket-meta">📍 ${t.location || 'Johannesburg'}</div>
          </div>
          <div class="ticket-right">${statusBadge(t.status)}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// FIX 4: single clean handleUpdateAvailability — saves to DB, updates APP state,
// re-renders profile badge if currently on profile page
async function handleUpdateAvailability(newStatus) {
  try {
    const res = await fetch(`${API_URL}/user/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: APP.currentUser.id, status: newStatus })
    });

    const data = await res.json();

    if (data.success) {
      APP.currentUser.technician_status = newStatus;
      showToast(`Duty status updated to: ${newStatus}`, 'success');

      // if worker is currently viewing their profile, refresh it so the badge updates
      if (APP.currentPage === 'profile') {
        const main = document.getElementById('main-content');
        if (main) main.innerHTML = `<div class="page">${renderProfile()}</div>`;
      }
    } else {
      showToast('Failed to update status on server.', 'error');
    }
  } catch (err) {
    console.error('Status update error:', err);
    showToast('Could not connect to the server.', 'error');
  }
}

function renderAssignedJobs() {
  const myJobs = APP.tickets.filter(t => String(t.technician_id) === String(APP.currentUser.technician_id));
  return `
  <div class="page-header"><div><div class="page-title">My Assigned Tasks</div></div></div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ticket ID</th><th>Title</th><th>Location</th><th>Priority</th><th>Job Status</th><th>View</th><th>Actions</th></tr></thead>
          <tbody>
            ${myJobs.map(t => `
              <tr>
                <td style="font-weight:700;color:var(--navy)">${t.id}</td>
                <td>${t.title}</td>
                <td>${t.location}</td>
                <td>${priorityHtml(t.priority)}</td>
                <td>
                  <select class="form-control" style="width:130px;" onchange="updateJobStatus('${t.id}', this.value)">
                    <option value="assigned" ${t.status === 'assigned' ? 'selected' : ''}>Assigned</option>
                    <option value="inprogress" ${t.status === 'inprogress' ? 'selected' : ''}>In Progress</option>
                    <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="rejected" ${t.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                  </select>
                </td>
                <td><button class="btn btn-sm btn-outline" onclick="showTicketDetail('${t.id}')">View</button></td>
                <td><button class="btn btn-sm btn-primary" onclick="triggerUploadPicture('${t.id}')">Upload Picture</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

async function updateJobStatus(id, newStatus) {
  const t = APP.tickets.find(tick => tick.id === id);
  if (!t) {
    showToast(`Task ${id} not found.`, 'error');
    return;
  }

  const cleanId = String(id).startsWith('TK-') ? id.slice(3) : id;

  try {
    const res = await fetch(`${API_URL}/tickets/${cleanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();

    if (!data.success) {
      showToast(data.message || 'Could not update ticket status.', 'error');
      return;
    }

    t.status = newStatus;
    if (data.status_id) {
      t.status_id = data.status_id;
    }

    showToast(`Task ${id} moved to status: ${newStatus}`, 'success');
    refreshWorkerJobsBadge();
    refreshMyTicketsBadge();

    if (APP.currentPage === 'assigned-jobs') {
      const main = document.getElementById('main-content');
      if (main) main.innerHTML = `<div class="page">${renderAssignedJobs()}</div>`;
    }
  } catch (err) {
    console.error('Ticket update error:', err);
    showToast('Could not save status change to server.', 'error');
  }
}

function triggerUploadPicture(ticketId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) {
      input.remove();
      return;
    }
    showToast(`Selected "${file.name}" for ticket ${ticketId}.`, 'success');
    // TODO: upload the selected picture to the server once an upload endpoint exists.
    input.remove();
  };
  document.body.appendChild(input);
  input.click();
}

async function renderAdminDashboard() {
  try {
    const [ticketsRes, usersRes, techRes, companyRes] = await Promise.all([
      fetch(`${API_URL}/tickets`),
      fetch(`${API_URL}/users`),
      fetch(`${API_URL}/technicians`),
      fetch(`${API_URL}/companies`)
    ]);

    const [ticketsData, usersData, techData, companiesData] = await Promise.all([
      ticketsRes.ok ? ticketsRes.json() : null,
      usersRes.ok ? usersRes.json() : null,
      techRes.ok ? techRes.json() : null,
      companyRes.ok ? companyRes.json() : null
    ]);

    const tickets = Array.isArray(ticketsData) ? ticketsData : (ticketsData?.tickets || []);
    const users = Array.isArray(usersData?.users) ? usersData.users : (Array.isArray(usersData) ? usersData : []);
    const technicians = Array.isArray(techData?.technicians) ? techData.technicians : (Array.isArray(techData) ? techData : []);
    const companies = Array.isArray(companiesData?.companies) ? companiesData.companies : (Array.isArray(companiesData) ? companiesData : []);

    const totalTickets = tickets.length;
    const pendingTickets = tickets.filter(t => t.status_id === 1 || String(t.status).toLowerCase() === 'pending').length;
    const assignedTickets = tickets.filter(t => t.status_id === 2 || String(t.status).toLowerCase() === 'assigned').length;
    const inProgressTickets = tickets.filter(t => t.status_id === 3 || String(t.status).toLowerCase() === 'inprogress').length;
    const completedTickets = tickets.filter(t => t.status_id === 4 || String(t.status).toLowerCase() === 'completed').length;
    const rejectedTickets = tickets.filter(t => t.status_id === 5 || String(t.status).toLowerCase() === 'rejected').length;
    const openTickets = totalTickets - completedTickets - rejectedTickets;
    const activeTechnicians = technicians.filter(t => String(t.technician_status).toLowerCase() === 'active').length;

    const recentTickets = tickets
      .slice()
      .sort((a, b) => {
        const da = new Date(a.date_created || a.created_at || a.createdAt || 0).getTime();
        const db = new Date(b.date_created || b.created_at || b.createdAt || 0).getTime();
        return db - da;
      })
      .slice(0, 5);

    return `
      <div class="page-header">
        <div>
          <div class="page-title">Admin Command Console</div>
          <div class="page-subtitle">Live operational figures pulled from the system database.</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-number">${totalTickets}</div><div class="stat-label">Total Tickets</div></div>
        <div class="stat-card orange"><div class="stat-number">${pendingTickets}</div><div class="stat-label">Pending Tickets</div></div>
        <div class="stat-card blue"><div class="stat-number">${inProgressTickets}</div><div class="stat-label">In Progress</div></div>
        <div class="stat-card green"><div class="stat-number">${completedTickets}</div><div class="stat-label">Completed</div></div>
      </div>

      <div class="stats-grid" style="margin-top:1rem;">
        <div class="stat-card"><div class="stat-number">${users.length}</div><div class="stat-label">Registered Users</div></div>
        <div class="stat-card"><div class="stat-number">${technicians.length}</div><div class="stat-label">Technicians</div></div>
        <div class="stat-card"><div class="stat-number">${companies.length}</div><div class="stat-label">Companies</div></div>
        <div class="stat-card orange"><div class="stat-number">${openTickets}</div><div class="stat-label">Open Tickets</div></div>
      </div>

      <div class="card" style="margin-top:1.5rem;">
        <div class="card-header"><span class="card-title">Quick Actions</span></div>
        <div class="card-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
          <button class="btn btn-primary" onclick="navigate('all-tickets')">View All Tickets</button>
          <button class="btn btn-primary" onclick="navigate('manage-users')">Manage Users</button>
          <button class="btn btn-primary" onclick="navigate('contractor-assign')">Contractors</button>
          <button class="btn btn-primary" onclick="navigate('reports')">Reports</button>
        </div>
      </div>

      <div class="card" style="margin-top:1.5rem;">
        <div class="card-header"><span class="card-title">Recent Tickets</span></div>
        <div class="card-body" style="padding:0;">
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Ticket ID</th><th>Title</th><th>Status</th><th>Priority</th><th>Date</th></tr>
              </thead>
              <tbody>
                ${recentTickets.length === 0 ? `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted)">No tickets available.</td></tr>` : recentTickets.map(t => `
                  <tr>
                    <td style="font-weight:700;color:var(--navy)">${t.ticket_id ? `TK-${t.ticket_id}` : '-'} </td>
                    <td>${escapeHtml(t.title || t.description || '-')}</td>
                    <td>${statusBadge(t.status_id == 1 ? 'pending' : t.status_id == 2 ? 'assigned' : t.status_id == 3 ? 'inprogress' : t.status_id == 4 ? 'completed' : t.status_id == 5 ? 'rejected' : (String(t.status || '').toLowerCase()))}</td>
                    <td>${priorityHtml(String(t.priority || 'medium'))}</td>
                    <td style="font-size:0.8rem">${t.date_created ? new Date(t.date_created).toLocaleDateString() : t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  } catch (err) {
    console.error('renderAdminDashboard failed:', err);
    return `<div class="card"><div class="card-body">Unable to load admin dashboard data right now. Please try again later.</div></div>`;
  }
}

async function renderAllTickets() {
  try {
    const res = await fetch("http://105.228.61.32:3000/tickets");
    const data = await res.json();

    if (!data || !Array.isArray(data)) {
      return `<div class="card"><div class="card-body">Failed to load tickets.</div></div>`;
    }

    return `
    <div class="page-header">
      <div>
        <div class="page-title">All Tickets</div>
        <div class="page-subtitle">Every submitted infrastructure ticket in the system (${data.length} total)</div>
      </div>
    </div>
    <div class="card">
      <div class="card-body" style="padding:0">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Title</th>
                <th>Description</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Asset ID</th>
                <th>User ID</th>
                <th>Date Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${data.length === 0 ? `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">No tickets found.</td></tr>` :
        data.map(t => `
                <tr id="ticket-row-${t.ticket_id}">
                  <td style="font-weight:700;color:var(--navy)">${t.ticket_id ? `TK-${t.ticket_id}` : '-'}</td>
                  <td>${t.title || '-'}</td>
                  <td style="font-size:0.8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.description || '-'}</td>
                  <td>${priorityHtml(t.priority || 'medium')}</td>
                  <td>${statusBadge(t.status_id == 1 ? 'pending' : t.status_id == 2 ? 'assigned' : t.status_id == 3 ? 'inprogress' : t.status_id == 4 ? 'completed' : t.status_id == 5 ? 'rejected' : 'pending')}</td>
                  <td>${t.asset_id || '-'}</td>
                  <td>${t.user_id || '-'}</td>
                 <td style="font-size:0.8rem">${t.date_created ? new Date(t.date_created).toLocaleDateString() : '-'}</td>
                 <td>
                 <button class="btn btn-sm btn-danger" onclick="deleteTicket(${t.ticket_id}, '${t.title?.replace(/'/g, '')}')">
                 Delete
                 </button>
                 </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  } catch (err) {
    console.error('renderAllTickets error:', err);
    return `<div class="card"><div class="card-body">Server error: ${err.message}</div></div>`;
  }
}
async function deleteTicket(ticketId, ticketTitle) {
  const confirmed = confirm(`Are you sure you want to delete ticket #${ticketId}: "${ticketTitle}"? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_URL}/tickets/${ticketId}`, {
      method: 'DELETE'
    });

    const data = await res.json();

    if (!data.success) {
      showToast('Delete failed: ' + data.message, 'error');
      return;
    }

    showToast(`🗑️ Ticket #${ticketId} deleted successfully.`, 'success');

    // Remove the row instantly without reloading
    const row = document.getElementById(`ticket-row-${ticketId}`);
    if (row) row.remove();

    // Keep in-memory ticket arrays in sync so assign-worker uses fresh data
    APP.allTickets = APP.allTickets.filter(t => String(t.raw_id || t.id).replace(/^TK-/, '') !== String(ticketId));
    APP.tickets = APP.tickets.filter(t => String(t.raw_id || t.id).replace(/^TK-/, '') !== String(ticketId));

    if (APP.currentPage === 'assign-worker') {
      navigate('assign-worker');
    }

  } catch (err) {
    showToast('Server error. Please try again.', 'error');
    console.error(err);
  }
}
function renderAssignWorker() {
  const tickets = APP.allTickets.length ? APP.allTickets : APP.tickets;
  const unassigned = tickets.filter(t => t.status === 'pending');
  const assigned = tickets.filter(t => t.worker !== null || t.status === 'assigned' || t.status === 'inprogress' || t.status === 'completed');

  return `
  <div class="page-header">
    <div>
      <div class="page-title">Assign Workers</div>
      <div class="page-subtitle">Assign open tickets to active contractors.</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <span class="card-title">Unassigned Tickets (${unassigned.length})</span>
    </div>
    <div class="card-body" style="padding:0">
      ${unassigned.length === 0
      ? `<div style="padding:2rem;text-align:center;color:#888">
              No pending tickets at the moment.
           </div>`
      : `<div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Title</th>
                  <th>Location</th>
                  <th>Priority</th>
                  <th>Assign To</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${unassigned.map(t => `
                <tr id="row-${t.id}">
                  <td style="font-weight:700;color:var(--navy)">${t.id}</td>
                  <td>${t.title}</td>
                  <td style="font-size:0.8rem">${t.location}</td>
                  <td>${priorityHtml(t.priority)}</td>
                  <td>
                    <select class="form-control" id="select-${t.id}" style="width:200px;">
                      <option value="">— Select Contractor —</option>
                      ${APP.workers.map(w => `
                        <option value="${w.id}">
                          ${w.name} · ${w.skill}
                        </option>
                      `).join('')}
                    </select>
                  </td>
                  <td>
                    <button 
                      class="btn btn-sm btn-primary" 
                      onclick="assignTicket('${t.id}', ${t.raw_id})">
                      Assign
                    </button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`
    }
    </div>
  </div>

  <div class="card" style="margin-top:1.5rem">
    <div class="card-header">
      <span class="card-title">Already Assigned (${assigned.length})</span>
    </div>
    <div class="card-body" style="padding:0">
      ${assigned.length === 0
      ? `<div style="padding:2rem;text-align:center;color:#888">
              No assigned tickets yet.
           </div>`
      : `<div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Title</th>
                  <th>Location</th>
                  <th>Priority</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${assigned.map(t => `
                <tr>
                  <td style="font-weight:700;color:var(--navy)">${t.id}</td>
                  <td>${t.title}</td>
                  <td style="font-size:0.8rem">${t.location}</td>
                  <td>${priorityHtml(t.priority)}</td>
                  <td>👷 ${resolveWorkerNameWithCompany(t)}</td>
                  <td>${statusBadge(t.status)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`
    }
    </div>
  </div>`;
}
async function assignTicket(appId, rawId) {
  const select = document.getElementById(`select-${appId}`);
  const workerId = select ? select.value : '';

  if (!workerId) {
    showToast('Please select a contractor first.', 'error');
    return;
  }

  const worker = APP.workers.find(w => w.id === workerId);
  const ticket = APP.allTickets.find(t => t.id === appId) || APP.tickets.find(t => t.id === appId);
  if (!worker || !ticket) return;

  try {
    const res = await fetch(`${API_URL}/assign-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: rawId, technician_id: workerId })
    });

    const data = await res.json();

    if (!data.success) {
      showToast('Assignment failed: ' + data.message, 'error');
      return;
    }

    // Update local state immediately
    const ticketInAll = APP.allTickets.find(t => t.id === appId);
    const ticketInUser = APP.tickets.find(t => t.id === appId);
    [ticketInAll, ticketInUser].forEach(t => {
      if (!t) return;
      t.worker = workerId;
      t.technician_id = String(workerId);
      t.workerName = worker.name;
      t.status = 'assigned';
    });

    showToast(`✅ ${appId} assigned to ${worker.name}`, 'success');
    navigate('assign-worker');

  } catch (err) {
    showToast('Server error. Please try again.', 'error');
    console.error(err);
  }
}
/*function assignTicket(ticketId) {
  const select = document.getElementById(`select-${ticketId}`);
  const workerId = select.value;

  if (!workerId) {
    showToast('Please select a contractor first.', 'error');
    return;
  }

  // Find the worker and ticket
  const worker = APP.workers.find(w => w.id === workerId);
  const ticket = APP.tickets.find(t => t.id === ticketId);

  if (!worker || !ticket) return;

  // Update the ticket
  ticket.worker = worker.name;
  ticket.status = 'assigned';

  // Increase worker active count
  worker.active += 1;

  showToast(`✅ ${ticketId} assigned to ${worker.name}`, 'success');

  // Refresh the page to reflect changes
  navigate('assign-worker');
}*/
async function loadAppData() {
  try {
    // Load all tickets
    const ticketRes = await fetch(`${API_URL}/tickets`);
    const ticketData = await ticketRes.json();

    APP.allTickets = ticketData.map(t => ({
      id: 'TK-' + t.ticket_id,
      raw_id: t.ticket_id,
      title: t.title,
      category: t.asset_type || 'Other',
      location: t.location || 'Unknown',
      priority: (t.priority || 'Medium').toLowerCase(),
      status: t.status_id === 1 ? 'pending'
        : t.status_id === 2 ? 'assigned'
          : t.status_id === 3 ? 'inprogress'
            : t.status_id === 4 ? 'completed'
              : 'pending',
      date: t.date_created ? t.date_created.split('T')[0] : '',
      worker: t.technician_id != null ? String(t.technician_id) : null,
      technician_id: t.technician_id != null ? String(t.technician_id) : null,
      workerName: t.technician_name || null,
      desc: t.description || ''
    }));

    // Load active technicians
    const techRes = await fetch(`${API_URL}/technicians`);
    const techData = await techRes.json();

    APP.workers = techData.technicians.map(t => ({
      id: String(t.technician_id),
      name: t.name + ' ' + t.surname,
      skill: t.skill_type || 'General',
      dept: t.skill_type || 'Technician'
    }));

    APP.technicians = Array.isArray(techData.technicians) ? techData.technicians.slice() : [];
    APP.companies = [];

  } catch (err) {
    showToast('Failed to load data from server.', 'error');
    console.error(err);
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadContractorAdminData() {
  try {
    const [companyRes, techRes, candidateRes] = await Promise.all([
      fetch(`${API_URL}/companies`),
      fetch(`${API_URL}/technicians/all`),
      fetch(`${API_URL}/users/technician-candidates`)
    ]);

    const [companyData, techData, candidateData] = await Promise.all([companyRes.json(), techRes.json(), candidateRes.json()]);
    APP.companies = companyData.companies || [];
    APP.technicians = techData.technicians || [];
    APP.technicianCandidates = candidateData.users || [];
  } catch (err) {
    showToast('Failed to load contractor data.', 'error');
    console.error(err);
  }
}

function getCompanyName(companyId) {
  const company = APP.companies.find(c => String(c.company_id) === String(companyId));
  return company ? company.company_name : 'Unassigned';
}

function companyWorkers(companyId) {
  return APP.technicians.filter(t => String(t.company_id) === String(companyId));
}

async function renderContractorAssignments() {
  await loadContractorAdminData();
  const companies = APP.companies || [];

  return `
  <div class="page-header">
    <div>
      <div class="page-title">Contractors Management</div>
      <div class="page-subtitle">Manage registered companies and their technicians.</div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><span class="card-title">Add New Company</span></div>
    <div class="card-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <input class="form-control" id="new-company-name" placeholder="Company Name">
        <input class="form-control" id="new-company-email" placeholder="Email">
        <input class="form-control" id="new-company-phone" placeholder="Phone">
        <textarea class="form-control" id="new-company-address" placeholder="Address"></textarea>
        <textarea class="form-control" id="new-company-info" placeholder="Info / Notes"></textarea>
      </div>
      <button class="btn btn-primary" style="margin-top:1rem;" onclick="addCompany()">Add Company</button>
    </div>
  </div>

  <div class="card" style="margin-top:1.5rem;">
    <div class="card-header"><span class="card-title">Companies (${companies.length})</span></div>
    <div class="card-body" style="padding:0;">
      ${companies.length === 0 ? `
        <div style="padding:2rem;text-align:center;color:#888">No companies found.</div>
      ` : `
        <div class="table-wrap">
          <table>
            <tbody>
              ${companies.map((c, idx) => `
                <tr id="company-row-${c.company_id}" style="border-bottom:1px solid #e2e8f0;">
                  <td style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">
                    <div style="font-weight:700;color:var(--navy);">${escapeHtml(c.company_name)}</div>
                    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;justify-content:flex-end;">
                      <button class="btn btn-sm btn-secondary" onclick="toggleCompanyDetails(${c.company_id})">Details</button>
                      <button class="btn btn-sm btn-primary" onclick="saveCompany(${c.company_id})">Save</button>
                      <button class="btn btn-sm btn-danger" onclick="deleteCompany(${c.company_id})">Delete</button>
                    </div>
                  </td>
                  <td></td>
                </tr>
                <tr id="company-details-${c.company_id}" style="display:none;">
                  <td colspan="2" style="background:#f8f9fb;padding:1rem;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:1rem;">
                      <div>
                        <label style="font-weight:600;">Name</label>
                        <input class="form-control" id="company-name-${c.company_id}" value="${escapeHtml(c.company_name)}">
                      </div>
                      <div>
                        <label style="font-weight:600;">Email</label>
                        <input class="form-control" id="company-email-${c.company_id}" value="${escapeHtml(c.company_email)}">
                      </div>
                      <div>
                        <label style="font-weight:600;">Phone</label>
                        <input class="form-control" id="company-phone-${c.company_id}" value="${escapeHtml(c.company_phone)}">
                      </div>
                      <div>
                        <label style="font-weight:600;">Address</label>
                        <textarea class="form-control" id="company-address-${c.company_id}" style="min-height:60px;">${escapeHtml(c.company_address)}</textarea>
                      </div>
                      <div style="grid-column:1 / -1;">
                        <label style="font-weight:600;">Info</label>
                        <textarea class="form-control" id="company-info-${c.company_id}" style="min-height:80px;">${escapeHtml(c.company_info)}</textarea>
                      </div>
                    </div>
                    <div style="font-weight:700;margin-bottom:0.5rem;">Workers at ${escapeHtml(c.company_name)}</div>
                    ${companyWorkers(c.company_id).length === 0 ? `
                      <div style="color:#666;padding:0.5rem 0;">No workers currently assigned.</div>
                    ` : `
                      <div class="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>User</th>
                              <th>Skill</th>
                              <th>Status</th>
                              <th>Company</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            ${companyWorkers(c.company_id).map(t => `
                              <tr id="tech-row-${t.technician_id}">
                                <td>${t.technician_id}</td>
                                <td>${escapeHtml(t.name)} ${escapeHtml(t.surname)}<br><small>${escapeHtml(t.email)}</small></td>
                                <td><input class="form-control" id="tech-skill-${t.technician_id}" value="${escapeHtml(t.skill_type)}"></td>
                                <td>
                                  <select class="form-control" id="tech-status-${t.technician_id}">
                                    <option value="Active" ${t.technician_status === 'Active' ? 'selected' : ''}>Active</option>
                                    <option value="Inactive" ${t.technician_status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                                    <option value="On Leave" ${t.technician_status === 'On Leave' ? 'selected' : ''}>On Leave</option>
                                  </select>
                                </td>
                                <td>
                                  <select class="form-control" id="tech-company-${t.technician_id}">
                                    ${companies.map(companyOption => `
                                      <option value="${companyOption.company_id}" ${String(companyOption.company_id) === String(t.company_id) ? 'selected' : ''}>
                                        ${escapeHtml(companyOption.company_name)}
                                      </option>
                                    `).join('')}
                                  </select>
                                </td>
                                <td style="white-space:nowrap;">
                                  <button class="btn btn-sm btn-primary" onclick="saveTechnician(${t.technician_id})">Save</button>
                                  <button class="btn btn-sm btn-danger" onclick="deleteTechnician(${t.technician_id})" style="margin-left:0.4rem;">Delete</button>
                                </td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    `}
                    <div style="margin-top:1rem;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;align-items:end;">
                      <div>
                        <label style="font-weight:600;">Technician</label>
                        <select class="form-control" id="new-tech-user-${c.company_id}">
                          <option value="">Select technician user</option>
                          ${APP.technicianCandidates.map(user => `
                            <option value="${user.user_id}">${escapeHtml(user.name)} ${escapeHtml(user.surname)} (${escapeHtml(user.email)})</option>
                          `).join('')}
                        </select>
                      </div>
                      <div>
                        <label style="font-weight:600;">Skill Type</label>
                        <input class="form-control" id="new-tech-skill-${c.company_id}" placeholder="Skill Type">
                      </div>
                      <div>
                        <label style="font-weight:600;">Status</label>
                        <select class="form-control" id="new-tech-status-${c.company_id}">
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="On Leave">On Leave</option>
                        </select>
                      </div>
                      <button class="btn btn-primary" onclick="addTechnician(${c.company_id})">Add Worker</button>
                    </div>
                  </td>
                </tr>
                ${idx < companies.length - 1 ? '<tr><td colspan="2" style="padding:0"><div style="height:1rem;background:#f5f7fb"></div></td></tr>' : ''}
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  </div>`;
}

async function addCompany() {
  const company_name = document.getElementById('new-company-name')?.value.trim();
  const company_email = document.getElementById('new-company-email')?.value.trim();
  const company_phone = document.getElementById('new-company-phone')?.value.trim();
  const company_address = document.getElementById('new-company-address')?.value.trim();
  const company_info = document.getElementById('new-company-info')?.value.trim();

  if (!company_name) {
    showToast('Company name is required.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name, company_email, company_phone, company_address, company_info })
    });
    const data = await res.json();
    if (!data.success) {
      showToast('Create company failed: ' + data.message, 'error');
      return;
    }
    showToast('Company added successfully.', 'success');
    navigate('contractor-assign');
  } catch (err) {
    showToast('Server error creating company.', 'error');
    console.error(err);
  }
}

async function saveCompany(companyId) {
  const company_name = document.getElementById(`company-name-${companyId}`)?.value.trim();
  const company_email = document.getElementById(`company-email-${companyId}`)?.value.trim();
  const company_phone = document.getElementById(`company-phone-${companyId}`)?.value.trim();
  const company_address = document.getElementById(`company-address-${companyId}`)?.value.trim();
  const company_info = document.getElementById(`company-info-${companyId}`)?.value.trim();

  if (!company_name) {
    showToast('Company name is required.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/companies/${companyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name, company_email, company_phone, company_address, company_info })
    });
    const data = await res.json();
    if (!data.success) {
      showToast('Update failed: ' + data.message, 'error');
      return;
    }
    showToast('Company updated successfully.', 'success');
    navigate('contractor-assign');
  } catch (err) {
    showToast('Server error updating company.', 'error');
    console.error(err);
  }
}

async function deleteCompany(companyId) {
  const confirmed = confirm('Delete this company? This will fail if technicians are still attached.');
  if (!confirmed) return;
  try {
    const res = await fetch(`${API_URL}/companies/${companyId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) {
      showToast('Delete failed: ' + data.message, 'error');
      return;
    }
    showToast('Company deleted.', 'success');
    navigate('contractor-assign');
  } catch (err) {
    showToast('Server error deleting company.', 'error');
    console.error(err);
  }
}

async function addTechnician(companyId) {
  const user_id = document.getElementById(`new-tech-user-${companyId}`)?.value;
  const skill_type = document.getElementById(`new-tech-skill-${companyId}`)?.value.trim();
  const technician_status = document.getElementById(`new-tech-status-${companyId}`)?.value;

  if (!user_id || !skill_type) {
    showToast('Technician user and skill are required.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/technicians`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: Number(user_id), company_id: companyId, skill_type, technician_status })
    });
    const data = await res.json();
    if (!data.success) {
      showToast('Add worker failed: ' + data.message, 'error');
      return;
    }
    showToast('Worker added.', 'success');
    navigate('contractor-assign');
  } catch (err) {
    showToast('Server error adding worker.', 'error');
    console.error(err);
  }
}

async function saveTechnician(technicianId) {
  const skill_type = document.getElementById(`tech-skill-${technicianId}`)?.value.trim();
  const technician_status = document.getElementById(`tech-status-${technicianId}`)?.value;
  const company_id = document.getElementById(`tech-company-${technicianId}`)?.value;

  try {
    const res = await fetch(`${API_URL}/technicians/${technicianId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_type, technician_status, company_id: Number(company_id) })
    });
    const data = await res.json();
    if (!data.success) {
      showToast('Update worker failed: ' + data.message, 'error');
      return;
    }
    showToast('Worker updated.', 'success');
    navigate('contractor-assign');
  } catch (err) {
    showToast('Server error updating worker.', 'error');
    console.error(err);
  }
}

async function deleteTechnician(technicianId) {
  const confirmed = confirm('Delete this worker?');
  if (!confirmed) return;
  try {
    const res = await fetch(`${API_URL}/technicians/${technicianId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) {
      showToast('Delete failed: ' + data.message, 'error');
      return;
    }
    showToast('Worker deleted.', 'success');
    navigate('contractor-assign');
  } catch (err) {
    showToast('Server error deleting worker.', 'error');
    console.error(err);
  }
}

function toggleCompanyDetails(companyId) {
  const detailsRow = document.getElementById(`company-details-${companyId}`);
  if (!detailsRow) return;
  detailsRow.style.display = detailsRow.style.display === 'none' || detailsRow.style.display === '' ? 'table-row' : 'none';
}

function getCompanyForTechnician(technicianId) {
  if (!technicianId) return null;
  const tech = APP.technicians.find(t => String(t.technician_id) === String(technicianId));
  if (!tech || !tech.company_id) return null;
  return APP.companies.find(c => String(c.company_id) === String(tech.company_id)) || null;
}

function resolveWorkerName(ticket) {
  if (ticket.workerName) return ticket.workerName;
  if (!ticket.worker) return null;
  const worker = APP.workers.find(w => String(w.id) === String(ticket.worker));
  return worker ? worker.name : null;
}

function resolveWorkerNameWithCompany(ticket) {
  const name = resolveWorkerName(ticket) || (ticket.worker ? 'Technician #' + ticket.worker : 'Unassigned');
  const company = getCompanyForTechnician(ticket.worker);
  return company ? `${name} (${company.company_name})` : name;
}

async function renderManageUsers() {
  try {
    const res = await fetch(`${API_URL}/users`);
    const data = await res.json();

    if (!data.success) {
      return `<div class="card"><div class="card-body">Failed to load users.</div></div>`;
    }

    // store users in-app so we can sort without refetching
    APP.managedUsers = Array.isArray(data.users) ? data.users.slice() : [];

    // determine header sort markers
    const idMarker = APP.managedUsersSort.field === 'user_id' ? (APP.managedUsersSort.asc ? ' ▲' : ' ▼') : '';
    const roleMarker = APP.managedUsersSort.field === 'role' ? (APP.managedUsersSort.asc ? ' ▲' : ' ▼') : '';

    return `
    <div class="page-header">
      <div>
        <div class="page-title">Manage Users</div>
        <div class="page-subtitle">All registered system users (${APP.managedUsers.length} total)</div>
      </div>
    </div>
    <div class="card">
      <div class="card-body" style="padding:0">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th id="th-id" style="cursor:pointer" onclick="toggleUserSort('user_id')">ID${idMarker}</th>
                <th>Name</th>
                <th>Surname</th>
                <th>Email</th>
                <th>Cellphone</th>
                <th>Password</th>
                <th id="th-role" style="cursor:pointer" onclick="toggleUserSort('role')">Role${roleMarker}</th>
                <th></th>
              </tr>
            </thead>
            <tbody class="manage-users-tbody">
              ${APP.managedUsers.map(u => `
                <tr id="user-row-${u.user_id}">
                  <td style="font-weight:700;color:var(--navy)">${u.user_id}</td>
                  <td><input class="form-control" id="u-name-${u.user_id}"      value="${escapeHtml(u.name)}"           style="min-width:90px"></td>
                  <td><input class="form-control" id="u-surname-${u.user_id}"   value="${escapeHtml(u.surname)}"        style="min-width:90px"></td>
                  <td><input class="form-control" id="u-email-${u.user_id}"     value="${escapeHtml(u.email)}"          style="min-width:150px"></td>
                  <td><input class="form-control" id="u-cellphone-${u.user_id}" value="${escapeHtml(u.cellphone || '')}" style="min-width:110px"></td>
                  <td><input class="form-control" id="u-password-${u.user_id}"  value="${escapeHtml(u.password || '')}"       style="min-width:110px"></td>
                  <td>${escapeHtml(u.role)}</td>
                  <td>
                    <button class="btn btn-sm btn-primary" onclick="saveUserEdit(${u.user_id})">Save</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.user_id}, '${(String(u.name || '') + ' ' + String(u.surname || '')).replace(/'/g, "")}')" style="margin-left:6px">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  } catch (err) {
    return `<div class="card"><div class="card-body">Server error loading users.</div></div>`;
  }
}
async function deleteUser(userId, userName) {
  const confirmed = confirm(`Are you sure you want to delete ${userName}? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_URL}/users/${userId}`, {
      method: 'DELETE'
    });

    const data = await res.json();

    if (!data.success) {
      showToast('Delete failed: ' + data.message, 'error');
      return;
    }

    showToast(`🗑️ ${userName} has been deleted.`, 'success');

    // Remove the row from the table instantly without reloading
    const row = document.getElementById(`user-row-${userId}`);
    if (row) row.remove();

  } catch (err) {
    showToast('Server error. Please try again.', 'error');
    console.error(err);
  }
}
async function saveUserEdit(userId) {
  const name = document.getElementById(`u-name-${userId}`)?.value.trim();
  const surname = document.getElementById(`u-surname-${userId}`)?.value.trim();
  const email = document.getElementById(`u-email-${userId}`)?.value.trim();
  const cellphone = document.getElementById(`u-cellphone-${userId}`)?.value.trim();
  const password = document.getElementById(`u-password-${userId}`)?.value.trim();

  if (!name || !surname || !email || !password) {
    showToast('Name, surname, email and password are required.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, surname, email, cellphone, password })
    });

    const data = await res.json();

    if (!data.success) {
      showToast('Update failed: ' + data.message, 'error');
      return;
    }

    showToast(`✅ User #${userId} updated successfully`, 'success');

  } catch (err) {
    showToast('Server error. Please try again.', 'error');
    console.error(err);
  }
}
function renderReports() { return `<div class="card"><div class="card-body"><h3>Departmental Performance Metrics</h3></div></div>`; }

function renderNotifications() {
  const isWorker = APP.currentRole === 'worker';

  const myRelevantData = APP.tickets.filter(t =>
    isWorker ? String(t.technician_id) === String(APP.currentUser.technician_id) : t.user_id == APP.currentUser.id
  );

  if (isWorker) {
    const emergencyAssignments = myRelevantData.filter(t => t.priority === 'high' && t.status !== 'completed');
    const confirmedDoneJobs = myRelevantData.filter(t => t.status === 'completed');

    return `
      <div class="page-header">
        <div><div class="page-title">Notifications Hub</div></div>
      </div>
      ${emergencyAssignments.length > 0 ? `
        <div class="card" style="margin-bottom: 2rem; border-left: 8px solid #E53E3E;">
          <div class="card-body">
            <strong>🚨 EMERGENCY DISPATCH:</strong> You have ${emergencyAssignments.length} high-priority fault(s).
            <button class="btn btn-danger" onclick="navigate('assigned-jobs')">Open Work Orders</button>
          </div>
        </div>` : '<div class="card"><div class="card-body">✅ No critical emergencies.</div></div>'}
      
      <div class="card">
        <div class="card-header">🔄 Administrative Job Closures</div>
        <div class="card-body">
          ${confirmedDoneJobs.map(job => `
            <div style="padding: 1rem; border-bottom: 1px solid #eee;">
              ✅ Administrator confirmed and closed Ticket <strong>${job.id}</strong>: "${job.title}"
            </div>`).join('') || 'No confirmed resolved jobs.'}
        </div>
      </div>`;
  }

  const completedComplaints = myRelevantData.filter(t => t.status === 'completed');

  return `
    <div class="page-header">
      <div class="page-title">My Notifications</div>
    </div>
    <div class="card">
      <div class="card-body">
        ${completedComplaints.length === 0 ? `
          <div style="text-align: center; padding: 2rem; color: #718096;">
            No new updates on your reports yet.
          </div>
        ` : completedComplaints.map(t => `
          <div style="padding: 1.5rem; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 1rem;">
            <div style="font-size: 1.5rem;">✅</div>
            <div>
              <div style="font-weight: 700; font-size: 1.1rem;">Your work is done</div>
              <div style="color: #4A5568;">
                Your report for <strong>${t.title}</strong> (ID: ${t.id}) has been successfully resolved.
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function renderProfile() {
  const user = APP.currentUser;
  if (!user) {
    return `<div class="card"><div class="card-body"><p>No active session found.</p></div></div>`;
  }

  const isWorker = APP.currentRole === 'worker';

  let statusSection = '';
  if (isWorker) {
    const currentStatus = user.technician_status || 'Active';
    let statusBadgeColor = '#38A169';
    if (currentStatus === 'Inactive') statusBadgeColor = '#718096';
    if (currentStatus === 'On Leave') statusBadgeColor = '#DD6B20';

    statusSection = `
      <div style="display: inline-block; margin-top: 0.5rem; padding: 0.25rem 0.75rem; background: ${statusBadgeColor}; color: white; border-radius: 20px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase;">
        ● ${currentStatus}
      </div>`;
  }

  let professionalDetails = '';
  if (isWorker) {
    professionalDetails = `
      <div class="detail-row"><label>Employee ID:</label> <span>#${user.technician_id || 'EMP-000'}</span></div>
      <div class="detail-row"><label>User ID:</label> <span>#${user.id || 'UID-unknown'}</span></div>
      <div class="detail-row"><label>Operational Status:</label> <span>${user.technician_status || 'Active'}</span></div>
    `;
  } else {
    professionalDetails = `
      <div class="detail-row"><label>Account Type:</label> <span>Registered Citizen</span></div>
      <div class="detail-row"><label>Region:</label> <span>City of Johannesburg</span></div>
    `;
  }

  return `
  <div class="page-header">
    <div>
      <div class="page-title">User Profile</div>
      <div class="page-subtitle">Personal account information and system credentials.</div>
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem; align-items: start;">
    <div class="card" style="text-align: center; padding: 2rem;">
      <div style="width: 90px; height: 90px; background: var(--navy); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; margin: 0 auto 0.5rem auto;">
        ${user.initials}
      </div>
      <h3 style="margin: 0;">${user.name}</h3>
      <p style="color: var(--muted); font-size: 0.9rem; margin-bottom: 0.5rem;">${user.email}</p>
      ${statusSection}
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Credentials</span></div>
      <div class="card-body" style="display: flex; flex-direction: column; gap: 1rem;">
        ${professionalDetails}
      </div>
    </div>
  </div>
  `;
}

// ── MODAL POPUP FOR TICKET DETAILS ────────────────────────────
async function showTicketDetail(ticketId) {
  const ticket = APP.tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  let imageHtml = '';
  try {
    const ticketNumId = String(ticketId).replace(/^TK-/, '');
    const ownerIds = [ticket.reporterId, ticket.user_id, ticket.creator_id, ticket.reporter_id, APP.currentUser?.id].filter(Boolean);
    for (const ownerId of ownerIds) {
      const imageUrl = `http://105.228.61.32:3001/picture/${ticketNumId}/${ownerId}`;
      try {
        const checkRes = await fetch(imageUrl);
        if (checkRes.ok && checkRes.headers.get('content-type')?.includes('image')) {
          imageHtml = `<div style="margin-top:1rem; text-align:center;"><img src="${imageUrl}" alt="Ticket picture" style="max-width:100%; max-height:300px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.1);"></div>`;
          break;
        }
      } catch (err) {
        // continue to next candidate
      }
    }
  } catch (err) {
    console.log('No image for ticket', ticketId);
  }

  const reporterInfo = ticket.reporterName ? `${ticket.reporterName} (${ticket.reporterId ? `ID: ${ticket.reporterId}` : 'ID: unknown'})` : (ticket.user_id ? `User #${ticket.user_id}` : 'Citizen user details unavailable');
  const overlayHtml = `
    <div class="modal-overlay" id="ticket-modal" onclick="closeTicketModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">Fault Summary: ${ticket.id}</div>
          <button class="modal-close" onclick="closeTicketModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
             <h4>${catIcon(ticket.category)} ${ticket.title}</h4>
             ${statusBadge(ticket.status)}
          </div>
          <p style="margin-bottom:0.75rem;"><strong>Region / Location:</strong> ${ticket.location}</p>
          <p style="margin-bottom:0.75rem;"><strong>Reported Date:</strong> ${ticket.date}</p>
          <p style="margin-bottom:0.75rem;"><strong>Reported By:</strong> ${reporterInfo}</p>
          <div style="background:#F4F6F9; padding:1rem; border-radius:4px; margin-top:1rem;">
             <strong>Description:</strong><br>
             <span style="font-size:0.9rem;">${ticket.desc || 'No details provided.'}</span>
          </div>
          ${imageHtml}
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="closeTicketModal()">Close Window</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('ticket-modal-container').innerHTML = overlayHtml;
}

function closeTicketModal() {
  const modal = document.getElementById('ticket-modal');
  if (modal) modal.remove();
}

function bindPageEvents(page) {
  if (page === 'create-ticket') {
    const form = document.getElementById('create-ticket-form');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); submitTicket(); });

    const categorySelect = document.getElementById('t-cat');
    if (categorySelect) {
      categorySelect.addEventListener('change', () => updateLocationOptions(categorySelect.value));
    }
  }
}

function formatTicketRow(row) {
  const ticketId = row.ticket_id || row.id;
  const status = row.status ||
    (row.status_id === 1 ? 'pending'
      : row.status_id === 2 ? 'assigned'
        : row.status_id === 3 ? 'inprogress'
          : row.status_id === 4 ? 'completed'
            : 'pending');

  return {
    id: ticketId && String(ticketId).startsWith('TK-') ? String(ticketId) : `TK-${ticketId}`,
    title: row.title || '',
    category: row.category || row.asset_type || 'Other',
    location: row.location || `${row.street || ''}${row.suburb ? ', ' + row.suburb : ''}`.trim(),
    status,
    priority: (String(row.priority || 'medium')).toLowerCase(),
    date: row.date ? String(row.date).split('T')[0] : '',
    worker: row.worker || null,
    technician_id: row.technician_id != null ? String(row.technician_id) : (row.technicianId != null ? String(row.technicianId) : null),
    user_id: row.user_id || row.creator_id || row.reporter_id || row.requester_id || null,
    reporterId: row.user_id || row.creator_id || row.reporter_id || row.requester_id || null,
    reporterName: row.reporter_name || row.user_name || row.name || row.reporter || row.requester || null,
    desc: row.description || row.desc || ''
  };
}

function filterLocationsByCategory(category) {
  if (!category) return [];
  return APP.locations.filter(loc => Array.isArray(loc.asset_types) && loc.asset_types.includes(category));
}

function buildLocationOptions(category) {
  const availableLocations = filterLocationsByCategory(category);
  if (!category) {
    return `<option value="">— Select Category First —</option>`;
  }
  if (availableLocations.length === 0) {
    return `<option value="">No locations available for selected category</option>`;
  }

  return [`
    <option value="">— Select Location —</option>`,
    ...availableLocations.map(loc => {
      const displayText = `${loc.street}, ${loc.suburb}`;
      return `<option value="${displayText}">${displayText}</option>`;
    })
  ].join('');
}

function updateLocationOptions(category) {
  const locationSelect = document.getElementById('t-loc');
  if (!locationSelect) return;
  locationSelect.innerHTML = buildLocationOptions(category);
  locationSelect.disabled = !category || filterLocationsByCategory(category).length === 0;
}

async function loadLocations() {
  if (APP.locations.length > 0) return;

  try {
    const res = await fetch(`${API_URL}/locations`);
    const data = await res.json();

    if (data.success) {
      APP.locations = data.locations.map(loc => ({
        ...loc,
        asset_types: Array.isArray(loc.asset_types)
          ? loc.asset_types
          : String(loc.asset_types || '').split(',').map(s => s.trim()).filter(Boolean)
      }));
    }
  } catch (err) {
    console.error('Error loading locations:', err);
  }
}

async function loadUserTickets() {
  if (!APP.currentUser?.id) {
    APP.tickets = [];
    refreshMyTicketsBadge();
    return;
  }

  try {
    // FIX 6: changed APP.currentUser.user_id to APP.currentUser.id in both endpoints
    let endpoint = `${API_URL}/tickets/user/${encodeURIComponent(APP.currentUser.id)}`;

    if (APP.currentRole === 'worker') {
      // Prefer the technician_id (employee id) when available, otherwise fall back to user id
      const techId = APP.currentUser?.technician_id || APP.currentUser?.id;
      endpoint = `${API_URL}/tickets/technician/${encodeURIComponent(techId)}`;
    }

    const res = await fetch(endpoint);
    const data = await res.json();
    if (data.success && Array.isArray(data.tickets)) {
      APP.tickets = data.tickets.map(formatTicketRow);
    } else {
      APP.tickets = [];
    }
  } catch (err) {
    console.error('Error loading user tickets:', err);
    APP.tickets = [];
  }

  refreshMyTicketsBadge();
  refreshWorkerJobsBadge();
}

async function uploadTicketImage(ticketId, file) {
  if (!file || !ticketId || !APP.currentUser?.id) {
    return { success: false, message: 'Missing required fields for image upload.' };
  }

  const formData = new FormData();
  formData.append('picture', file);
  // Strip TK- prefix if present
  const cleanTicketId = String(ticketId).replace(/^TK-/, '');
  formData.append('ticket_id', cleanTicketId);
  formData.append('user_id', String(APP.currentUser.id));

  try {
    const res = await fetch('http://105.228.61.32:3001/upload-picture', {
      method: 'POST',
      body: formData
    });
    return await res.json();
  } catch (err) {
    console.error('Image upload error', err);
    return { success: false, message: 'Unable to upload ticket image.' };
  }
}

async function submitTicket() {
  const title = document.getElementById('t-title')?.value.trim();
  const cat = document.getElementById('t-cat')?.value;
  const desc = document.getElementById('t-desc')?.value.trim();
  const imageFile = document.getElementById('t-image')?.files?.[0] || null;
  const loc = document.getElementById('t-loc')?.value.trim();
  const pri = (document.getElementById('t-priority')?.value || 'Medium');
  if (!title || !cat || !desc || !loc || !pri) { showToast('Please fill in required fields.', 'error'); return; }

  try {
    const res = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category: cat, description: desc, location: loc, priority: pri, user_id: APP.currentUser?.id })
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.message || 'Failed to submit ticket.', 'error');
      return;
    }

    // Extract ticket ID from response (could be data.id, data.ticket_id, or data.data.ticket_id)
    const newTicketId = data.id || data.ticket_id || data.data?.ticket_id;
    if (!newTicketId) {
      showToast('Ticket created but ID not found in response.', 'warning');
      await loadUserTickets();
      setTimeout(() => navigate('my-tickets'), 1000);
      return;
    }

    let message = '🎉 Ticket submitted!';
    let toastType = 'success';

    if (imageFile) {
      const uploadResult = await uploadTicketImage(newTicketId, imageFile);
      if (!uploadResult.success) {
        message = uploadResult.message || 'Ticket created, but image upload failed.';
        toastType = 'warning';
      } else {
        message = '🎉 Ticket and picture uploaded successfully!';
      }
    }

    showToast(message, toastType);

    // Clear the form
    const form = document.getElementById('create-ticket-form');
    if (form) form.reset();

    // Reload tickets and navigate
    await loadUserTickets();
    refreshMyTicketsBadge();
    setTimeout(() => navigate('my-tickets'), 800);
  } catch (err) {
    console.error('Submit ticket error', err);
    showToast('Server error while submitting ticket.', 'error');
  }
}

// ── LOGOUT ────────────────────────────────────────────────────
function logout() {
  APP.currentUser = null; APP.currentRole = null;
  showScreen('home-screen');
  showToast('You have been logged out.', 'info');
}
// Toggle sort for managed users and re-render the table body
function toggleUserSort(field) {
  if (!APP.managedUsers || !Array.isArray(APP.managedUsers)) return;

  if (APP.managedUsersSort.field === field) {
    APP.managedUsersSort.asc = !APP.managedUsersSort.asc;
  } else {
    APP.managedUsersSort.field = field;
    APP.managedUsersSort.asc = true;
  }

  const dir = APP.managedUsersSort.asc ? 1 : -1;

  APP.managedUsers.sort((a, b) => {
    const av = a[field] == null ? '' : a[field];
    const bv = b[field] == null ? '' : b[field];
    if (field === 'user_id') {
      const na = Number(av);
      const nb = Number(bv);
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    }
    return String(av).toLowerCase().localeCompare(String(bv).toLowerCase()) * dir;
  });

  // update header markers
  const thId = document.getElementById('th-id');
  const thRole = document.getElementById('th-role');
  if (thId) thId.textContent = 'ID' + (APP.managedUsersSort.field === 'user_id' ? (APP.managedUsersSort.asc ? ' ▲' : ' ▼') : '');
  if (thRole) thRole.textContent = 'Role' + (APP.managedUsersSort.field === 'role' ? (APP.managedUsersSort.asc ? ' ▲' : ' ▼') : '');

  // re-render tbody
  const tbody = document.querySelector('.manage-users-tbody');
  if (!tbody) return;

  tbody.innerHTML = APP.managedUsers.map(u => `
    <tr id="user-row-${u.user_id}">
      <td style="font-weight:700;color:var(--navy)">${u.user_id}</td>
      <td><input class="form-control" id="u-name-${u.user_id}"      value="${escapeHtml(u.name)}"           style="min-width:90px"></td>
      <td><input class="form-control" id="u-surname-${u.user_id}"   value="${escapeHtml(u.surname)}"        style="min-width:90px"></td>
      <td><input class="form-control" id="u-email-${u.user_id}"     value="${escapeHtml(u.email)}"          style="min-width:150px"></td>
      <td><input class="form-control" id="u-cellphone-${u.user_id}" value="${escapeHtml(u.cellphone || '')}" style="min-width:110px"></td>
      <td><input class="form-control" id="u-password-${u.user_id}"  value="${escapeHtml(u.password || '')}"       style="min-width:110px"></td>
      <td>${escapeHtml(u.role)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="saveUserEdit(${u.user_id})">Save</button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.user_id}, '${(String(u.name || '') + ' ' + String(u.surname || '')).replace(/'/g, "")}')" style="margin-left:6px">Delete</button>
      </td>
    </tr>
  `).join('');
}