const DB_NAME = "pos-offline";
const DB_VERSION = 1;

export type PendingSale = {
  id: string;
  payload: unknown;
  createdAt: string;
  status: "pending" | "synced" | "failed";
  error?: string;
};

export type CachedProduct = {
  id: string;
  sku: string;
  name: string;
  sellingPrice: number;
  barcode?: string;
  variantId: string;
  updatedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("pendingSales")) {
        db.createObjectStore("pendingSales", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("products")) {
        db.createObjectStore("products", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { keyPath: "id" });
      }
    };
  });
}

export class OfflineDb {
  static async addPendingSale(sale: PendingSale) {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("pendingSales", "readwrite");
      tx.objectStore("pendingSales").put(sale);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async listPendingSales(): Promise<PendingSale[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("pendingSales", "readonly");
      const req = tx.objectStore("pendingSales").getAll();
      req.onsuccess = () => resolve(req.result as PendingSale[]);
      req.onerror = () => reject(req.error);
    });
  }

  static async cacheProducts(products: CachedProduct[]) {
    const db = await openDb();
    const tx = db.transaction("products", "readwrite");
    const store = tx.objectStore("products");
    for (const p of products) store.put(p);
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getCachedProducts(): Promise<CachedProduct[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("products", "readonly");
      const req = tx.objectStore("products").getAll();
      req.onsuccess = () => resolve(req.result as CachedProduct[]);
      req.onerror = () => reject(req.error);
    });
  }

  static async removePendingSale(id: string) {
    const db = await openDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("pendingSales", "readwrite");
      tx.objectStore("pendingSales").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
