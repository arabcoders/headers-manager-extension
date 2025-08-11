// Options page script for Headers Manager extension

class OptionsManager {
    constructor() {
        this.websites = [];
        this.headerRules = [];
        this.currentEditingWebsite = null;
        this.currentEditingRule = null;
        this.currentTab = 'websites';
        this.init();
    }

    async init() {
        await this.loadData();
        await this.loadActiveTab();
        this.setupTabs();
        this.renderAll();
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

    async loadActiveTab() {
        try {
            const result = await chrome.storage.local.get(['activeTab']);
            this.currentTab = result.activeTab || 'websites';
        } catch (error) {
            console.error('Error loading active tab:', error);
            this.currentTab = 'websites';
        }
    }

    async saveActiveTab() {
        try {
            await chrome.storage.local.set({ activeTab: this.currentTab });
        } catch (error) {
            console.error('Error saving active tab:', error);
        }
    }

    async saveData() {
        try {
            await storageManager.set({
                websites: this.websites,
                headerRules: this.headerRules
            });

            // Notify background script to reload configuration
            chrome.runtime.sendMessage({ action: 'reloadConfiguration' });

            this.showStatus('Settings saved successfully', 'success');
        } catch (error) {
            console.error('Error saving data:', error);
            this.showStatus('Error saving settings', 'error');
        }
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');

        // Set initial active tab
        tabs.forEach(tab => {
            const tabName = tab.getAttribute('data-tab');
            if (tabName === this.currentTab) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        tabContents.forEach(content => {
            if (content.id === `${this.currentTab}-tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');

                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update active content
                tabContents.forEach(content => content.classList.remove('active'));
                document.getElementById(`${tabName}-tab`).classList.add('active');

                this.currentTab = tabName;
                this.saveActiveTab();
            });
        });
    }

    renderAll() {
        this.renderWebsites();
        this.renderRules();
    }

    renderWebsites() {
        const websitesList = document.getElementById('websitesList');

        if (this.websites.length === 0) {
            websitesList.innerHTML = `
        <div class="empty-state">
          <h3>No websites configured</h3>
          <p>Click "Add Website" to create your first website configuration.</p>
        </div>
      `;
            return;
        }

        const websitesHtml = this.websites.map((website, index) => {
            const urlsHtml = website.urls.map(url => `
        <div class="url-item">
          <span>${this.escapeHtml(url)}</span>
        </div>
      `).join('');

            const groupsHtml = website.enabledRules.map(ruleId => {
                const rule = this.headerRules.find(r => r.id === ruleId);
                return rule ? `
          <span style="background: #e1e5e9; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-right: 4px;">
            ${this.escapeHtml(rule.name)}
          </span>
        ` : '';
            }).join('');

            return `
        <div class="item-card">
          <div class="item-header">
            <div class="item-name">${this.escapeHtml(website.name)}</div>
            <div class="item-actions">
              <div class="toggle-switch ${website.enabled ? 'active' : ''}" data-type="website" data-index="${index}"></div>
              <button class="btn btn-secondary btn-small edit-website-btn" data-index="${index}">Edit</button>
              <button class="btn btn-danger btn-small delete-website-btn" data-index="${index}">Delete</button>
            </div>
          </div>
          <div class="item-details">
            <div class="item-info">
              <strong>URLs (${website.urls.length}):</strong>
              <div class="url-list">${urlsHtml}</div>
            </div>
            <div class="item-info" style="margin-top: 8px;">
              <strong>Enabled Rules:</strong> ${groupsHtml || '<em>None</em>'}
            </div>
          </div>
        </div>
      `;
        }).join('');

        websitesList.innerHTML = websitesHtml;
    }

    renderRules() {
        const rulesList = document.getElementById('rulesList');

        if (this.headerRules.length === 0) {
            rulesList.innerHTML = `
        <div class="empty-state">
          <h3>No header rules configured</h3>
          <p>Click "Add Rule" to create your first header rule.</p>
        </div>
      `;
            return;
        }

        const rulesHtml = this.headerRules.map((rule, index) => {
            const headersHtml = rule.headers.map(header => {
                const operation = header.operation || 'set';
                const displayValue = operation === 'remove' ? '<em>REMOVE</em>' : this.escapeHtml(header.value || '');
                const operationBadge = operation === 'remove' ?
                    '<span style="background: #da3633; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 8px;">REMOVE</span>' :
                    '<span style="background: #0969da; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 8px;">SET</span>';

                return `
          <div class="url-item">
            <span><strong>${this.escapeHtml(header.name)}:</strong> ${displayValue}${operationBadge}</span>
          </div>
        `;
            }).join('');

            return `
        <div class="item-card">
          <div class="item-header">
            <div class="item-name">${this.escapeHtml(rule.name)}</div>
            <div class="item-actions">
              <div class="toggle-switch ${rule.enabled ? 'active' : ''}" data-type="rule" data-index="${index}"></div>
              <button class="btn btn-secondary btn-small edit-rule-btn" data-index="${index}">Edit</button>
              <button class="btn btn-danger btn-small delete-rule-btn" data-index="${index}">Delete</button>
            </div>
          </div>
          <div class="item-details">
            <div class="item-info">
              <strong>Headers (${rule.headers.length}):</strong>
              <div class="url-list">${headersHtml}</div>
            </div>
          </div>
        </div>
      `;
        }).join('');

        rulesList.innerHTML = rulesHtml;
    }

    renderGroups() {
        // Removed - no longer using rule groups
    }

    setupEventListeners() {
        // Website events
        document.getElementById('addWebsiteBtn').addEventListener('click', () => {
            this.openWebsiteModal();
        });

        document.getElementById('closeWebsiteModal').addEventListener('click', () => {
            this.closeWebsiteModal();
        });

        document.getElementById('cancelWebsiteBtn').addEventListener('click', () => {
            this.closeWebsiteModal();
        });

        document.getElementById('websiteForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveWebsite();
        });

        document.getElementById('addUrlBtn').addEventListener('click', () => {
            this.addUrlRow();
        });

        // Rule events
        document.getElementById('addRuleBtn').addEventListener('click', () => {
            this.openRuleModal();
        });

        document.getElementById('closeRuleModal').addEventListener('click', () => {
            this.closeRuleModal();
        });

        document.getElementById('cancelRuleBtn').addEventListener('click', () => {
            this.closeRuleModal();
        });

        document.getElementById('ruleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveRule();
        });

        document.getElementById('addHeaderBtn').addEventListener('click', () => {
            this.addHeaderRow();
        });

        // Group events
        // Removed - no longer using rule groups

        // Toggle switches and buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('toggle-switch')) {
                const type = e.target.getAttribute('data-type');
                const index = parseInt(e.target.getAttribute('data-index'));

                if (type === 'website') {
                    this.toggleWebsite(index);
                } else if (type === 'rule') {
                    this.toggleRule(index);
                }
            }

            // Handle edit/delete buttons
            if (e.target.classList.contains('edit-website-btn')) {
                const index = parseInt(e.target.getAttribute('data-index'));
                this.editWebsite(index);
            } else if (e.target.classList.contains('delete-website-btn')) {
                const index = parseInt(e.target.getAttribute('data-index'));
                this.deleteWebsite(index);
            } else if (e.target.classList.contains('edit-rule-btn')) {
                const index = parseInt(e.target.getAttribute('data-index'));
                this.editRule(index);
            } else if (e.target.classList.contains('delete-rule-btn')) {
                const index = parseInt(e.target.getAttribute('data-index'));
                this.deleteRule(index);
            }

            // Handle remove buttons for dynamic form rows
            if (e.target.classList.contains('remove-url-btn')) {
                e.target.parentElement.remove();
            } else if (e.target.classList.contains('remove-header-btn')) {
                e.target.parentElement.remove();
            }
        });

        // Close modals when clicking outside
        document.getElementById('websiteModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('websiteModal')) {
                this.closeWebsiteModal();
            }
        });

        document.getElementById('ruleModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('ruleModal')) {
                this.closeRuleModal();
            }
        });

        document.getElementById('clearDataModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('clearDataModal')) {
                this.closeClearDataModal();
            }
        });

        // Settings events
        document.getElementById('clearDataBtn').addEventListener('click', () => {
            this.openClearDataModal();
        });

        document.getElementById('closeClearDataModal').addEventListener('click', () => {
            this.closeClearDataModal();
        });

        document.getElementById('cancelClearDataBtn').addEventListener('click', () => {
            this.closeClearDataModal();
        });

        document.getElementById('confirmClearDataBtn').addEventListener('click', () => {
            this.clearAllData();
        });

        document.getElementById('exportDataBtn').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('importDataBtn').addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });

        document.getElementById('importFileInput').addEventListener('change', (e) => {
            this.importData(e);
        });

        // Storage management events
        document.getElementById('refreshStorageBtn').addEventListener('click', () => {
            this.refreshStorageInfo();
        });

        document.getElementById('migrateStorageBtn').addEventListener('click', () => {
            this.migrateStorage();
        });

        // Load storage info on initialization
        this.refreshStorageInfo();
    }

    // Website methods
    openWebsiteModal(website = null) {
        this.currentEditingWebsite = website;
        const modal = document.getElementById('websiteModal');
        const title = document.getElementById('websiteModalTitle');
        const form = document.getElementById('websiteForm');

        if (website) {
            title.textContent = 'Edit Website';
            this.populateWebsiteForm(website);
        } else {
            title.textContent = 'Add Website';
            form.reset();
            this.clearUrls();
            this.addUrlRow();
        }

        this.updateRuleGroupsCheckboxes();
        modal.classList.add('active');
    }

    closeWebsiteModal() {
        const modal = document.getElementById('websiteModal');
        modal.classList.remove('active');
        this.currentEditingWebsite = null;
    }

    populateWebsiteForm(website) {
        document.getElementById('websiteName').value = website.name;
        document.getElementById('websiteEnabled').checked = website.enabled;

        this.clearUrls();
        website.urls.forEach(url => {
            this.addUrlRow(url);
        });
    }

    updateRuleGroupsCheckboxes() {
        const container = document.getElementById('ruleGroupsCheckboxes');
        const enabledRules = this.currentEditingWebsite ? this.currentEditingWebsite.enabledRules : [];

        container.innerHTML = this.headerRules.map(rule => `
      <div class="checkbox-item">
        <input type="checkbox" id="rule-${rule.id}" value="${rule.id}" 
               ${enabledRules.includes(rule.id) ? 'checked' : ''}>
        <label for="rule-${rule.id}">${this.escapeHtml(rule.name)}</label>
      </div>
    `).join('');
    }

    addUrlRow(value = '') {
        const container = document.getElementById('urlsContainer');
        const row = document.createElement('div');
        row.className = 'url-input-row';
        row.innerHTML = `
      <input type="text" class="form-control" placeholder="https://example.com (matches all paths)" value="${this.escapeHtml(value)}" required>
      <button type="button" class="btn btn-danger btn-small remove-url-btn">Remove</button>
    `;
        container.appendChild(row);
    }

    clearUrls() {
        document.getElementById('urlsContainer').innerHTML = '';
    }

    async saveWebsite() {
        const form = document.getElementById('websiteForm');

        const website = {
            id: this.currentEditingWebsite ? this.currentEditingWebsite.id : this.generateId(),
            name: document.getElementById('websiteName').value,
            enabled: document.getElementById('websiteEnabled').checked,
            urls: [],
            enabledRules: []
        };

        // Collect URLs
        const urlRows = document.querySelectorAll('#urlsContainer .url-input-row input');
        urlRows.forEach(input => {
            if (input.value.trim()) {
                website.urls.push(input.value.trim());
            }
        });

        // Collect enabled rules
        const ruleCheckboxes = document.querySelectorAll('#ruleGroupsCheckboxes input:checked');
        ruleCheckboxes.forEach(checkbox => {
            website.enabledRules.push(checkbox.value);
        });

        if (website.urls.length === 0) {
            this.showStatus('Please add at least one URL', 'error');
            return;
        }

        if (this.currentEditingWebsite) {
            // Update existing website
            const index = this.websites.findIndex(w => w.id === this.currentEditingWebsite.id);
            if (index !== -1) {
                this.websites[index] = website;
            }
        } else {
            // Add new website
            this.websites.push(website);
        }

        await this.saveData();
        this.renderWebsites();
        this.closeWebsiteModal();
    }

    editWebsite(index) {
        const website = this.websites[index];
        this.openWebsiteModal(website);
    }

    async deleteWebsite(index) {
        if (confirm('Are you sure you want to delete this website?')) {
            this.websites.splice(index, 1);
            await this.saveData();
            this.renderWebsites();
        }
    }

    async toggleWebsite(index) {
        this.websites[index].enabled = !this.websites[index].enabled;
        await this.saveData();
        this.renderWebsites();
    }

    // Rule methods
    openRuleModal(rule = null) {
        this.currentEditingRule = rule;
        const modal = document.getElementById('ruleModal');
        const title = document.getElementById('ruleModalTitle');
        const form = document.getElementById('ruleForm');

        if (rule) {
            title.textContent = 'Edit Rule';
            this.populateRuleForm(rule);
        } else {
            title.textContent = 'Add Rule';
            form.reset();
            this.clearHeaders();
            this.addHeaderRow();
        }

        this.updateRuleGroupsList();
        modal.classList.add('active');
    }

    closeRuleModal() {
        const modal = document.getElementById('ruleModal');
        modal.classList.remove('active');
        this.currentEditingRule = null;
    }

    populateRuleForm(rule) {
        document.getElementById('ruleName').value = rule.name;
        document.getElementById('ruleEnabled').checked = rule.enabled;

        this.clearHeaders();
        rule.headers.forEach(header => {
            this.addHeaderRow(header.name, header.value || '', header.operation || 'set');
        });
    }

    updateRuleGroupsList() {
        // Removed - no longer using rule groups
    }

    addHeaderRow(name = '', value = '', operation = 'set') {
        const container = document.getElementById('headersContainer');
        const row = document.createElement('div');
        row.className = 'header-form-row';
        row.innerHTML = `
      <input type="text" class="form-control" placeholder="Header Name" value="${this.escapeHtml(name)}" required>
      <input type="text" class="form-control" placeholder="Header Value (empty for remove)" value="${this.escapeHtml(value)}">
      <select class="form-control" style="max-width: 120px;">
        <option value="set" ${operation === 'set' ? 'selected' : ''}>Set</option>
        <option value="remove" ${operation === 'remove' ? 'selected' : ''}>Remove</option>
      </select>
      <button type="button" class="btn btn-danger btn-small remove-header-btn">Remove</button>
    `;
        container.appendChild(row);
    }

    clearHeaders() {
        document.getElementById('headersContainer').innerHTML = '';
    }

    async saveRule() {
        const rule = {
            id: this.currentEditingRule ? this.currentEditingRule.id : this.generateId(),
            name: document.getElementById('ruleName').value,
            enabled: document.getElementById('ruleEnabled').checked,
            headers: []
        };

        // Collect headers
        const headerRows = document.querySelectorAll('#headersContainer .header-form-row');
        headerRows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            const select = row.querySelector('select');
            const operation = select.value;

            if (inputs[0].value) { // Header name is required
                const header = {
                    name: inputs[0].value,
                    operation: operation
                };

                // For 'set' operation, value is required
                // For 'remove' operation, value is ignored
                if (operation === 'set' && inputs[1].value) {
                    header.value = inputs[1].value;
                    rule.headers.push(header);
                } else if (operation === 'remove') {
                    header.value = ''; // Chrome expects empty value for remove
                    rule.headers.push(header);
                }
            }
        });

        if (rule.headers.length === 0) {
            this.showStatus('Please add at least one header', 'error');
            return;
        }

        if (this.currentEditingRule) {
            // Update existing rule
            const index = this.headerRules.findIndex(r => r.id === this.currentEditingRule.id);
            if (index !== -1) {
                this.headerRules[index] = rule;
            }
        } else {
            // Add new rule
            this.headerRules.push(rule);
        }

        await this.saveData();
        this.renderRules();
        this.closeRuleModal();
    }

    editRule(index) {
        const rule = this.headerRules[index];
        this.openRuleModal(rule);
    }

    async deleteRule(index) {
        if (confirm('Are you sure you want to delete this rule?')) {
            this.headerRules.splice(index, 1);
            await this.saveData();
            this.renderRules();
        }
    }

    async toggleRule(index) {
        this.headerRules[index].enabled = !this.headerRules[index].enabled;
        await this.saveData();
        this.renderRules();
    }

    async deleteGroup(index) {
        // Removed - no longer using rule groups
    }

    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Storage management methods
    async refreshStorageInfo() {
        const storageInfoDiv = document.getElementById('storageInfo');
        const migrationSection = document.getElementById('migrationSection');
        const migrateBtn = document.getElementById('migrateStorageBtn');
        const migrationDesc = document.getElementById('migrationDescription');

        try {
            storageInfoDiv.innerHTML = '<div class="loading">Loading storage information...</div>';

            const storageInfo = await storageManager.getStorageInfo();

            if (storageInfo.error) {
                storageInfoDiv.innerHTML = `<div class="error">Error loading storage info: ${storageInfo.error}</div>`;
                return;
            }

            let usageClass = '';
            let usagePercentage = 0;

            if (storageInfo.currentStorageType === 'sync') {
                usagePercentage = storageInfo.syncUsage.percentage;
                if (usagePercentage > 90) usageClass = 'danger';
                else if (usagePercentage > 75) usageClass = 'warning';
            }

            let html = `
                <div class="storage-type">
                    Current Storage: ${storageInfo.currentStorageType === 'sync' ? 'Sync Storage (syncs across devices)' : 'Local Storage (device only)'}
                </div>
            `;

            if (storageInfo.currentStorageType === 'sync') {
                html += `
                    <div class="storage-usage">
                        <span class="usage-text">Sync Usage:</span>
                        <div class="usage-bar">
                            <div class="usage-fill ${usageClass}" style="width: ${usagePercentage}%"></div>
                        </div>
                        <span class="usage-text">${Math.round(storageInfo.syncUsage.bytes / 1024)}KB / 100KB</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="storage-usage">
                        <span class="usage-text">Local Usage: ${Math.round(storageInfo.localUsage.bytes / 1024)}KB</span>
                    </div>
                `;
            }

            if (storageInfo.recommendations.length > 0) {
                html += '<div class="recommendations">';
                storageInfo.recommendations.forEach(rec => {
                    html += `<div class="recommendation">${rec}</div>`;
                });
                html += '</div>';
            }

            storageInfoDiv.innerHTML = html;

            // Show/hide migration section
            if (storageInfo.currentStorageType === 'local') {
                migrationSection.style.display = 'block';
                migrateBtn.textContent = 'Migrate to Sync';
                migrationDesc.textContent = 'Move data back to sync storage to enable cross-device synchronization.';
            } else if (usagePercentage > 75) {
                migrationSection.style.display = 'block';
                migrateBtn.textContent = 'Migrate to Local';
                migrationDesc.textContent = 'Move data to local storage to avoid sync storage limits.';
            } else {
                migrationSection.style.display = 'none';
            }

        } catch (error) {
            console.error('Error refreshing storage info:', error);
            storageInfoDiv.innerHTML = `<div class="error">Error loading storage information: ${error.message}</div>`;
        }
    }

    async migrateStorage() {
        const migrateBtn = document.getElementById('migrateStorageBtn');
        const originalText = migrateBtn.textContent;

        try {
            migrateBtn.disabled = true;
            migrateBtn.textContent = 'Migrating...';

            const storageInfo = await storageManager.getStorageInfo();

            if (storageInfo.currentStorageType === 'local') {
                // Migrate back to sync
                await storageManager.migrateBackToSync();
                this.showStatus('Successfully migrated data to sync storage', 'success');
            } else {
                // This case is handled automatically by the storage manager when data is too large
                this.showStatus('Migration to local storage happens automatically when needed', 'info');
            }

            // Refresh the storage info display
            await this.refreshStorageInfo();

        } catch (error) {
            console.error('Migration failed:', error);
            this.showStatus(`Migration failed: ${error.message}`, 'error');
        } finally {
            migrateBtn.disabled = false;
            migrateBtn.textContent = originalText;
        }
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';

        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Settings methods
    openClearDataModal() {
        const modal = document.getElementById('clearDataModal');
        modal.classList.add('active');
    }

    closeClearDataModal() {
        const modal = document.getElementById('clearDataModal');
        modal.classList.remove('active');
    }

    async clearAllData() {
        try {
            // Clear all storage using storage manager
            await storageManager.clear();

            // Reset local data
            this.websites = [];
            this.headerRules = [];
            this.currentTab = 'websites';

            // Re-render everything
            this.renderAll();

            // Close modal and show success
            this.closeClearDataModal();
            this.showStatus('All data cleared successfully. Extension reset to defaults.', 'success');

            // Notify background script to reload configuration
            chrome.runtime.sendMessage({ action: 'reloadConfiguration' });

        } catch (error) {
            console.error('Error clearing data:', error);
            this.showStatus('Error clearing data', 'error');
        }
    }

    exportData() {
        const data = {
            websites: this.websites,
            headerRules: this.headerRules,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileName = `headers-manager-config-${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileName);
        linkElement.click();

        this.showStatus('Configuration exported successfully', 'success');
    }

    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validate the imported data
            if (!data.websites || !data.headerRules) {
                throw new Error('Invalid configuration file format');
            }

            // Confirm import
            if (!confirm('This will replace all current data. Are you sure you want to continue?')) {
                return;
            }

            // Update local data
            this.websites = data.websites || [];
            this.headerRules = data.headerRules || [];

            // Save to storage
            await this.saveData();

            // Re-render everything
            this.renderAll();

            this.showStatus(`Configuration imported successfully. Loaded ${this.websites.length} websites and ${this.headerRules.length} rules.`, 'success');

        } catch (error) {
            console.error('Error importing data:', error);
            this.showStatus('Error importing configuration: ' + error.message, 'error');
        }

        // Clear the file input
        event.target.value = '';
    }
}

// Initialize options when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new OptionsManager();
});
