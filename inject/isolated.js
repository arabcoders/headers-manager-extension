// Headers Manager - Isolated Script
// Runs in ISOLATED world (content script context)

let port = document.getElementById('headers-manager-port');
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 500; // ms

// Wait for port to be available (in case script execution order varies)
const waitForPort = () => {
    return new Promise((resolve) => {
        if (port) {
            resolve(port);
            return;
        }

        const checkInterval = setInterval(() => {
            port = document.getElementById('headers-manager-port');
            if (port) {
                clearInterval(checkInterval);
                resolve(port);
            }
        }, 100);

        // Timeout after 2 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!port) {
                console.warn('Headers Manager: Port element not found after timeout');
            }
            resolve(port);
        }, 2000);
    });
};

const override = (prefs) => {
    if (!port) {
        return;
    }

    // Prepare userAgentData if needed
    let userAgentData = null;
    if (prefs.userAgent && navigator.userAgentData) {
        userAgentData = createUserAgentData(prefs.userAgent);
    }

    // Trigger override in main world
    const event = new CustomEvent('override', {
        detail: {
            userAgentData: userAgentData,
            prefs: prefs
        }
    });
    port.dispatchEvent(event);
};

const createUserAgentData = (userAgent) => {
    // Parse userAgent to create compatible userAgentData
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    let platform = 'Unknown';
    if (userAgent.includes('Windows NT')) {
        platform = 'Windows';
    } else if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) {
        platform = 'macOS';
    } else if (userAgent.includes('Linux')) {
        platform = 'Linux';
    }

    const brands = [
        { brand: 'Not/A)Brand', version: '8' }
    ];

    // Extract browser info
    const chromeMatch = userAgent.match(/Chrome\/([\d.]+)/);
    if (chromeMatch) {
        const version = chromeMatch[1].split('.')[0];
        brands.push(
            { brand: 'Chromium', version },
            { brand: 'Google Chrome', version }
        );
    }

    const edgeMatch = userAgent.match(/Edg\/([\d.]+)/);
    if (edgeMatch) {
        const version = edgeMatch[1].split('.')[0];
        brands.push({ brand: 'Microsoft Edge', version });
    }

    return {
        brands,
        mobile,
        platform,
        toJSON() {
            return {
                brands: this.brands,
                mobile: this.mobile,
                platform: this.platform
            };
        },
        getHighEntropyValues(hints) {
            if (!hints || !Array.isArray(hints)) {
                return Promise.reject(new Error("Failed to execute 'getHighEntropyValues' on 'NavigatorUAData'"));
            }

            const result = this.toJSON();

            if (hints.includes('architecture')) {
                result.architecture = 'x86';
            }
            if (hints.includes('bitness')) {
                result.bitness = '64';
            }
            if (hints.includes('model')) {
                result.model = '';
            }
            if (hints.includes('platformVersion')) {
                result.platformVersion = '10.0.0';
            }
            if (hints.includes('uaFullVersion')) {
                result.uaFullVersion = this.brands[1]?.version + '.0.0.0' || '139.0.0.0';
            }
            if (hints.includes('fullVersionList')) {
                result.fullVersionList = this.brands;
            }

            return Promise.resolve(result);
        }
    };
};

