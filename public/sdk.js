/**
 * Consent Management Platform (CMP) Client Script
 * Version: 2.0 (includes necessary cookie checkbox)
 * 
 * This script provides a complete consent management solution for websites.
 * It handles consent banner display, consent recording, and preference management.
 * 
 * Usage:
 *   <script src="https://your-api-domain.com/consent/cmp-script.js"></script>
 *   <script>
 *     CMP.init({
 *       apiBaseUrl: 'https://your-api-domain.com/consent',
 *       privacyPolicyId: 'your-privacy-policy-id',
 *       termsAndConditionsPolicyId: 'your-terms-policy-id',
 *       onConsentChange: function(categories) {
 *         // Handle consent changes
 *       }
 *     });
 *   </script>
 */

(function(window, document) {
  'use strict';

  // Blocked scripts storage (for scripts in HTML)
  const blockedScripts = {
    analytics: [],
    marketing: [],
    performance: []
  };

  /**
   * Detect script category by URL pattern
   */
  function detectScriptCategory(script) {
    const src = script.src || '';
    const text = (script.textContent || script.innerHTML || '').toLowerCase();
    
    // Check explicit category attribute first (highest priority)
    const explicitCategory = script.getAttribute('data-cmp-category') || 
                             script.getAttribute('data-consent-category');
    if (explicitCategory && ['analytics', 'marketing', 'performance'].includes(explicitCategory)) {
      return explicitCategory;
    }
    
    // Auto-detect by URL patterns if enabled
    // Use current config or default config if not initialized yet
    const currentConfig = config && Object.keys(config).length > 0 ? config : DEFAULT_CONFIG;
    const patterns = currentConfig.scriptPatterns || DEFAULT_SCRIPT_PATTERNS;
    
    if (currentConfig.autoBlockScripts !== false) {
      // Check analytics patterns
      if (patterns.analytics && patterns.analytics.some(pattern => pattern.test(src) || pattern.test(text))) {
        return 'analytics';
      }
      
      // Check marketing patterns
      if (patterns.marketing && patterns.marketing.some(pattern => pattern.test(src) || pattern.test(text))) {
        return 'marketing';
      }
      
      // Check performance patterns
      if (patterns.performance && patterns.performance.some(pattern => pattern.test(src) || pattern.test(text))) {
        return 'performance';
      }
    }
    
    return null;
  }

  /**
   * Block a script tag from executing
   */
  function blockScript(script) {
    const category = detectScriptCategory(script);
    
    if (!category || !['analytics', 'marketing', 'performance'].includes(category)) {
      return false; // Not a script that needs blocking
    }

    console.log(`CMP: Blocking script (${category}): ${script.src || 'inline script'}`);

    // Store script info
    const scriptInfo = {
      element: script,
      src: script.src,
      type: script.type,
      async: script.async,
      defer: script.defer,
      text: script.textContent || script.innerHTML,
      attributes: {}
    };

    // Store all attributes
    Array.from(script.attributes).forEach(attr => {
      scriptInfo.attributes[attr.name] = attr.value;
    });

    // Remove the script from DOM temporarily
    const parent = script.parentNode;
    if (parent) {
      parent.removeChild(script);
      blockedScripts[category].push(scriptInfo);
      console.log(`CMP: Script blocked and queued (${category}): ${script.src || 'inline'}. Total blocked: ${blockedScripts[category].length}`);
      return true;
    }
    return false;
  }

  /**
   * Process blocked scripts for a category
   */
  function processBlockedScripts(category) {
    if (!blockedScripts[category] || blockedScripts[category].length === 0) {
      console.log(`CMP: No blocked scripts found for category: ${category}`);
      return;
    }

    const scripts = blockedScripts[category];
    console.log(`CMP: Processing ${scripts.length} blocked script(s) for category: ${category}`);
    blockedScripts[category] = []; // Clear

    scripts.forEach(scriptInfo => {
      try {
        // Create unique identifier for this script
        const scriptId = scriptInfo.src || scriptInfo.text || JSON.stringify(scriptInfo.attributes);
        
        // Check if script already processed to prevent duplicates
        if (processedScripts.has(scriptId)) {
          console.log(`CMP: Script already processed, skipping: ${scriptInfo.src || 'inline'}`);
          return; // Already processed, skip
        }
        
        // Check if script already exists in DOM
        if (scriptInfo.src) {
          const existing = document.querySelector(`script[src="${scriptInfo.src}"]`);
          if (existing) {
            processedScripts.add(scriptId);
            console.log(`CMP: Script already in DOM, skipping: ${scriptInfo.src}`);
            return; // Script already loaded, skip
          }
        } else if (scriptInfo.text) {
          // For inline scripts, check by content
          const existing = document.querySelector(`script[id="${scriptInfo.attributes.id || ''}"]`);
          if (existing && existing.textContent === scriptInfo.text) {
            processedScripts.add(scriptId);
            console.log(`CMP: Inline script already in DOM, skipping`);
            return; // Script already loaded, skip
          }
        }

        console.log(`CMP: Loading blocked script: ${scriptInfo.src || 'inline script'}`);

        // Initialize Facebook Pixel before loading the script
        if (category === 'marketing' && scriptInfo.src && scriptInfo.src.includes('facebook.net')) {
          if (typeof window.fbq === 'undefined') {
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
          }
        }

        const newScript = document.createElement('script');
        
        // Restore attributes
        Object.keys(scriptInfo.attributes).forEach(key => {
          if (key !== 'data-cmp-category' && key !== 'data-consent-category') {
            newScript.setAttribute(key, scriptInfo.attributes[key]);
          }
        });

        // Set src or text content
        if (scriptInfo.src) {
          newScript.src = scriptInfo.src;
        } else if (scriptInfo.text) {
          newScript.textContent = scriptInfo.text;
        }

        // Mark as processed before adding to DOM
        processedScripts.add(scriptId);
        
        // Add to head
        document.head.appendChild(newScript);
        console.log(`CMP: Successfully loaded script: ${scriptInfo.src || 'inline script'}`);
      } catch (error) {
        console.error('CMP: Failed to load blocked script:', error, scriptInfo);
      }
    });
  }

  /**
   * Intercept scripts in the document
   */
  function interceptScripts() {
    // Block existing scripts in head (check all scripts, not just those with attributes)
    const headScripts = document.head.querySelectorAll('script');
    headScripts.forEach(script => {
      blockScript(script);
    });

    // Block existing scripts in body
    const bodyScripts = document.body ? document.body.querySelectorAll('script') : [];
    bodyScripts.forEach(script => {
      blockScript(script);
    });

    // Watch for new scripts being added
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'SCRIPT') {
            blockScript(node);
          }
        });
      });
    });

    // Start observing
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Run interception immediately (before DOM is ready)
  if (document.readyState === 'loading') {
    // DOM is still loading, wait for it
    document.addEventListener('DOMContentLoaded', interceptScripts);
  } else {
    // DOM is already loaded
    interceptScripts();
  }

  // Default script detection patterns
  const DEFAULT_SCRIPT_PATTERNS = {
    analytics: [
      /googletagmanager\.com/i,
      /google-analytics\.com/i,
      /analytics\.google\.com/i,
      /doubleclick\.net/i,
      /googleadservices\.com/i,
      /googlesyndication\.com/i,
      /hotjar\.com/i,
      /mixpanel\.com/i,
      /segment\.com/i,
      /amplitude\.com/i,
      /heap\.io/i,
      /fullstory\.com/i,
      /logrocket\.com/i
    ],
    marketing: [
      /facebook\.net/i,
      /facebook\.com\/tr/i,
      /ads\.facebook\.com/i,
      /connect\.facebook\.net/i,
      /pixel\.facebook\.com/i,
      /snapchat\.com/i,
      /tiktok\.com/i,
      /linkedin\.com/i,
      /twitter\.com/i,
      /ads\.twitter\.com/i,
      /pinterest\.com/i,
      /ads\.pinterest\.com/i,
      /bing\.com\/msads/i,
      /ads\.youtube\.com/i
    ],
    performance: [
      /newrelic\.com/i,
      /datadoghq\.com/i,
      /sentry\.io/i,
      /rollbar\.com/i,
      /bugsnag\.com/i,
      /raygun\.io/i
    ]
  };

  // Default configuration
  const DEFAULT_CONFIG = {
    apiBaseUrl: '/consent',
    publicApiBaseUrl: '/public/policies', // Base URL for public policy file downloads
    storageKey: 'cmp_subject_id',
    externalUserIdStorageKey: 'cmp_external_user_id',
    externalUserDataStorageKey: 'cmp_external_user_data',
    externalUserId: null, // Optional: set for authenticated users
    userData: null, // Optional: user metadata (only used when externalUserId exists)
    bannerId: 'cmp-consent-banner',
    bannerPosition: 'bottom', // 'top' or 'bottom'
    autoShow: true,
    fetchIP: true, // Set to false to disable IP fetching (backend will still extract from headers)
    customText: null, // Custom banner text (if null, uses default text)
    showPolicyLinks: true, // Show privacy policy and T&C links
    showPreferencesButton: true, // Show floating preferences button in bottom right
    preferencesButtonId: 'cmp-preferences-button', // ID for preferences button
    autoBlockScripts: true, // Automatically detect and block common third-party scripts
    scriptPatterns: DEFAULT_SCRIPT_PATTERNS, // Custom patterns for script detection
    categories: {
      necessary: true, // Always true
      analytics: false,
      performance: false,
      marketing: false
    },
    styles: {
      bannerBackground: '#f8f9fa',
      bannerTextColor: '#2d3748',
      buttonBackground: '#000000',
      buttonTextColor: '#ffffff',
      buttonHoverBackground: '#333333',
      linkColor: '#0066cc' // Color for policy links (default blue)
    }
  };

  // CMP instance
  let config = {};
  let currentConsent = null;
  let bannerElement = null;
  let preferencesButton = null;
  let isBannerFromPreferences = false; // Track if banner was opened from preferences button
  let scriptQueue = {
    analytics: [],
    marketing: [],
    performance: []
  };
  let lastAppliedCategories = null; // Track last applied categories to prevent infinite loops
  let processedScripts = new Set(); // Track processed scripts to prevent duplicates
  let selectedLanguage = 'en'; // Language for policy/summary (DPDP 5(3)); used when recording consent if getLanguageCode not provided

  /**
   * Get selected policy language (used by banner and consent recording)
   */
  function getSelectedLanguage() {
    return selectedLanguage || 'en';
  }

  /**
   * Set selected policy language (e.g. from banner or page dropdown)
   */
  function setSelectedLanguage(lang) {
    selectedLanguage = (lang && String(lang).trim()) ? String(lang).trim() : 'en';
  }

  /**
   * Generate or retrieve subject ID
   */
  function getOrCreateSubjectId() {
    let subjectId = localStorage.getItem(config.storageKey);
    if (!subjectId) {
      // Generate UUID v4
      subjectId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      localStorage.setItem(config.storageKey, subjectId);
    }
    return subjectId;
  }

  /**
   * Get external user id (authenticated user identifier)
   */
  function getExternalUserId() {
    // Priority: explicit config value -> localStorage
    if (config && config.externalUserId) return config.externalUserId;
    if (config && config.externalUserIdStorageKey) {
      return localStorage.getItem(config.externalUserIdStorageKey);
    }
    return localStorage.getItem(DEFAULT_CONFIG.externalUserIdStorageKey);
  }

  /**
   * Get userData (only meaningful when externalUserId exists)
   */
  function getUserData() {
    if (config && config.userData) return config.userData;
    const key = (config && config.externalUserDataStorageKey) || DEFAULT_CONFIG.externalUserDataStorageKey;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /**
   * Set userData (store user metadata for authenticated users)
   */
  function setUserData(userData, options) {
    const opts = options || {};
    const persist = opts.persist !== false;

    config.userData = userData || null;
    if (persist) {
      const key = config.externalUserDataStorageKey || DEFAULT_CONFIG.externalUserDataStorageKey;
      if (userData) {
        localStorage.setItem(key, JSON.stringify(userData));
      } else {
        localStorage.removeItem(key);
      }
    }
  }

  /**
   * Set external user id (login)
   */
  async function setExternalUserId(externalUserId, options) {
    const opts = options || {};
    const persist = opts.persist !== false;
    const userData = opts.userData;

    config.externalUserId = externalUserId || null;
    if (persist && externalUserId) {
      localStorage.setItem(config.externalUserIdStorageKey, externalUserId);
    }
    if (typeof userData !== 'undefined') {
      setUserData(userData, { persist });
    }

    // Re-check consent for the authenticated user context
    const consent = await checkConsent();
    if (consent && consent.isCurrent) {
      if (consent.status === 'Accepted') {
        applyConsentPreferences(consent.categories);
      }
      showPreferencesButton();
      hideBanner();
    } else if (config.autoShow) {
      showBanner();
    }
  }

  /**
   * Clear external user id (logout)
   */
  async function clearExternalUserId(options) {
    const opts = options || {};
    const clearStorage = opts.clearStorage !== false;
    const clearUserData = opts.clearUserData !== false;

    config.externalUserId = null;
    if (clearStorage) {
      localStorage.removeItem(config.externalUserIdStorageKey);
    }
    if (clearStorage && clearUserData) {
      const key = config.externalUserDataStorageKey || DEFAULT_CONFIG.externalUserDataStorageKey;
      localStorage.removeItem(key);
    }
    if (clearUserData) {
      config.userData = null;
    }

    // Re-check consent for anonymous/device context
    const consent = await checkConsent();
    if (consent && consent.isCurrent) {
      if (consent.status === 'Accepted') {
        applyConsentPreferences(consent.categories);
      }
      showPreferencesButton();
      hideBanner();
    } else if (config.autoShow) {
      showBanner();
    }
  }

  /**
   * Check latest consent status
   */
  async function checkConsent() {
    try {
      const externalUserId = getExternalUserId();
      const subjectId = getOrCreateSubjectId();
      // subjectId is always included (device/browser identity); externalUserId is added when authenticated (user identity).
      const query = externalUserId
        ? `subjectId=${encodeURIComponent(subjectId)}&externalUserId=${encodeURIComponent(externalUserId)}`
        : `subjectId=${encodeURIComponent(subjectId)}`;
      const response = await fetch(`${config.apiBaseUrl}/latest?${query}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        currentConsent = result.data;
        return result.data;
      }
      return null;
    } catch (error) {
      console.error('CMP: Failed to check consent:', error);
      return null;
    }
  }

  /**
   * Get user's IP address (optional - uses third-party service)
   * Note: Backend will automatically extract IP from request headers
   */
  async function getUserIP() {
    try {
      // Try to get IP from a free service (optional)
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn('CMP: Could not fetch IP address:', error);
      return null;
    }
  }

  /**
   * Record consent
   */
  async function recordConsent(consentData) {
    const subjectId = getOrCreateSubjectId();
    const externalUserId = getExternalUserId();
    const userData = getUserData();
    
    // Optionally fetch IP (backend will also extract from headers)
    let ipAddress = null;
    if (config.fetchIP !== false) {
      ipAddress = await getUserIP();
    }
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subjectId: subjectId,
          ...(externalUserId ? { externalUserId: externalUserId } : {}),
          ...(externalUserId && userData ? { userData: userData } : {}),
          privacyPolicyId: config.privacyPolicyId,
          termsAndConditionsPolicyId: config.termsAndConditionsPolicyId,
          status: consentData.status,
          categories: consentData.categories || config.categories,
          ...(typeof config.getLanguageCode === 'function' && config.getLanguageCode() ? { languageCode: config.getLanguageCode() } : { languageCode: getSelectedLanguage() }),
          ipAddress: ipAddress, // Optional - backend will also extract from headers
          userAgent: navigator.userAgent,
          metadata: {
            source: 'cmp-banner',
            timestamp: new Date().toISOString(),
            ...(consentData.metadata || {})
          }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        currentConsent = result.data;
        return result;
      }
      
      return { success: false, message: result.message || 'Failed to record consent' };
    } catch (error) {
      console.error('CMP: Failed to record consent:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Load a script dynamically
   */
  function loadScript(src, attributes) {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        resolve(existingScript);
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      
      // Add custom attributes
      if (attributes) {
        Object.keys(attributes).forEach(key => {
          script.setAttribute(key, attributes[key]);
        });
      }

      script.onload = () => resolve(script);
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      
      document.head.appendChild(script);
    });
  }

  /**
   * Load inline script code
   */
  function loadInlineScript(code, id) {
    // Check if script already exists
    if (id) {
      const existingScript = document.getElementById(id);
      if (existingScript) {
        return Promise.resolve(existingScript);
      }
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      if (id) script.id = id;
      script.textContent = code;
      
      script.onload = () => resolve(script);
      script.onerror = () => reject(new Error('Failed to load inline script'));
      
      document.head.appendChild(script);
      resolve(script); // Inline scripts execute immediately
    });
  }

  /**
   * Process queued scripts for a category
   */
  function processScriptQueue(category) {
    if (!scriptQueue[category] || scriptQueue[category].length === 0) {
      return;
    }

    const scripts = scriptQueue[category];
    scriptQueue[category] = []; // Clear queue

    scripts.forEach(scriptConfig => {
      try {
        if (scriptConfig.type === 'src') {
          loadScript(scriptConfig.src, scriptConfig.attributes)
            .then(() => {
              if (scriptConfig.onLoad) scriptConfig.onLoad();
            })
            .catch(error => {
              console.error('CMP: Failed to load script:', error);
              if (scriptConfig.onError) scriptConfig.onError(error);
            });
        } else if (scriptConfig.type === 'inline') {
          loadInlineScript(scriptConfig.code, scriptConfig.id)
            .then(() => {
              if (scriptConfig.onLoad) scriptConfig.onLoad();
            })
            .catch(error => {
              console.error('CMP: Failed to load inline script:', error);
              if (scriptConfig.onError) scriptConfig.onError(error);
            });
        }
      } catch (error) {
        console.error('CMP: Error processing script:', error);
      }
    });
  }

  /**
   * Apply consent preferences
   */
  function applyConsentPreferences(categories) {
    if (!categories) return;

    // Prevent infinite loops by checking if categories haven't changed
    const categoriesStr = JSON.stringify(categories);
    if (lastAppliedCategories === categoriesStr) {
      return; // Categories haven't changed, skip to prevent infinite loop
    }
    lastAppliedCategories = categoriesStr;

    // Trigger custom callback if provided
    if (typeof config.onConsentChange === 'function') {
      try {
        config.onConsentChange(categories);
      } catch (error) {
        console.error('CMP: Error in onConsentChange callback:', error);
      }
    }

    // Dispatch custom event
    const event = new CustomEvent('cmpConsentChange', {
      detail: { categories }
    });
    window.dispatchEvent(event);

    // Process queued scripts and blocked scripts based on consent
    console.log('CMP: Applying consent preferences:', categories);
    console.log('CMP: Blocked scripts status:', {
      analytics: blockedScripts.analytics.length,
      marketing: blockedScripts.marketing.length,
      performance: blockedScripts.performance.length
    });
    
    if (categories.analytics) {
      console.log('CMP: Processing analytics scripts...');
      processScriptQueue('analytics');
      processBlockedScripts('analytics');
      // Enable analytics tracking
      if (typeof window.gtag !== 'undefined') {
        window.gtag('consent', 'update', {
          analytics_storage: 'granted'
        });
      }
    } else {
      // Disable analytics tracking
      if (typeof window.gtag !== 'undefined') {
        window.gtag('consent', 'update', {
          analytics_storage: 'denied'
        });
      }
    }

    if (categories.marketing) {
      console.log('CMP: Processing marketing scripts...');
      processScriptQueue('marketing');
      processBlockedScripts('marketing');
      // Enable marketing cookies
      if (typeof window.fbq !== 'undefined') {
        window.fbq('consent', 'grant');
      }
    } else {
      // Disable marketing cookies
      if (typeof window.fbq !== 'undefined') {
        window.fbq('consent', 'revoke');
      }
    }

    if (categories.performance) {
      console.log('CMP: Processing performance scripts...');
      processScriptQueue('performance');
      processBlockedScripts('performance');
    }
  }

  /**
   * Update banner policy link hrefs to use current selected language
   */
  function updateBannerPolicyLinks() {
    if (!config.privacyPolicyId || !config.publicApiBaseUrl) return;
    const lang = getSelectedLanguage();
    const base = config.publicApiBaseUrl;
    const privacyHref = lang === 'en'
      ? base + '/' + config.privacyPolicyId + '/active/file'
      : base + '/' + config.privacyPolicyId + '/active/translations/' + encodeURIComponent(lang) + '/download';
    const termsHref = config.termsAndConditionsPolicyId
      ? (lang === 'en'
          ? base + '/' + config.termsAndConditionsPolicyId + '/active/file'
          : base + '/' + config.termsAndConditionsPolicyId + '/active/translations/' + encodeURIComponent(lang) + '/download')
      : '';
    const privacyLink = document.getElementById('cmp-privacy-link');
    const termsLink = document.getElementById('cmp-terms-link');
    if (privacyLink) privacyLink.setAttribute('href', privacyHref);
    if (termsLink && termsHref) termsLink.setAttribute('href', termsHref);
  }

  /**
   * Fetch summary for selected language and render into banner panel
   */
  function fetchAndRenderBannerSummary() {
    const panel = document.getElementById('cmp-summary-panel');
    if (!panel || !config.privacyPolicyId || !config.publicApiBaseUrl) return;
    const lang = getSelectedLanguage();
    const url = config.publicApiBaseUrl + '/' + config.privacyPolicyId + '/active/summary?languageCode=' + encodeURIComponent(lang);
    panel.innerHTML = '<p style="margin: 0; color: rgba(0,0,0,0.5);">Loading…</p>';
    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(result) {
        const styles = config.styles;
        if (!result.success || !result.summary) {
          panel.innerHTML = '<p style="margin: 0 0 8px 0;">Summary not available in this language.</p>' +
            (config.showPolicyLinks ? '<a id="cmp-summary-download" href="' + (lang === 'en' ? config.publicApiBaseUrl + '/' + config.privacyPolicyId + '/active/file' : config.publicApiBaseUrl + '/' + config.privacyPolicyId + '/active/translations/' + encodeURIComponent(lang) + '/download') + '" target="_blank" rel="noopener" style="color: ' + styles.linkColor + '; text-decoration: underline;">Download full policy (PDF)</a>' : '');
          return;
        }
        const s = result.summary;
        const dataCollected = s.dataCollected && s.dataCollected.length ? s.dataCollected : [];
        const summaryBullets = s.summary && s.summary.length ? s.summary : [];
        let html = '';
        if (dataCollected.length) {
          html += '<p style="margin: 0 0 6px 0; font-weight: 600;">Data we collect:</p><ul style="margin: 0 0 12px 0; padding-left: 18px;">';
          dataCollected.forEach(function(item) { html += '<li style="margin: 2px 0;">' + escapeHtml(String(item)) + '</li>'; });
          html += '</ul>';
        }
        if (summaryBullets.length) {
          html += '<p style="margin: 0 0 6px 0; font-weight: 600;">Summary:</p><ul style="margin: 0 0 12px 0; padding-left: 18px;">';
          summaryBullets.forEach(function(item) { html += '<li style="margin: 2px 0;">' + escapeHtml(String(item)) + '</li>'; });
          html += '</ul>';
        }
        const downloadUrl = lang === 'en' ? config.publicApiBaseUrl + '/' + config.privacyPolicyId + '/active/file' : config.publicApiBaseUrl + '/' + config.privacyPolicyId + '/active/translations/' + encodeURIComponent(lang) + '/download';
        html += '<a id="cmp-summary-download" href="' + downloadUrl + '" target="_blank" rel="noopener" style="color: ' + styles.linkColor + '; text-decoration: underline;">Download full policy (PDF)</a>';
        panel.innerHTML = html || '<p style="margin: 0;">No summary content.</p>';
      })
      .catch(function() {
        panel.innerHTML = '<p style="margin: 0 0 8px 0;">Summary not available in this language.</p>';
      });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Create consent banner HTML
   */
  function createBannerHTML(previousCategories = null, changeMessage = null, hasExistingConsent = false, canWithdrawConsent = true) {
    const position = config.bannerPosition === 'top' ? 'top: 0' : 'bottom: 0';
    const styles = config.styles;
    
    // Use previous consent categories if available, otherwise use config defaults
    const categories = previousCategories || config.categories;
    
    // Get custom text or use default
    // If consent already exists, use update message instead
    const bannerText = hasExistingConsent 
      ? (config.customText || 'Update your cookie preferences below. You can change your choices at any time.')
      : (config.customText || 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.');
    
    // Build change message if available
    let changeMessageHTML = '';
    if (changeMessage) {
      changeMessageHTML = `<div style="margin: 0 0 20px 0; padding: 14px 16px; background: linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 193, 7, 0.08) 100%); border-left: 4px solid #ffc107; border-radius: 8px; box-shadow: 0 2px 8px rgba(255, 193, 7, 0.1);">
        <p style="margin: 0; font-weight: 600; color: ${styles.bannerTextColor}; font-size: 14px; line-height: 1.5;">
          ${changeMessage}
        </p>
      </div>`;
    }
    
    // Build policy links (respect selected language for download)
    const lang = getSelectedLanguage();
    const privacyUrl = (config.privacyPolicyId && config.publicApiBaseUrl)
      ? (lang === 'en'
          ? `${config.publicApiBaseUrl}/${config.privacyPolicyId}/active/file`
          : `${config.publicApiBaseUrl}/${config.privacyPolicyId}/active/translations/${encodeURIComponent(lang)}/download`)
      : '';
    const termsUrl = (config.termsAndConditionsPolicyId && config.publicApiBaseUrl)
      ? (lang === 'en'
          ? `${config.publicApiBaseUrl}/${config.termsAndConditionsPolicyId}/active/file`
          : `${config.publicApiBaseUrl}/${config.termsAndConditionsPolicyId}/active/translations/${encodeURIComponent(lang)}/download`)
      : '';

    let policyLinks = '';
    if (config.showPolicyLinks) {
      const links = [];
      if (config.privacyPolicyId && privacyUrl) {
        links.push(`<a id="cmp-privacy-link" href="${privacyUrl}" target="_blank" rel="noopener" class="cmp-banner__link" style="color: ${styles.linkColor}; text-decoration: underline; font-weight: 500; transition: all 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Privacy Policy</a>`);
      }
      if (config.termsAndConditionsPolicyId && termsUrl) {
        links.push(`<a id="cmp-terms-link" href="${termsUrl}" target="_blank" rel="noopener" class="cmp-banner__link" style="color: ${styles.linkColor}; text-decoration: underline; font-weight: 500; transition: all 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Terms & Conditions</a>`);
      }
      if (links.length > 0) {
        policyLinks = `<div class="cmp-banner__policy-links" style="margin-top: 12px; font-size: 13px; color: ${styles.bannerTextColor}; opacity: 0.85;">Read our ${links.join(' and ')}.</div>`;
      }
    }

    // Language row + expandable summary (when privacy policy and public API exist)
    const showSummaryInBanner = config.privacyPolicyId && config.publicApiBaseUrl && config.showPolicySummaryInBanner !== false;
    let languageAndSummaryHTML = '';
    if (showSummaryInBanner) {
      languageAndSummaryHTML = `
        <div class="cmp-banner__language-row" style="margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">
          <span style="font-size: 13px; color: ${styles.bannerTextColor}; opacity: 0.9;">Policy in:</span>
          <select id="cmp-banner-language" aria-label="Policy language" style="padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.2); background: #fff; color: ${styles.bannerTextColor}; font-size: 13px; cursor: pointer;">
            <option value="en" ${lang === 'en' ? 'selected' : ''}>English</option>
          </select>
          <button type="button" id="cmp-summary-trigger" aria-expanded="false" aria-controls="cmp-summary-panel" aria-label="Expand privacy summary" style="background: none; border: none; color: ${styles.linkColor}; text-decoration: underline; font-size: 13px; cursor: pointer; padding: 0;">Read a short summary</button>
        </div>
        <div id="cmp-summary-panel" role="region" aria-labelledby="cmp-summary-trigger" style="display: none; margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.04); border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); max-height: 240px; overflow-y: auto; font-size: 13px; line-height: 1.5; color: ${styles.bannerTextColor};">
          <p style="margin: 0; color: rgba(0,0,0,0.5);">Loading…</p>
        </div>
      `;
    }

    // Close button (only show when opened from preferences)
    const closeButtonHTML = isBannerFromPreferences ? `
      <button id="cmp-close-banner" class="cmp-banner__close" style="
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.08);
        border: 1px solid rgba(0, 0, 0, 0.1);
        color: ${styles.bannerTextColor};
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s;
        font-size: 20px;
        line-height: 1;
        font-weight: 300;
        z-index: 10002;
        opacity: 0.8;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      " onmouseover="this.style.background='rgba(0,0,0,0.15)'; this.style.opacity='1'; this.style.borderColor='rgba(0,0,0,0.2)'" 
         onmouseout="this.style.background='rgba(0,0,0,0.08)'; this.style.opacity='0.8'; this.style.borderColor='rgba(0,0,0,0.1)'"
         aria-label="Close">
        Ã—
      </button>
    ` : '';

    return `
      <div id="${config.bannerId}" class="cmp-banner" style="
        position: fixed;
        ${position};
        left: 0;
        right: 0;
        background: ${styles.bannerBackground};
        color: ${styles.bannerTextColor};
        padding: 24px 20px;
        box-shadow: 0 -4px 24px rgba(0,0,0,0.12), 0 -2px 8px rgba(0,0,0,0.08);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        font-size: 15px;
        line-height: 1.6;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
      ">
        ${closeButtonHTML}
        <div class="cmp-banner__container" style="max-width: 1200px; margin: 0 auto; position: relative;">
          <div class="cmp-banner__header" style="display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 20px; padding-right: ${isBannerFromPreferences ? '50px' : '0'};">
            <div class="cmp-banner__content" style="flex: 1; min-width: 300px;">
              ${changeMessageHTML}
              <p class="cmp-banner__text" style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.6; color: ${styles.bannerTextColor};">
                ${bannerText}
              </p>
              ${policyLinks}
              ${languageAndSummaryHTML}
            </div>
            <div class="cmp-banner__actions" style="display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start; flex-shrink: 0;">
            ${hasExistingConsent ? `
            <!-- Existing consent: allow updating selections and (optionally) withdraw -->
            <button id="cmp-accept-selected" class="cmp-banner__button cmp-banner__button--primary" style="
              background: ${styles.buttonBackground};
              color: ${styles.buttonTextColor};
              border: none;
              padding: 11px 22px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              transition: all 0.2s;
              white-space: nowrap;
            " onmouseover="this.style.background='${styles.buttonHoverBackground}'; this.style.opacity='0.95'" 
               onmouseout="this.style.background='${styles.buttonBackground}'; this.style.opacity='1'">
              Save Preferences
            </button>
            ${canWithdrawConsent ? `
            <button id="cmp-withdraw-consent" class="cmp-banner__button cmp-banner__button--secondary" style="
              background: transparent;
              color: ${styles.bannerTextColor};
              border: 1px solid rgba(0, 0, 0, 0.2);
              padding: 11px 22px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s;
              white-space: nowrap;
            " onmouseover="this.style.background='rgba(0,0,0,0.05)'; this.style.borderColor='rgba(0,0,0,0.3)'" 
               onmouseout="this.style.background='transparent'; this.style.borderColor='rgba(0,0,0,0.2)'">
              Withdraw Consent
            </button>
            ` : ''}
            ` : `
            <!-- Show all buttons for new consent -->
            <button id="cmp-accept-all" class="cmp-banner__button cmp-banner__button--primary" style="
              background: ${styles.buttonBackground};
              color: ${styles.buttonTextColor};
              border: none;
              padding: 11px 22px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              transition: all 0.2s;
              white-space: nowrap;
            " onmouseover="this.style.background='${styles.buttonHoverBackground}'; this.style.opacity='0.95'" 
               onmouseout="this.style.background='${styles.buttonBackground}'; this.style.opacity='1'">
              Accept All
            </button>
            <button id="cmp-accept-selected" class="cmp-banner__button cmp-banner__button--primary" style="
              background: ${styles.buttonBackground};
              color: ${styles.buttonTextColor};
              border: none;
              padding: 11px 22px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              transition: all 0.2s;
              white-space: nowrap;
            " onmouseover="this.style.background='${styles.buttonHoverBackground}'; this.style.opacity='0.95'" 
               onmouseout="this.style.background='${styles.buttonBackground}'; this.style.opacity='1'">
              Accept Selected
            </button>
            <button id="cmp-reject-all" class="cmp-banner__button cmp-banner__button--secondary" style="
              background: transparent;
              color: ${styles.bannerTextColor};
              border: 1px solid rgba(0, 0, 0, 0.2);
              padding: 11px 22px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s;
              white-space: nowrap;
            " onmouseover="this.style.background='rgba(0,0,0,0.05)'; this.style.borderColor='rgba(0,0,0,0.3)'" 
               onmouseout="this.style.background='transparent'; this.style.borderColor='rgba(0,0,0,0.2)'">
              Reject
            </button>
            `}
            </div>
          </div>
          <div class="cmp-banner__categories" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; max-width: 500px; align-items: flex-start;">
            <label class="cmp-banner__category cmp-banner__category--disabled" style="display: flex; align-items: center; gap: 10px; cursor: not-allowed; padding: 12px 14px; width: 100%; background: #ffffff; border-radius: 6px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">
              <input type="checkbox" id="cmp-necessary" class="cmp-banner__checkbox" checked disabled style="cursor: not-allowed; width: 16px; height: 16px; min-width: 16px; max-width: 16px; margin: 0; flex-shrink: 0; flex-grow: 0;">
              <span class="cmp-banner__category-label" style="font-weight: 500; color: ${styles.bannerTextColor}; font-size: 14px; opacity: 0.7; text-align: left;">Necessary</span>
            </label>
            <label class="cmp-banner__category" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px 14px; width: 100%; background: #ffffff; border-radius: 6px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">
              <input type="checkbox" id="cmp-marketing" class="cmp-banner__checkbox" ${categories.marketing ? 'checked' : ''} style="width: 16px; height: 16px; min-width: 16px; max-width: 16px; margin: 0; cursor: pointer; flex-shrink: 0; flex-grow: 0;">
              <span class="cmp-banner__category-label" style="font-weight: 500; color: ${styles.bannerTextColor}; font-size: 14px; text-align: left;">Marketing</span>
            </label>
            <label class="cmp-banner__category" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px 14px; width: 100%; background: #ffffff; border-radius: 6px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">
              <input type="checkbox" id="cmp-analytics" class="cmp-banner__checkbox" ${categories.analytics ? 'checked' : ''} style="width: 16px; height: 16px; min-width: 16px; max-width: 16px; margin: 0; cursor: pointer; flex-shrink: 0; flex-grow: 0;">
              <span class="cmp-banner__category-label" style="font-weight: 500; color: ${styles.bannerTextColor}; font-size: 14px; text-align: left;">Analytics</span>
            </label>
            <label class="cmp-banner__category" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 12px 14px; width: 100%; background: #ffffff; border-radius: 6px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">
              <input type="checkbox" id="cmp-performance" class="cmp-banner__checkbox" ${categories.performance ? 'checked' : ''} style="width: 16px; height: 16px; min-width: 16px; max-width: 16px; margin: 0; cursor: pointer; flex-shrink: 0; flex-grow: 0;">
              <span class="cmp-banner__category-label" style="font-weight: 500; color: ${styles.bannerTextColor}; font-size: 14px; text-align: left;">Performance</span>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Show consent banner
   */
  function showBanner(fromPreferences = false) {
    // Hide preferences button when banner is shown
    hidePreferencesButton();
    
    // Track if banner is opened from preferences
    isBannerFromPreferences = fromPreferences;
    
    if (bannerElement) {
      if (fromPreferences) {
        // Always recreate banner when opened from preferences to ensure close button works
        bannerElement.remove();
        bannerElement = null;
      } else {
        // Just show existing banner without close button
        bannerElement.style.display = 'block';
        // Hide close button if it exists
        const existingCloseButton = document.getElementById('cmp-close-banner');
        if (existingCloseButton) {
          existingCloseButton.style.display = 'none';
        }
        return;
      }
    }

    // Get previous consent categories to pre-check boxes
    let previousCategories = null;
    let changeMessage = null;
    let hasExistingConsent = false;
    let canWithdrawConsent = true;
    
    if (currentConsent && currentConsent.categories) {
      previousCategories = currentConsent.categories;
      // Check if consent is current (exists and is valid)
      hasExistingConsent = currentConsent.isCurrent === true;
      // If consent is already Withdrawn or Rejected, hide withdraw button
      canWithdrawConsent = currentConsent.status !== 'Withdrawn' && currentConsent.status !== 'Rejected';
      // Get change message if consent is not current
      if (currentConsent.changeMessage) {
        changeMessage = currentConsent.changeMessage;
      }
    } else {
      // Try to get from localStorage as fallback
      const storedCategories = localStorage.getItem('cmp_consent_categories');
      const storedStatus = localStorage.getItem('cmp_consent_status');
      if (storedCategories) {
        try {
          previousCategories = JSON.parse(storedCategories);
          // If we have stored categories, assume consent exists
          hasExistingConsent = true;
          if (storedStatus) {
            canWithdrawConsent = storedStatus !== 'Withdrawn' && storedStatus !== 'Rejected';
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    // Create banner element with previous consent categories and change message
    const bannerHTML = createBannerHTML(previousCategories, changeMessage, hasExistingConsent, canWithdrawConsent);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = bannerHTML;
    bannerElement = tempDiv.firstElementChild;
    document.body.appendChild(bannerElement);

    // Add event listeners (only add if buttons exist)
    const acceptAllBtn = document.getElementById('cmp-accept-all');
    const acceptSelectedBtn = document.getElementById('cmp-accept-selected');
    const rejectAllBtn = document.getElementById('cmp-reject-all');
    const withdrawConsentBtn = document.getElementById('cmp-withdraw-consent');

    if (acceptAllBtn) {
      acceptAllBtn.addEventListener('click', function() {
        handleAcceptAll();
      });
    }

    if (acceptSelectedBtn) {
      acceptSelectedBtn.addEventListener('click', function() {
        handleAcceptSelected();
      });
    }

    if (rejectAllBtn) {
      rejectAllBtn.addEventListener('click', function() {
        handleRejectAll();
      });
    }

    if (withdrawConsentBtn) {
      withdrawConsentBtn.addEventListener('click', function() {
        handleWithdrawConsent();
      });
    }

    // Add close button listener if it exists
    const closeButton = document.getElementById('cmp-close-banner');
    if (closeButton) {
      // Remove any existing listeners by cloning and replacing
      const newCloseButton = closeButton.cloneNode(true);
      closeButton.parentNode.replaceChild(newCloseButton, closeButton);
      
      // Add fresh event listener
      newCloseButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        hideBanner();
        showPreferencesButton();
      });
    }

    // Banner language dropdown + expandable summary
    const bannerLanguageSelect = document.getElementById('cmp-banner-language');
    const summaryTrigger = document.getElementById('cmp-summary-trigger');
    if (bannerLanguageSelect) {
      // Fetch available languages and populate dropdown
      if (config.privacyPolicyId && config.publicApiBaseUrl) {
        var langUrl = config.publicApiBaseUrl + '/' + config.privacyPolicyId + '/translations/available';
        fetch(langUrl).then(function(r) { return r.json(); }).then(function(result) {
          if (result.success && result.languages && result.languages.length > 0) {
            var hasEn = result.languages.some(function(l) { return l.languageCode === 'en'; });
            bannerLanguageSelect.innerHTML = '';
            if (!hasEn) {
              var optEn = document.createElement('option');
              optEn.value = 'en';
              optEn.textContent = 'English';
              bannerLanguageSelect.appendChild(optEn);
            }
            result.languages.forEach(function(lang) {
              var opt = document.createElement('option');
              opt.value = lang.languageCode;
              opt.textContent = lang.languageName;
              bannerLanguageSelect.appendChild(opt);
            });
          }
          bannerLanguageSelect.value = getSelectedLanguage();
        }).catch(function() { bannerLanguageSelect.value = 'en'; });
      }
      bannerLanguageSelect.addEventListener('change', function() {
        setSelectedLanguage(this.value);
        updateBannerPolicyLinks();
        var panel = document.getElementById('cmp-summary-panel');
        if (panel && panel.style.display !== 'none') fetchAndRenderBannerSummary();
      });
    }
    if (summaryTrigger) {
      summaryTrigger.addEventListener('click', function() {
        var panel = document.getElementById('cmp-summary-panel');
        if (!panel) return;
        var isExpanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
        panel.style.display = isExpanded ? 'none' : 'block';
        if (!isExpanded) fetchAndRenderBannerSummary();
      });
    }
  }

  /**
   * Hide consent banner
   */
  function hideBanner() {
    if (bannerElement) {
      bannerElement.style.display = 'none';
    }
  }

  /**
   * Create preferences button
   */
  function createPreferencesButton() {
    if (preferencesButton) {
      return; // Already exists
    }

    if (config.showPreferencesButton === false) {
      return; // Disabled
    }

    const button = document.createElement('button');
    button.id = config.preferencesButtonId;
    button.setAttribute('aria-label', 'Cookie Preferences');
    button.setAttribute('title', 'Cookie Preferences');
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style="display:block">
        <!-- Cookie icon (outline + chips) -->
        <path d="M12 2a10 10 0 1 0 10 10 3 3 0 0 1-3-3 3 3 0 0 1-3-3 3 3 0 0 1-3-3 3 3 0 0 1-1.1-2.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="8.5" cy="13" r="1.1" fill="currentColor"/>
        <circle cx="14.2" cy="14.8" r="1" fill="currentColor"/>
        <circle cx="11" cy="17.2" r="0.9" fill="currentColor"/>
        <circle cx="15.8" cy="10.6" r="0.9" fill="currentColor"/>
      </svg>
    `;
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: ${config.styles.buttonBackground};
      color: ${config.styles.buttonTextColor};
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      padding: 0;
    `;
    
    button.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.1)';
      this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
      this.style.background = config.styles.buttonHoverBackground;
    });
    
    button.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      this.style.background = config.styles.buttonBackground;
    });
    
    button.addEventListener('click', function() {
      showBanner(true); // Pass true to indicate it's from preferences button
    });
    
    document.body.appendChild(button);
    preferencesButton = button;
  }

  /**
   * Show preferences button
   */
  function showPreferencesButton() {
    if (config.showPreferencesButton !== false) {
      createPreferencesButton();
      if (preferencesButton) {
        preferencesButton.style.display = 'flex';
      }
    }
  }

  /**
   * Hide preferences button
   */
  function hidePreferencesButton() {
    if (preferencesButton) {
      preferencesButton.style.display = 'none';
    }
  }

  /**
   * Handle Accept All
   */
  async function handleAcceptAll() {
    const categories = {
      necessary: true,
      analytics: true,
      performance: true,
      marketing: true
    };

    const result = await recordConsent({
      status: 'Accepted',
      categories: categories
    });

    if (result.success) {
      hideBanner();
      applyConsentPreferences(categories);
      
      // Store consent preference
      localStorage.setItem('cmp_consent_categories', JSON.stringify(categories));
      localStorage.setItem('cmp_consent_status', 'Accepted');
      
      // Show preferences button after consent
      showPreferencesButton();
    } else {
      alert('Failed to record consent. Please try again.');
    }
  }

  /**
   * Handle Accept Selected
   */
  async function handleAcceptSelected() {
    const analytics = document.getElementById('cmp-analytics').checked;
    const performance = document.getElementById('cmp-performance').checked;
    const marketing = document.getElementById('cmp-marketing').checked;

    const categories = {
      necessary: true,
      analytics: analytics,
      performance: performance,
      marketing: marketing
    };

    const result = await recordConsent({
      status: 'Accepted',
      categories: categories
    });

    if (result.success) {
      hideBanner();
      applyConsentPreferences(categories);
      
      // Store consent preference
      localStorage.setItem('cmp_consent_categories', JSON.stringify(categories));
      localStorage.setItem('cmp_consent_status', 'Accepted');
      
      // Show preferences button after consent
      showPreferencesButton();
    } else {
      alert('Failed to record consent. Please try again.');
    }
  }

  /**
   * Handle Reject (reject all optional cookies, necessary cookies are always required)
   */
  async function handleRejectAll() {
    const categories = {
      necessary: true,
      analytics: false,
      performance: false,
      marketing: false
    };

    const result = await recordConsent({
      status: 'Rejected',
      categories: categories
    });

    if (result.success) {
      hideBanner();
      applyConsentPreferences(categories);
      
      // Store consent preference
      localStorage.setItem('cmp_consent_categories', JSON.stringify(categories));
      localStorage.setItem('cmp_consent_status', 'Rejected');
      
      // Show preferences button after consent
      showPreferencesButton();
    } else {
      alert('Failed to record consent. Please try again.');
    }
  }

  /**
   * Handle Withdraw Consent (withdraw all optional cookies; necessary cookies are always required)
   */
  async function handleWithdrawConsent() {
    const categories = {
      necessary: true,
      analytics: false,
      performance: false,
      marketing: false
    };

    const result = await recordConsent({
      status: 'Withdrawn',
      categories: categories
    });

    if (result.success) {
      hideBanner();
      applyConsentPreferences(categories);
      
      // Store consent preference
      localStorage.setItem('cmp_consent_categories', JSON.stringify(categories));
      localStorage.setItem('cmp_consent_status', 'Withdrawn');
      
      // Show preferences button after consent
      showPreferencesButton();
    } else {
      alert('Failed to record consent. Please try again.');
    }
  }

  /**
   * Initialize CMP
   */
  async function init(userConfig) {
    // Merge user config with defaults
    config = { ...DEFAULT_CONFIG, ...userConfig };

    // Validate required config
    if (!config.apiBaseUrl) {
      console.error('CMP: apiBaseUrl is required');
      return;
    }
    
    // Set default public API base URL if not provided
    if (!config.publicApiBaseUrl) {
      // Try to derive from apiBaseUrl (replace /consent with /public/policies)
      config.publicApiBaseUrl = config.apiBaseUrl.replace('/consent', '/public/policies') || '/public/policies';
    }

    // Check existing consent
    const consent = await checkConsent();

    if (consent && consent.isCurrent) {
      // User has existing consent (Accepted or Rejected) - apply preferences if Accepted
      if (consent.status === 'Accepted') {
        applyConsentPreferences(consent.categories);
      }
      
      // Store categories in localStorage for banner pre-checking
      if (consent.categories) {
        localStorage.setItem('cmp_consent_categories', JSON.stringify(consent.categories));
      }
      if (consent.status) {
        localStorage.setItem('cmp_consent_status', consent.status);
      }
      
      // Try to restore from localStorage if available
      const storedCategories = localStorage.getItem('cmp_consent_categories');
      if (storedCategories) {
        try {
          const parsed = JSON.parse(storedCategories);
          if (consent.status === 'Accepted') {
            applyConsentPreferences(parsed);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Show preferences button if consent exists (both Accepted and Rejected)
      showPreferencesButton();
      
      // Don't auto-show banner if consent exists (user can use preferences button)
    } else if (config.autoShow) {
      // Show banner if no valid consent (will use previous consent categories and change message if available)
      showBanner();
    }

    // Process any queued scripts and blocked scripts if consent already exists and is Accepted
    if (consent && consent.isCurrent && consent.status === 'Accepted') {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (consent.categories.analytics) {
          processScriptQueue('analytics');
          processBlockedScripts('analytics');
        }
        if (consent.categories.marketing) {
          processScriptQueue('marketing');
          processBlockedScripts('marketing');
        }
        if (consent.categories.performance) {
          processScriptQueue('performance');
          processBlockedScripts('performance');
        }
      }, 100);
    } else if (consent && consent.isCurrent && consent.status === 'Rejected') {
      // If consent is Rejected, don't process any scripts
      console.log('CMP: Consent is Rejected, scripts will remain blocked');
    }

    // Expose public API (merge with existing CMP object to preserve loadScript/loadInlineScript and getCurrentConsent)
    window.CMP = window.CMP || {};
    window.CMP.checkConsent = checkConsent;
    window.CMP.recordConsent = recordConsent;
    window.CMP.showBanner = showBanner;
    window.CMP.hideBanner = hideBanner;
    window.CMP.getSubjectId = getOrCreateSubjectId;
    window.CMP.getExternalUserId = getExternalUserId;
    window.CMP.setExternalUserId = setExternalUserId;
    window.CMP.clearExternalUserId = clearExternalUserId;
    window.CMP.getUserData = getUserData;
    window.CMP.setUserData = setUserData;
    // Update getCurrentConsent to ensure it returns the latest currentConsent
    window.CMP.getCurrentConsent = function() { return currentConsent; };
    window.CMP.applyPreferences = applyConsentPreferences;
    window.CMP.getSelectedLanguage = getSelectedLanguage;
    window.CMP.setSelectedLanguage = setSelectedLanguage;
    
    // Process any scripts that were queued before init
    setTimeout(() => {
      const consent = currentConsent;
      if (consent && consent.isCurrent && consent.status === 'Accepted') {
        if (consent.categories.analytics) processScriptQueue('analytics');
        if (consent.categories.marketing) processScriptQueue('marketing');
        if (consent.categories.performance) processScriptQueue('performance');
      }
    }, 100);
  }

  // Auto-initialize if config is provided via data attributes
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      const script = document.querySelector('script[data-cmp-config]');
      if (script) {
        try {
          const config = JSON.parse(script.getAttribute('data-cmp-config'));
          init(config);
        } catch (e) {
          console.error('CMP: Invalid configuration', e);
        }
      }
    });
  } else {
    const script = document.querySelector('script[data-cmp-config]');
    if (script) {
      try {
        const config = JSON.parse(script.getAttribute('data-cmp-config'));
        init(config);
      } catch (e) {
        console.error('CMP: Invalid configuration', e);
      }
    }
  }

  // Export init function and script loading functions for manual initialization
  window.CMP = window.CMP || {};
  window.CMP.init = init;
  
  // Expose getCurrentConsent immediately (before init)
  window.CMP.getCurrentConsent = function() { 
    return currentConsent; 
  };
  
  // Expose script loading functions immediately (they'll work even before init)
  window.CMP.loadScript = function(category, src, attributes, onLoad, onError) {
    // Check if CMP is initialized
    if (!config || !config.apiBaseUrl) {
      console.warn('CMP: loadScript called before init. Script will be queued after initialization.');
      // Queue the script to be processed after init
      if (!scriptQueue[category]) {
        scriptQueue[category] = [];
      }
      scriptQueue[category].push({
        type: 'src',
        src: src,
        attributes: attributes,
        onLoad: onLoad,
        onError: onError
      });
      return Promise.resolve(null);
    }
    
    const consent = currentConsent;
    const hasConsent = consent && consent.isCurrent && consent.status === 'Accepted' && consent.categories[category];
    
    if (hasConsent) {
      // Load immediately if consent exists
      return loadScript(src, attributes)
        .then(script => {
          if (onLoad) onLoad(script);
          return script;
        })
        .catch(error => {
          if (onError) onError(error);
          throw error;
        });
    } else {
      // Queue for later
      scriptQueue[category].push({
        type: 'src',
        src: src,
        attributes: attributes,
        onLoad: onLoad,
        onError: onError
      });
      return Promise.resolve(null);
    }
  };
  
  window.CMP.loadInlineScript = function(category, code, id, onLoad, onError) {
    // Check if CMP is initialized
    if (!config || !config.apiBaseUrl) {
      console.warn('CMP: loadInlineScript called before init. Script will be queued after initialization.');
      // Queue the script to be processed after init
      if (!scriptQueue[category]) {
        scriptQueue[category] = [];
      }
      scriptQueue[category].push({
        type: 'inline',
        code: code,
        id: id,
        onLoad: onLoad,
        onError: onError
      });
      return Promise.resolve(null);
    }
    
    const consent = currentConsent;
    const hasConsent = consent && consent.isCurrent && consent.status === 'Accepted' && consent.categories[category];
    
    if (hasConsent) {
      // Load immediately if consent exists
      return loadInlineScript(code, id)
        .then(script => {
          if (onLoad) onLoad(script);
          return script;
        })
        .catch(error => {
          if (onError) onError(error);
          throw error;
        });
    } else {
      // Queue for later
      scriptQueue[category].push({
        type: 'inline',
        code: code,
        id: id,
        onLoad: onLoad,
        onError: onError
      });
      return Promise.resolve(null);
    }
  };

})(window, document);
