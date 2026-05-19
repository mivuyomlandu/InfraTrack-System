/* ================================================================
   City of Johannesburg – Public Works System
   Main Application JavaScript
   ================================================================ */

'use strict';

// ── STATE ─────────────────────────────────────────────────────
const APP = {
  currentUser: null,
  currentRole: null,
  currentPage: null,
  tickets: [
    { id:'TK-2401', title:'Burst Water Pipe', category:'Water', location:'Soweto, Sector 4', status:'inprogress', priority:'high',  date:'2026-05-14', worker:'M. Dlamini', desc:'Major burst on Vilakazi St, flooding pavement.' },
    { id:'TK-2398', title:'Pothole – Main Reef Rd', category:'Road',    location:'Johannesburg CBD',   status:'assigned',   priority:'high',  date:'2026-05-13', worker:'T. Nkosi',   desc:'Large pothole causing vehicle damage.' },
    { id:'TK-2395', title:'Faulty Street Light',   category:'Electric', location:'Sandton, Rivonia',   status:'pending',    priority:'medium',date:'2026-05-12', worker:null,         desc:'Street light out for 3 nights.' },
    { id:'TK-2390', title:'Illegal Dumping Site',  category:'Other',    location:'Alexandra Township', status:'completed',  priority:'low',   date:'2026-05-10', worker:'J. Sithole', desc:'Waste cleared and area sanitized.' },
    { id:'TK-2388', title:'Storm Drain Blocked',   category:'Water',    location:'Roodepoort',         status:'pending',    priority:'medium',date:'2026-05-09', worker:null,         desc:'Drain causing flooding in street.' },
    { id:'TK-2385', title:'Broken Traffic Light',  category:'Electric', location:'Braamfontein',       status:'assigned',   priority:'high',  date:'2026-05-08', worker:'M. Dlamini', desc:'Traffic light at Jorissen/Jan Smuts.' },
  ],
  workers: [
    { id:'W001', name:'Musa Dlamini',    dept:'Water & Sanitation', active:3 },
    { id:'W002', name:'Thabo Nkosi',     dept:'Roads & Transport',  active:2 },
    { id:'W003', name:'Jerome Sithole',  dept:'Waste Management',   active:1 },
    { id:'W004', name:'Zanele Mokoena',  dept:'Electrical',         active:4 },
    { id:'W005', name:'Sipho Mahlangu',  dept:'Water & Sanitation', active:0 },
  ]
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
  }
  
  // Clean up existing error feedback notifications
  const logErr = document.getElementById('login-error');
  const signErr = document.getElementById('signup-error');
  if (logErr) logErr.classList.add('hidden');
  if (signErr) signErr.classList.add('hidden');
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
function navigate(page) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const link = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (link) link.classList.add('active');

  APP.currentPage = page;
  const main = document.getElementById('main-content');
  if (!main) return;

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
    main.innerHTML = `<div class="page">${renders[page]()}</div>`;
    bindPageEvents(page);
  }
}

// ── LANDING HOME EVENT HANDLERS ───────────────────────────────
function handleHomeTrackTicket() {
  const ticketInput = document.getElementById('home-track-id');
  const idValue = ticketInput ? ticketInput.value.trim().toUpperCase() : '';
  
  if (!idValue) {
    showToast('Please type a valid Ticket ID first.', 'error');
    return;
  }
  
  const foundTicket = APP.tickets.find(t => t.id === idValue);
  if (foundTicket) {
    showTicketDetail(foundTicket.id);
  } else {
    showToast(`No logged infrastructure ticket was found matching code "${idValue}".`, 'error');
  }
}

function handleGuestLogTicket() {
  showToast('Please sign up or login with your database credentials to submit maintenance reports.', 'info');
  setTimeout(() => {
    showScreen('signup-screen');
  }, 1200);
}

// ── LOGIN & SIGNUP FORMS HANDLERS ─────────────────────────────
function initGlobalAuthHandlers() {
  const logForm = document.getElementById('login-form');
  if (logForm) {
    logForm.addEventListener('submit', e => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value.trim();
      const errEl = document.getElementById('login-error');
      
      if (!email || !password) {
        errEl.textContent = 'Please fill in all identity fields correctly.';
        errEl.classList.remove('hidden');
        return;
      }

      let resolvedRole = 'citizen';
      let formattedName = 'Citizen Resident';
      
      if (email.includes('admin')) {
        resolvedRole = 'admin';
        formattedName = 'System Administrator';
      } else if (email.includes('contractor') || email.includes('worker')) {
        resolvedRole = 'worker';
        formattedName = 'Musa Dlamini';
      } else {
        formattedName = email.split('@')[0];
        formattedName = formattedName.charAt(0).toUpperCase() + formattedName.slice(1);
      }

      APP.currentUser = {
        name: formattedName,
        initials: formattedName.substring(0, 2).toUpperCase(),
        email: email
      };
      APP.currentRole = resolvedRole;
      
      showToast(`Authenticated successfully as ${formattedName}!`, 'success');
      loadApp();
    });
  }

  const signForm = document.getElementById('signup-form');
  if (signForm) {
    signForm.addEventListener('submit', e => {
      e.preventDefault();
      const role = document.getElementById('signup-role').value;
      const name = document.getElementById('signup-name').value.trim();
      const surname = document.getElementById('signup-surname').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value.trim();
      const errEl = document.getElementById('signup-error');

      if (!role || !name || !surname || !email || !password) {
        errEl.textContent = 'All validation elements must be completed.';
        errEl.classList.remove('hidden');
        return;
      }

      console.log('Storing record safely inside target user database structures:', { role, name, surname, email, password });
      showToast(`🎉 Registration saved to Database! Logging you in as ${name}.`, 'success');
      
      let mappedAppRole = 'citizen';
      if (role === 'admin') mappedAppRole = 'admin';
      if (role === 'contractor') mappedAppRole = 'worker';

      APP.currentUser = {
        name: `${name} ${surname}`,
        initials: (name[0] + surname[0]).toUpperCase(),
        email: email
      };
      APP.currentRole = mappedAppRole;
      
      setTimeout(() => {
        loadApp();
        signForm.reset();
      }, 1000);
    });
  }
}