const checkAndApplyUserAgent = async () => {
    try {
        // Get configuration from storage - try both sync and local
        // This ensures compatibility with the storage manager's hybrid approach
        let result;
        try {
            // Try sync first
            result = await chrome.storage.sync.get(['websites', 'headerRules']);
            
            // If no data in sync, try local storage
            if ((!result.websites || result.websites.length === 0) && 
                (!result.headerRules || result.headerRules.length === 0)) {
                result = await chrome.storage.local.get(['websites', 'headerRules']);
            }
        } catch (error) {
            // Fallback to local storage if sync fails
            console.warn('Headers Manager: Sync storage failed, trying local', error);
            result = await chrome.storage.local.get(['websites', 'headerRules']);
        }

        const websites = result.websites || [];
        const headerRules = result.headerRules || [];

        if (websites.length === 0 || headerRules.length === 0) {
            console.log('Headers Manager: No configuration found yet, will retry on storage change');
            return;
        }

        const currentUrl = window.location.href;
        let customUserAgent = null;

        // Find matching User-Agent rules
        for (const website of websites) {
            if (!website.enabled) continue;

            const urlMatches = website.urls.some(pattern => {
                try {
                    let regexPattern = pattern
                        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                        .replace(/\\\*/g, '.*');

                    if (pattern.includes('://*.')) {
                        regexPattern = regexPattern.replace('://\\.\\*\\.', '://(.*\\.)?');
                    }

                    if (!pattern.endsWith('/*') && !pattern.endsWith('*') && !pattern.includes('/', pattern.indexOf('://') + 3)) {
                        regexPattern += '/.*';
                    }

                    const regex = new RegExp('^' + regexPattern + '$');
                    return regex.test(currentUrl);
                } catch (e) {
                    return currentUrl.includes(pattern.replace(/\*/g, ''));
                }
            });

            if (urlMatches) {
                for (const ruleId of website.enabledRules) {
                    const rule = headerRules.find(r => r.id === ruleId && r.enabled);
                    if (rule) {
                        const userAgentHeader = rule.headers.find(h =>
                            h.name.toLowerCase() === 'user-agent' &&
                            h.operation === 'set' &&
                            h.value
                        );
                        if (userAgentHeader) {
                            customUserAgent = userAgentHeader.value;
                            break;
                        }
                    }
                }
            }

            if (customUserAgent) break;
        }

        if (customUserAgent) {
            // Parse User-Agent to extract other properties
            let appVersion = customUserAgent;
            if (customUserAgent.startsWith('Mozilla/')) {
                appVersion = customUserAgent.substring(8);
            }

            let platform = 'Linux x86_64'; // default
            if (customUserAgent.includes('Windows NT')) {
                platform = 'Win32';
            } else if (customUserAgent.includes('Macintosh')) {
                platform = 'MacIntel';
            } else if (customUserAgent.includes('Android')) {
                platform = 'Linux armv7l';
            }

            const prefs = {
                userAgent: customUserAgent,
                appVersion: appVersion,
                platform: platform
            };

            // Store data in port element
            port.dataset.str = encodeURIComponent(JSON.stringify(prefs));
            port.dataset.ready = 'true';

            // Trigger override
            override(prefs);

            console.log('Headers Manager: Applied navigator overrides:', prefs);
        }

    } catch (error) {
        console.warn('Headers Manager: Error applying navigator overrides', error);
    }
};

// Initialize with retry mechanism
(async () => {
    // Wait for port element to be available
    await waitForPort();

    if (port) {
        // Apply overrides immediately with retry
        const tryApply = async (attempt = 0) => {
            try {
                await checkAndApplyUserAgent();
            } catch (error) {
                if (attempt < MAX_RETRIES) {
                    console.log(`Headers Manager: Retry ${attempt + 1}/${MAX_RETRIES} after error:`, error);
                    setTimeout(() => tryApply(attempt + 1), RETRY_DELAY * (attempt + 1));
                } else {
                    console.error('Headers Manager: Failed to apply user agent after retries:', error);
                }
            }
        };

        tryApply();

        // Listen for storage changes in both sync and local storage
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if ((namespace === 'sync' || namespace === 'local') && 
                (changes.websites || changes.headerRules)) {
                console.log('Headers Manager: Storage changed, reapplying navigator overrides');
                checkAndApplyUserAgent();
            }
        });

        // Listen for refresh messages
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'refreshNavigatorProperties') {
                console.log('Headers Manager: Refresh requested, reapplying navigator overrides');
                checkAndApplyUserAgent();
                sendResponse({ success: true });
            }
        });
    } else {
        console.warn('Headers Manager: Port element not available, navigator overrides disabled');
    }
})();
