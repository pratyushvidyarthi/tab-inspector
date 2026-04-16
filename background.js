const tabData = {};
const tabMemory = {};

function getTimestamp() {
  return Date.now();
}

async function collectMemoryViaScripting(tab) {
  return new Promise((resolve) => {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url === 'about:blank' || tab.url.startsWith('about:')) {
      resolve(null);
      return;
    }
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const mem = performance.memory || {};
        return {
          usedJSHeapSize: mem.usedJSHeapSize || 0,
          totalJSHeapSize: mem.totalJSHeapSize || 0,
          jsHeapSizeLimit: mem.jsHeapSizeLimit || 0,
          domNodes: document.querySelectorAll('*').length,
          resourceCount: performance.getEntriesByType ? performance.getEntriesByType('resource').length : 0,
          domSizeKB: Math.round(document.documentElement.innerHTML.length / 1024),
          loadTime: performance.timing ? Math.max(0, performance.timing.loadEventEnd - performance.timing.navigationStart) : 0,
          images: document.images.length,
          scripts: document.scripts.length,
          links: document.links.length,
          iframes: document.querySelectorAll('iframe').length,
        };
      }
    }, (results) => {
      if (chrome.runtime.lastError || !results || !results[0]) {
        resolve(null);
        return;
      }
      resolve(results[0].result);
    });
  });
}

async function refreshMemoryForTab(tab) {
  if (!tab || !tab.id) return;
  try {
    const data = await collectMemoryViaScripting(tab);
    if (data) {
      tabMemory[tab.id] = { ...data, source: 'scripting', updatedAt: Date.now() };
      chrome.storage.local.set({ tabMemory: { ...tabMemory } });
    }
  } catch (e) {}
}

async function refreshAllMemory() {
  const tabs = await chrome.tabs.query({});
  const batchSize = 4;
  for (let i = 0; i < tabs.length; i += batchSize) {
    await Promise.all(tabs.slice(i, i + batchSize).map(t => refreshMemoryForTab(t)));
  }
}

function saveTimings() {
  chrome.storage.local.set({ tabTimings: { ...tabData } });
}

chrome.tabs.onCreated.addListener((tab) => {
  tabData[tab.id] = { openedAt: Date.now(), lastActivated: Date.now(), activationCount: 1 };
  saveTimings();
});

chrome.tabs.onActivated.addListener((info) => {
  if (!tabData[info.tabId]) {
    tabData[info.tabId] = { openedAt: Date.now(), lastActivated: Date.now(), activationCount: 1 };
  } else {
    tabData[info.tabId].lastActivated = Date.now();
    tabData[info.tabId].activationCount = (tabData[info.tabId].activationCount || 0) + 1;
  }
  saveTimings();
  chrome.tabs.get(info.tabId, (tab) => {
    if (!chrome.runtime.lastError && tab) refreshMemoryForTab(tab);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabData[tabId];
  delete tabMemory[tabId];
  saveTimings();
  chrome.storage.local.set({ tabMemory: { ...tabMemory } });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tabData[tabId]) {
    tabData[tabId] = { openedAt: Date.now(), lastActivated: Date.now(), activationCount: 0 };
  }
  if (changeInfo.status === 'complete') {
    tabData[tabId].lastLoaded = Date.now();
    saveTimings();
    setTimeout(() => refreshMemoryForTab(tab), 1500);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    const now = Date.now();
    tabs.forEach(tab => {
      if (!tabData[tab.id]) tabData[tab.id] = { openedAt: now, lastActivated: now, activationCount: 0 };
    });
    saveTimings();
    refreshAllMemory();
  });
});

chrome.storage.local.get(['tabTimings', 'tabMemory'], (result) => {
  if (result.tabTimings) Object.assign(tabData, result.tabTimings);
  if (result.tabMemory) Object.assign(tabMemory, result.tabMemory);
});

chrome.alarms.create('memoryRefresh', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'memoryRefresh') refreshAllMemory();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'REFRESH_MEMORY') {
    refreshAllMemory().then(() => {
      sendResponse({ ok: true, tabMemory });
    });
    return true;
  }
  if (msg.type === 'GET_MEMORY') {
    sendResponse({ tabMemory });
  }
});
