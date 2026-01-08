import { useState, useEffect, useCallback } from 'react';
import type { LoadedFile, QueryResult, JoinType, JoinCondition, SelectedColumn, JoinConfig } from '../../types';
import { TableSelector } from './TableSelector';
import { TablePreview } from './TablePreview';
import { JoinConfigurator } from './JoinConfigurator';
import { JoinResult } from './JoinResult';

type WizardStep = 'select' | 'preview' | 'configure' | 'result';

interface JoinWizardProps {
  loadedFiles: LoadedFile[];
  onFileUpload: (file: File) => Promise<LoadedFile>;
  executeQuery: (sql: string) => Promise<QueryResult>;
  createJoinedTable: (config: JoinConfig, tableName: string) => Promise<LoadedFile>;
  onComplete: (result: LoadedFile) => void;
  onCancel: () => void;
}

export function JoinWizard({
  loadedFiles,
  onFileUpload,
  executeQuery,
  createJoinedTable,
  onComplete,
  onCancel,
}: JoinWizardProps) {
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedTables, setSelectedTables] = useState<[LoadedFile | null, LoadedFile | null]>([null, null]);
  const [leftPreview, setLeftPreview] = useState<QueryResult | null>(null);
  const [rightPreview, setRightPreview] = useState<QueryResult | null>(null);
  const [joinConfig, setJoinConfig] = useState<{
    joinType: JoinType;
    conditions: JoinCondition[];
    selectedColumns: SelectedColumn[];
  } | null>(null);
  const [resultPreview, setResultPreview] = useState<QueryResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTableSelect = useCallback((index: 0 | 1, table: LoadedFile | null) => {
    setSelectedTables(prev => {
      const updated = [...prev] as [LoadedFile | null, LoadedFile | null];
      updated[index] = table;
      return updated;
    });
  }, []);

  // Load previews when tables are selected and we move to preview step
  useEffect(() => {
    if (step === 'preview' && selectedTables[0] && selectedTables[1]) {
      const loadPreviews = async () => {
        try {
          const [left, right] = await Promise.all([
            executeQuery(`SELECT * FROM "${selectedTables[0]!.tableName}" LIMIT 5`),
            executeQuery(`SELECT * FROM "${selectedTables[1]!.tableName}" LIMIT 5`),
          ]);
          setLeftPreview(left);
          setRightPreview(right);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load previews');
        }
      };
      loadPreviews();
    }
  }, [step, selectedTables, executeQuery]);

  // Generate result preview when moving to result step
  useEffect(() => {
    if (step === 'result' && selectedTables[0] && selectedTables[1] && joinConfig) {
      const generatePreview = async () => {
        setIsPreviewLoading(true);
        setError(null);
        try {
          // Build the preview query (similar to what createJoinedTable does)
          const cols = joinConfig.selectedColumns.map(c => {
            const alias = c.table === 'left' ? 't1' : 't2';
            if (c.alias) {
              return `${alias}."${c.column}" AS "${c.alias}"`;
            }
            return `${alias}."${c.column}"`;
          }).join(', ');

          const conds = joinConfig.conditions.map(c =>
            `t1."${c.leftColumn}" ${c.operator} t2."${c.rightColumn}"`
          ).join(' AND ');

          const joinSQL = joinConfig.joinType === 'FULL OUTER' ? 'FULL OUTER JOIN' : `${joinConfig.joinType} JOIN`;

          const sql = `
            SELECT ${cols}
            FROM "${selectedTables[0]!.tableName}" t1
            ${joinSQL} "${selectedTables[1]!.tableName}" t2
            ON ${conds}
            LIMIT 100
          `;

          const preview = await executeQuery(sql);

          // Also get total count
          const countSQL = `
            SELECT COUNT(*) as cnt
            FROM "${selectedTables[0]!.tableName}" t1
            ${joinSQL} "${selectedTables[1]!.tableName}" t2
            ON ${conds}
          `;
          const countResult = await executeQuery(countSQL);
          const totalCount = Number(countResult.rows[0]?.cnt ?? 0);

          setResultPreview({
            ...preview,
            rowCount: totalCount,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to generate preview');
        } finally {
          setIsPreviewLoading(false);
        }
      };
      generatePreview();
    }
  }, [step, selectedTables, joinConfig, executeQuery]);

  const handleSave = async (tableName: string) => {
    if (!selectedTables[0] || !selectedTables[1] || !joinConfig) return;

    try {
      setError(null);
      const config: JoinConfig = {
        leftTable: selectedTables[0],
        rightTable: selectedTables[1],
        joinType: joinConfig.joinType,
        joinConditions: joinConfig.conditions,
        selectedColumns: joinConfig.selectedColumns,
      };

      const result = await createJoinedTable(config, tableName);
      onComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create joined table');
    }
  };

  const steps: WizardStep[] = ['select', 'preview', 'configure', 'result'];
  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Join Tables</h2>
            <div className="flex gap-2 mt-2">
              {steps.map((s, i) => (
                <div
                  key={s}
                  className={`h-2 w-16 rounded ${
                    i <= currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select' && (
            <TableSelector
              loadedFiles={loadedFiles}
              onFileUpload={onFileUpload}
              selectedTables={selectedTables}
              onTableSelect={handleTableSelect}
              onNext={() => setStep('preview')}
            />
          )}

          {step === 'preview' && selectedTables[0] && selectedTables[1] && (
            <TablePreview
              leftTable={selectedTables[0]}
              rightTable={selectedTables[1]}
              leftPreview={leftPreview}
              rightPreview={rightPreview}
              onBack={() => setStep('select')}
              onNext={() => setStep('configure')}
            />
          )}

          {step === 'configure' && selectedTables[0] && selectedTables[1] && (
            <JoinConfigurator
              leftTable={selectedTables[0]}
              rightTable={selectedTables[1]}
              onBack={() => setStep('preview')}
              onNext={(config) => {
                setJoinConfig(config);
                setStep('result');
              }}
            />
          )}

          {step === 'result' && (
            <JoinResult
              previewResult={resultPreview}
              isLoading={isPreviewLoading}
              error={error}
              onBack={() => setStep('configure')}
              onSave={handleSave}
            />
          )}
        </div>
      </div>
    </div>
  );
}
