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

        if (this.websites.length === 0) {
            websitesList.innerHTML = `
        <div class="no-groups">
          No websites configured.<br>
          Click Options to get started.
        </div>
      `;
            return;
        }

        const websitesHtml = this.websites.map(website => {
            const enabledRulesCount = website.enabledRules.length;
            const totalRules = this.countRulesForWebsite(website);
            const isEnabled = website.enabled;

            return `
        <div class="group-item">
          <div>
            <div class="group-name">${this.escapeHtml(website.name)}</div>
            <div class="group-count">${enabledRulesCount} rules enabled, ${totalRules} headers total</div>
          </div>
          <div class="toggle-switch ${isEnabled ? 'active' : ''}" data-website="${this.escapeHtml(website.id)}"></div>
        </div>
      `;
        }).join('');

        websitesList.innerHTML = websitesHtml;
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
