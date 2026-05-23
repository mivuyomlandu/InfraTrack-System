/* ================================================================
   City of Johannesburg – Public Works System
   Main Application JavaScript
   ================================================================ */

'use strict';

// ── STATE ─────────────────────────────────────────────────────
const API_URL = "http://localhost:3000";

const APP = {
  currentUser: null,
  currentRole: null,
  currentPage: null,
  tickets: [],
  workers: [],
  locations: []  
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
    name: `${user.name || ''} ${user.surname || ''}`.trim() || user.email || 'User',
    initials: ((user.name?.[0] || user.email?.[0] || 'U') + (user.surname?.[0] || '')).toUpperCase(),
    email: user.email || '',
    technician_status: user.technician_status || (normalizedRole === 'worker' ? 'Active' : null)  };
  APP.currentRole = normalizedRole;
  loadApp();
}

// ── TOAST MESSAGES ───────────────────────────────────────────
function showToast(msg, type='info') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(100%)'; t.style.transition='all 0.3s'; setTimeout(()=>t.remove(),300); }, 3200);
}

// ── STATUS BADGE HTML ──────────────────────────────────────────
function statusBadge(s) {
  const map = { pending:'badge-pending', assigned:'badge-assigned', inprogress:'badge-inprogress', completed:'badge-completed' };
  const label = { pending:'Pending', assigned:'Assigned', inprogress:'In Progress', completed:'Completed' };
  return `<span class="badge ${map[s]||''}">${label[s]||s}</span>`;
}

// ── PRIORITY HTML ──────────────────────────────────────────────
function priorityHtml(p) {
  return `<span class="priority ${p}"><span class="priority-dot"></span>${p.charAt(0).toUpperCase()+p.slice(1)}</span>`;
}

