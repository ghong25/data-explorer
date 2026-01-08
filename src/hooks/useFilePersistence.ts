import { useCallback } from 'react';
import {
  savePersistedFile,
  getPersistedFile,
  clearAllPersistedFiles,
  getSetting,
  setSetting,
  fileToPersistedFile,
  persistedFileToFile,
} from '../utils/indexedDB';

const LAST_FILE_ID_KEY = 'lastUsedFileId';

export function useFilePersistence() {
  const saveFile = useCallback(async (file: File): Promise<string> => {
    // Generate a unique ID based on filename and timestamp
    const id = `${file.name}-${Date.now()}`;
    const persisted = await fileToPersistedFile(file, id);
    await savePersistedFile(persisted);
    await setSetting(LAST_FILE_ID_KEY, id);
    return id;
  }, []);

  const loadPersistedFile = useCallback(async (id: string): Promise<File | null> => {
    const persisted = await getPersistedFile(id);
    if (!persisted) return null;
    return persistedFileToFile(persisted);
  }, []);

  const getLastUsedFileId = useCallback(async (): Promise<string | null> => {
    return getSetting<string>(LAST_FILE_ID_KEY);
  }, []);

  const setLastUsedFileId = useCallback(async (id: string): Promise<void> => {
    await setSetting(LAST_FILE_ID_KEY, id);
  }, []);

  const clearSavedData = useCallback(async (): Promise<void> => {
    await clearAllPersistedFiles();
    await setSetting(LAST_FILE_ID_KEY, null);
  }, []);

  const loadLastUsedFile = useCallback(async (): Promise<File | null> => {
    const lastId = await getLastUsedFileId();
    if (!lastId) return null;
    return loadPersistedFile(lastId);
  }, [getLastUsedFileId, loadPersistedFile]);

  return {
    saveFile,
    loadPersistedFile,
    getLastUsedFileId,
    setLastUsedFileId,
    clearSavedData,
    loadLastUsedFile,
  };
}
