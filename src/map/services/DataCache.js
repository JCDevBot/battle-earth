export class DataCache {
  constructor(dbName = "MapGenCache", storeName = "maps") {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
    this.initPromise = this.init();
  }

  init() {
    return new Promise((resolve) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onerror = () => resolve(false);
    });
  }

  async get(key) {
    await this.initPromise;
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = () => resolve(null);
    });
  }

  async put(key, data) {
    await this.initPromise;
    if (!this.db) return;

    const transaction = this.db.transaction([this.storeName], "readwrite");
    const store = transaction.objectStore(this.storeName);
    store.put(data, key);
  }

  async clear() {
    await this.initPromise;
    if (!this.db) return;

    const transaction = this.db.transaction([this.storeName], "readwrite");
    transaction.objectStore(this.storeName).clear();
  }
}
