// Background script for Headers Manager extension

// Import storage manager
importScripts('./storage-manager.js');

class HeadersManager {
    constructor() {
        this.chromeRules = new Map();
        this.ruleId = 1;
        this.isLoading = false; // Prevent concurrent loads
        this.pendingReload = false; // Track if reload is needed after current load
        this.init();
    }

    async init() {
        // Load saved configuration from storage
        await this.loadConfiguration();

        // Register navigator override scripts
        await this.registerNavigatorScripts();

        // Listen for storage changes
        storageManager.addChangeListener(async (changes, namespace) => {
            if (changes.headerRules || changes.websites) {
                await this.loadConfiguration();
            }
        });

        // Listen for extension installation
        chrome.runtime.onInstalled.addListener(() => {
            this.setupDefaultConfiguration();
        });
    }

    async loadConfiguration() {
        // If already loading, mark that we need to reload again
        if (this.isLoading) {
            console.log('Configuration loading already in progress, marking for reload...');
            this.pendingReload = true;
            return;
        }

        this.isLoading = true;

        try {
            do {
                this.pendingReload = false; // Reset the flag

                const result = await storageManager.get(['headerRules', 'websites']);
                const headerRules = result.headerRules || [];
                const websites = result.websites || [];

                // Get all existing dynamic rules and remove them
                const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
                const existingRuleIds = existingRules.map(rule => rule.id);

                if (existingRuleIds.length > 0) {
                    await chrome.declarativeNetRequest.updateDynamicRules({
                        removeRuleIds: existingRuleIds
                    });

                    // Small delay to ensure Chrome processes the removal
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                this.chromeRules.clear();

                // Use random integers within safe range to ensure no conflicts
                // Chrome expects 32-bit signed integers, so use range 1 to 999999
                const usedIds = new Set();
                const generateUniqueId = () => {
                    let id;
                    do {
                        id = Math.floor(Math.random() * 999999) + 1;
                    } while (usedIds.has(id));
                    usedIds.add(id);
                    return id;
                };

                // Build Chrome rules based on websites and their enabled rules
                const rulesToAdd = [];

                websites.forEach(website => {
                    if (!website.enabled) return;

                    website.urls.forEach(urlPattern => {
                        website.enabledRules.forEach(ruleId => {
                            // Find the rule by ID
                            const rule = headerRules.find(r => r.id === ruleId && r.enabled);
                            if (!rule) return;

                            rule.headers.forEach(header => {
                                const chromeRuleId = generateUniqueId();
                                this.chromeRules.set(chromeRuleId, {
                                    website: website.name,
                                    rule: rule.name,
                                    header: header.name
                                });

                                const requestHeader = {
                                    header: header.name,
                                    operation: header.operation || "set"
                                };

                                // Only include value for 'set' operations, not for 'remove'
                                if (header.operation !== 'remove') {
                                    requestHeader.value = header.value;
                                }

                                const chromeRule = {
                                    id: chromeRuleId,
                                    priority: 1,
                                    action: {
                                        type: "modifyHeaders",
                                        requestHeaders: [requestHeader]
                                    },
                                    condition: {
                                        urlFilter: this.convertUrlPatternToFilter(urlPattern),
                                        resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "other"]
                                    }
                                };

                                console.log(`Created rule for ${urlPattern} -> ${this.convertUrlPatternToFilter(urlPattern)}`);
                                rulesToAdd.push(chromeRule);
                            });
                        });
                    });
                });

                if (rulesToAdd.length > 0) {
                    await chrome.declarativeNetRequest.updateDynamicRules({
                        addRules: rulesToAdd
                    });
                }

                // Notify content scripts about configuration changes
                this.notifyContentScripts();

                console.log(`Loaded ${rulesToAdd.length} Chrome header rules from ${websites.length} websites`);

            } while (this.pendingReload); // Keep reloading if more changes came in

        } catch (error) {
            console.error('Error loading configuration:', error);
        } finally {
            this.isLoading = false;
        }
    }

    convertUrlPatternToFilter(pattern) {
        // Convert user-friendly patterns to Chrome's declarativeNetRequest format
        let filter = pattern.trim();

        // Handle subdomain wildcards like https://*.example.com
        if (filter.includes('://*.')) {
            // Ensure subdomain patterns end with /*
            if (!filter.endsWith('/*') && !filter.endsWith('*')) {
                // If it ends with just the domain, add /*
                if (!filter.includes('/', filter.indexOf('://') + 3)) {
                    filter += '/*';
                } else if (!filter.endsWith('/') && !filter.endsWith('*')) {
                    filter += '/*';
                }
            }
        }
        //-- Handle regular domains (most common case)
        else {
            // If no path is specified after the domain, add /* to match everything
            const protocolEnd = filter.indexOf('://') + 3;
            const pathStart = filter.indexOf('/', protocolEnd);

            if (pathStart === -1) {
                // No path specified, add /* to match all paths
                filter += '/*';
            } else if (filter.endsWith('/')) {
                // Ends with /, add * to match everything under that path
                filter += '*';
            } else if (!filter.endsWith('*')) {
                // Has a path but no wildcard, check if it needs one
                // For exact files, don't add wildcard
                // For directories or ambiguous cases, add /*
                const lastSegment = filter.substring(filter.lastIndexOf('/') + 1);
                if (!lastSegment.includes('.')) {
                    // Likely a directory, add /*
                    filter += '/*';
                }
                // If it contains a dot, assume it's a file and leave as-is
            }
        }

        return filter;
    }

