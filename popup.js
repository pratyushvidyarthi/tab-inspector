let allTabs = [];
let tabMemoryData = {};
let tabTimings = {};
let maxMemory = 0;

function formatMemory(bytes) {
  if (!bytes || bytes === 0) return 'N/A';
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatMemoryShort(bytes) {
  if (!bytes || bytes === 0) return '—';
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return `${(bytes / 1024).toFixed(0)}KB`;
  if (mb < 1024) return `${mb.toFixed(0)}MB`;
  return `${(mb / 1024).toFixed(1)}GB`;
}

function getMemoryClass(bytes) {
  if (!bytes) return 'none';
  const mb = bytes / 1024 / 1024;
  if (mb > 300) return 'high';
  if (mb > 80) return 'medium';
  return 'low';
}

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return 'Just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

function extractDomain(url) {
  try {
    if (!url) return '—';
    if (url.startsWith('chrome://')) return url.split('/')[2] || 'chrome';
    if (url.startsWith('chrome-extension://')) return 'extension';
    if (url === 'about:blank') return 'blank';
    return new URL(url).hostname.replace('www.', '') || '—';
  } catch { return '—'; }
}

function getTabMemoryBytes(tabId) {
  const m = tabMemoryData[tabId];
  if (!m) return 0;
  return m.usedJSHeapSize || m.jsHeapUsed || 0;
}

function buildTabRow(tab, timing, memory) {
  const memBytes = getTabMemoryBytes(tab.id);
  const memClass = getMemoryClass(memBytes);
  const memPct = maxMemory > 0 ? Math.min(100, (memBytes / maxMemory) * 100) : 0;
  const domain = extractDomain(tab.url);
  const memInfo = tabMemoryData[tab.id] || {};

  const row = document.createElement('div');
  row.className = `tab-row${tab.active ? ' active-tab' : ''}`;
  row.dataset.tabId = tab.id;

  // Favicon
  const firstChar = domain.charAt(0).toUpperCase() || '?';
  let faviconHtml = `<div class="tab-favicon-placeholder">${firstChar}</div>`;
  if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://') && tab.favIconUrl !== '') {
    faviconHtml = `<img class="tab-favicon" src="${tab.favIconUrl}" alt=""
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="tab-favicon-placeholder" style="display:none">${firstChar}</div>`;
  }

  // Badges
  let badges = '';
  if (tab.active) badges += `<span class="badge badge-active">Active</span>`;
  if (tab.pinned) badges += `<span class="badge badge-pinned">Pinned</span>`;
  if (tab.audible) badges += `<span class="badge badge-audible">▶ Audio</span>`;
  if (tab.mutedInfo?.muted) badges += `<span class="badge badge-muted">Muted</span>`;
  if (tab.discarded) badges += `<span class="badge badge-discarded">Suspended</span>`;
  if (tab.status === 'loading') badges += `<span class="badge badge-loading">Loading</span>`;

  const timing_ = timing || {};
  const openedAt = formatTime(timing_.openedAt);
  const lastActive = timeAgo(timing_.lastActivated);
  const visitCount = timing_.activationCount || 0;
  const loadTime = memInfo.loadTime > 0 ? `${memInfo.loadTime}ms` : null;

  // Memory display
  const memDisplay = memBytes > 0
    ? `<span class="memory-value ${memClass}">${formatMemoryShort(memBytes)}</span>`
    : `<span class="memory-value none" title="Memory not available for this tab type">—</span>`;

  // Extra memory stats for tooltip area
  const domNodes = memInfo.domNodes ? `${memInfo.domNodes} nodes` : null;
  const resources = memInfo.resourceCount ? `${memInfo.resourceCount} res` : null;

  row.innerHTML = `
    <div class="favicon-wrap">${faviconHtml}</div>
    <div class="tab-main">
      <div class="tab-title-row">
        <span class="tab-title" title="${escapeHtml(tab.title || '')}">${escapeHtml(tab.title || domain || 'New Tab')}</span>
        <div class="tab-badges">${badges}</div>
      </div>
      <div class="tab-url" title="${escapeHtml(tab.url || '')}">${domain}</div>
      <div class="tab-meta">
        <span class="meta-item" title="Opened at">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.1"/><path d="M5 3v2l1.5 1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
          ${openedAt}
        </span>
        <span class="meta-item">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M8.5 5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z" stroke="currentColor" stroke-width="1.1"/><path d="M5 5l1.5-1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
          ${lastActive}
        </span>
        ${visitCount > 0 ? `<span class="meta-item"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1.5L6.2 4H9l-2.3 1.7.9 2.8L5 7l-2.6 1.5.9-2.8L1 4h2.8z" stroke="currentColor" stroke-width="0.9" fill="none"/></svg>${visitCount} visits</span>` : ''}
        ${loadTime ? `<span class="meta-item">⚡ ${loadTime}</span>` : ''}
        ${domNodes ? `<span class="meta-item">DOM ${domNodes}</span>` : ''}
        ${resources ? `<span class="meta-item">${resources}</span>` : ''}
        <span class="meta-item muted">Tab ${tab.index + 1}</span>
      </div>
    </div>
    <div class="tab-memory">
      ${memDisplay}
      ${memBytes > 0 ? `<div class="memory-bar-wrap"><div class="memory-bar ${memClass}" style="width:${memPct.toFixed(1)}%"></div></div>` : ''}
      ${memInfo.totalJSHeapSize ? `<span class="memory-sub">${formatMemoryShort(memInfo.totalJSHeapSize)} alloc</span>` : ''}
    </div>
    <div class="tab-actions">
      <button class="action-btn reload-btn" title="Reload tab" data-action="reload">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M9 5.5A3.5 3.5 0 1 1 5.5 2a3.5 3.5 0 0 1 3 1.7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M8.5 1.5v2h-2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="action-btn close-btn" title="Close tab" data-action="close">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 2l7 7M9 2l-7 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      </button>
    </div>
  `;

  row.addEventListener('click', (e) => {
    if (e.target.closest('.tab-actions')) return;
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
    window.close();
  });

  row.querySelector('[data-action="reload"]').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.tabs.reload(tab.id);
  });

  row.querySelector('[data-action="close"]').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.tabs.remove(tab.id, () => {
      row.style.transition = 'opacity 0.2s, height 0.2s';
      row.style.opacity = '0';
      setTimeout(() => { row.remove(); updateStats(); }, 200);
    });
  });

  return row;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getFilteredSortedTabs() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const sortBy = document.getElementById('sortSelect').value;
  const filterBy = document.getElementById('filterSelect').value;

  let filtered = allTabs.filter(tab => {
    if (query) {
      const t = (tab.title || '').toLowerCase();
      const u = (tab.url || '').toLowerCase();
      if (!t.includes(query) && !u.includes(query)) return false;
    }
    switch (filterBy) {
      case 'active': return tab.active;
      case 'pinned': return tab.pinned;
      case 'audible': return tab.audible;
      case 'muted': return tab.mutedInfo?.muted;
      case 'discarded': return tab.discarded;
      default: return true;
    }
  });

  filtered.sort((a, b) => {
    const mA = getTabMemoryBytes(a.id);
    const mB = getTabMemoryBytes(b.id);
    const tA = tabTimings[a.id] || {};
    const tB = tabTimings[b.id] || {};
    switch (sortBy) {
      case 'memory': return mB - mA;
      case 'memory-asc': return mA - mB;
      case 'title': return (a.title || '').localeCompare(b.title || '');
      case 'opened': return (tB.openedAt || 0) - (tA.openedAt || 0);
      case 'lastActive': return (tB.lastActivated || 0) - (tA.lastActivated || 0);
      case 'activations': return (tB.activationCount || 0) - (tA.activationCount || 0);
      default: return mB - mA;
    }
  });

  return filtered;
}

function updateStats() {
  let totalMem = 0, audible = 0;
  const windowIds = new Set();
  let tabsWithMemory = 0;

  allTabs.forEach(tab => {
    const m = getTabMemoryBytes(tab.id);
    if (m > 0) { totalMem += m; tabsWithMemory++; }
    windowIds.add(tab.windowId);
    if (tab.audible) audible++;
  });

  document.getElementById('totalMemory').textContent = totalMem > 0 ? formatMemory(totalMem) : 'Scanning...';
  document.getElementById('windowCount').textContent = windowIds.size;
  document.getElementById('avgMemory').textContent = tabsWithMemory > 0 ? formatMemory(totalMem / tabsWithMemory) : '—';
  document.getElementById('audibleCount').textContent = audible;
  document.getElementById('tabCount').textContent = `${allTabs.length} tab${allTabs.length !== 1 ? 's' : ''}`;
}

function render() {
  const list = document.getElementById('tabList');
  const tabs = getFilteredSortedTabs();

  if (tabs.length === 0) {
    list.innerHTML = `<div class="no-results">No tabs match your filter</div>`;
    return;
  }

  maxMemory = Math.max(...tabs.map(t => getTabMemoryBytes(t.id)), 1);

  const windows = {};
  tabs.forEach(tab => {
    if (!windows[tab.windowId]) windows[tab.windowId] = [];
    windows[tab.windowId].push(tab);
  });

  const fragment = document.createDocumentFragment();
  const windowIds = Object.keys(windows);

  windowIds.forEach((wid, wi) => {
    if (windowIds.length > 1) {
      const header = document.createElement('div');
      header.className = 'group-header';
      const winMem = windows[wid].reduce((s, t) => s + getTabMemoryBytes(t.id), 0);
      header.innerHTML = `<span>Window ${wi + 1}</span><span>${windows[wid].length} tabs${winMem > 0 ? ' · ' + formatMemory(winMem) : ''}</span>`;
      fragment.appendChild(header);
    }
    windows[wid].forEach(tab => {
      fragment.appendChild(buildTabRow(tab, tabTimings[tab.id], getTabMemoryBytes(tab.id)));
    });
  });

  list.innerHTML = '';
  list.appendChild(fragment);

  const labels = {
    'memory': 'Sorted by memory (highest first)',
    'memory-asc': 'Sorted by memory (lowest first)',
    'title': 'Sorted alphabetically',
    'opened': 'Sorted by open time',
    'lastActive': 'Sorted by last activity',
    'activations': 'Sorted by visit count'
  };
  document.getElementById('footerInfo').textContent = labels[document.getElementById('sortSelect').value] || '';
}

async function loadAndRender(showSpinner = true) {
  if (showSpinner) document.getElementById('refreshBtn').classList.add('spinning');

  try {
    // Load stored data
    const stored = await new Promise(r => chrome.storage.local.get(['tabTimings', 'tabMemory'], r));
    tabTimings = stored.tabTimings || {};
    tabMemoryData = stored.tabMemory || {};

    allTabs = await new Promise(r => chrome.tabs.query({}, r));

    updateStats();
    render();

    // Trigger a fresh memory scan in background
    chrome.runtime.sendMessage({ type: 'REFRESH_MEMORY' }, (resp) => {
      if (chrome.runtime.lastError) return;
      if (resp && resp.tabMemory) {
        tabMemoryData = resp.tabMemory;
        updateStats();
        render();
      }
    });

  } catch (err) {
    console.error(err);
  } finally {
    document.getElementById('refreshBtn').classList.remove('spinning');
  }
}

// Close duplicates
document.getElementById('closeDiscardedBtn').addEventListener('click', () => {
  const seen = new Set();
  const toClose = [];
  [...allTabs]
    .sort((a, b) => getTabMemoryBytes(b.id) - getTabMemoryBytes(a.id))
    .forEach(tab => {
      if (!tab.url || tab.url === 'chrome://newtab/') return;
      if (seen.has(tab.url)) toClose.push(tab.id);
      else seen.add(tab.url);
    });

  if (toClose.length === 0) {
    document.getElementById('footerInfo').textContent = 'No duplicate tabs found';
    return;
  }
  if (confirm(`Close ${toClose.length} duplicate tab${toClose.length > 1 ? 's' : ''}?`)) {
    chrome.tabs.remove(toClose, () => loadAndRender());
  }
});

document.getElementById('refreshBtn').addEventListener('click', () => loadAndRender(true));
document.getElementById('searchInput').addEventListener('input', render);
document.getElementById('sortSelect').addEventListener('change', render);
document.getElementById('filterSelect').addEventListener('change', render);

loadAndRender();
