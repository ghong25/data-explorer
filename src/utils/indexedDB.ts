import type { PersistedFile, PersistedFileMetadata, FileFormat } from '../types';

const DB_NAME = 'data-explorer-db';
const DB_VERSION = 1;
const FILES_STORE = 'files';
const SETTINGS_STORE = 'settings';

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };
  });
}

export async function savePersistedFile(file: PersistedFile): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FILES_STORE, 'readwrite');
    const store = transaction.objectStore(FILES_STORE);
    const request = store.put(file);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getPersistedFile(id: string): Promise<PersistedFile | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FILES_STORE, 'readonly');
    const store = transaction.objectStore(FILES_STORE);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function deletePersistedFile(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FILES_STORE, 'readwrite');
    const store = transaction.objectStore(FILES_STORE);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAllPersistedFiles(): Promise<PersistedFileMetadata[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FILES_STORE, 'readonly');
    const store = transaction.objectStore(FILES_STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const files = request.result as PersistedFile[];
      // Return metadata only (exclude content for performance)
      resolve(files.map(f => ({
        id: f.id,
        name: f.name,
        format: f.format,
        size: f.size,
        lastUsed: f.lastUsed,
      })));
    };
  });
}

export async function clearAllPersistedFiles(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FILES_STORE, 'readwrite');
    const store = transaction.objectStore(FILES_STORE);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Settings helpers
export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readonly');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.value : null);
    };
  });
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.put({ key, value });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteSetting(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.delete(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Helper to convert File to storable format
export async function fileToPersistedFile(file: File, id: string): Promise<PersistedFile> {
  const format = detectFormat(file.name);
  let content: string;

  if (format === 'parquet') {
    // Binary format - store as base64
    const buffer = await file.arrayBuffer();
    content = arrayBufferToBase64(buffer);
  } else {
    // Text format - store as-is
    content = await file.text();
  }

  return {
    id,
    name: file.name,
    format,
    content,
    lastUsed: Date.now(),
    size: file.size,
  };
}

// Helper to convert persisted file back to File object
export function persistedFileToFile(persisted: PersistedFile): File {
  let blob: Blob;

  if (persisted.format === 'parquet') {
    // Binary format - decode from base64
    const buffer = base64ToArrayBuffer(persisted.content);
    blob = new Blob([buffer], { type: 'application/octet-stream' });
  } else {
    // Text format
    blob = new Blob([persisted.content], { type: 'text/plain' });
  }

  return new File([blob], persisted.name, { lastModified: persisted.lastUsed });
}

function detectFormat(filename: string): FileFormat {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'csv': return 'csv';
    case 'tsv': return 'tsv';
    case 'parquet': return 'parquet';
    case 'xlsx': return 'xlsx';
    case 'xls': return 'xls';
    case 'json': return 'json';
    default: return 'csv';
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
