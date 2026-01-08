import { useState } from 'react';
import type { QueryResult } from '../../types';

interface JoinResultProps {
  previewResult: QueryResult | null;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
  onSave: (tableName: string) => void;
}

export function JoinResult({
  previewResult,
  isLoading,
  error,
  onBack,
  onSave,
}: JoinResultProps) {
  const [tableName, setTableName] = useState('joined_table');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!tableName.trim()) return;
    setIsSaving(true);
    try {
      await onSave(tableName.trim());
    } finally {
      setIsSaving(false);
    }
  };

  const isValidTableName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Preview & Save</h3>
        <p className="text-sm text-gray-600">
          Review the joined result and save as a new table
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Preview Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-3 py-2 border-b flex justify-between items-center">
          <span className="font-medium">Result Preview</span>
          {previewResult && (
            <span className="text-sm text-gray-600">
              {previewResult.rowCount.toLocaleString()} rows, {previewResult.columns.length} columns
            </span>
          )}
        </div>
        <div className="overflow-x-auto max-h-64">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="animate-spin h-6 w-6 mx-auto mb-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating preview...
            </div>
          ) : previewResult ? (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {previewResult.columns.map(col => (
                    <th key={col} className="px-2 py-1 text-left font-medium border-b">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewResult.rows.slice(0, 100).map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    {previewResult.columns.map(col => (
                      <td key={col} className="px-2 py-1 truncate max-w-[150px]">
                        {row[col] === null ? (
                          <span className="text-gray-400 italic">NULL</span>
                        ) : (
                          String(row[col] ?? '')
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">No preview available</div>
          )}
        </div>
        {previewResult && previewResult.rowCount > 100 && (
          <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 text-center border-t">
            Showing first 100 of {previewResult.rowCount.toLocaleString()} rows
          </div>
        )}
      </div>

      {/* Save Options */}
      <div className="border rounded-lg p-4">
        <label className="block text-sm font-medium mb-2">Table Name</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tableName}
            onChange={e => setTableName(e.target.value)}
            placeholder="Enter table name"
            className={`flex-1 border rounded px-3 py-2 ${
              !isValidTableName && tableName ? 'border-red-300' : ''
            }`}
          />
          <button
            onClick={handleSave}
            disabled={!isValidTableName || !previewResult || isSaving}
            className={`px-6 py-2 rounded ${
              isValidTableName && previewResult && !isSaving
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? 'Creating...' : 'Create Table'}
          </button>
        </div>
        {!isValidTableName && tableName && (
          <p className="text-xs text-red-500 mt-1">
            Table name must start with a letter or underscore and contain only letters, numbers, and underscores
          </p>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Back
        </button>
      </div>
    </div>
  );
}
