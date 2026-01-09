import { useState, useCallback, useEffect } from 'react';
import type { FileFormat } from '../types';

interface ExportPanelProps {
  onExport: (format: FileFormat, filename: string) => void;
  isExporting: boolean;
  defaultFilename?: string;
}

const FORMAT_OPTIONS: { value: FileFormat; label: string; extension: string }[] = [
  { value: 'csv', label: 'CSV', extension: '.csv' },
  { value: 'tsv', label: 'TSV', extension: '.tsv' },
  { value: 'json', label: 'JSON', extension: '.json' },
  { value: 'parquet', label: 'Parquet', extension: '.parquet' },
  { value: 'xlsx', label: 'Excel', extension: '.xlsx' },
];

export function ExportPanel({ onExport, isExporting, defaultFilename = 'export' }: ExportPanelProps) {
  const [format, setFormat] = useState<FileFormat>('csv');
  const [filename, setFilename] = useState(defaultFilename);

  // Sync filename when defaultFilename prop changes (e.g., switching tables)
  useEffect(() => {
    setFilename(defaultFilename);
  }, [defaultFilename]);

  const handleExport = useCallback(() => {
    const ext = FORMAT_OPTIONS.find(f => f.value === format)?.extension || '';
    const finalFilename = filename.endsWith(ext) ? filename : `${filename}${ext}`;
    onExport(format, finalFilename);
  }, [format, filename, onExport]);

  return (
    <div className="flex items-center gap-3 p-3 bg-white border rounded-lg">
      <span className="text-sm font-medium text-gray-700">Export:</span>
      <input
        type="text"
        value={filename}
        onChange={(e) => setFilename(e.target.value)}
        placeholder="Filename"
        className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
      />
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as FileFormat)}
        className="px-3 py-2 border rounded text-sm bg-white"
      >
        {FORMAT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label} ({opt.extension})
          </option>
        ))}
      </select>
      <button
        onClick={handleExport}
        disabled={isExporting || !filename.trim()}
        className={`
          px-4 py-2 rounded text-sm font-medium transition-colors
          ${isExporting || !filename.trim()
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700'
          }
        `}
      >
        {isExporting ? 'Exporting...' : 'Download'}
      </button>
    </div>
  );
}
