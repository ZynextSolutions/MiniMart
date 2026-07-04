import { OfflineDb } from "./offline-db";

export class OfflineSyncService {
  static isOnline(): boolean {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  }

  static async queueSale(payload: unknown): Promise<string> {
    const id = `offline-${crypto.randomUUID()}`;
    await OfflineDb.addPendingSale({
      id,
      payload,
      createdAt: new Date().toISOString(),
      status: "pending",
    });

    if ("serviceWorker" in navigator && "SyncManager" in window) {
      const reg = await navigator.serviceWorker.ready;
      await (reg as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      }).sync.register("pos-sync");
    }

    return id;
  }

  static async replayPending(
    submitFn: (payload: unknown) => Promise<{ success: boolean; error?: string }>,
  ) {
    const pending = await OfflineDb.listPendingSales();
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const sale of pending.filter((s) => s.status === "pending")) {
      const result = await submitFn(sale.payload);
      if (result.success) {
        await OfflineDb.removePendingSale(sale.id);
        results.push({ id: sale.id, success: true });
      } else {
        results.push({ id: sale.id, success: false, error: result.error });
      }
    }

    return results;
  }
}
