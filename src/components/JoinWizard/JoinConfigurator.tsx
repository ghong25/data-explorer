import { useState, useMemo, useEffect, useCallback } from 'react';
import type { LoadedFile, JoinType, JoinCondition, SelectedColumn } from '../../types';
import { JoinDiagram } from './JoinDiagram';

interface JoinConfiguratorProps {
  leftTable: LoadedFile;
  rightTable: LoadedFile;
  onBack: () => void;
  onNext: (config: {
    joinType: JoinType;
    conditions: JoinCondition[];
    selectedColumns: SelectedColumn[];
  }) => void;
}

const JOIN_TYPES: { value: JoinType; label: string }[] = [
  { value: 'INNER', label: 'INNER JOIN' },
  { value: 'LEFT', label: 'LEFT JOIN' },
  { value: 'RIGHT', label: 'RIGHT JOIN' },
  { value: 'FULL OUTER', label: 'FULL OUTER JOIN' },
];

const OPERATORS = ['=', '<', '>', '<=', '>=', '!='] as const;

export function JoinConfigurator({
  leftTable,
  rightTable,
  onBack,
  onNext,
}: JoinConfiguratorProps) {
  const [joinType, setJoinType] = useState<JoinType>('INNER');
  const [conditions, setConditions] = useState<JoinCondition[]>([
    { leftColumn: leftTable.columns[0]?.name || '', rightColumn: rightTable.columns[0]?.name || '', operator: '=' },
  ]);
  const [leftPrefix, setLeftPrefix] = useState('');
  const [rightPrefix, setRightPrefix] = useState('');

  // Helper to compute alias for a column based on prefix and conflict detection
  const getColumnAlias = useCallback((
    table: 'left' | 'right',
    columnName: string,
    lPrefix: string,
    rPrefix: string
  ): string | undefined => {
    if (table === 'left') {
      return lPrefix ? `${lPrefix}${columnName}` : undefined;
    } else {
      // Right table: apply prefix if set, otherwise alias only if conflicts with left
      if (rPrefix) {
        return `${rPrefix}${columnName}`;
      }
      const needsAlias = leftTable.columns.some(lc => lc.name === columnName);
      return needsAlias ? `${rightTable.tableName}_${columnName}` : undefined;
    }
  }, [leftTable.columns, rightTable.tableName]);

  // Initialize with all columns selected
  const initialColumns: SelectedColumn[] = useMemo(() => {
    const cols: SelectedColumn[] = [];
    leftTable.columns.forEach(col => {
      cols.push({
        table: 'left',
        column: col.name,
        alias: getColumnAlias('left', col.name, leftPrefix, rightPrefix),
      });
    });
    rightTable.columns.forEach(col => {
      cols.push({
        table: 'right',
        column: col.name,
        alias: getColumnAlias('right', col.name, leftPrefix, rightPrefix),
      });
    });
    return cols;
  }, [leftTable, rightTable, leftPrefix, rightPrefix, getColumnAlias]);

  const [selectedColumns, setSelectedColumns] = useState<SelectedColumn[]>(initialColumns);

  // Update aliases when prefixes change
  useEffect(() => {
    setSelectedColumns(prev =>
      prev.map(col => ({
        ...col,
        alias: getColumnAlias(col.table, col.column, leftPrefix, rightPrefix),
      }))
    );
  }, [leftPrefix, rightPrefix, getColumnAlias]);

  const addCondition = () => {
    setConditions([
      ...conditions,
      { leftColumn: leftTable.columns[0]?.name || '', rightColumn: rightTable.columns[0]?.name || '', operator: '=' },
    ]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const updateCondition = (index: number, field: keyof JoinCondition, value: string) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConditions(updated);
  };

  const toggleColumn = (table: 'left' | 'right', column: string) => {
    const existing = selectedColumns.find(c => c.table === table && c.column === column);
    if (existing) {
      setSelectedColumns(selectedColumns.filter(c => !(c.table === table && c.column === column)));
    } else {
      setSelectedColumns([
        ...selectedColumns,
        {
          table,
          column,
          alias: getColumnAlias(table, column, leftPrefix, rightPrefix),
        },
      ]);
    }
  };

  const isColumnSelected = (table: 'left' | 'right', column: string) => {
    return selectedColumns.some(c => c.table === table && c.column === column);
  };

  // Generate SQL preview
  const sqlPreview = useMemo(() => {
    const cols = selectedColumns.map(c => {
      const alias = c.table === 'left' ? 't1' : 't2';
      if (c.alias) {
        return `${alias}."${c.column}" AS "${c.alias}"`;
      }
      return `${alias}."${c.column}"`;
    }).join(',\n  ');

    const conds = conditions.map(c =>
      `t1."${c.leftColumn}" ${c.operator} t2."${c.rightColumn}"`
    ).join('\n  AND ');

    const joinSQL = joinType === 'FULL OUTER' ? 'FULL OUTER JOIN' : `${joinType} JOIN`;

    return `SELECT
  ${cols}
FROM "${leftTable.tableName}" t1
${joinSQL} "${rightTable.tableName}" t2
  ON ${conds}`;
  }, [selectedColumns, conditions, joinType, leftTable, rightTable]);

  const canProceed = conditions.length > 0 &&
    conditions.every(c => c.leftColumn && c.rightColumn) &&
    selectedColumns.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Configure Join</h3>
      </div>

      {/* Join Type Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Join Type</label>
          <select
            value={joinType}
            onChange={e => setJoinType(e.target.value as JoinType)}
            className="w-full border rounded px-3 py-2"
          >
            {JOIN_TYPES.map(jt => (
              <option key={jt.value} value={jt.value}>{jt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-center">
          <JoinDiagram
            joinType={joinType}
            leftLabel={leftTable.tableName}
            rightLabel={rightTable.tableName}
          />
        </div>
      </div>

      {/* Join Conditions */}
      <div>
        <label className="block text-sm font-medium mb-2">Join Conditions</label>
        <div className="space-y-2">
          {conditions.map((cond, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-blue-600 w-8">t1.</span>
              <select
                value={cond.leftColumn}
                onChange={e => updateCondition(i, 'leftColumn', e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-sm"
              >
                {leftTable.columns.map(col => (
                  <option key={col.name} value={col.name}>{col.name}</option>
                ))}
              </select>
              <select
                value={cond.operator}
                onChange={e => updateCondition(i, 'operator', e.target.value)}
                className="w-16 border rounded px-2 py-1 text-sm text-center"
              >
                {OPERATORS.map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              <span className="text-sm text-green-600 w-8">t2.</span>
              <select
                value={cond.rightColumn}
                onChange={e => updateCondition(i, 'rightColumn', e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-sm"
              >
                {rightTable.columns.map(col => (
                  <option key={col.name} value={col.name}>{col.name}</option>
                ))}
              </select>
              {conditions.length > 1 && (
                <button
                  onClick={() => removeCondition(i)}
                  className="text-red-500 hover:text-red-700 px-2"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addCondition}
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          + Add condition
        </button>
      </div>

      {/* Column Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Select Columns</label>
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded p-2">
            <div className="text-xs text-blue-600 font-medium mb-1">Left Table (t1)</div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-gray-500">Prefix:</label>
              <input
                type="text"
                value={leftPrefix}
                onChange={e => setLeftPrefix(e.target.value)}
                placeholder="e.g. orders_"
                className="flex-1 border rounded px-2 py-1 text-xs"
              />
            </div>
            <div className="max-h-32 overflow-y-auto">
              {leftTable.columns.map(col => (
                <label key={col.name} className="flex items-center gap-2 text-sm py-0.5">
                  <input
                    type="checkbox"
                    checked={isColumnSelected('left', col.name)}
                    onChange={() => toggleColumn('left', col.name)}
                  />
                  <span className="truncate" title={`${col.name} (${col.type})`}>
                    {col.name}
                  </span>
                  <span className="text-xs text-gray-400">{col.type}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="border rounded p-2">
            <div className="text-xs text-green-600 font-medium mb-1">Right Table (t2)</div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-gray-500">Prefix:</label>
              <input
                type="text"
                value={rightPrefix}
                onChange={e => setRightPrefix(e.target.value)}
                placeholder="e.g. products_"
                className="flex-1 border rounded px-2 py-1 text-xs"
              />
            </div>
            <div className="max-h-32 overflow-y-auto">
              {rightTable.columns.map(col => (
                <label key={col.name} className="flex items-center gap-2 text-sm py-0.5">
                  <input
                    type="checkbox"
                    checked={isColumnSelected('right', col.name)}
                    onChange={() => toggleColumn('right', col.name)}
                  />
                  <span className="truncate" title={`${col.name} (${col.type})`}>
                    {col.name}
                  </span>
                  <span className="text-xs text-gray-400">{col.type}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SQL Preview */}
      <div>
        <label className="block text-sm font-medium mb-2">SQL Preview</label>
        <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
          {sqlPreview}
        </pre>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={() => onNext({ joinType, conditions, selectedColumns })}
          disabled={!canProceed}
          className={`px-4 py-2 rounded ${
            canProceed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Next: Preview Result
        </button>
      </div>
    </div>
  );
}
