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

        // Clear existing content
        websitesList.textContent = '';

        if (this.websites.length === 0) {
            const emptyStateDiv = document.createElement('div');
            emptyStateDiv.className = 'empty-state';

            const heading = document.createElement('h3');
            heading.textContent = 'No websites configured';

            const paragraph = document.createElement('p');
            paragraph.textContent = 'Click "Add Website" to create your first website configuration.';

            emptyStateDiv.appendChild(heading);
            emptyStateDiv.appendChild(paragraph);
            websitesList.appendChild(emptyStateDiv);
            return;
        }

        this.websites.forEach((website, index) => {
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';

            // Item header
            const itemHeader = document.createElement('div');
            itemHeader.className = 'item-header';

            const itemName = document.createElement('div');
            itemName.className = 'item-name';
            itemName.textContent = website.name;

            const itemActions = document.createElement('div');
            itemActions.className = 'item-actions';

            const toggleSwitch = document.createElement('div');
            toggleSwitch.className = `toggle-switch ${website.enabled ? 'active' : ''}`;
            toggleSwitch.setAttribute('data-type', 'website');
            toggleSwitch.setAttribute('data-index', index.toString());

            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-secondary btn-small edit-website-btn';
            editBtn.setAttribute('data-index', index.toString());
            editBtn.textContent = 'Edit';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-small delete-website-btn';
            deleteBtn.setAttribute('data-index', index.toString());
            deleteBtn.textContent = 'Delete';

            itemActions.appendChild(toggleSwitch);
            itemActions.appendChild(editBtn);
            itemActions.appendChild(deleteBtn);

            itemHeader.appendChild(itemName);
            itemHeader.appendChild(itemActions);

            // Item details
            const itemDetails = document.createElement('div');
            itemDetails.className = 'item-details';

            // URLs section
            const urlsInfo = document.createElement('div');
            urlsInfo.className = 'item-info';

            const urlsLabel = document.createElement('strong');
            urlsLabel.textContent = `URLs (${website.urls.length}):`;
            urlsInfo.appendChild(urlsLabel);

            const urlList = document.createElement('div');
            urlList.className = 'url-list';

            website.urls.forEach(url => {
                const urlItem = document.createElement('div');
                urlItem.className = 'url-item';
                const urlSpan = document.createElement('span');
                urlSpan.textContent = url;
                urlItem.appendChild(urlSpan);
                urlList.appendChild(urlItem);
            });

            urlsInfo.appendChild(urlList);

            // Enabled rules section
            const rulesInfo = document.createElement('div');
            rulesInfo.className = 'item-info';
            rulesInfo.style.marginTop = '8px';

            const rulesLabel = document.createElement('strong');
            rulesLabel.textContent = 'Enabled Rules: ';
            rulesInfo.appendChild(rulesLabel);

            if (website.enabledRules.length === 0) {
                const noneElem = document.createElement('em');
                noneElem.textContent = 'None';
                rulesInfo.appendChild(noneElem);
            } else {
                website.enabledRules.forEach(ruleId => {
                    const rule = this.headerRules.find(r => r.id === ruleId);
                    if (rule) {
                        const badge = document.createElement('span');
                        badge.style.cssText = 'background: #e1e5e9; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-right: 4px;';
                        badge.textContent = rule.name;
                        rulesInfo.appendChild(badge);
                    }
                });
            }

            itemDetails.appendChild(urlsInfo);
            itemDetails.appendChild(rulesInfo);

            itemCard.appendChild(itemHeader);
            itemCard.appendChild(itemDetails);
            websitesList.appendChild(itemCard);
        });
    }

    renderRules() {
        const rulesList = document.getElementById('rulesList');

        // Clear existing content
        rulesList.textContent = '';

        if (this.headerRules.length === 0) {
            const emptyStateDiv = document.createElement('div');
            emptyStateDiv.className = 'empty-state';

            const heading = document.createElement('h3');
            heading.textContent = 'No header rules configured';

            const paragraph = document.createElement('p');
            paragraph.textContent = 'Click "Add Rule" to create your first header rule.';

            emptyStateDiv.appendChild(heading);
            emptyStateDiv.appendChild(paragraph);
            rulesList.appendChild(emptyStateDiv);
            return;
        }

        this.headerRules.forEach((rule, index) => {
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';

            // Item header
            const itemHeader = document.createElement('div');
            itemHeader.className = 'item-header';

            const itemName = document.createElement('div');
            itemName.className = 'item-name';
            itemName.textContent = rule.name;

            const itemActions = document.createElement('div');
            itemActions.className = 'item-actions';

            const toggleSwitch = document.createElement('div');
            toggleSwitch.className = `toggle-switch ${rule.enabled ? 'active' : ''}`;
            toggleSwitch.setAttribute('data-type', 'rule');
            toggleSwitch.setAttribute('data-index', index.toString());

            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-secondary btn-small edit-rule-btn';
            editBtn.setAttribute('data-index', index.toString());
            editBtn.textContent = 'Edit';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-small delete-rule-btn';
            deleteBtn.setAttribute('data-index', index.toString());
            deleteBtn.textContent = 'Delete';

            itemActions.appendChild(toggleSwitch);
            itemActions.appendChild(editBtn);
            itemActions.appendChild(deleteBtn);

            itemHeader.appendChild(itemName);
            itemHeader.appendChild(itemActions);

            // Item details
            const itemDetails = document.createElement('div');
            itemDetails.className = 'item-details';

            const headersInfo = document.createElement('div');
            headersInfo.className = 'item-info';

            const headersLabel = document.createElement('strong');
            headersLabel.textContent = `Headers (${rule.headers.length}):`;
            headersInfo.appendChild(headersLabel);

            const urlList = document.createElement('div');
            urlList.className = 'url-list';

            rule.headers.forEach(header => {
                const operation = header.operation || 'set';

                const urlItem = document.createElement('div');
                urlItem.className = 'url-item';

                const span = document.createElement('span');

                const headerNameStrong = document.createElement('strong');
                headerNameStrong.textContent = `${header.name}: `;
                span.appendChild(headerNameStrong);

                if (operation === 'remove') {
                    const removeEm = document.createElement('em');
                    removeEm.textContent = 'REMOVE';
                    span.appendChild(removeEm);
                } else {
                    const valueText = document.createTextNode(header.value || '');
                    span.appendChild(valueText);
                }

                const operationBadge = document.createElement('span');
                if (operation === 'remove') {
                    operationBadge.style.cssText = 'background: #da3633; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 8px;';
                    operationBadge.textContent = 'REMOVE';
                } else {
                    operationBadge.style.cssText = 'background: #0969da; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 8px;';
                    operationBadge.textContent = 'SET';
                }
                span.appendChild(operationBadge);

                urlItem.appendChild(span);
                urlList.appendChild(urlItem);
            });

            headersInfo.appendChild(urlList);
            itemDetails.appendChild(headersInfo);

            itemCard.appendChild(itemHeader);
            itemCard.appendChild(itemDetails);
            rulesList.appendChild(itemCard);
        });
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

        // Clear existing content
        container.textContent = '';

        this.headerRules.forEach(rule => {
            const checkboxItem = document.createElement('div');
            checkboxItem.className = 'checkbox-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `rule-${rule.id}`;
            checkbox.value = rule.id;
            if (enabledRules.includes(rule.id)) {
                checkbox.checked = true;
            }

            const label = document.createElement('label');
            label.setAttribute('for', `rule-${rule.id}`);
            label.textContent = rule.name;

            checkboxItem.appendChild(checkbox);
            checkboxItem.appendChild(label);
            container.appendChild(checkboxItem);
        });
    }

    addUrlRow(value = '') {
        const container = document.getElementById('urlsContainer');
        const row = document.createElement('div');
        row.className = 'url-input-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control';
        input.placeholder = 'https://example.com (matches all paths)';
        input.value = value;
        input.required = true;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-danger btn-small remove-url-btn';
        button.textContent = 'Remove';

        row.appendChild(input);
        row.appendChild(button);
        container.appendChild(row);
    }

    clearUrls() {
        document.getElementById('urlsContainer').textContent = '';
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

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'form-control';
        nameInput.placeholder = 'Header Name';
        nameInput.value = name;
        nameInput.required = true;

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'form-control';
        valueInput.placeholder = 'Header Value (empty for remove)';
        valueInput.value = value;

        const select = document.createElement('select');
        select.className = 'form-control';
        select.style.maxWidth = '120px';

        const setOption = document.createElement('option');
        setOption.value = 'set';
        setOption.textContent = 'Set';
        if (operation === 'set') {
            setOption.selected = true;
        }

        const removeOption = document.createElement('option');
        removeOption.value = 'remove';
        removeOption.textContent = 'Remove';
        if (operation === 'remove') {
            removeOption.selected = true;
        }

        select.appendChild(setOption);
        select.appendChild(removeOption);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-danger btn-small remove-header-btn';
        button.textContent = 'Remove';

        row.appendChild(nameInput);
        row.appendChild(valueInput);
        row.appendChild(select);
        row.appendChild(button);
        container.appendChild(row);
    }

    clearHeaders() {
        document.getElementById('headersContainer').textContent = '';
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
            // Show loading state
            storageInfoDiv.textContent = '';
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading';
            loadingDiv.textContent = 'Loading storage information...';
            storageInfoDiv.appendChild(loadingDiv);

            const storageInfo = await storageManager.getStorageInfo();

            if (storageInfo.error) {
                storageInfoDiv.textContent = '';
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error';
                errorDiv.textContent = `Error loading storage info: ${storageInfo.error}`;
                storageInfoDiv.appendChild(errorDiv);
                return;
            }

            let usageClass = '';
            let usagePercentage = 0;

            if (storageInfo.currentStorageType === 'sync') {
                usagePercentage = storageInfo.syncUsage.percentage;
                if (usagePercentage > 90) usageClass = 'danger';
                else if (usagePercentage > 75) usageClass = 'warning';
            }

            // Clear and rebuild storage info display
            storageInfoDiv.textContent = '';

            // Storage type
            const storageTypeDiv = document.createElement('div');
            storageTypeDiv.className = 'storage-type';
            storageTypeDiv.textContent = storageInfo.currentStorageType === 'sync'
                ? 'Current Storage: Sync Storage (syncs across devices)'
                : 'Current Storage: Local Storage (device only)';
            storageInfoDiv.appendChild(storageTypeDiv);

            // Storage usage
            const storageUsageDiv = document.createElement('div');
            storageUsageDiv.className = 'storage-usage';

            if (storageInfo.currentStorageType === 'sync') {
                const usageText1 = document.createElement('span');
                usageText1.className = 'usage-text';
                usageText1.textContent = 'Sync Usage:';
                storageUsageDiv.appendChild(usageText1);

                const usageBar = document.createElement('div');
                usageBar.className = 'usage-bar';

                const usageFill = document.createElement('div');
                usageFill.className = `usage-fill ${usageClass}`;
                usageFill.style.width = `${usagePercentage}%`;
                usageBar.appendChild(usageFill);
                storageUsageDiv.appendChild(usageBar);

                const usageText2 = document.createElement('span');
                usageText2.className = 'usage-text';
                usageText2.textContent = `${Math.round(storageInfo.syncUsage.bytes / 1024)}KB / 100KB`;
                storageUsageDiv.appendChild(usageText2);
            } else {
                const usageText = document.createElement('span');
                usageText.className = 'usage-text';
                usageText.textContent = `Local Usage: ${Math.round(storageInfo.localUsage.bytes / 1024)}KB`;
                storageUsageDiv.appendChild(usageText);
            }

            storageInfoDiv.appendChild(storageUsageDiv);

            // Recommendations
            if (storageInfo.recommendations.length > 0) {
                const recommendationsDiv = document.createElement('div');
                recommendationsDiv.className = 'recommendations';

                storageInfo.recommendations.forEach(rec => {
                    const recDiv = document.createElement('div');
                    recDiv.className = 'recommendation';
                    recDiv.textContent = rec;
                    recommendationsDiv.appendChild(recDiv);
                });

                storageInfoDiv.appendChild(recommendationsDiv);
            }

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
            storageInfoDiv.textContent = '';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.textContent = `Error loading storage information: ${error.message}`;
            storageInfoDiv.appendChild(errorDiv);
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
