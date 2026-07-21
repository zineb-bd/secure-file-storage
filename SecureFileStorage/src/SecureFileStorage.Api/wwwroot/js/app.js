(function () {
  'use strict';

  const API = window.location.origin;
  const TOKEN_KEY = 'sfs_token';
  const USER_KEY = 'sfs_user';
  const THEME_KEY = 'sfs_theme';
  const CATEGORIES = ['RH', 'Factures', 'Contrats', 'General'];

  let token = localStorage.getItem(TOKEN_KEY);
  let userInfo = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  let dashboardCache = null;
  let currentPreviewId = null;
  let currentPreviewName = null;

  const PAGE_TITLES = {
    dashboard: 'Accueil',
    documents: 'Mes fichiers',
    categories: 'Catégories',
    archived: 'Archivés',
    trash: 'Corbeille',
    search: 'Rechercher',
    profile: 'Mon profil',
    settings: 'Paramètres',
    'admin-users': 'Utilisateurs',
    'admin-roles': 'Rôles et permissions',
    'admin-audit': 'Traçabilité documents',
    'admin-config': 'Configuration système'
  };

  const PAGE_SUBTITLES = {
    dashboard: 'Vue d\'ensemble de votre espace documentaire',
    documents: 'Gérez et organisez vos fichiers',
    categories: 'Documents regroupés par catégorie',
    archived: 'Documents mis en archive',
    trash: 'Documents supprimés — restaurez-les ou videz la corbeille',
    search: 'Filtrez vos documents avec des critères précis',
    profile: 'Informations personnelles et sécurité',
    settings: 'Configuration et informations système',
    'admin-users': 'Gestion des comptes utilisateurs',
    'admin-roles': 'Gestion des rôles et affectations',
    'admin-audit': 'Historique des opérations sur les documents',
    'admin-config': 'Stockage et sécurité'
  };

  // ── Thème ────────────────────────────────────────────────────

  function getTheme() {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    updateThemeUI();
  }

  function toggleTheme() {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }

  function updateThemeUI() {
    const isDark = getTheme() === 'dark';
    const toggle = $('btn-theme-toggle');
    if (toggle) {
      toggle.textContent = isDark ? '☀️' : '🌙';
      toggle.title = isDark ? 'Passer en mode clair' : 'Passer en mode sombre';
      toggle.setAttribute('aria-label', toggle.title);
    }
    const label = $('theme-current-label');
    if (label) label.textContent = 'Thème actuel : ' + (isDark ? 'sombre' : 'clair');
    const lightBtn = $('btn-theme-light');
    const darkBtn = $('btn-theme-dark');
    if (lightBtn) lightBtn.classList.toggle('active', !isDark);
    if (darkBtn) darkBtn.classList.toggle('active', isDark);
  }

  function initTheme() {
    applyTheme(getTheme());
  }

  // ── Utilitaires ──────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function isAdmin() {
    return (userInfo?.roles || []).includes('Admin');
  }

  function showMsg(elId, text, type) {
    const el = $(elId);
    if (!el) return;
    el.className = 'msg ' + (type || '');
    el.textContent = text || '';
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('fr-FR');
  }

  function fmtSize(bytes) {
    if (bytes == null) return '—';
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / 1048576).toFixed(2) + ' Mo';
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildQuery(params) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== '' && v != null && v !== undefined) q.set(k, v);
    });
    const s = q.toString();
    return s ? '?' + s : '';
  }

  function fileIcon(contentType, fileName) {
    const ct = (contentType || '').toLowerCase();
    const ext = ((fileName || '').split('.').pop() || 'file').toUpperCase().slice(0, 4);
    let type = 'generic';
    if (ct.includes('pdf') || ext === 'PDF') type = 'pdf';
    else if (ct.startsWith('image/')) type = 'image';
    else if (ct.includes('word') || ['DOC', 'DOCX'].includes(ext)) type = 'doc';
    else if (ct.includes('sheet') || ct.includes('excel') || ['XLS', 'XLSX', 'CSV'].includes(ext)) type = 'sheet';
    else if (ct.includes('presentation') || ['PPT', 'PPTX'].includes(ext)) type = 'slide';
    else if (ct.includes('zip') || ['ZIP', 'RAR', '7Z'].includes(ext)) type = 'archive';
    return '<span class="file-tile file-tile-' + type + '"><span class="file-tile-label">' + esc(ext) + '</span></span>';
  }

  function statusBadge(status) {
    const s = (status || '').toLowerCase();
    if (s === 'active') return '<span class="badge badge-active">Actif</span>';
    if (s === 'archived') return '<span class="badge badge-archived">Archivé</span>';
    if (s === 'deleted') return '<span class="badge badge-deleted">Supprimé</span>';
    return '<span class="badge badge-info">' + esc(status) + '</span>';
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (token && !(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(API + path, { ...options, headers });

    if (res.status === 401 && token) {
      logout(false);
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }

    if (options.raw) return res;

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.title || 'Erreur ' + res.status);
      return data;
    }

    if (!res.ok) throw new Error('Erreur ' + res.status);
    return res;
  }

  async function downloadBlob(path, filename) {
    const res = await api(path, { raw: true });
    if (!res.ok) throw new Error('Téléchargement impossible');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'fichier';
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderTable(headers, rows, emptyMsg) {
    if (!rows.length) {
      return '<div class="empty-state">' + esc(emptyMsg || 'Aucun résultat.') + '</div>';
    }
    let html = '<table class="data-table"><thead><tr>';
    headers.forEach(h => { html += '<th>' + esc(h) + '</th>'; });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => { html += '<td>' + cell + '</td>'; });
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function confirmPermanentDelete(label) {
    const target = label ? ' « ' + label + ' »' : ' ce document';
    return confirm(
      'Êtes-vous sûr de vouloir supprimer définitivement' + target + ' ?\n\n' +
      'Cette action est irréversible : le fichier sera effacé du serveur.'
    );
  }

  function docActionButtons(id, fileName, opts) {
    opts = opts || {};
    const name = esc(fileName);
    let btns = '';
    if (!opts.noPreview) btns += '<button class="btn btn-sm btn-outline" data-action="preview" data-id="' + id + '" data-name="' + name + '" title="Aperçu">Aperçu</button>';
    if (!opts.noDownload) btns += '<button class="btn btn-sm" data-action="download" data-id="' + id + '" data-name="' + name + '" title="Télécharger">Téléch.</button>';
    btns += '<button class="btn btn-sm btn-secondary" data-action="metadata" data-id="' + id + '" title="Métadonnées">Détails</button>';
    btns += '<button class="btn btn-sm btn-secondary" data-action="versions" data-id="' + id + '" data-name="' + name + '" title="Versions">Versions</button>';
    if (opts.showRestore) {
      btns += '<button class="btn btn-sm btn-success" data-action="restore" data-id="' + id + '" title="Restaurer">Restaurer</button>';
    } else if (!opts.noArchive) {
      btns += '<button class="btn btn-sm btn-secondary" data-action="archive" data-id="' + id + '" title="Archiver">Archiver</button>';
    }
    if (!opts.noTrash) btns += '<button class="btn btn-sm btn-danger" data-action="trash" data-id="' + id + '" title="Mettre à la corbeille">Corbeille</button>';
    if (isAdmin() && opts.showPermDelete) btns += '<button class="btn btn-sm btn-danger" data-action="perm-delete" data-id="' + id + '" data-name="' + name + '" title="Suppression définitive">Suppr. déf.</button>';
    return '<div class="btn-group">' + btns + '</div>';
  }

  function docRowCells(d) {
    return [
      '<span class="file-icon">' + fileIcon(d.contentType, d.fileName) + '</span>',
      '<span class="doc-name">' + esc(d.fileName) + '</span>',
      esc(d.category || '—'),
      esc((d.contentType || '—').split('/').pop()),
      fmtSize(d.sizeBytes),
      String(d.currentVersion || 1),
      esc(d.ownerName || '—'),
      fmtDate(d.createdAt),
      fmtDate(d.updatedAt),
      statusBadge(d.status),
      docActionButtons(d.id, d.fileName)
    ];
  }

  const DOC_HEADERS = ['', 'Nom', 'Catégorie', 'Type', 'Taille', 'Version', 'Propriétaire', 'Créé le', 'Modifié le', 'Statut', 'Actions'];

  // ── Modales ──────────────────────────────────────────────────

  function openModal(id) { $(id).classList.remove('hidden'); }
  function closeModal(id) { $(id).classList.add('hidden'); }

  function closeAllDropdowns() {
    $('user-dropdown').classList.add('hidden');
    $('notif-panel').classList.add('hidden');
  }

  // ── Navigation ───────────────────────────────────────────────

  function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const page = $('page-' + pageId);
    if (page) page.classList.remove('hidden');
    const nav = document.querySelector('[data-page="' + pageId + '"]');
    if (nav) nav.classList.add('active');
    closeAllDropdowns();
    $('sidebar').classList.remove('open');

    const crumb = $('page-breadcrumb');
    const crumbSub = $('page-breadcrumb-sub');
    if (crumb) crumb.textContent = PAGE_TITLES[pageId] || pageId;
    if (crumbSub) {
      const sub = PAGE_SUBTITLES[pageId];
      if (sub) {
        crumbSub.textContent = sub;
        crumbSub.classList.remove('hidden');
      } else {
        crumbSub.classList.add('hidden');
      }
    }

    const loaders = {
      dashboard: loadDashboard,
      documents: loadDocuments,
      categories: loadCategories,
      archived: loadArchived,
      trash: loadTrash,
      search: () => {},
      profile: loadProfile,
      settings: loadSettings,
      'admin-users': loadUsers,
      'admin-roles': loadRoles,
      'admin-audit': loadAudit,
      'admin-config': () => { loadStorage(); loadAntivirusAlerts(); }
    };
    if (loaders[pageId]) loaders[pageId]();
  }

  function showApp() {
    $('login-page').classList.add('hidden');
    $('app').classList.remove('hidden');
    updateUserUI();
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', !isAdmin());
    });
    showPage('dashboard');
  }

  function showLogin() {
    $('login-page').classList.remove('hidden');
    $('app').classList.add('hidden');
  }

  function updateUserUI() {
    const name = userInfo?.fullName || userInfo?.email || 'Utilisateur';
    $('user-name').textContent = name;
    const roles = (userInfo?.roles || []).join(', ') || 'User';
    $('user-role').textContent = roles;
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    $('user-avatar').textContent = initials;
  }

  function updateNotifBadge(count) {
    const badge = $('notif-badge');
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function renderNotifList(notifications) {
    const list = notifications || [];
    updateNotifBadge(list.length);
    if (!list.length) {
      $('notif-list').innerHTML = '<div class="notif-item" style="color:var(--gray-400)">Aucune notification.</div>';
      return;
    }
    $('notif-list').innerHTML = list.map(n =>
      '<div class="notif-item">' +
      '<div class="notif-item-type">' + esc(n.type) + '</div>' +
      '<div>' + esc(n.message) + '</div>' +
      '<div class="notif-item-date">' + fmtDate(n.date) + '</div></div>'
    ).join('');
  }

  // ── Authentification ─────────────────────────────────────────

  async function login() {
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      token = data.token;
      userInfo = data;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(data));
      showMsg('login-msg', 'Connexion réussie.', 'ok');
      showApp();
    } catch (e) {
      showMsg('login-msg', e.message, 'err');
    }
  }

  async function logout(callApi = true) {
    if (callApi && token) {
      try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) { /* ignore */ }
    }
    token = null;
    userInfo = null;
    dashboardCache = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    showLogin();
  }

  // ── Dashboard ────────────────────────────────────────────────

  async function loadDashboard() {
    try {
      const data = await api('/api/dashboard');
      dashboardCache = data;

      $('stat-docs').textContent = data.totalDocuments ?? 0;
      $('stat-storage').textContent = fmtSize(data.storageUsedBytes);
      const recentDocs = data.recentDocuments || [];
      $('stat-uploads').textContent = recentDocs.length;
      const notifs = data.notifications || [];
      $('stat-notifs').textContent = notifs.length;
      renderNotifList(notifs);

      const docRows = recentDocs.map(d => [
        '<span class="file-icon">' + fileIcon(d.contentType, d.fileName) + '</span>',
        esc(d.fileName),
        esc(d.category),
        fmtSize(d.sizeBytes),
        fmtDate(d.createdAt)
      ]);
      $('dash-recent-docs').innerHTML = renderTable(['', 'Fichier', 'Catégorie', 'Taille', 'Date'], docRows, 'Aucun document récent.');

      const activity = data.recentActivity || [];
      const actRows = activity.map(a => [
        esc(a.action),
        esc(a.documentName || '—'),
        fmtDate(a.timestamp)
      ]);
      $('dash-recent-activity').innerHTML = renderTable(['Action', 'Document', 'Date'], actRows, 'Aucune activité récente.');

      if (!notifs.length) {
        $('dash-notifications').innerHTML = '<div class="empty-state">Aucune notification.</div>';
      } else {
        $('dash-notifications').innerHTML = notifs.map(n =>
          '<div class="notif-item" style="border-bottom:1px solid var(--gray-100);padding:.75rem 0">' +
          '<strong style="color:var(--blue-700);font-size:.75rem;text-transform:uppercase">' + esc(n.type) + '</strong>' +
          '<div style="margin-top:.25rem">' + esc(n.message) + '</div>' +
          '<div style="font-size:.75rem;color:var(--gray-400);margin-top:.2rem">' + fmtDate(n.date) + '</div></div>'
        ).join('');
      }
    } catch (e) {
      showMsg('dashboard-msg', e.message, 'err');
    }
  }

  // ── Documents ────────────────────────────────────────────────

  function getDocFilters() {
    return {
      fileName: $('doc-search')?.value.trim() || null,
      category: $('doc-filter-category')?.value || null,
      contentType: $('doc-filter-type')?.value.trim() || null,
      status: $('doc-filter-status')?.value || null,
      createdFrom: $('doc-filter-from')?.value || null,
      createdTo: $('doc-filter-to')?.value || null,
      page: 1,
      pageSize: 50
    };
  }

  async function fetchDocuments(filters) {
    const q = buildQuery(filters);
    const data = await api('/api/documents' + q);
    return data.items || [];
  }

  async function loadDocuments() {
    const wrap = $('docs-table-wrap');
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';
    try {
      const docs = await fetchDocuments(getDocFilters());
      const rows = docs.map(d => docRowCells(d));
      wrap.innerHTML = renderTable(DOC_HEADERS, rows, 'Aucun document trouvé.');
      bindDocActions(wrap, 'docs-msg', loadDocuments);
      showMsg('docs-msg', docs.length + ' document(s).', 'info');
    } catch (e) {
      wrap.innerHTML = '';
      showMsg('docs-msg', e.message, 'err');
    }
  }

  async function loadArchived() {
    const wrap = $('archived-table-wrap');
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';
    try {
      const docs = await fetchDocuments({ status: 'Archived', page: 1, pageSize: 100 });
      const rows = docs.map(d => {
        const cells = docRowCells(d);
        cells[cells.length - 1] = docActionButtons(d.id, d.fileName, { showRestore: true, noArchive: true, noTrash: true });
        return cells;
      });
      wrap.innerHTML = renderTable(DOC_HEADERS, rows, 'Aucun document archivé.');
      bindDocActions(wrap, 'archived-msg', loadArchived);
      showMsg('archived-msg', docs.length + ' document(s) archivé(s).', 'info');
    } catch (e) {
      wrap.innerHTML = '';
      showMsg('archived-msg', e.message, 'err');
    }
  }

  const TRASH_HEADERS = ['', 'Nom', 'Catégorie', 'Taille', 'Propriétaire', 'Supprimé le', 'Actions'];

  function trashRowCells(d) {
    return [
      '<span class="file-icon">' + fileIcon(d.contentType, d.fileName) + '</span>',
      '<span class="doc-name">' + esc(d.fileName) + '</span>',
      esc(d.category || '—'),
      fmtSize(d.sizeBytes),
      esc(d.ownerName || '—'),
      fmtDate(d.deletedAt || d.updatedAt),
      docActionButtons(d.id, d.fileName, { showRestore: true, noPreview: true, noDownload: true, noArchive: true, noTrash: true, showPermDelete: isAdmin() })
    ];
  }

  async function loadTrash() {
    const wrap = $('trash-table-wrap');
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';
    try {
      const docs = await fetchDocuments({ status: 'Deleted', page: 1, pageSize: 100 });
      const rows = docs.map(trashRowCells);
      wrap.innerHTML = renderTable(TRASH_HEADERS, rows, 'La corbeille est vide.');
      bindDocActions(wrap, 'trash-msg', loadTrash);
      if (docs.length) showMsg('trash-msg', docs.length + ' document(s) dans la corbeille.', 'info');
    } catch (e) {
      wrap.innerHTML = '';
      showMsg('trash-msg', e.message, 'err');
    }
  }

  async function emptyTrash() {
    if (!confirm(
      'Êtes-vous sûr de vouloir vider la corbeille ?\n\n' +
      'Tous les documents seront supprimés DÉFINITIVEMENT et ne pourront pas être récupérés.'
    )) return;
    try {
      let count = 0;
      try {
        const result = await api('/api/trash', { method: 'DELETE' });
        count = result.deletedCount ?? result.DeletedCount ?? 0;
      } catch (err) {
        if (!String(err.message).includes('404')) throw err;
        if (!isAdmin()) {
          throw new Error('Redémarrez l\'API pour activer le vidage de la corbeille.');
        }
        const docs = await fetchDocuments({ status: 'Deleted', page: 1, pageSize: 500 });
        for (const doc of docs) {
          await api('/api/documents/' + doc.id + '/permanent', { method: 'DELETE' });
          count++;
        }
      }
      showMsg('trash-msg', count + ' document(s) supprimé(s) définitivement.', 'ok');
      loadTrash();
    } catch (e) {
      showMsg('trash-msg', e.message, 'err');
    }
  }

  async function loadCategories() {
    const container = $('categories-content');
    container.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';
    try {
      const allDocs = await fetchDocuments({ page: 1, pageSize: 200 });
      let html = '';
      CATEGORIES.forEach(cat => {
        const docs = allDocs.filter(d => (d.category || 'General') === cat);
        const label = cat === 'General' ? 'Général' : cat;
        html += '<div class="category-group">';
        html += '<div class="category-header"><span>' + esc(label) + '</span><span class="count">' + docs.length + ' document(s)</span></div>';
        if (!docs.length) {
          html += '<div class="empty-state" style="padding:1.5rem;border:1px solid var(--gray-200);border-top:none;border-radius:0 0 var(--radius) var(--radius)">Aucun document dans cette catégorie.</div>';
        } else {
          const rows = docs.map(d => [
            '<span class="file-icon">' + fileIcon(d.contentType, d.fileName) + '</span>',
            esc(d.fileName),
            fmtSize(d.sizeBytes),
            statusBadge(d.status),
            fmtDate(d.createdAt),
            docActionButtons(d.id, d.fileName)
          ]);
          html += '<div class="table-wrap" style="border-radius:0 0 var(--radius) var(--radius)">' +
            renderTable(['', 'Fichier', 'Taille', 'Statut', 'Date', 'Actions'], rows) + '</div>';
        }
        html += '</div>';
      });
      container.innerHTML = html;
      container.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => handleDocAction(btn, 'categories-msg', loadCategories));
      });
    } catch (e) {
      container.innerHTML = '';
      showMsg('categories-msg', e.message, 'err');
    }
  }

  function bindDocActions(container, msgId, reloadFn) {
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleDocAction(btn, msgId, reloadFn));
    });
  }

  async function handleDocAction(btn, msgId, reloadFn) {
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const name = btn.dataset.name;
    try {
      switch (action) {
        case 'download':
          await downloadBlob('/api/documents/' + id + '/download', name);
          break;
        case 'preview':
          await openPreview(id, name);
          break;
        case 'metadata':
          await openMetadata(id);
          break;
        case 'versions':
          await openVersions(id, name);
          break;
        case 'archive':
          await api('/api/documents/' + id + '/archive', { method: 'POST' });
          showMsg(msgId, 'Document archivé.', 'ok');
          if (reloadFn) reloadFn();
          break;
        case 'restore':
          await api('/api/documents/' + id + '/restore', { method: 'POST' });
          showMsg(msgId, 'Document restauré.', 'ok');
          if (reloadFn) reloadFn();
          break;
        case 'trash':
        case 'delete':
          if (!confirm('Déplacer ce document dans la corbeille ?')) return;
          try {
            await api('/api/documents/' + id + '/trash', { method: 'POST' });
          } catch (err) {
            if (!String(err.message).includes('404')) throw err;
            await api('/api/documents/' + id, { method: 'DELETE' });
          }
          showMsg(msgId, 'Document déplacé dans la corbeille.', 'ok');
          if (reloadFn) reloadFn();
          break;
        case 'perm-delete':
          if (!confirmPermanentDelete(name)) return;
          await api('/api/documents/' + id + '/permanent', { method: 'DELETE' });
          showMsg(msgId, 'Document supprimé définitivement.', 'ok');
          if (reloadFn) reloadFn();
          break;
      }
    } catch (e) {
      showMsg(msgId, e.message, 'err');
    }
  }

  async function uploadDocument() {
    const fileInput = $('upload-file');
    if (!fileInput.files.length) {
      showMsg('upload-msg', 'Sélectionnez un fichier.', 'err');
      return;
    }
    const form = new FormData();
    form.append('file', fileInput.files[0]);
    form.append('category', $('upload-category').value);
    form.append('description', $('upload-desc').value);
    try {
      await api('/api/documents', { method: 'POST', body: form });
      fileInput.value = '';
      $('upload-desc').value = '';
      showMsg('upload-msg', 'Document téléversé avec succès.', 'ok');
      closeModal('modal-upload');
      loadDocuments();
    } catch (e) {
      showMsg('upload-msg', e.message, 'err');
    }
  }

  // ── Preview ──────────────────────────────────────────────────

  async function openPreview(id, name) {
    currentPreviewId = id;
    currentPreviewName = name;
    $('preview-title').textContent = 'Aperçu — ' + (name || 'Document');
    $('preview-iframe').src = 'about:blank';
    $('preview-sidebar').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    openModal('modal-preview');

    try {
      const detail = await api('/api/documents/' + id + '/detail');
      $('preview-sidebar').innerHTML =
        '<h4>' + esc(detail.fileName) + '</h4>' +
        '<div class="detail-row"><div class="detail-label">Catégorie</div><div class="detail-value">' + esc(detail.category) + '</div></div>' +
        '<div class="detail-row"><div class="detail-label">Type</div><div class="detail-value">' + esc(detail.contentType) + '</div></div>' +
        '<div class="detail-row"><div class="detail-label">Taille</div><div class="detail-value">' + fmtSize(detail.sizeBytes) + '</div></div>' +
        '<div class="detail-row"><div class="detail-label">Version</div><div class="detail-value">' + detail.currentVersion + '</div></div>' +
        '<div class="detail-row"><div class="detail-label">Propriétaire</div><div class="detail-value">' + esc(detail.ownerName) + '</div></div>' +
        '<div class="detail-row"><div class="detail-label">Statut</div><div class="detail-value">' + statusBadge(detail.status) + '</div></div>' +
        '<div class="detail-row"><div class="detail-label">Créé le</div><div class="detail-value">' + fmtDate(detail.createdAt) + '</div></div>';

      const res = await api('/api/documents/' + id + '/preview', { raw: true });
      if (!res.ok) throw new Error('Prévisualisation non disponible.');
      const blob = await res.blob();
      $('preview-iframe').src = URL.createObjectURL(blob);
    } catch (e) {
      $('preview-sidebar').innerHTML = '<p style="color:var(--red)">' + esc(e.message) + '</p>';
    }
  }

  // ── Metadata ─────────────────────────────────────────────────

  async function openMetadata(id) {
    $('meta-doc-id').value = id;
    $('meta-detail').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    $('meta-category').value = '';
    $('meta-desc').value = '';
    $('meta-owner-id').value = '';
    openModal('modal-metadata');
    await loadDocumentDetail();
  }

  async function loadDocumentDetail() {
    const docId = $('meta-doc-id').value.trim();
    if (!docId) return;
    try {
      const d = await api('/api/documents/' + docId + '/detail');
      $('meta-detail').innerHTML =
        '<dt>Fichier</dt><dd>' + esc(d.fileName) + '</dd>' +
        '<dt>Extension</dt><dd>' + esc(d.extension) + '</dd>' +
        '<dt>Type MIME</dt><dd>' + esc(d.contentType) + '</dd>' +
        '<dt>Taille</dt><dd>' + fmtSize(d.sizeBytes) + '</dd>' +
        '<dt>SHA-256</dt><dd><code>' + esc(d.sha256Hash) + '</code></dd>' +
        '<dt>Version</dt><dd>' + d.currentVersion + '</dd>' +
        '<dt>Statut</dt><dd>' + statusBadge(d.status) + '</dd>' +
        '<dt>Propriétaire</dt><dd>' + esc(d.ownerName) + ' <small>(' + esc(d.ownerId) + ')</small></dd>' +
        '<dt>Scan antivirus</dt><dd>' + esc(d.lastScanResult) + '</dd>' +
        '<dt>Créé le</dt><dd>' + fmtDate(d.createdAt) + '</dd>' +
        '<dt>Modifié le</dt><dd>' + fmtDate(d.updatedAt) + '</dd>';
      $('meta-category').value = d.category || '';
      $('meta-desc').value = d.description || '';
    } catch (e) {
      showMsg('meta-msg', e.message, 'err');
    }
  }

  async function saveMetadata() {
    const docId = $('meta-doc-id').value.trim();
    const body = {
      category: $('meta-category').value.trim() || null,
      description: $('meta-desc').value.trim() || null
    };
    if (isAdmin() && $('meta-owner-id').value.trim()) {
      body.ownerId = $('meta-owner-id').value.trim();
    }
    try {
      await api('/api/documents/' + docId + '/metadata', {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      showMsg('meta-msg', 'Métadonnées enregistrées.', 'ok');
      loadDocumentDetail();
    } catch (e) {
      showMsg('meta-msg', e.message, 'err');
    }
  }

  async function checkIntegrity() {
    const docId = $('meta-doc-id').value.trim();
    if (!docId) return;
    try {
      const r = await api('/api/documents/' + docId + '/integrity');
      alert(
        'Vérification d\'intégrité\n\n' +
        'Fichier : ' + r.fileName + '\n' +
        'Valide : ' + (r.isValid ? 'Oui' : 'Non') + '\n' +
        'Hash attendu : ' + r.expectedHash + '\n' +
        'Hash actuel : ' + (r.actualHash || '—') + '\n' +
        'Message : ' + r.message
      );
    } catch (e) {
      showMsg('meta-msg', e.message, 'err');
    }
  }

  async function grantPermission() {
    const docId = $('meta-doc-id').value.trim();
    const userId = $('perm-user-id').value.trim();
    try {
      await api('/api/documents/' + docId + '/permissions', {
        method: 'POST',
        body: JSON.stringify({ userId, permission: $('perm-type').value })
      });
      showMsg('meta-msg', 'Permission accordée.', 'ok');
    } catch (e) {
      showMsg('meta-msg', e.message, 'err');
    }
  }

  async function revokePermission() {
    const docId = $('meta-doc-id').value.trim();
    const userId = $('perm-user-id').value.trim();
    try {
      await api('/api/documents/' + docId + '/permissions/' + userId, { method: 'DELETE' });
      showMsg('meta-msg', 'Permission révoquée.', 'ok');
    } catch (e) {
      showMsg('meta-msg', e.message, 'err');
    }
  }

  // ── Versions ─────────────────────────────────────────────────

  async function openVersions(id, name) {
    $('versions-doc-id').value = id;
    $('versions-title').textContent = 'Versions — ' + (name || 'Document');
    openModal('modal-versions');
    await loadVersions();
  }

  async function loadVersions() {
    const docId = $('versions-doc-id').value.trim();
    const wrap = $('versions-table-wrap');
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const versions = await api('/api/documents/' + docId + '/versions');
      const list = Array.isArray(versions) ? versions : [];
      const rows = list.map(v => [
        String(v.versionNumber),
        fmtSize(v.sizeBytes),
        esc(v.uploadedByName),
        fmtDate(v.createdAt),
        esc(v.changeComment || '—'),
        '<div class="btn-group">' +
        '<button class="btn btn-sm" data-vdl="' + docId + '" data-ver="' + v.versionNumber + '">Téléch.</button>' +
        '<button class="btn btn-sm btn-success" data-vrs="' + docId + '" data-ver="' + v.versionNumber + '">Restaurer</button>' +
        '</div>'
      ]);
      wrap.innerHTML = renderTable(['Version', 'Taille', 'Téléversé par', 'Date', 'Commentaire', 'Actions'], rows, 'Aucune version.');
      wrap.querySelectorAll('[data-vdl]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await downloadBlob('/api/documents/' + btn.dataset.vdl + '/download?version=' + btn.dataset.ver, 'version-' + btn.dataset.ver);
          } catch (e) { showMsg('versions-msg', e.message, 'err'); }
        });
      });
      wrap.querySelectorAll('[data-vrs]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Restaurer la version ' + btn.dataset.ver + ' ?')) return;
          try {
            await api('/api/documents/' + btn.dataset.vrs + '/versions/' + btn.dataset.ver + '/restore', { method: 'POST' });
            showMsg('versions-msg', 'Version restaurée.', 'ok');
            loadVersions();
          } catch (e) { showMsg('versions-msg', e.message, 'err'); }
        });
      });
    } catch (e) {
      wrap.innerHTML = '';
      showMsg('versions-msg', e.message, 'err');
    }
  }

  // ── Recherche ────────────────────────────────────────────────

  async function searchDocuments() {
    const q = buildQuery({
      fileName: $('search-filename').value.trim(),
      category: $('search-category').value,
      contentType: $('search-content-type').value.trim(),
      status: $('search-status').value,
      createdFrom: $('search-from').value || null,
      createdTo: $('search-to').value || null,
      page: 1,
      pageSize: 50
    });
    const wrap = $('search-results');
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div> Recherche…</div>';
    try {
      const data = await api('/api/documents' + q);
      const docs = data.items || [];
      const rows = docs.map(d => docRowCells(d));
      wrap.innerHTML = renderTable(DOC_HEADERS, rows, 'Aucun résultat pour cette recherche.');
      bindDocActions(wrap, 'search-msg', searchDocuments);
      showMsg('search-msg', data.totalCount + ' résultat(s).', 'info');
    } catch (e) {
      wrap.innerHTML = '';
      showMsg('search-msg', e.message, 'err');
    }
  }

  function globalSearch(query) {
    if (!query.trim()) return;
    showPage('search');
    $('search-filename').value = query.trim();
    searchDocuments();
  }

  // ── Profil ───────────────────────────────────────────────────

  async function loadProfile() {
    try {
      const p = await api('/api/auth/me');
      $('profile-info').innerHTML =
        '<dt>E-mail</dt><dd>' + esc(p.email) + '</dd>' +
        '<dt>Identifiant</dt><dd><code>' + esc(p.id) + '</code></dd>' +
        '<dt>Rôles</dt><dd>' + esc((p.roles || []).join(', ')) + '</dd>' +
        '<dt>Statut</dt><dd>' + (p.isActive ? '<span class="badge badge-active">Actif</span>' : '<span class="badge badge-deleted">Inactif</span>') + '</dd>' +
        '<dt>Membre depuis</dt><dd>' + fmtDate(p.createdAt) + '</dd>';
      $('profile-first').value = p.firstName || '';
      $('profile-last').value = p.lastName || '';

      if (dashboardCache?.recentActivity) {
        const actRows = dashboardCache.recentActivity.map(a => [
          esc(a.action), esc(a.documentName || '—'), fmtDate(a.timestamp)
        ]);
        $('profile-activity').innerHTML = renderTable(['Action', 'Document', 'Date'], actRows, 'Aucune activité.');
      } else {
        const dash = await api('/api/dashboard');
        dashboardCache = dash;
        const actRows = (dash.recentActivity || []).map(a => [
          esc(a.action), esc(a.documentName || '—'), fmtDate(a.timestamp)
        ]);
        $('profile-activity').innerHTML = renderTable(['Action', 'Document', 'Date'], actRows, 'Aucune activité.');
      }
    } catch (e) {
      showMsg('profile-msg', e.message, 'err');
    }
  }

  async function saveProfile() {
    try {
      const p = await api('/api/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: $('profile-first').value.trim(),
          lastName: $('profile-last').value.trim()
        })
      });
      userInfo = { ...userInfo, fullName: (p.firstName + ' ' + p.lastName).trim() };
      localStorage.setItem(USER_KEY, JSON.stringify(userInfo));
      updateUserUI();
      showMsg('profile-msg', 'Profil mis à jour.', 'ok');
    } catch (e) {
      showMsg('profile-msg', e.message, 'err');
    }
  }

  async function changePassword() {
    const current = $('pwd-current').value;
    const newPwd = $('pwd-new').value;
    const confirm = $('pwd-confirm').value;
    if (newPwd !== confirm) {
      showMsg('password-msg', 'Les mots de passe ne correspondent pas.', 'err');
      return;
    }
    try {
      await api('/api/auth/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: newPwd })
      });
      $('pwd-current').value = '';
      $('pwd-new').value = '';
      $('pwd-confirm').value = '';
      showMsg('password-msg', 'Mot de passe modifié.', 'ok');
    } catch (e) {
      showMsg('password-msg', e.message, 'err');
    }
  }

  // ── Paramètres ───────────────────────────────────────────────

  function loadSettings() {
    updateThemeUI();
    $('settings-session').innerHTML =
      '<p><strong>Utilisateur :</strong> ' + esc(userInfo?.email || '—') + '</p>' +
      '<p><strong>Nom :</strong> ' + esc(userInfo?.fullName || '—') + '</p>' +
      '<p><strong>Rôles :</strong> ' + esc((userInfo?.roles || []).join(', ')) + '</p>' +
      '<p><strong>Expiration jeton :</strong> ' + fmtDate(userInfo?.expiresAt) + '</p>' +
      '<p style="margin-top:.5rem;font-size:.8rem;color:var(--gray-500)">Jeton stocké dans localStorage (<code>sfs_token</code>).</p>';
  }

  // ── Admin Users ──────────────────────────────────────────────

  async function loadUsers() {
    const wrap = $('users-table-wrap');
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const users = await api('/api/admin/users');
      const list = Array.isArray(users) ? users : [];
      const rows = list.map(u => [
        esc(u.email),
        esc((u.firstName + ' ' + u.lastName).trim()),
        esc((u.roles || []).join(', ')),
        u.isActive ? '<span class="badge badge-active">Actif</span>' : '<span class="badge badge-deleted">Inactif</span>',
        fmtDate(u.createdAt),
        '<button class="btn btn-sm btn-outline" data-uid="' + u.id + '">Modifier</button>'
      ]);
      wrap.innerHTML = renderTable(['E-mail', 'Nom', 'Rôles', 'Statut', 'Créé le', 'Actions'], rows, 'Aucun utilisateur.');
      wrap.querySelectorAll('[data-uid]').forEach(btn => {
        btn.addEventListener('click', () => {
          const u = list.find(x => x.id === btn.dataset.uid);
          if (!u) return;
          $('user-action-id').value = u.id;
          $('user-email').value = u.email;
          $('user-email').disabled = true;
          $('user-password').value = '';
          $('user-first').value = u.firstName;
          $('user-last').value = u.lastName;
          $('user-roles-input').value = (u.roles || []).join(', ');
          $('user-update-active').checked = u.isActive;
          $('user-form-title').textContent = 'Modifier — ' + u.email;
          $('user-form-card').classList.remove('hidden');
          $('btn-create-user').classList.add('hidden');
        });
      });
    } catch (e) {
      wrap.innerHTML = '';
      showMsg('users-msg', e.message, 'err');
    }
  }

  function resetUserForm() {
    $('user-action-id').value = '';
    $('user-email').value = '';
    $('user-email').disabled = false;
    $('user-password').value = '';
    $('user-first').value = '';
    $('user-last').value = '';
    $('user-roles-input').value = '';
    $('user-update-active').checked = true;
    $('user-reset-pwd').value = '';
    $('user-form-title').textContent = 'Créer un utilisateur';
    $('btn-create-user').classList.remove('hidden');
    $('user-form-card').classList.add('hidden');
  }

  async function createUser() {
    const rolesRaw = $('user-roles-input').value.trim();
    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: $('user-email').value.trim(),
          password: $('user-password').value,
          firstName: $('user-first').value.trim(),
          lastName: $('user-last').value.trim(),
          roleNames: rolesRaw ? rolesRaw.split(',').map(r => r.trim()) : null
        })
      });
      showMsg('users-msg', 'Utilisateur créé.', 'ok');
      resetUserForm();
      loadUsers();
    } catch (e) {
      showMsg('users-msg', e.message, 'err');
    }
  }

  async function updateUser() {
    const id = $('user-action-id').value.trim();
    if (!id) { showMsg('users-msg', 'Sélectionnez un utilisateur.', 'err'); return; }
    try {
      await api('/api/admin/users/' + id, {
        method: 'PUT',
        body: JSON.stringify({
          firstName: $('user-first').value.trim(),
          lastName: $('user-last').value.trim(),
          isActive: $('user-update-active').checked
        })
      });
      showMsg('users-msg', 'Utilisateur mis à jour.', 'ok');
      loadUsers();
    } catch (e) {
      showMsg('users-msg', e.message, 'err');
    }
  }

  async function deactivateUser() {
    const id = $('user-action-id').value.trim();
    if (!id || !confirm('Désactiver cet utilisateur ?')) return;
    try {
      await api('/api/admin/users/' + id + '/deactivate', { method: 'POST' });
      showMsg('users-msg', 'Utilisateur désactivé.', 'ok');
      loadUsers();
    } catch (e) {
      showMsg('users-msg', e.message, 'err');
    }
  }

  async function deleteUser() {
    const id = $('user-action-id').value.trim();
    if (!id || !confirm('Supprimer définitivement cet utilisateur ?')) return;
    try {
      await api('/api/admin/users/' + id, { method: 'DELETE' });
      showMsg('users-msg', 'Utilisateur supprimé.', 'ok');
      resetUserForm();
      loadUsers();
    } catch (e) {
      showMsg('users-msg', e.message, 'err');
    }
  }

  async function resetUserPassword() {
    const id = $('user-action-id').value.trim();
    const newPassword = $('user-reset-pwd').value;
    if (!id || !newPassword) { showMsg('users-msg', 'Saisissez un mot de passe.', 'err'); return; }
    try {
      await api('/api/admin/users/' + id + '/reset-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword })
      });
      $('user-reset-pwd').value = '';
      showMsg('users-msg', 'Mot de passe réinitialisé.', 'ok');
    } catch (e) {
      showMsg('users-msg', e.message, 'err');
    }
  }

  // ── Admin Roles ──────────────────────────────────────────────

  async function loadRoles() {
    const wrap = $('roles-table-wrap');
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const roles = await api('/api/admin/roles');
      const list = Array.isArray(roles) ? roles : [];
      const rows = list.map(r => [
        esc(r.name),
        esc(r.description),
        '<code style="font-size:.75rem">' + esc(r.id) + '</code>',
        '<button class="btn btn-sm btn-outline" data-rid="' + r.id + '" data-rname="' + esc(r.name) + '" data-rdesc="' + esc(r.description) + '">Modifier</button>'
      ]);
      wrap.innerHTML = renderTable(['Nom', 'Description', 'ID', ''], rows, 'Aucun rôle.');
      wrap.querySelectorAll('[data-rid]').forEach(btn => {
        btn.addEventListener('click', () => {
          $('role-edit-id').value = btn.dataset.rid;
          $('role-edit-name').value = btn.dataset.rname;
          $('role-edit-desc').value = btn.dataset.rdesc || '';
          $('assign-role-id').value = btn.dataset.rid;
        });
      });
    } catch (e) {
      wrap.innerHTML = '';
      showMsg('roles-msg', e.message, 'err');
    }
  }

  async function createRole() {
    try {
      await api('/api/admin/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: $('role-name').value.trim(),
          description: $('role-desc').value.trim()
        })
      });
      $('role-name').value = '';
      $('role-desc').value = '';
      showMsg('roles-msg', 'Rôle créé.', 'ok');
      loadRoles();
    } catch (e) {
      showMsg('roles-msg', e.message, 'err');
    }
  }

  async function updateRole() {
    const id = $('role-edit-id').value.trim();
    if (!id) { showMsg('roles-msg', 'Sélectionnez un rôle.', 'err'); return; }
    try {
      await api('/api/admin/roles/' + id, {
        method: 'PUT',
        body: JSON.stringify({
          name: $('role-edit-name').value.trim(),
          description: $('role-edit-desc').value.trim()
        })
      });
      showMsg('roles-msg', 'Rôle mis à jour.', 'ok');
      loadRoles();
    } catch (e) {
      showMsg('roles-msg', e.message, 'err');
    }
  }

  async function deleteRole() {
    const id = $('role-edit-id').value.trim();
    if (!id || !confirm('Supprimer ce rôle ?')) return;
    try {
      await api('/api/admin/roles/' + id, { method: 'DELETE' });
      showMsg('roles-msg', 'Rôle supprimé.', 'ok');
      loadRoles();
    } catch (e) {
      showMsg('roles-msg', e.message, 'err');
    }
  }

  async function assignRole() {
    try {
      await api('/api/admin/roles/assign', {
        method: 'POST',
        body: JSON.stringify({
          userId: $('assign-user-id').value.trim(),
          roleId: $('assign-role-id').value.trim()
        })
      });
      showMsg('roles-msg', 'Rôle affecté.', 'ok');
    } catch (e) {
      showMsg('roles-msg', e.message, 'err');
    }
  }

  // ── Admin Audit ──────────────────────────────────────────────

  async function loadAudit() {
    const q = buildQuery({
      action: $('audit-action').value.trim(),
      resourceId: $('audit-document-id').value.trim() || null,
      from: $('audit-from').value || null,
      to: $('audit-to').value || null,
      page: 1,
      pageSize: 100
    });
    const wrap = $('audit-table-wrap');
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const data = await api('/api/admin/audit' + q);
      const logs = data.items || [];
      const rows = logs.map(l => [
        fmtDate(l.timestamp),
        esc(l.userEmail || '—'),
        esc(l.action),
        l.resourceId ? '<code>' + esc(l.resourceId) + '</code>' : '—',
        esc(l.details),
        l.success ? '<span class="badge badge-active">Oui</span>' : '<span class="badge badge-deleted">Non</span>',
        esc(l.ipAddress)
      ]);
      wrap.innerHTML = renderTable(['Date', 'Utilisateur', 'Action', 'Document', 'Détails', 'OK', 'IP'], rows, 'Aucune entrée.');
      showMsg('audit-msg', data.totalCount + ' entrée(s).', 'info');
    } catch (e) {
      wrap.innerHTML = '';
      showMsg('audit-msg', e.message, 'err');
    }
  }

  async function exportAudit() {
    const q = buildQuery({
      action: $('audit-action').value.trim(),
      resourceId: $('audit-document-id').value.trim() || null,
      from: $('audit-from').value || null,
      to: $('audit-to').value || null
    });
    try {
      await downloadBlob('/api/admin/audit/export' + q, 'tracabilite-documents.csv');
      showMsg('audit-msg', 'Export téléchargé.', 'ok');
    } catch (e) {
      showMsg('audit-msg', e.message, 'err');
    }
  }

  // ── Admin Config ─────────────────────────────────────────────

  async function loadStorage() {
    try {
      const c = await api('/api/admin/storage');
      $('storage-current').innerHTML =
        '<dt>Fournisseur</dt><dd>' + esc(c.providerType) + '</dd>' +
        '<dt>Base de données</dt><dd>' + esc(c.databaseProvider) + '</dd>' +
        '<dt>Chemin</dt><dd>' + esc(c.basePath) + '</dd>' +
        '<dt>Endpoint S3</dt><dd>' + esc(c.s3Endpoint || '—') + '</dd>' +
        '<dt>Bucket S3</dt><dd>' + esc(c.s3Bucket || '—') + '</dd>' +
        '<dt>Actif</dt><dd>' + (c.isActive ? 'Oui' : 'Non') + '</dd>' +
        '<dt>Mis à jour</dt><dd>' + fmtDate(c.updatedAt) + '</dd>';
      $('storage-provider').value = c.providerType || 'Local';
      $('storage-db').value = c.databaseProvider || 'Sqlite';
      $('storage-base').value = c.basePath || '';
      $('storage-s3-endpoint').value = c.s3Endpoint || '';
      $('storage-s3-bucket').value = c.s3Bucket || '';
    } catch (e) {
      showMsg('storage-msg', e.message, 'err');
    }
  }

  async function saveStorage() {
    try {
      await api('/api/admin/storage', {
        method: 'PUT',
        body: JSON.stringify({
          providerType: $('storage-provider').value,
          databaseProvider: $('storage-db').value.trim(),
          basePath: $('storage-base').value.trim(),
          s3Endpoint: $('storage-s3-endpoint').value.trim() || null,
          s3Bucket: $('storage-s3-bucket').value.trim() || null,
          s3AccessKey: $('storage-s3-key').value.trim() || null,
          s3SecretKey: $('storage-s3-secret').value || null
        })
      });
      showMsg('storage-msg', 'Configuration enregistrée.', 'ok');
      loadStorage();
    } catch (e) {
      showMsg('storage-msg', e.message, 'err');
    }
  }

  async function loadAntivirusAlerts() {
    const wrap = $('alerts-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const alerts = await api('/api/admin/security/antivirus-alerts');
      const list = Array.isArray(alerts) ? alerts : [];
      const rows = list.map(a => [
        esc(a.fileName),
        esc(a.threatName),
        esc(a.details),
        fmtDate(a.detectedAt),
        a.isResolved ? '<span class="badge badge-active">Résolu</span>' : '<span class="badge badge-deleted">Actif</span>'
      ]);
      wrap.innerHTML = renderTable(['Fichier', 'Menace', 'Détails', 'Détecté le', 'Statut'], rows, 'Aucune alerte.');
      showMsg('security-msg', list.length + ' alerte(s).', 'info');
    } catch (e) {
      wrap.innerHTML = '';
      showMsg('security-msg', e.message, 'err');
    }
  }

  async function rotateKey() {
    if (!confirm('Confirmer la rotation de la clé maître de chiffrement ?')) return;
    try {
      const r = await api('/api/admin/security/rotate-key', { method: 'POST' });
      $('rotate-result').innerHTML =
        '<div class="info-block"><strong>Clé :</strong> ' + esc(r.keyIdentifier) + '<br><strong>Rotée le :</strong> ' + fmtDate(r.rotatedAt) + '</div>';
      showMsg('security-msg', 'Rotation effectuée.', 'ok');
    } catch (e) {
      showMsg('security-msg', e.message, 'err');
    }
  }

  // ── Events ───────────────────────────────────────────────────

  function bindEvents() {
    $('btn-login').addEventListener('click', login);
    $('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    $('forgot-password').addEventListener('click', e => {
      e.preventDefault();
      alert('Pour réinitialiser votre mot de passe, veuillez contacter votre administrateur système.');
    });

    $('btn-logout').addEventListener('click', () => logout(true));

    $('btn-theme-toggle')?.addEventListener('click', toggleTheme);
    $('btn-theme-light')?.addEventListener('click', () => applyTheme('light'));
    $('btn-theme-dark')?.addEventListener('click', () => applyTheme('dark'));

    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => showPage(btn.dataset.page));
    });

    document.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => showPage(btn.dataset.goto));
    });

    $('user-trigger').addEventListener('click', e => {
      e.stopPropagation();
      $('user-dropdown').classList.toggle('hidden');
      $('notif-panel').classList.add('hidden');
    });

    $('btn-notifications').addEventListener('click', e => {
      e.stopPropagation();
      $('notif-panel').classList.toggle('hidden');
      $('user-dropdown').classList.add('hidden');
    });

    document.addEventListener('click', () => closeAllDropdowns());

    $('global-search').addEventListener('keydown', e => {
      if (e.key === 'Enter') globalSearch(e.target.value);
    });

    $('menu-toggle').addEventListener('click', () => {
      $('sidebar').classList.toggle('open');
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });

    $('btn-open-upload').addEventListener('click', () => {
      $('upload-msg').textContent = '';
      openModal('modal-upload');
    });
    $('btn-upload').addEventListener('click', uploadDocument);
    $('btn-filter-docs').addEventListener('click', loadDocuments);
    $('doc-filter-status').addEventListener('change', loadDocuments);
    $('btn-empty-trash')?.addEventListener('click', emptyTrash);

    $('btn-search').addEventListener('click', searchDocuments);

    $('btn-save-profile').addEventListener('click', saveProfile);
    $('btn-change-password').addEventListener('click', changePassword);

    $('btn-save-metadata').addEventListener('click', saveMetadata);
    $('btn-check-integrity').addEventListener('click', checkIntegrity);
    $('btn-grant-perm').addEventListener('click', grantPermission);
    $('btn-revoke-perm').addEventListener('click', revokePermission);

    $('preview-download-btn').addEventListener('click', () => {
      if (currentPreviewId) downloadBlob('/api/documents/' + currentPreviewId + '/download', currentPreviewName);
    });
    $('preview-versions-btn').addEventListener('click', () => {
      if (currentPreviewId) {
        closeModal('modal-preview');
        openVersions(currentPreviewId, currentPreviewName);
      }
    });

    $('btn-show-create-user').addEventListener('click', () => {
      resetUserForm();
      $('user-form-card').classList.remove('hidden');
    });
    $('btn-cancel-user-form').addEventListener('click', resetUserForm);
    $('btn-create-user').addEventListener('click', createUser);
    $('btn-update-user').addEventListener('click', updateUser);
    $('btn-deactivate-user').addEventListener('click', deactivateUser);
    $('btn-delete-user').addEventListener('click', deleteUser);
    $('btn-reset-pwd').addEventListener('click', resetUserPassword);

    $('btn-create-role').addEventListener('click', createRole);
    $('btn-update-role').addEventListener('click', updateRole);
    $('btn-delete-role').addEventListener('click', deleteRole);
    $('btn-assign-role').addEventListener('click', assignRole);

    $('btn-load-audit').addEventListener('click', loadAudit);
    $('btn-export-audit').addEventListener('click', exportAudit);

    $('btn-save-storage').addEventListener('click', saveStorage);
    $('btn-load-alerts').addEventListener('click', loadAntivirusAlerts);
    $('btn-rotate-key').addEventListener('click', rotateKey);

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        $('tab-' + btn.dataset.tab).classList.remove('hidden');
      });
    });
  }

  bindEvents();
  initTheme();
  if (token && userInfo) {
    showApp();
  } else {
    showLogin();
  }
})();