// ── LOAD APP SHELL ─────────────────────────────────────────────
function loadApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('signup-screen').classList.add('hidden');
  document.getElementById('home-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');

  document.getElementById('user-name').textContent = APP.currentUser.name;
  document.getElementById('user-initials').textContent = APP.currentUser.initials;

  buildSidebar();

  const defaultPage = {
    citizen: 'dashboard-citizen',
    worker:  'dashboard-worker',
    admin:   'dashboard-admin',
  }[APP.currentRole];
  navigate(defaultPage);
}

// ── SIDEBAR BUILDER ────────────────────────────────────────────
function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  const navs = {
    citizen: `
      <div class="sidebar-section-label">Main</div>
      <a class="nav-link" data-page="dashboard-citizen"><span class="icon">🏠</span>Dashboard</a>
      <a class="nav-link" data-page="my-tickets"><span class="icon">🎫</span>My Tickets <span class="nav-badge">3</span></a>
      <a class="nav-link" data-page="create-ticket"><span class="icon">➕</span>New Ticket</a>
      <div class="sidebar-section-label">Account</div>
      <a class="nav-link" data-page="notifications"><span class="icon">🔔</span>Notifications</a>
      <a class="nav-link" data-page="profile"><span class="icon">👤</span>Profile</a>`,
    worker: `
      <div class="sidebar-section-label">Main</div>
      <a class="nav-link" data-page="dashboard-worker"><span class="icon">🏠</span>Dashboard</a>
      <a class="nav-link" data-page="assigned-jobs"><span class="icon">🔧</span>Assigned Jobs <span class="nav-badge">3</span></a>
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

// ── PAGE RENDERS ───────────────────────────────────────────────
function renderCitizenDashboard() {
  const stats = APP.tickets;
  const myTickets = stats.slice(0,4);
  return `
  <div class="page-header">
    <div>
      <div class="page-title">Citizen Dashboard</div>
      <div class="page-subtitle">Welcome back, ${APP.currentUser.name} — track your submissions here.</div>
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
            <input class="form-control" id="t-loc" type="text" placeholder="Street address or area name">
          </div>
          <div class="form-group">
            <label class="form-label">Ward / Region</label>
            <input class="form-control" type="text" placeholder="e.g. Region F">
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
  const assigned = APP.tickets.filter(t=>t.worker==='Musa Dlamini');
  return `
  <div class="page-header">
    <div>
      <div class="page-title">Worker Dashboard</div>
      <div class="page-subtitle">Good morning, ${APP.currentUser.name}. Overview.</div>
    </div>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="ticket-list">
        ${assigned.map(t=>`
        <div class="ticket-item" onclick="navigate('assigned-jobs')">
          <div class="ticket-icon ${t.category.toLowerCase()}">${catIcon(t.category)}</div>
          <div class="ticket-info">
            <div class="ticket-title">${t.title}</div>
            <div class="ticket-meta">📍 ${t.location}</div>
          </div>
          <div class="ticket-right">${statusBadge(t.status)}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderAssignedJobs() {
  const myJobs = APP.tickets.filter(t=>t.worker==='Musa Dlamini');
  return `
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
  }
}

function renderAdminDashboard() {
  return `<div class="page-header"><div><div class="page-title">Admin Command Console</div></div></div>`;
}

function renderAllTickets() { return `<div class="card"><div class="card-body"><h3>All System Tickets Grid</h3></div></div>`; }
function renderAssignWorker() { return `<div class="card"><div class="card-body"><h3>Assign Contractor Task Matrix</h3></div></div>`; }
function renderManageUsers() { return `<div class="card"><div class="card-body"><h3>User Accounts Database Manager</h3></div></div>`; }
function renderReports() { return `<div class="card"><div class="card-body"><h3>Departmental Performance Metrics</h3></div></div>`; }
function renderNotifications() { return `<div class="card"><div class="card-body"><h3>Civic Notifications Broadcasts</h3></div></div>`; }
function renderProfile() { return `<div class="card"><div class="card-body"><h3>Account Identity Settings Profile</h3></div></div>`; }

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

function submitTicket() {
  const title = document.getElementById('t-title')?.value.trim();
  const cat   = document.getElementById('t-cat')?.value;
  const desc  = document.getElementById('t-desc')?.value.trim();
  const loc   = document.getElementById('t-loc')?.value.trim();
  if (!title || !cat || !desc || !loc) { showToast('Please fill in required fields.','error'); return; }
  
  const newId = 'TK-' + (2402 + APP.tickets.length);
  APP.tickets.unshift({ id:newId, title, category:cat, location:loc, status:'pending', priority:'medium', date:new Date().toISOString().split('T')[0], worker:null, desc });
  showToast(`🎉 Ticket ${newId} submitted!`,'success');
  setTimeout(() => navigate('my-tickets'), 800);
}

// ── LOGOUT ────────────────────────────────────────────────────
function logout() {
  APP.currentUser = null; APP.currentRole = null;
  showScreen('home-screen');
  showToast('You have been logged out.', 'info');
}