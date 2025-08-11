// Storage Manager for Headers Manager Extension
// Automatically handles fallback between sync and local storage to overcome 100KB sync limit

class StorageManager {
    constructor() {
        this.SYNC_QUOTA_BYTES = 102400; // 100KB Chrome sync storage limit
        this.STORAGE_KEY_PREFIX = 'hm_'; // Headers Manager prefix
        this.MIGRATION_KEY = 'hm_storage_migration_v1';
        this.STORAGE_TYPE_KEY = 'hm_storage_type'; // Track which storage we're using

        // Storage types
        this.STORAGE_TYPES = {
            SYNC: 'sync',
            LOCAL: 'local',
            HYBRID: 'hybrid'
        };

        this.currentStorageType = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        try {
            // Check current storage type
            const storageTypeResult = await chrome.storage.local.get([this.STORAGE_TYPE_KEY]);
            this.currentStorageType = storageTypeResult[this.STORAGE_TYPE_KEY] || this.STORAGE_TYPES.SYNC;

            // Perform migration if needed
            await this.performMigrationIfNeeded();

            this.initialized = true;
            console.log(`Storage Manager initialized with storage type: ${this.currentStorageType}`);
        } catch (error) {
            console.error('Storage Manager initialization failed:', error);
            // Default to local storage if initialization fails
            this.currentStorageType = this.STORAGE_TYPES.LOCAL;
            this.initialized = true;
        }
    }

    async performMigrationIfNeeded() {
        try {
            const migrationResult = await chrome.storage.local.get([this.MIGRATION_KEY]);
            if (migrationResult[this.MIGRATION_KEY]) {
                return; // Migration already performed
            }

            // Check if we have data in sync storage
            const syncData = await chrome.storage.sync.get(['headerRules', 'websites']);
            if (syncData.headerRules || syncData.websites) {
                console.log('Found existing data in sync storage, checking size...');

                const dataSize = this.calculateDataSize(syncData);
                if (dataSize > this.SYNC_QUOTA_BYTES * 0.8) { // 80% threshold
                    console.log(`Data size (${dataSize} bytes) approaching sync limit, migrating to local storage`);
                    await this.migrateToLocalStorage(syncData);
                }
            }

            // Mark migration as complete
            await chrome.storage.local.set({ [this.MIGRATION_KEY]: true });
        } catch (error) {
            console.warn('Migration check failed:', error);
        }
    }

    async migrateToLocalStorage(existingData) {
        try {
            // Save data to local storage
            await chrome.storage.local.set(existingData);

            // Clear sync storage
            await chrome.storage.sync.clear();

            // Update storage type
            this.currentStorageType = this.STORAGE_TYPES.LOCAL;
            await chrome.storage.local.set({ [this.STORAGE_TYPE_KEY]: this.STORAGE_TYPES.LOCAL });

            console.log('Successfully migrated data from sync to local storage');
        } catch (error) {
            console.error('Migration to local storage failed:', error);
            throw error;
        }
    }

    calculateDataSize(data) {
        try {
            return new Blob([JSON.stringify(data)]).size;
        } catch (error) {
            // Fallback estimation
            return JSON.stringify(data).length * 2; // Rough estimate: 2 bytes per character
        }
    }

    async get(keys) {
        await this.init();

        try {
            if (this.currentStorageType === this.STORAGE_TYPES.LOCAL) {
                return await chrome.storage.local.get(keys);
            } else {
                // Try sync first, fallback to local if needed
                const result = await chrome.storage.sync.get(keys);

                // Check if we got all the data we requested
                const requestedKeys = Array.isArray(keys) ? keys : [keys];
                const hasAllData = requestedKeys.every(key => key in result);

                if (!hasAllData) {
                    // Some data might be in local storage due to size limits
                    const localResult = await chrome.storage.local.get(keys);
                    return { ...result, ...localResult };
                }

                return result;
            }
        } catch (error) {
            console.error('Storage get operation failed:', error);
            // Fallback to local storage
            return await chrome.storage.local.get(keys);
        }
    }

