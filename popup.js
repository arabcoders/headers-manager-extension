// Popup script for Headers Manager extension

class PopupManager {
    constructor() {
        this.websites = [];
        this.headerRules = [];
        this.init();
    }

    async init() {
        await this.loadData();
        this.renderWebsites();
        this.setupEventListeners();
    }

    async loadData() {
        try {
            const result = await storageManager.get(['websites', 'headerRules']);
            this.websites = result.websites || [];
            this.headerRules = result.headerRules || [];
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    renderWebsites() {
        const websitesList = document.getElementById('groupsList');

        // Clear existing content
        websitesList.textContent = '';

        if (this.websites.length === 0) {
            const noGroupsDiv = document.createElement('div');
            noGroupsDiv.className = 'no-groups';

            noGroupsDiv.appendChild(document.createTextNode('No websites configured.'));
            noGroupsDiv.appendChild(document.createElement('br'));
            noGroupsDiv.appendChild(document.createTextNode('Click Options to get started.'));

            websitesList.appendChild(noGroupsDiv);
            return;
        }

        this.websites.forEach(website => {
            const enabledRulesCount = website.enabledRules.length;
            const totalRules = this.countRulesForWebsite(website);
            const isEnabled = website.enabled;

            const groupItem = document.createElement('div');
            groupItem.className = 'group-item';

            const infoDiv = document.createElement('div');

            const groupName = document.createElement('div');
            groupName.className = 'group-name';
            groupName.textContent = website.name;

            const groupCount = document.createElement('div');
            groupCount.className = 'group-count';
            groupCount.textContent = `${enabledRulesCount} rules enabled, ${totalRules} headers total`;

            infoDiv.appendChild(groupName);
            infoDiv.appendChild(groupCount);

            const toggleSwitch = document.createElement('div');
            toggleSwitch.className = `toggle-switch ${isEnabled ? 'active' : ''}`;
            toggleSwitch.setAttribute('data-website', website.id);

            groupItem.appendChild(infoDiv);
            groupItem.appendChild(toggleSwitch);
            websitesList.appendChild(groupItem);
        });
    }

    countRulesForWebsite(website) {
        let totalHeaders = 0;
        website.enabledRules.forEach(ruleId => {
            const rule = this.headerRules.find(r => r.id === ruleId && r.enabled);
            if (rule) {
                totalHeaders += rule.headers.length;
            }
        });
        return totalHeaders;
    }

    setupEventListeners() {
        // Open options page
        document.getElementById('openOptions').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        // Toggle switches
        document.getElementById('groupsList').addEventListener('click', async (e) => {
            if (e.target.classList.contains('toggle-switch')) {
                const websiteId = e.target.getAttribute('data-website');
                const isCurrentlyEnabled = e.target.classList.contains('active');

                try {
                    // Toggle the switch visually first for immediate feedback
                    e.target.classList.toggle('active');

                    // Send message to background script
                    const response = await chrome.runtime.sendMessage({
                        action: 'toggleWebsite',
                        websiteId: websiteId,
                        enabled: !isCurrentlyEnabled
                    });

                    if (response.success) {
                        // Update local state
                        const website = this.websites.find(w => w.id === websiteId);
                        if (website) {
                            website.enabled = !isCurrentlyEnabled;
                        }

                        // Re-render to update counts
                        this.renderWebsites();
                        this.showStatus('Website updated successfully', 'success');
                    } else {
                        // Revert the visual change if the operation failed
                        e.target.classList.toggle('active');
                        this.showStatus('Error updating website: ' + response.error, 'error');
                    }
                } catch (error) {
                    // Revert the visual change if the operation failed
                    e.target.classList.toggle('active');
                    this.showStatus('Error updating website', 'error');
                    console.error('Error toggling website:', error);
                }
            }
        });
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';

        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => new PopupManager());
