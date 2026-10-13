// OAuth Auto-Approver Popup Script
document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enableToggle');
  const delaySlider = document.getElementById('delaySlider');
  const delayValue = document.getElementById('delayValue');
  const statusBadge = document.getElementById('statusBadge');
  const activityLog = document.getElementById('activityLog');
  const clearLogBtn = document.getElementById('clearLog');

  // Load saved settings
  const settings = await chrome.storage.sync.get(['enabled', 'delay', 'activityLog']);

  // Set initial state
  enableToggle.checked = settings.enabled !== false; // Default to enabled
  delaySlider.value = settings.delay || 1500;
  delayValue.textContent = (delaySlider.value / 1000).toFixed(1);
  updateStatusBadge(enableToggle.checked);

  // Display activity log
  displayActivityLog(settings.activityLog || []);

  // Toggle handler
  enableToggle.addEventListener('change', async () => {
    const enabled = enableToggle.checked;
    await chrome.storage.sync.set({ enabled });
    updateStatusBadge(enabled);

    // Update badge in background
    chrome.runtime.sendMessage({ type: 'updateBadge', enabled });
  });

  // Delay slider handler
  delaySlider.addEventListener('input', () => {
    delayValue.textContent = (delaySlider.value / 1000).toFixed(1);
  });

  delaySlider.addEventListener('change', async () => {
    await chrome.storage.sync.set({ delay: parseInt(delaySlider.value) });
  });

  // Clear log handler
  clearLogBtn.addEventListener('click', async () => {
    await chrome.storage.sync.set({ activityLog: [] });
    displayActivityLog([]);
  });

  function updateStatusBadge(enabled) {
    statusBadge.textContent = enabled ? 'Active' : 'Inactive';
    statusBadge.className = 'status-badge ' + (enabled ? 'active' : 'inactive');
  }

  function displayActivityLog(logs) {
    if (!logs || logs.length === 0) {
      activityLog.innerHTML = '<div class="log-empty">No recent activity</div>';
      return;
    }

    // Show most recent 5 entries
    const recentLogs = logs.slice(-5).reverse();
    activityLog.innerHTML = recentLogs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const provider = log.provider.charAt(0).toUpperCase() + log.provider.slice(1);
      return `<div class="log-entry">
        <span class="log-provider">${provider}</span>
        <span class="log-time">${time}</span>
      </div>`;
    }).join('');
  }
});
