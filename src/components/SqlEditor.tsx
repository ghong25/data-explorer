import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';

interface SqlEditorProps {
  onExecute: (sql: string) => void;
  isExecuting: boolean;
  defaultTable?: string;
}

export function SqlEditor({ onExecute, isExecuting, defaultTable }: SqlEditorProps) {
  const [sql, setSql] = useState(defaultTable ? `SELECT * FROM "${defaultTable}" LIMIT 1000` : '');
  const [history, setHistory] = useState<string[]>([]);

  const handleExecute = useCallback(() => {
    if (!sql.trim()) return;
    onExecute(sql);
    setHistory(prev => [sql, ...prev.filter(q => q !== sql)].slice(0, 20));
  }, [sql, onExecute]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    setSql(value || '');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  }, [handleExecute]);

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b">
        <span className="text-sm font-medium text-gray-700">SQL Query</span>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <select
              className="text-sm border rounded px-2 py-1 bg-white"
              onChange={(e) => setSql(e.target.value)}
              value=""
            >
              <option value="" disabled>History</option>
              {history.map((q, i) => (
                <option key={i} value={q}>
                  {q.substring(0, 50)}{q.length > 50 ? '...' : ''}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleExecute}
            disabled={isExecuting || !sql.trim()}
            className={`
              px-4 py-1.5 rounded text-sm font-medium transition-colors
              ${isExecuting || !sql.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            {isExecuting ? 'Running...' : 'Run (Ctrl+Enter)'}
          </button>
        </div>
      </div>
      <div className="flex-1" onKeyDown={handleKeyDown}>
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={sql}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
}
