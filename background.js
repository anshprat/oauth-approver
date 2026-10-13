// OAuth Auto-Approver Background Service Worker

// Initialize extension state
chrome.runtime.onInstalled.addListener(async () => {
  // Set default values
  const settings = await chrome.storage.sync.get(['enabled', 'delay']);
  if (settings.enabled === undefined) {
    await chrome.storage.sync.set({ enabled: true, delay: 1500 });
  }

  // The activity log moved to local storage - drop the old copy that filled its sync quota
  await chrome.storage.sync.remove('activityLog');

  // Update badge
  updateBadge(settings.enabled !== false);
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'logAction') {
    logActivity(message.data);
    sendResponse({ success: true });
  } else if (message.type === 'updateBadge') {
    updateBadge(message.enabled);
    sendResponse({ success: true });
  } else if (message.type === 'getStatus') {
    chrome.storage.sync.get(['enabled']).then(result => {
      sendResponse({ enabled: result.enabled !== false });
    });
    return true; // Keep channel open for async response
  }
});

// Update extension badge
function updateBadge(enabled) {
  chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({
    color: enabled ? '#22c55e' : '#6b7280'
  });
}

// Log activity in local storage - sync storage caps each item at 8 KB,
// which a few long OAuth URLs fill up
async function logActivity(data) {
  try {
    const result = await chrome.storage.local.get(['activityLog']);
    const logs = result.activityLog || [];

    // Add new entry, without the query string (long, and holds OAuth tokens)
    logs.push({ ...data, url: stripQuery(data.url) });

    // Keep only last 20 entries
    if (logs.length > 20) {
      logs.shift();
    }

    await chrome.storage.local.set({ activityLog: logs });
  } catch (e) {
    console.error('[OAuth Auto-Approver] Could not save activity log:', e);
  }
}

function stripQuery(url) {
  try {
    const { origin, pathname } = new URL(url);
    return origin + pathname;
  } catch (e) {
    return '';
  }
}

// Initialize badge on startup
chrome.storage.sync.get(['enabled']).then(result => {
  updateBadge(result.enabled !== false);
});
