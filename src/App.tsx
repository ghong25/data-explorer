import { useState, useCallback, useMemo } from 'react';
import { useDuckDB } from './hooks/useDuckDB';
import { FileDropZone } from './components/FileDropZone';
import { DataGrid } from './components/DataGrid';
import { SqlEditor } from './components/SqlEditor';
import { RegexSearch } from './components/RegexSearch';
import { ExportPanel } from './components/ExportPanel';
import type { QueryResult, FileFormat, LoadedFile } from './types';

type ViewMode = 'data' | 'sql';

function App() {
  const {
    isLoading: dbLoading,
    error: dbError,
    loadedFiles,
    executeQuery,
    loadFile,
    exportData,
    downloadBlob,
  } = useDuckDB();

  const [currentFile, setCurrentFile] = useState<LoadedFile | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('data');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [isQueryRunning, setIsQueryRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [quickFilter, setQuickFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsFileLoading(true);
    setError(null);
    try {
      const loaded = await loadFile(file);
      setCurrentFile(loaded);
      const result = await executeQuery(`SELECT * FROM "${loaded.tableName}" LIMIT 1000`);
      setQueryResult(result);
      setLastQuery(`SELECT * FROM "${loaded.tableName}"`);
      setViewMode('data');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setIsFileLoading(false);
    }
  }, [loadFile, executeQuery]);

  const handleQueryExecute = useCallback(async (sql: string) => {
    setIsQueryRunning(true);
    setError(null);
    try {
      const result = await executeQuery(sql);
      setQueryResult(result);
      setLastQuery(sql);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setIsQueryRunning(false);
    }
  }, [executeQuery]);

  const handleSearch = useCallback(async (pattern: string, column: string | null, useRegex: boolean) => {
    if (!currentFile) return;

    setIsQueryRunning(true);
    setError(null);
    try {
      let whereClause: string;
      if (column) {
        if (useRegex) {
          whereClause = `regexp_matches(CAST("${column}" AS VARCHAR), '${pattern.replace(/'/g, "''")}')`;
        } else {
          whereClause = `CAST("${column}" AS VARCHAR) LIKE '%${pattern.replace(/'/g, "''")}%'`;
        }
      } else {
        const conditions = currentFile.columns.map(col => {
          if (useRegex) {
            return `regexp_matches(CAST("${col.name}" AS VARCHAR), '${pattern.replace(/'/g, "''")}')`;
          } else {
            return `CAST("${col.name}" AS VARCHAR) LIKE '%${pattern.replace(/'/g, "''")}%'`;
          }
        });
        whereClause = conditions.join(' OR ');
      }

      const sql = `SELECT * FROM "${currentFile.tableName}" WHERE ${whereClause}`;
      const result = await executeQuery(sql);
      setQueryResult(result);
      setLastQuery(sql);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsQueryRunning(false);
    }
  }, [currentFile, executeQuery]);

  const handleSearchClear = useCallback(async () => {
    if (!currentFile) return;
    setQuickFilter('');
    try {
      const sql = `SELECT * FROM "${currentFile.tableName}" LIMIT 1000`;
      const result = await executeQuery(sql);
      setQueryResult(result);
      setLastQuery(sql);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset view');
    }
  }, [currentFile, executeQuery]);

  const handleExport = useCallback(async (format: FileFormat, filename: string) => {
    if (!lastQuery) return;

    setIsExporting(true);
    setError(null);
    try {
      const blob = await exportData(lastQuery, format, filename);
      downloadBlob(blob, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [lastQuery, exportData, downloadBlob]);

  const columns = useMemo(() => {
    return queryResult?.columns || [];
  }, [queryResult]);

  if (dbLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 mx-auto mb-4 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-600">Initializing DuckDB...</p>
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
        <h1 className="text-xl font-bold text-gray-800">Data Explorer</h1>
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

        {!currentFile ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-lg">
              <FileDropZone onFileSelect={handleFileSelect} isLoading={isFileLoading} />
              {loadedFiles.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Previously loaded:</p>
                  <div className="flex flex-wrap gap-2">
                    {loadedFiles.map(f => (
                      <button
                        key={f.tableName}
                        onClick={async () => {
                          setCurrentFile(f);
                          const result = await executeQuery(`SELECT * FROM "${f.tableName}" LIMIT 1000`);
                          setQueryResult(result);
                          setLastQuery(`SELECT * FROM "${f.tableName}"`);
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
        ) : (
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
                  onClick={() => {
                    setCurrentFile(null);
                    setQueryResult(null);
                    setLastQuery('');
                  }}
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
                  <DataGrid data={queryResult} quickFilterText={quickFilter} />
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-hidden">
                <DataGrid data={queryResult} quickFilterText={quickFilter} />
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