    async set(data) {
        await this.init();

        try {
            const dataSize = this.calculateDataSize(data);

            if (this.currentStorageType === this.STORAGE_TYPES.LOCAL) {
                return await chrome.storage.local.set(data);
            }

            // Check if data fits in sync storage
            if (dataSize > this.SYNC_QUOTA_BYTES * 0.8) { // 80% threshold for safety
                console.log(`Data size (${dataSize} bytes) too large for sync storage, using local storage`);

                if (this.currentStorageType === this.STORAGE_TYPES.SYNC) {
                    // Need to migrate existing data
                    const existingData = await chrome.storage.sync.get(['headerRules', 'websites']);
                    await this.migrateToLocalStorage({ ...existingData, ...data });
                } else {
                    await chrome.storage.local.set(data);
                }

                return;
            }

            // Try sync storage first
            try {
                await chrome.storage.sync.set(data);
            } catch (error) {
                if (error.message && error.message.includes('QUOTA_BYTES')) {
                    console.warn('Sync storage quota exceeded, migrating to local storage');

                    // Get existing data and migrate everything
                    const existingData = await chrome.storage.sync.get(['headerRules', 'websites']);
                    await this.migrateToLocalStorage({ ...existingData, ...data });
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error('Storage set operation failed:', error);
            // Fallback to local storage
            await chrome.storage.local.set(data);
            this.currentStorageType = this.STORAGE_TYPES.LOCAL;
            await chrome.storage.local.set({ [this.STORAGE_TYPE_KEY]: this.STORAGE_TYPES.LOCAL });
        }
    }

    async remove(keys) {
        await this.init();

        try {
            if (this.currentStorageType === this.STORAGE_TYPES.LOCAL) {
                return await chrome.storage.local.remove(keys);
            } else {
                // Remove from both storages to be safe
                await Promise.allSettled([
                    chrome.storage.sync.remove(keys),
                    chrome.storage.local.remove(keys)
                ]);
            }
        } catch (error) {
            console.error('Storage remove operation failed:', error);
            // Fallback to local storage
            await chrome.storage.local.remove(keys);
        }
    }

    async clear() {
        await this.init();

        try {
            // Clear both storages
            await Promise.allSettled([
                chrome.storage.sync.clear(),
                chrome.storage.local.clear()
            ]);

            // Reset storage type
            this.currentStorageType = this.STORAGE_TYPES.SYNC;
            await chrome.storage.local.set({ [this.STORAGE_TYPE_KEY]: this.STORAGE_TYPES.SYNC });
        } catch (error) {
            console.error('Storage clear operation failed:', error);
        }
    }

    // Listen for storage changes across both storage areas
    addChangeListener(callback) {
        const wrappedCallback = (changes, namespace) => {
            // Only trigger for the storage area we're currently using
            if (this.currentStorageType === this.STORAGE_TYPES.LOCAL && namespace === 'local') {
                callback(changes, namespace);
            } else if (this.currentStorageType === this.STORAGE_TYPES.SYNC && namespace === 'sync') {
                callback(changes, namespace);
            }
        };

        chrome.storage.onChanged.addListener(wrappedCallback);
        return wrappedCallback; // Return for potential removal
    }

    removeChangeListener(callback) {
        chrome.storage.onChanged.removeListener(callback);
    }

    // Get storage usage information
    async getStorageInfo() {
        await this.init();

        try {
            const [syncUsage, localUsage] = await Promise.allSettled([
                chrome.storage.sync.getBytesInUse(),
                chrome.storage.local.getBytesInUse ? chrome.storage.local.getBytesInUse() : Promise.resolve(0)
            ]);

            const syncBytes = syncUsage.status === 'fulfilled' ? syncUsage.value : 0;
            const localBytes = localUsage.status === 'fulfilled' ? localUsage.value : 0;

            return {
                currentStorageType: this.currentStorageType,
                syncUsage: {
                    bytes: syncBytes,
                    percentage: (syncBytes / this.SYNC_QUOTA_BYTES) * 100,
                    remaining: this.SYNC_QUOTA_BYTES - syncBytes
                },
                localUsage: {
                    bytes: localBytes
                },
                recommendations: this.getStorageRecommendations(syncBytes, localBytes)
            };
        } catch (error) {
            console.error('Failed to get storage info:', error);
            return {
                currentStorageType: this.currentStorageType,
                error: error.message
            };
        }
    }

    getStorageRecommendations(syncBytes, localBytes) {
        const recommendations = [];

        if (syncBytes > this.SYNC_QUOTA_BYTES * 0.8) {
            recommendations.push('Consider reducing the number of header rules or websites to stay within sync storage limits');
        }

        if (this.currentStorageType === this.STORAGE_TYPES.LOCAL) {
            recommendations.push('Using local storage - settings will not sync across Chrome instances');
        }

        if (syncBytes < this.SYNC_QUOTA_BYTES * 0.5 && this.currentStorageType === this.STORAGE_TYPES.LOCAL) {
            recommendations.push('Data size reduced - you could migrate back to sync storage for cross-device sync');
        }

        return recommendations;
    }

    // Force migration back to sync storage (if data is small enough)
    async migrateBackToSync() {
        await this.init();

        if (this.currentStorageType === this.STORAGE_TYPES.SYNC) {
            throw new Error('Already using sync storage');
        }

        try {
            const localData = await chrome.storage.local.get(['headerRules', 'websites']);
            const dataSize = this.calculateDataSize(localData);

            if (dataSize > this.SYNC_QUOTA_BYTES * 0.8) {
                throw new Error(`Data size (${dataSize} bytes) too large for sync storage`);
            }

            // Clear sync storage first
            await chrome.storage.sync.clear();

            // Move data to sync storage
            await chrome.storage.sync.set(localData);

            // Clear the data from local storage (keep metadata)
            await chrome.storage.local.remove(['headerRules', 'websites']);

            // Update storage type
            this.currentStorageType = this.STORAGE_TYPES.SYNC;
            await chrome.storage.local.set({ [this.STORAGE_TYPE_KEY]: this.STORAGE_TYPES.SYNC });

            console.log('Successfully migrated data back to sync storage');
            return true;
        } catch (error) {
            console.error('Migration back to sync storage failed:', error);
            throw error;
        }
    }
}

// Create a singleton instance
const storageManager = new StorageManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = storageManager;
} else {
    // For Chrome extension context
    self.storageManager = storageManager;
}