// ── CATEGORY ICON ──────────────────────────────────────────────
function catIcon(c) {
  return { Water:'💧', Road:'🚧', Electric:'⚡', Other:'📋' }[c] || '📋';
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
    'dashboard-citizen':  renderCitizenDashboard,
    'create-ticket':      renderCreateTicket,
    'my-tickets':         renderMyTickets,
    'dashboard-worker':   renderWorkerDashboard,
    'assigned-jobs':      renderAssignedJobs,
    'dashboard-admin':    renderAdminDashboard,
    'all-tickets':        renderAllTickets,
    'assign-worker':      renderAssignWorker,
    'manage-users':       renderManageUsers,
    'reports':            renderReports,
    'notifications':      renderNotifications,
    'profile':            renderProfile,
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
  const API_URL = "http://localhost:3000";

  //localhost

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
          body: JSON.stringify({
            role,
            name,
            surname,
            email,
            cellphone,
            password
          })
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
  await loadUserTickets();
  try {
  await loadAppData();
  } catch (err) {
  console.error('loadAppData failed:', err);
  }
  buildSidebar();

  const defaultPage = {
    citizen: 'dashboard-citizen',
    worker:  'dashboard-worker',
    admin:   'dashboard-admin',
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
      <a class="nav-link" data-page="assigned-jobs"><span class="icon">🔧</span>Assigned Jobs <span class="nav-badge" id="worker-jobs-badge">0</span></a>
      <div class="sidebar-section-label">Account</div>
      <a class="nav-link" data-page="notifications"><span class="icon">🔔</span>Notifications</a>
      <a class="nav-link" data-page="profile"><span class="icon">👤</span>Profile</a>`,
    admin: `
      <div class="sidebar-section-label">Management</div>
      <a class="nav-link" data-page="dashboard-admin"><span class="icon">🏠</span>Dashboard</a>
      <a class="nav-link" data-page="all-tickets"><span class="icon">📋</span>All Tickets</a>
      <a class="nav-link" data-page="assign-worker"><span class="icon">👷</span>Assign Workers</a>
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

function refreshWorkerJobsBadge() {
  const badge = document.getElementById('worker-jobs-badge');
  if (badge && APP.currentUser?.id) {
    const activeJobs = APP.tickets.filter(t => 
      String(t.technician_id) === String(APP.currentUser.id) && 
      t.status !== 'completed'
    ).length;
    
    badge.textContent = String(activeJobs);
  }
}

// ── PAGE RENDERS ───────────────────────────────────────────────
function renderCitizenDashboard() {
  const stats = APP.tickets;
  const myTickets = stats.slice(0,4);
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
    <div class="stat-card orange"><div class="stat-number">${stats.filter(t=>t.status==='pending').length}</div><div class="stat-label">Pending</div></div>
    <div class="stat-card blue"><div class="stat-number">${stats.filter(t=>t.status==='inprogress').length}</div><div class="stat-label">In Progress</div></div>
    <div class="stat-card green"><div class="stat-number">${stats.filter(t=>t.status==='completed').length}</div><div class="stat-label">Completed</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">Recent Tickets</span><a class="btn btn-sm btn-outline" onclick="navigate('my-tickets')">View All</a></div>
    <div class="card-body">
      <div class="ticket-list">
        ${myTickets.map(t=>`
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
  const locOptions = APP.locations.map(loc => {
    const displayText = `${loc.street}, ${loc.suburb}`;
    return `<option value="${displayText}">${displayText}</option>`;
  }).join('');
  
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
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Location / Address *</label>
            <select class="form-control" id="t-loc" required>
              <option value="">— Select Location —</option>
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
            ${APP.tickets.map(t=>`<tr>
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
const assigned = APP.tickets.filter(t => t.technician_id == APP.currentUser.id);  const activeStatus = APP.currentUser.technician_status || 'Active';

  const totalAssigned = assigned.length;
  const pendingCount  = assigned.filter(t => t.status === 'pending' || t.status === 'assigned').length;
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

function renderAssignedJobs() {
  const myJobs = APP.tickets.filter(t => t.technician_id == APP.currentUser.id);  return `
  <div class="page-header"><div><div class="page-title">My Assigned Tasks</div></div></div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ticket ID</th><th>Title</th><th>Location</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${myJobs.map(t=>`
              <tr>
                <td style="font-weight:700;color:var(--navy)">${t.id}</td>
                <td>${t.title}</td>
                <td>${t.location}</td>
                <td>${priorityHtml(t.priority)}</td>
                <td>${statusBadge(t.status)}</td>
                <td>
                  <select class="form-control" style="width:130px;" onchange="updateJobStatus('${t.id}', this.value)">
                    <option value="assigned" ${t.status==='assigned'?'selected':''}>Assigned</option>
                    <option value="inprogress" ${t.status==='inprogress'?'selected':''}>In Progress</option>
                    <option value="completed" ${t.status==='completed'?'selected':''}>Completed</option>
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function updateJobStatus(id, newStatus) {
  const t = APP.tickets.find(tick => tick.id === id);
  if(t) {
    t.status = newStatus;
    showToast(`Task ${id} moved to status: ${newStatus}`, 'success');
    
    refreshWorkerJobsBadge(); 
    refreshMyTicketsBadge();
    
    if (APP.currentPage === 'assigned-jobs') {
      const main = document.getElementById('main-content');
      if (main) main.innerHTML = `<div class="page">${renderAssignedJobs()}</div>`;
    }
  }
}

function renderAdminDashboard() {
  return `<div class="page-header"><div><div class="page-title">Admin Command Console</div></div></div>`;
}

async function renderAllTickets() {
  try {
    const res = await fetch("http://localhost:3000/tickets");
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
                  <td style="font-weight:700;color:var(--navy)">${t.id}</td>
                  <td>${t.title || '-'}</td>
                  <td style="font-size:0.8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.description || '-'}</td>
                  <td>${priorityHtml(t.priority || 'medium')}</td>
                  <td>${statusBadge(t.status_id == 1 ? 'pending' : t.status_id == 2 ? 'assigned' : t.status_id == 3 ? 'inprogress' : 'completed')}</td>
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

  } catch (err) {
    showToast('Server error. Please try again.', 'error');
    console.error(err);
  }
}
function renderAssignWorker() {
  const unassigned = APP.tickets.filter(t => t.status === 'pending');
  const assigned   = APP.tickets.filter(t => t.worker !== null);

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
                  <td>👷 ${t.workerName || 'Technician #' + t.worker}</td>
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
  const select   = document.getElementById(`select-${appId}`);
  const workerId = select ? select.value : '';

  if (!workerId) {
    showToast('Please select a contractor first.', 'error');
    return;
  }

  const worker = APP.workers.find(w => w.id === workerId);
  const ticket = APP.tickets.find(t => t.id === appId);
  if (!worker || !ticket) return;

  try {
    const res = await fetch(`${API_URL}/assign-ticket`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ticket_id: rawId, technician_id: workerId })
    });

    const data = await res.json();

    if (!data.success) {
      showToast('Assignment failed: ' + data.message, 'error');
      return;
    }

    // Update local state immediately
    ticket.worker     = workerId;
    ticket.workerName = worker.name;
    ticket.status     = 'assigned';

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
    const ticketRes  = await fetch(`${API_URL}/tickets`);
    const ticketData = await ticketRes.json();

    APP.tickets = ticketData.map(t => ({
      id:         'TK-' + t.ticket_id,
      raw_id:     t.ticket_id,
      title:      t.title,
      category:   t.asset_type || 'Other',
      location:   t.location   || 'Unknown',
      priority:   (t.priority  || 'Medium').toLowerCase(),
      status:     t.status_id === 1 ? 'pending'
                : t.status_id === 2 ? 'assigned'
                : t.status_id === 3 ? 'inprogress'
                : t.status_id === 4 ? 'completed'
                : 'pending',
      date:       t.date_created ? t.date_created.split('T')[0] : '',
      worker:     t.technician_id ? String(t.technician_id) : null,
      workerName: t.technician_name || null,
      desc:       t.description || ''
    }));

    // Load active technicians
    const techRes  = await fetch(`${API_URL}/technicians`);
    const techData = await techRes.json();

    APP.workers = techData.technicians.map(t => ({
      id:    String(t.technician_id),
      name:  t.name + ' ' + t.surname,
      skill: t.skill_type || 'General',
      dept:  t.skill_type || 'Technician'
    }));

  } catch (err) {
    showToast('Failed to load data from server.', 'error');
    console.error(err);
  }
}
async function renderManageUsers() {
  try {
    const res  = await fetch(`${API_URL}/users`);
    const data = await res.json();

    if (!data.success) {
      return `<div class="card"><div class="card-body">Failed to load users.</div></div>`;
    }

    return `
    <div class="page-header">
      <div>
        <div class="page-title">Manage Users</div>
        <div class="page-subtitle">All registered system users (${data.users.length} total)</div>
      </div>
    </div>
    <div class="card">
      <div class="card-body" style="padding:0">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Surname</th>
                <th>Email</th>
                <th>Cellphone</th>
                <th>Password</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${data.users.map(u => `
                <tr id="user-row-${u.user_id}">
                  <td style="font-weight:700;color:var(--navy)">${u.user_id}</td>
                  <td><input class="form-control" id="u-name-${u.user_id}"      value="${u.name}"           style="min-width:90px"></td>
                  <td><input class="form-control" id="u-surname-${u.user_id}"   value="${u.surname}"        style="min-width:90px"></td>
                  <td><input class="form-control" id="u-email-${u.user_id}"     value="${u.email}"          style="min-width:150px"></td>
                  <td><input class="form-control" id="u-cellphone-${u.user_id}" value="${u.cellphone || ''}" style="min-width:110px"></td>
                  <td><input class="form-control" id="u-password-${u.user_id}"  value="${u.password}"       style="min-width:110px"></td>
                  <td>${u.role}</td>
                  <td>
                    <button class="btn btn-sm btn-primary" onclick="saveUserEdit(${u.user_id})">
                     Save
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.user_id}, '${u.name} ${u.surname}')" style="margin-left:6px">
                     Delete
                    </button>
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
  const name      = document.getElementById(`u-name-${userId}`)?.value.trim();
  const surname   = document.getElementById(`u-surname-${userId}`)?.value.trim();
  const email     = document.getElementById(`u-email-${userId}`)?.value.trim();
  const cellphone = document.getElementById(`u-cellphone-${userId}`)?.value.trim();
  const password  = document.getElementById(`u-password-${userId}`)?.value.trim();

  if (!name || !surname || !email || !password) {
    showToast('Name, surname, email and password are required.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/users/${userId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, surname, email, cellphone, password })
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
  
  // Data relevant to the specific user
  const myRelevantData = APP.tickets.filter(t => 
    isWorker ? String(t.technician_id) === String(APP.currentUser.id) : t.user_id == APP.currentUser.id
  );

  // ── WORKER NOTIFICATION LOGIC ─────────────────────────────
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

  // ── CITIZEN NOTIFICATION LOGIC ────────────────────────────
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
  
  // Logic for the color-coded status badge (Worker Only)
  let statusSection = '';
  if (isWorker) {
    const currentStatus = user.technician_status || 'Active';
    let statusBadgeColor = '#38A169'; // Green (Active)
    if (currentStatus === 'Inactive') statusBadgeColor = '#718096'; // Grey
    if (currentStatus === 'On Leave') statusBadgeColor = '#DD6B20'; // Orange
    
    statusSection = `
      <div style="display: inline-block; margin-top: 0.5rem; padding: 0.25rem 0.75rem; background: ${statusBadgeColor}; color: white; border-radius: 20px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase;">
        ● ${currentStatus}
      </div>`;
  }

  // Professional details
  let professionalDetails = '';
  if (isWorker) {
    professionalDetails = `
      <div class="detail-row"><label>Employee ID:</label> <span>#${user.id || 'EMP-000'}</span></div>
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
function showTicketDetail(ticketId) {
  const ticket = APP.tickets.find(t => t.id === ticketId);
  if (!ticket) return;

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
          <div style="background:#F4F6F9; padding:1rem; border-radius:4px; margin-top:1rem;">
             <strong>Description:</strong><br>
             <span style="font-size:0.9rem;">${ticket.desc || 'No details provided.'}</span>
          </div>
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
  }
}

function formatTicketRow(row) {
  
  const ticketId = row.ticket_id || row.id || '';
  return {
    id: ticketId && String(ticketId).startsWith('TK-') ? String(ticketId) : `TK-${ticketId}`,
    title: row.title || '',
    category: row.category || row.asset_type || 'Other',
    location: row.location || `${row.street || ''}${row.suburb ? ', ' + row.suburb : ''}`.trim(),
    status: row.status || 'pending',
    priority: (String(row.priority || 'medium')).toLowerCase(),
    date: row.date ? String(row.date).split('T')[0] : '',
    worker: row.worker || null,
    technician_id: row.technician_id || null,
    desc: row.description || row.desc || ''
  };
}

async function loadLocations() {
  if (APP.locations.length > 0) return;
  
  try {
    const res = await fetch(`${API_URL}/locations`);
    const data = await res.json();
    
    if (data.success) {
      APP.locations = data.locations;
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
    let endpoint = `${API_URL}/tickets/user/${encodeURIComponent(APP.currentUser.id)}`;
    
    if (APP.currentRole === 'Technician') {
      endpoint = `${API_URL}/tickets/technician/${encodeURIComponent(APP.currentUser.id)}`;
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

async function submitTicket() {
  const title = document.getElementById('t-title')?.value.trim();
  const cat   = document.getElementById('t-cat')?.value;
  const desc  = document.getElementById('t-desc')?.value.trim();
  const loc   = document.getElementById('t-loc')?.value.trim();
  const pri   = (document.getElementById('t-priority')?.value || 'Medium');
  if (!title || !cat || !desc || !loc || !pri) { showToast('Please fill in required fields.','error'); return; }

  const API_URL = "http://localhost:3000";

  try {
    const res = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category: cat, description: desc, location: loc, priority: pri, user_id: APP.currentUser?.id })
    });

    const data = await res.json();
    if (!data.success) {
      showToast(data.message || 'Failed to submit ticket.','error');
      return;
    }

    showToast(`🎉 Ticket submitted!`, 'success');
    await loadUserTickets();
    refreshMyTicketsBadge();
    setTimeout(() => navigate('my-tickets'), 800);
  } catch (err) {
    console.error('Submit ticket error', err);
    showToast('Server error while submitting ticket.','error');
  }
}

// ── LOGOUT ────────────────────────────────────────────────────
function logout() {
  APP.currentUser = null; APP.currentRole = null;
  showScreen('home-screen');
  showToast('You have been logged out.', 'info');
}

// Updates the technician's availability status locally and syncs it with the server backend
async function handleUpdateAvailability(newStatus) {
  //Update local memory state immediately so the change persists across dashboard tabs
  if (APP.currentUser) {
    APP.currentUser.technician_status = newStatus;
  }

  //Trigger built-in system notification popup alert
  if (typeof showToast === 'function') {
    showToast(`Duty status updated to: ${newStatus}`, 'success');
  } else {
    alert(`Duty status updated to: ${newStatus}`);
  }

  //Background network sync
  try {
    const response = await fetch('http://localhost:3000/technician/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: APP.currentUser?.id || null,
        email: APP.currentUser?.email || '',
        status: newStatus,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      console.warn('Backend rejected status sync, but local state preserved.', response.statusText);
    }
  } catch (error) {
    // Fails silently in the background so the app keeps working perfectly even if offline
    console.error('Network error updating status to background API server:', error);
  }
}

//Fetching the ticket from db
async function fetchTicketsForWorker() {
  if (!APP.currentUser) return; 

  try {
    const response = await fetch(`http://localhost:3000/api/tickets?techId=${APP.currentUser.id}`);
    const data = await response.json();
    
    // Update the global state
    APP.tickets = data; 
    
    renderCurrentPage(); 
  } catch (err) {
    console.error("Database sync failed:", err);
  }
}

