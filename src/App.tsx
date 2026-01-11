import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDuckDB } from './hooks/useDuckDB';
import { useFilePersistence } from './hooks/useFilePersistence';
import { FileDropZone } from './components/FileDropZone';
import { DataGrid, type DataGridHandle } from './components/DataGrid';
import { SqlEditor } from './components/SqlEditor';
import { RegexSearch } from './components/RegexSearch';
import { ExportPanel } from './components/ExportPanel';
import { JoinWizard } from './components/JoinWizard';
import { TabBar } from './components/TabBar';
import { getPersistedFile } from './utils/indexedDB';
import type { FileFormat, LoadedFile, FileTabState } from './types';

type ViewMode = 'data' | 'sql';

function App() {
  const {
    isLoading: dbLoading,
    error: dbError,
    loadedFiles,
    executeQuery,
    loadFile,
    loadFileFromContent,
    createJoinedTable,
    exportFromData,
    downloadBlob,
  } = useDuckDB();

  const {
    saveFile,
    getLastUsedFileId,
    clearSavedData,
  } = useFilePersistence();

  // Tab-based state
  const [tabs, setTabs] = useState<FileTabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);

  // Derived state from active tab
  const activeTab = useMemo(() =>
    tabs.find(t => t.file.tableName === activeTabId) ?? null,
    [tabs, activeTabId]
  );
  const currentFile = activeTab?.file ?? null;
  const queryResult = activeTab?.queryResult ?? null;
  const lastQuery = activeTab?.lastQuery ?? '';
  const quickFilter = activeTab?.quickFilter ?? '';

  const [viewMode, setViewMode] = useState<ViewMode>('data');
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [isQueryRunning, setIsQueryRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJoinWizard, setShowJoinWizard] = useState(false);
  const [restoreNotification, setRestoreNotification] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const dataGridRef = useRef<DataGridHandle>(null);
  const hasAttemptedRestore = useRef(false);

  // Helper to update a specific tab's state
  const updateTab = useCallback((tableName: string, updates: Partial<FileTabState>) => {
    setTabs(prev => prev.map(tab =>
      tab.file.tableName === tableName
        ? { ...tab, ...updates }
        : tab
    ));
  }, []);

  // Save current tab's filter state before switching
  const saveCurrentTabState = useCallback(() => {
    if (!activeTabId || !dataGridRef.current) return;
    const filterModel = dataGridRef.current.getFilterModel?.() ?? null;
    updateTab(activeTabId, { filterModel });
  }, [activeTabId, updateTab]);

  // Switch to a different tab
  const handleTabSelect = useCallback((tableName: string) => {
    saveCurrentTabState();
    setActiveTabId(tableName);
    setShowFileSelector(false);
  }, [saveCurrentTabState]);

  // Close a tab
  const handleTabClose = useCallback((tableName: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.file.tableName !== tableName);
      if (tableName === activeTabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].file.tableName);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }
      return newTabs;
    });
  }, [activeTabId]);

  // Update quickFilter for active tab
  const setQuickFilter = useCallback((value: string) => {
    if (activeTabId) {
      updateTab(activeTabId, { quickFilter: value });
    }
  }, [activeTabId, updateTab]);

  // Auto-restore last used file on mount (only once)
  useEffect(() => {
    if (dbLoading || hasAttemptedRestore.current) return;
    hasAttemptedRestore.current = true;

    const restoreLastFile = async () => {
      try {
        const lastId = await getLastUsedFileId();
        if (!lastId) return;

        setIsRestoring(true);
        const persisted = await getPersistedFile(lastId);
        if (!persisted) {
          setRestoreNotification('Previous session could not be restored');
          setTimeout(() => setRestoreNotification(null), 3000);
          return;
        }

        // Load the file content into DuckDB
        const loaded = await loadFileFromContent(
          persisted.content,
          persisted.name,
          persisted.format
        );
        const result = await executeQuery(`SELECT * FROM "${loaded.tableName}" LIMIT 1000`);
        const defaultQuery = `SELECT * FROM "${loaded.tableName}"`;

        // Create new tab for restored file
        const newTab: FileTabState = {
          file: loaded,
          queryResult: result,
          lastQuery: defaultQuery,
          quickFilter: '',
          filterModel: null,
        };
        setTabs([newTab]);
        setActiveTabId(loaded.tableName);
      } catch (err) {
        console.error('Failed to restore file:', err);
        setRestoreNotification('Previous session could not be restored');
        setTimeout(() => setRestoreNotification(null), 3000);
      } finally {
        setIsRestoring(false);
      }
    };

    restoreLastFile();
  }, [dbLoading, getLastUsedFileId, loadFileFromContent, executeQuery]);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsFileLoading(true);
    setError(null);
    setShowFileSelector(false);
    try {
      const loaded = await loadFile(file);
      const result = await executeQuery(`SELECT * FROM "${loaded.tableName}" LIMIT 1000`);
      const defaultQuery = `SELECT * FROM "${loaded.tableName}"`;

      // Create new tab
      const newTab: FileTabState = {
        file: loaded,
        queryResult: result,
        lastQuery: defaultQuery,
        quickFilter: '',
        filterModel: null,
      };

      setTabs(prev => [...prev, newTab]);
      setActiveTabId(loaded.tableName);
      setViewMode('data');

      // Save to persistence for auto-restore on next visit
      try {
        await saveFile(file);
      } catch (persistError) {
        console.warn('Failed to persist file:', persistError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setIsFileLoading(false);
    }
  }, [loadFile, executeQuery, saveFile]);

  const handleJoinComplete = useCallback(async (result: LoadedFile) => {
    setShowJoinWizard(false);
    const queryRes = await executeQuery(`SELECT * FROM "${result.tableName}" LIMIT 1000`);
    const defaultQuery = `SELECT * FROM "${result.tableName}"`;

    // Create new tab for joined result
    const newTab: FileTabState = {
      file: result,
      queryResult: queryRes,
      lastQuery: defaultQuery,
      quickFilter: '',
      filterModel: null,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(result.tableName);
    setViewMode('data');
  }, [executeQuery]);

  const handleClearSavedData = useCallback(async () => {
    try {
      await clearSavedData();
      setRestoreNotification('Saved data cleared');
      setTimeout(() => setRestoreNotification(null), 2000);
    } catch (err) {
      console.error('Failed to clear saved data:', err);
    }
  }, [clearSavedData]);

  const handleQueryExecute = useCallback(async (sql: string) => {
    if (!activeTabId) return;
    setIsQueryRunning(true);
    setError(null);
    try {
      const result = await executeQuery(sql);
      updateTab(activeTabId, { queryResult: result, lastQuery: sql });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setIsQueryRunning(false);
    }
  }, [activeTabId, executeQuery, updateTab]);

  const handleSearch = useCallback(async (pattern: string, column: string | null, useRegex: boolean, caseSensitive: boolean) => {
    if (!currentFile || !activeTabId) return;

    setIsQueryRunning(true);
    setError(null);
    try {
      const escapedPattern = pattern.replace(/'/g, "''");
      const likeOp = caseSensitive ? 'LIKE' : 'ILIKE';
      const regexFlags = caseSensitive ? '' : ", 'i'";

      let whereClause: string;
      if (column) {
        if (useRegex) {
          whereClause = `regexp_matches(CAST("${column}" AS VARCHAR), '${escapedPattern}'${regexFlags})`;
        } else {
          whereClause = `CAST("${column}" AS VARCHAR) ${likeOp} '%${escapedPattern}%'`;
        }
      } else {
        const conditions = currentFile.columns.map(col => {
          if (useRegex) {
            return `regexp_matches(CAST("${col.name}" AS VARCHAR), '${escapedPattern}'${regexFlags})`;
          } else {
            return `CAST("${col.name}" AS VARCHAR) ${likeOp} '%${escapedPattern}%'`;
          }
        });
        whereClause = conditions.join(' OR ');
      }

      const sql = `SELECT * FROM "${currentFile.tableName}" WHERE ${whereClause}`;
      const result = await executeQuery(sql);
      updateTab(activeTabId, { queryResult: result, lastQuery: sql });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsQueryRunning(false);
    }
  }, [currentFile, activeTabId, executeQuery, updateTab]);

  const handleSearchClear = useCallback(async () => {
    if (!currentFile || !activeTabId) return;
    setQuickFilter('');
    try {
      const sql = `SELECT * FROM "${currentFile.tableName}" LIMIT 1000`;
      const result = await executeQuery(sql);
      updateTab(activeTabId, { queryResult: result, lastQuery: sql });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset view');
    }
  }, [currentFile, activeTabId, executeQuery, updateTab, setQuickFilter]);

  const handleExport = useCallback(async (format: FileFormat, filename: string) => {
    if (!currentFile) return;

    setIsExporting(true);
    setError(null);
    try {
      // Get displayed data from grid (includes edits, filters, and column visibility)
      const displayedData = dataGridRef.current?.getDisplayedData();
      if (!displayedData || displayedData.rows.length === 0) {
        throw new Error('No data to export');
      }
      const blob = await exportFromData(displayedData, format);
      downloadBlob(blob, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [currentFile, exportFromData, downloadBlob]);

  const columns = useMemo(() => {
    return queryResult?.columns || [];
  }, [queryResult]);

  if (dbLoading || isRestoring) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 mx-auto mb-4 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-600">
            {isRestoring ? 'Restoring previous session...' : 'Initializing DuckDB...'}
          </p>
        </div>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center text-red-600">
          <p className="text-xl font-semibold mb-2">Failed to initialize</p>
          <p>{dbError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-800">Data Explorer</h1>
          {loadedFiles.length >= 1 && (
            <button
              onClick={() => setShowJoinWizard(true)}
              className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Join Tables
            </button>
          )}
          <button
            onClick={handleClearSavedData}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            title="Clear saved session data"
          >
            Clear Cache
          </button>
        </div>
        {currentFile && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {currentFile.name} ({currentFile.rowCount.toLocaleString()} rows)
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('data')}
                className={`px-3 py-1 text-sm rounded ${
                  viewMode === 'data'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Data
              </button>
              <button
                onClick={() => setViewMode('sql')}
                className={`px-3 py-1 text-sm rounded ${
                  viewMode === 'sql'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                SQL
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Tab Bar */}
      {tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId ?? ''}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
          onAddFile={() => setShowFileSelector(true)}
        />
      )}

      {/* Restore notification */}
      {restoreNotification && (
        <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded shadow-lg z-50">
          {restoreNotification}
        </div>
      )}

      {/* Join Wizard Modal */}
      {showJoinWizard && (
        <JoinWizard
          loadedFiles={loadedFiles}
          onFileUpload={loadFile}
          executeQuery={executeQuery}
          createJoinedTable={createJoinedTable}
          onComplete={handleJoinComplete}
          onCancel={() => setShowJoinWizard(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right font-bold"
            >
              &times;
            </button>
          </div>
        )}

        {(tabs.length === 0 || showFileSelector) ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-lg relative">
              {showFileSelector && tabs.length > 0 && (
                <button
                  onClick={() => setShowFileSelector(false)}
                  className="absolute -top-8 right-0 text-gray-500 hover:text-gray-700 text-sm"
                >
                  Cancel
                </button>
              )}
              <FileDropZone onFileSelect={handleFileSelect} isLoading={isFileLoading} />
              {loadedFiles.length > 0 && tabs.length === 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Previously loaded:</p>
                  <div className="flex flex-wrap gap-2">
                    {loadedFiles.map(f => (
                      <button
                        key={f.tableName}
                        onClick={async () => {
                          const result = await executeQuery(`SELECT * FROM "${f.tableName}" LIMIT 1000`);
                          const defaultQuery = `SELECT * FROM "${f.tableName}"`;
                          const newTab: FileTabState = {
                            file: f,
                            queryResult: result,
                            lastQuery: defaultQuery,
                            quickFilter: '',
                            filterModel: null,
                          };
                          setTabs([newTab]);
                          setActiveTabId(f.tableName);
                        }}
                        className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : currentFile && (
          <>
            {/* Search and Export toolbar */}
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[300px]">
                <RegexSearch
                  columns={columns}
                  onSearch={handleSearch}
                  onClear={handleSearchClear}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Quick filter (Ctrl+F)..."
                  value={quickFilter}
                  onChange={(e) => setQuickFilter(e.target.value)}
                  className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                />
                <button
                  type="button"
                  onClick={() => setShowFileSelector(true)}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                >
                  Load New File
                </button>
              </div>
            </div>

            {/* Main view area */}
            {viewMode === 'sql' ? (
              <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                <div className="w-1/2 flex flex-col overflow-hidden">
                  <SqlEditor
                    onExecute={handleQueryExecute}
                    isExecuting={isQueryRunning}
                    defaultTable={currentFile.tableName}
                  />
                </div>
                <div className="w-1/2 flex flex-col min-h-0 overflow-hidden">
                  <DataGrid
                    ref={dataGridRef}
                    data={queryResult}
                    quickFilterText={quickFilter}
                    initialFilterModel={activeTab?.filterModel}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-hidden">
                <DataGrid
                  ref={dataGridRef}
                  data={queryResult}
                  quickFilterText={quickFilter}
                  initialFilterModel={activeTab?.filterModel}
                />
              </div>
            )}

            {/* Export panel */}
            <ExportPanel
              onExport={handleExport}
              isExporting={isExporting}
              defaultFilename={currentFile.name.replace(/\.[^.]+$/, '_export')}
            />

            {/* Status bar */}
            <div className="text-sm text-gray-600 flex justify-between">
              <span>
                {queryResult
                  ? `Showing ${queryResult.rowCount.toLocaleString()} rows × ${queryResult.columns.length} columns`
                  : 'No data loaded'}
              </span>
              {lastQuery && (
                <span className="text-gray-400 truncate max-w-md" title={lastQuery}>
                  Last query: {lastQuery.substring(0, 60)}{lastQuery.length > 60 ? '...' : ''}
                </span>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