    async setupDefaultConfiguration() {
        // Setup default configuration
        const defaultHeaderRules = [
            {
                id: 'cors-basic',
                name: 'Basic CORS Headers',
                headers: [
                    { name: 'Access-Control-Allow-Origin', value: '*', operation: 'set' },
                    { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS', operation: 'set' },
                    { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization', operation: 'set' }
                ],
                enabled: true
            },
            {
                id: 'auth-bearer',
                name: 'Bearer Token Auth',
                headers: [
                    { name: 'Authorization', value: 'Bearer your-token-here', operation: 'set' }
                ],
                enabled: false
            },
            {
                id: 'custom-user-agent',
                name: 'Custom User Agent',
                headers: [
                    { name: 'User-Agent', value: 'TestBot/1.0', operation: 'set' }
                ],
                enabled: false
            },
            {
                id: 'privacy-headers',
                name: 'Privacy Headers (Remove Tracking)',
                headers: [
                    { name: 'Referer', value: '', operation: 'remove' },
                    { name: 'X-Forwarded-For', value: '', operation: 'remove' }
                ],
                enabled: false
            }
        ];

        const defaultWebsites = [
            {
                id: 'localhost-dev',
                name: 'Local Development',
                urls: ['http://localhost:*/*', 'https://localhost:*/*'],
                enabledRules: ['cors-basic'],
                enabled: false
            }
        ];

        await storageManager.set({
            headerRules: defaultHeaderRules,
            websites: defaultWebsites
        });
    }

    async toggleWebsite(websiteId, enabled) {
        const result = await storageManager.get(['websites']);
        const websites = result.websites || [];

        const website = websites.find(w => w.id === websiteId);
        if (website) {
            website.enabled = enabled;
            await storageManager.set({ websites });
            await this.loadConfiguration();
        }
    }

    async toggleWebsiteRule(websiteId, ruleId, enabled) {
        const result = await storageManager.get(['websites']);
        const websites = result.websites || [];

        const website = websites.find(w => w.id === websiteId);
        if (website) {
            if (enabled) {
                if (!website.enabledRules.includes(ruleId)) {
                    website.enabledRules.push(ruleId);
                }
            } else {
                website.enabledRules = website.enabledRules.filter(r => r !== ruleId);
            }
            await storageManager.set({ websites });
            await this.loadConfiguration();
        }
    }

    // Function to register navigator override scripts
    async registerNavigatorScripts() {
        try {
            // Unregister existing scripts first
            await chrome.scripting.unregisterContentScripts();

            const props = {
                'matches': ['*://*/*'],
                'allFrames': true,
                'matchOriginAsFallback': true,
                'runAt': 'document_start'
            };

            // Register scripts in specific order (important!)
            await chrome.scripting.registerContentScripts([{
                'id': 'headers-manager-main',
                'js': ['/inject/main.js'],
                'world': 'MAIN',
                ...props
            }]);

            await chrome.scripting.registerContentScripts([{
                'id': 'headers-manager-override',
                'js': ['/inject/override.js'],
                'world': 'MAIN',
                ...props
            }]);

            await chrome.scripting.registerContentScripts([{
                'id': 'headers-manager-isolated',
                'js': ['/inject/isolated.js'],
                'world': 'ISOLATED',
                ...props
            }]);

            console.log('Headers Manager: Navigator override scripts registered successfully');

        } catch (error) {
            console.warn('Headers Manager: Error registering navigator scripts', error);
        }
    }

    async notifyContentScripts() {
        // Get all tabs and inject/refresh content scripts for navigator property changes
        try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                    try {
                        // Send message to existing content script if it exists
                        await chrome.tabs.sendMessage(tab.id, { action: 'refreshNavigatorProperties' });
                    } catch (error) {
                        // Content script might not be loaded yet, that's okay
                        console.log(`No content script in tab ${tab.id}, will be loaded on next navigation`);
                    }
                }
            }
        } catch (error) {
            console.warn('Error notifying content scripts:', error);
        }
    }
}

// Initialize the headers manager
const headersManager = new HeadersManager();

// Handle messages from popup and options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'log':
            // Handle logging messages from content scripts
            const timestamp = new Date().toISOString();
            const tabInfo = sender.tab ? ` [Tab ${sender.tab.id}]` : '';
            const prefix = `[${timestamp}] Headers Manager${tabInfo}:`;

            if (request.level === 'error') {
                console.error(prefix, request.message, request.error || '', request.url || '');
            } else if (request.level === 'warn') {
                console.warn(prefix, request.message, request.data || '', request.url || '');
            } else {
                console.log(prefix, request.message, request.data || '', request.url || '');
            }
            break;
        case 'toggleWebsite':
            headersManager.toggleWebsite(request.websiteId, request.enabled)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'toggleWebsiteRule':
            headersManager.toggleWebsiteRule(request.websiteId, request.ruleId, request.enabled)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'reloadConfiguration':
            headersManager.loadConfiguration()
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
});
