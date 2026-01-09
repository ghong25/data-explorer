import { useState, useCallback } from 'react';

interface RegexSearchProps {
  columns: string[];
  onSearch: (pattern: string, column: string | null, useRegex: boolean, caseSensitive: boolean) => void;
  onClear: () => void;
}

export function RegexSearch({ columns, onSearch, onClear }: RegexSearchProps) {
  const [pattern, setPattern] = useState('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(() => {
    setError(null);

    if (!pattern.trim()) {
      onClear();
      return;
    }

    if (useRegex) {
      try {
        new RegExp(pattern);
      } catch (e) {
        setError('Invalid regex pattern');
        return;
      }
    }

    onSearch(pattern, selectedColumn || null, useRegex, caseSensitive);
  }, [pattern, selectedColumn, useRegex, caseSensitive, onSearch, onClear]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const handleClear = useCallback(() => {
    setPattern('');
    setSelectedColumn('');
    setError(null);
    onClear();
  }, [onClear]);

  return (
    <div className="flex flex-col gap-2 p-3 bg-white border rounded-lg">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={useRegex ? 'Enter regex pattern...' : 'Enter search text...'}
          className="flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={selectedColumn}
          onChange={(e) => setSelectedColumn(e.target.value)}
          className="px-3 py-2 border rounded text-sm bg-white"
        >
          <option value="">All columns</option>
          {columns.map(col => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={useRegex}
            onChange={(e) => setUseRegex(e.target.checked)}
            className="rounded"
          />
          Regex
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
            className="rounded"
          />
          Case sensitive
        </label>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          Search
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300"
        >
          Clear
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
