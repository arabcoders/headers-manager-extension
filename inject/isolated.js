// Headers Manager - Isolated Script
// Runs in ISOLATED world (content script context)

let port = document.getElementById('headers-manager-port');

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
        // Get configuration from storage
        const result = await chrome.storage.sync.get(['websites', 'headerRules']);
        const websites = result.websites || [];
        const headerRules = result.headerRules || [];

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

if (port) {
    // Apply overrides immediately
    checkAndApplyUserAgent();

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && (changes.websites || changes.headerRules)) {
            checkAndApplyUserAgent();
        }
    });

    // Listen for refresh messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'refreshNavigatorProperties') {
            checkAndApplyUserAgent();
            sendResponse({ success: true });
        }
    });
}
