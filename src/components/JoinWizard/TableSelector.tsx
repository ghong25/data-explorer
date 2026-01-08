import { useState } from 'react';
import type { LoadedFile } from '../../types';
import { FileDropZone } from '../FileDropZone';

interface TableSelectorProps {
  loadedFiles: LoadedFile[];
  onFileUpload: (file: File) => Promise<LoadedFile>;
  selectedTables: [LoadedFile | null, LoadedFile | null];
  onTableSelect: (index: 0 | 1, table: LoadedFile) => void;
  onNext: () => void;
}

export function TableSelector({
  loadedFiles,
  onFileUpload,
  selectedTables,
  onTableSelect,
  onNext,
}: TableSelectorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<0 | 1 | null>(null);

  const handleFileUpload = async (file: File) => {
    if (uploadTarget === null) return;
    setIsUploading(true);
    try {
      const loaded = await onFileUpload(file);
      onTableSelect(uploadTarget, loaded);
      setUploadTarget(null);
    } finally {
      setIsUploading(false);
    }
  };

  const canProceed = selectedTables[0] !== null && selectedTables[1] !== null;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Select Two Tables to Join</h3>
        <p className="text-sm text-gray-600">
          Choose from loaded tables or upload new files
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left Table */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3 text-blue-600">Left Table (t1)</h4>
          {selectedTables[0] ? (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="font-medium">{selectedTables[0].name}</div>
              <div className="text-sm text-gray-600">
                {selectedTables[0].rowCount.toLocaleString()} rows, {selectedTables[0].columns.length} columns
              </div>
              <button
                onClick={() => onTableSelect(0, null as unknown as LoadedFile)}
                className="text-xs text-red-600 hover:underline mt-2"
              >
                Remove
              </button>
            </div>
          ) : uploadTarget === 0 ? (
            <div className="h-32">
              <FileDropZone onFileSelect={handleFileUpload} isLoading={isUploading} />
              <button
                onClick={() => setUploadTarget(null)}
                className="text-xs text-gray-500 hover:underline mt-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {loadedFiles.filter(f => f !== selectedTables[1]).map(file => (
                <button
                  key={file.tableName}
                  onClick={() => onTableSelect(0, file)}
                  className="w-full text-left p-2 border rounded hover:bg-gray-50"
                >
                  <div className="font-medium text-sm">{file.name}</div>
                  <div className="text-xs text-gray-500">
                    {file.rowCount.toLocaleString()} rows
                  </div>
                </button>
              ))}
              <button
                onClick={() => setUploadTarget(0)}
                className="w-full p-2 border border-dashed rounded text-sm text-gray-500 hover:bg-gray-50"
              >
                + Upload new file
              </button>
            </div>
          )}
        </div>

        {/* Right Table */}
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3 text-green-600">Right Table (t2)</h4>
          {selectedTables[1] ? (
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <div className="font-medium">{selectedTables[1].name}</div>
              <div className="text-sm text-gray-600">
                {selectedTables[1].rowCount.toLocaleString()} rows, {selectedTables[1].columns.length} columns
              </div>
              <button
                onClick={() => onTableSelect(1, null as unknown as LoadedFile)}
                className="text-xs text-red-600 hover:underline mt-2"
              >
                Remove
              </button>
            </div>
          ) : uploadTarget === 1 ? (
            <div className="h-32">
              <FileDropZone onFileSelect={handleFileUpload} isLoading={isUploading} />
              <button
                onClick={() => setUploadTarget(null)}
                className="text-xs text-gray-500 hover:underline mt-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {loadedFiles.filter(f => f !== selectedTables[0]).map(file => (
                <button
                  key={file.tableName}
                  onClick={() => onTableSelect(1, file)}
                  className="w-full text-left p-2 border rounded hover:bg-gray-50"
                >
                  <div className="font-medium text-sm">{file.name}</div>
                  <div className="text-xs text-gray-500">
                    {file.rowCount.toLocaleString()} rows
                  </div>
                </button>
              ))}
              <button
                onClick={() => setUploadTarget(1)}
                className="w-full p-2 border border-dashed rounded text-sm text-gray-500 hover:bg-gray-50"
              >
                + Upload new file
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`px-4 py-2 rounded ${
            canProceed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Next: Preview Tables
        </button>
      </div>
    </div>
  );
}
