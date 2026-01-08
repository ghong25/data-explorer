import type { LoadedFile, QueryResult } from '../../types';

interface TablePreviewProps {
  leftTable: LoadedFile;
  rightTable: LoadedFile;
  leftPreview: QueryResult | null;
  rightPreview: QueryResult | null;
  onBack: () => void;
  onNext: () => void;
}

export function TablePreview({
  leftTable,
  rightTable,
  leftPreview,
  rightPreview,
  onBack,
  onNext,
}: TablePreviewProps) {
  // Find matching column names between tables
  const leftCols = new Set(leftTable.columns.map(c => c.name.toLowerCase()));
  const matchingColumns = rightTable.columns
    .filter(c => leftCols.has(c.name.toLowerCase()))
    .map(c => c.name);

  const renderPreviewTable = (
    table: LoadedFile,
    preview: QueryResult | null,
    color: 'blue' | 'green'
  ) => {
    const bgColor = color === 'blue' ? 'bg-blue-50' : 'bg-green-50';
    const borderColor = color === 'blue' ? 'border-blue-200' : 'border-green-200';
    const textColor = color === 'blue' ? 'text-blue-600' : 'text-green-600';

    return (
      <div className={`border ${borderColor} rounded-lg overflow-hidden`}>
        <div className={`${bgColor} px-3 py-2 border-b ${borderColor}`}>
          <h4 className={`font-medium ${textColor}`}>{table.name}</h4>
          <div className="text-xs text-gray-600">
            {table.rowCount.toLocaleString()} rows, {table.columns.length} columns
          </div>
        </div>
        <div className="overflow-x-auto max-h-48">
          {preview ? (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {preview.columns.map(col => (
                    <th
                      key={col}
                      className={`px-2 py-1 text-left font-medium border-b ${
                        matchingColumns.includes(col) ? 'bg-purple-100' : ''
                      }`}
                      title={matchingColumns.includes(col) ? 'Potential join column' : ''}
                    >
                      {col}
                      {matchingColumns.includes(col) && (
                        <span className="ml-1 text-purple-600">*</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    {preview.columns.map(col => (
                      <td key={col} className="px-2 py-1 truncate max-w-[150px]">
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-center text-gray-500">Loading preview...</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Preview Tables</h3>
        <p className="text-sm text-gray-600">
          Review the first few rows of each table.
          {matchingColumns.length > 0 && (
            <span className="text-purple-600">
              {' '}Columns marked with * have matching names.
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {renderPreviewTable(leftTable, leftPreview, 'blue')}
        {renderPreviewTable(rightTable, rightPreview, 'green')}
      </div>

      {matchingColumns.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm">
          <span className="font-medium text-purple-700">Suggested join columns: </span>
          <span className="text-purple-600">{matchingColumns.join(', ')}</span>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Next: Configure Join
        </button>
      </div>
    </div>
  );
}
