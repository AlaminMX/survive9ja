export type VoiceUpload = { path: string; uploaded: boolean; reservedAt: number };

export type GistDraft = {
  title: string;
  body: string;
  category: string;
  destination: string;
  routeCircle: string;
  circleName: string;
  circleDescription: string;
  clip: Blob | null;
  upload: VoiceUpload | null;
};

const storeName = "gist-drafts";
let database: Promise<IDBDatabase> | undefined;

function openDrafts() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("survive9ja-local-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        database = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  }).catch((reason: unknown) => {
    database = undefined;
    throw reason;
  });
  return database;
}

export async function readGistDraft(account: string): Promise<GistDraft | undefined> {
  const db = await openDrafts();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(account);
    request.onsuccess = () => resolve(request.result as GistDraft | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function writeGistDraft(account: string, draft: GistDraft | null) {
  const db = await openDrafts();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite", { durability: "strict" });
    const store = transaction.objectStore(storeName);
    if (draft) store.put(draft, account);
    else store.delete(account);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
}
