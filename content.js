// OAuth Auto-Approver Content Script
(function() {
  'use strict';

  const CONFIG = {
    defaultDelay: 1500,
    maxAttempts: 10,
    checkInterval: 500,
    debug: true
  };

  function log(...args) {
    if (CONFIG.debug) {
      console.log('[OAuth Auto-Approver]', ...args);
    }
  }

  // Button selectors for different OAuth providers
  const SELECTORS = {
    google: {
      // Account chooser - select first account
      accountButton: [
        'div[data-identifier]',
        'div[data-email]',
        'li[data-email]',
        '.JDAKTe'
      ],
      // Continue/Next buttons (consent summary page)
      continueButton: [
        '#identifierNext',
        '#passwordNext',
        'button[type="submit"]',
        '[data-idom-class*="continue"]',
        'button[jsname="LgbsSe"]',
        'div[role="button"][data-idom-class]',
        'span[jsname="V67aGc"]',
        'button[jsname="j6LnYe"]',
        'div[jsname="j6LnYe"]',
        'button[data-mdc-dialog-action="ok"]'
      ],
      // Allow/Approve buttons (consent page)
      allowButton: [
        '#submit_approve_access',
        'button[id*="allow"]',
        'button[data-idom-class*="allow"]',
        '[aria-label*="Allow"]',
        '[aria-label*="Continue"]',
        'button[name="submit_approve_access"]',
        'input[name="submit_approve_access"]',
        'button[value="true"]',
        'div[role="button"][jscontroller]',
        'button[jsaction*="click"]',
        'div[jsname="LgbsSe"]',
        'button[jsname="LgbsSe"]'
      ],
      // Text-based matching
      textMatches: ['Continue', 'Allow', 'Next', 'Confirm', 'Accept', 'Agree']
    },
    aws: {
      buttons: [
        'button[type="submit"]',
        'input[type="submit"]',
        '#signin_button',
        '.awsui-button-variant-primary',
        '[data-testid="submit-button"]'
      ],
      textMatches: ['Continue', 'Sign in', 'Allow', 'Approve', 'Submit']
    },
    dex: {
      // Connector selection buttons
      connectorButton: [
        '.dex-btn',
        'button.dex-btn',
        'a.dex-btn',
        '.theme-btn'
      ],
      // Approval buttons
      approvalButton: [
        'button[type="submit"]',
        'input[type="submit"]',
        '.btn-success',
        '.btn-primary'
      ],
      textMatches: ['Log in', 'Login', 'Grant Access', 'Approve', 'Continue']
    }
  };

  function detectProvider() {
    const url = window.location.href;
    if (url.includes('accounts.google.com')) return 'google';
    if (url.includes('amazonaws.com')) return 'aws';
    if (url.includes('/dex/') || url.includes('/api/dex/')) return 'dex';
    return null;
  }

  function detectGooglePageType() {
    const url = window.location.href;
    if (url.includes('/consent')) return 'consent';
    if (url.includes('/consentsummary')) return 'consentsummary';
    if (url.includes('/signin/oauth/id')) return 'consent'; // OAuth identity confirmation page
    if (url.includes('/signin/oauth')) return 'consent'; // Generic OAuth signin page
    if (url.includes('AccountChooser')) return 'accountchooser';
    return 'unknown';
  }

  // Check if a button is a cancel/deny type button that should be avoided
  function isCancelButton(element) {
    const text = (element.textContent || element.value || element.getAttribute('aria-label') || '').toLowerCase();
    const cancelKeywords = ['cancel', 'deny', 'reject', 'decline', 'no thanks', 'not now', 'go back', 'back'];
    return cancelKeywords.some(keyword => text.includes(keyword));
  }

  function findButtonBySelector(selectors) {
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (isClickable(el) && !isCancelButton(el)) {
            return el;
          }
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return null;
  }

  function findButtonByText(textMatches) {
    // Broader search for clickable elements
    const buttons = document.querySelectorAll(
      'button, [role="button"], a.btn, input[type="submit"], ' +
      'div[tabindex="0"], span[role="button"], [data-idom-class], ' +
      'form button, form input[type="submit"]'
    );
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim();
      for (const match of textMatches) {
        if (text.toLowerCase().includes(match.toLowerCase()) && isClickable(btn) && !isCancelButton(btn)) {
          log('Found button by text match:', match, btn);
          return btn;
        }
      }
    }
    return null;
  }

  function isClickable(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           !element.disabled &&
           element.offsetParent !== null;
  }

  function simulateClick(element) {
    log('Clicking element:', element);

    // Focus the element first
    try {
      element.focus();
    } catch (e) {}

    // Get element position for realistic mouse events
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Dispatch mouse events with position for elements that need them
    try {
      const events = ['mouseover', 'mouseenter', 'mousedown', 'mouseup', 'click'];
      events.forEach(eventType => {
        const event = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          button: 0
        });
        element.dispatchEvent(event);
      });
    } catch (e) {
      log('Mouse event dispatch failed:', e);
    }

    // Also try standard click as fallback
    try {
      element.click();
    } catch (e) {
      log('Standard click failed');
    }

    // For forms, try submitting the parent form
    try {
      const form = element.closest('form');
      if (form && element.type === 'submit') {
        form.submit();
      }
    } catch (e) {}
  }

  function findAndClickButton(provider) {
    const config = SELECTORS[provider];
    if (!config) return false;

    // For Google, detect the page type and use appropriate selectors
    if (provider === 'google') {
      const pageType = detectGooglePageType();
      log('Google page type:', pageType);

      // On consent pages, look for Allow/Continue buttons first
      if (pageType === 'consent' || pageType === 'consentsummary') {
        // Try Allow button selectors first
        let btn = findButtonBySelector(config.allowButton || []);
        if (btn) {
          log('Found Allow button:', btn);
          return btn;
        }

        // Try Continue button selectors
        btn = findButtonBySelector(config.continueButton || []);
        if (btn) {
          log('Found Continue button:', btn);
          return btn;
        }

        // Fall back to text matching for consent pages
        const consentTextMatches = ['Allow', 'Continue', 'Confirm', 'Accept', 'Agree'];
        btn = findButtonByText(consentTextMatches);
        if (btn) {
          return btn;
        }

        return null;
      }

      // On account chooser, look for account buttons
      if (pageType === 'accountchooser') {
        const btn = findButtonBySelector(config.accountButton || []);
        if (btn) {
          log('Found account button:', btn);
          return btn;
        }
      }
    }

    // Generic flow for other providers
    const selectorGroups = Object.entries(config).filter(([key]) => key !== 'textMatches');
    for (const [name, selectors] of selectorGroups) {
      if (Array.isArray(selectors)) {
        const btn = findButtonBySelector(selectors);
        if (btn) {
          log(`Found button via ${name} selector:`, btn);
          return btn;
        }
      }
    }

    // Fall back to text matching
    if (config.textMatches) {
      const btn = findButtonByText(config.textMatches);
      if (btn) {
        log('Found button via text match:', btn);
        return btn;
      }
    }

    return null;
  }

  async function runAutoApprover() {
    // Check if extension is enabled
    const result = await chrome.storage.sync.get(['enabled', 'delay']);
    const enabled = result.enabled !== false; // Default to enabled
    const delay = result.delay || CONFIG.defaultDelay;

    if (!enabled) {
      log('Extension is disabled');
      return;
    }

    const provider = detectProvider();
    if (!provider) {
      log('No OAuth provider detected on this page');
      return;
    }

    log(`Detected provider: ${provider}`);
    log(`Will attempt to auto-click with ${delay}ms delay`);

    let attempts = 0;
    const attemptClick = () => {
      if (attempts >= CONFIG.maxAttempts) {
        log('Max attempts reached, stopping');
        return;
      }

      attempts++;
      const button = findAndClickButton(provider);

      if (button) {
        log(`Attempt ${attempts}: Found clickable button, clicking in ${delay}ms`);
        setTimeout(() => {
          simulateClick(button);

          // Log the action
          chrome.runtime.sendMessage({
            type: 'logAction',
            data: {
              provider,
              url: window.location.href,
              timestamp: new Date().toISOString()
            }
          }).catch(() => {});

        }, delay);
      } else {
        log(`Attempt ${attempts}: No clickable button found, retrying...`);
        setTimeout(attemptClick, CONFIG.checkInterval);
      }
    };

    // Start attempting after a short initial delay
    setTimeout(attemptClick, 500);
  }

  // Use MutationObserver to handle dynamic content
  function setupObserver() {
    let debounceTimer = null;

    const observer = new MutationObserver((mutations) => {
      // Debounce rapid mutations
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        runAutoApprover();
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize
  async function init() {
    log('Initializing on:', window.location.href);

    // Run immediately
    runAutoApprover();

    // Also set up observer for dynamic content
    if (document.body) {
      setupObserver();
    } else {
      document.addEventListener('DOMContentLoaded', setupObserver);
    }
  }

  // Start the extension
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
