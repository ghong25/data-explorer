import { useMemo, useCallback, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import type { ColDef, GridApi, GridReadyEvent, CellValueChangedEvent, ValueFormatterParams } from 'ag-grid-community';
import type { QueryResult } from '../types';
import { isDatetimeType, formatDatetime, mightBeEpochColumn, formatEpoch } from '../utils/dateFormatter';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Custom theme
const customTheme = themeQuartz;

export interface ExportParams {
  visibleColumns: string[];
  quickFilterText?: string;
  filterModel?: Record<string, unknown>;
}

export interface DataGridHandle {
  getDisplayedData: () => QueryResult | null;
  getExportParams: () => ExportParams | null;
  getFilterModel: () => Record<string, unknown> | null;
}

interface DataGridProps {
  data: QueryResult | null;
  onCellChange?: (rowIndex: number, field: string, oldValue: unknown, newValue: unknown) => void;
  quickFilterText?: string;
  initialFilterModel?: Record<string, unknown> | null;
}

export const DataGrid = forwardRef<DataGridHandle, DataGridProps>(function DataGrid({ data, onCellChange, quickFilterText, initialFilterModel }, ref) {
  const gridRef = useRef<AgGridReact>(null);
  const gridApiRef = useRef<GridApi | null>(null);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showColumnCheckboxes, setShowColumnCheckboxes] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const columnSelectorRef = useRef<HTMLDivElement>(null);
  const checkboxRowRef = useRef<HTMLDivElement>(null);

  // Initialize visible columns and column order when data changes
  useEffect(() => {
    if (data?.columns) {
      setVisibleColumns(new Set(data.columns));
      setColumnOrder(data.columns);
    }
  }, [data?.columns.join(',')]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const columnDefs = useMemo<ColDef[]>(() => {
    if (!data || columnOrder.length === 0) return [];

    // Use columnOrder to preserve user's drag order
    return columnOrder
      .filter(col => visibleColumns.has(col))
      .map((col) => {
        const colType = data.columnTypes?.[col] ?? '';
        const isDatetime = isDatetimeType(colType);
        const isEpoch = !isDatetime && mightBeEpochColumn(col, colType);

        return {
          field: col,
          headerName: col,
          sortable: true,
          filter: true,
          resizable: true,
          editable: true,
          floatingFilter: true,
          minWidth: 150,
          width: (isDatetime || isEpoch) ? 180 : 200,
          ...(isDatetime && {
            valueFormatter: (params: ValueFormatterParams) =>
              formatDatetime(params.value, colType),
          }),
          ...(isEpoch && {
            valueFormatter: (params: ValueFormatterParams) =>
              formatEpoch(params.value),
          }),
        };
      });
  }, [data, columnOrder, visibleColumns]);

  const defaultColDef = useMemo<ColDef>(() => ({
    minWidth: 150,
    filter: true,
    sortable: true,
    resizable: true,
  }), []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
  }, []);

  // Update column order when columns are dragged (but not on resize)
  const onDragStopped = useCallback(() => {
    if (!gridApiRef.current) return;
    const colState = gridApiRef.current.getColumnState();
    const newOrder = colState
      .filter(col => col.colId && !col.hide)
      .map(col => col.colId as string);

    // Only update if order actually changed (not just a resize)
    setColumnOrder(prev => {
      if (prev.length !== newOrder.length) return newOrder;
      for (let i = 0; i < prev.length; i++) {
        if (prev[i] !== newOrder[i]) return newOrder;
      }
      return prev; // No change, keep same reference
    });
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getDisplayedData: (): QueryResult | null => {
      if (!gridApiRef.current || !data) return null;

      // Use columnOrder to preserve user's drag-and-drop order
      const orderedVisibleColumns = columnOrder.filter(col => visibleColumns.has(col));
      const displayedRows: Record<string, unknown>[] = [];
      gridApiRef.current.forEachNodeAfterFilterAndSort((node) => {
        if (node.data) {
          const filteredRow: Record<string, unknown> = {};
          for (const col of orderedVisibleColumns) {
            filteredRow[col] = node.data[col];
          }
          displayedRows.push(filteredRow);
        }
      });

      return {
        columns: orderedVisibleColumns,
        rows: displayedRows,
        rowCount: displayedRows.length,
      };
    },
    getExportParams: (): ExportParams | null => {
      if (!gridApiRef.current || !data) return null;

      return {
        visibleColumns: columnOrder.filter(col => visibleColumns.has(col)),
        quickFilterText: quickFilterText || undefined,
        filterModel: gridApiRef.current.getFilterModel() || undefined,
      };
    },
    getFilterModel: (): Record<string, unknown> | null => {
      return gridApiRef.current?.getFilterModel() ?? null;
    },
  }), [data, visibleColumns, quickFilterText, columnOrder]);

  // Restore filter model when switching tabs
  useEffect(() => {
    if (gridApiRef.current && initialFilterModel) {
      gridApiRef.current.setFilterModel(initialFilterModel);
    }
  }, [initialFilterModel]);

  // Sync checkbox row scroll with grid scroll
  const onBodyScroll = useCallback(() => {
    if (checkboxRowRef.current && gridApiRef.current) {
      const scrollLeft = gridApiRef.current.getHorizontalPixelRange().left;
      checkboxRowRef.current.scrollLeft = scrollLeft;
    }
  }, []);

  // Sync grid scroll when checkbox row is scrolled
  const onCheckboxRowScroll = useCallback(() => {
    if (checkboxRowRef.current) {
      const scrollLeft = checkboxRowRef.current.scrollLeft;
      const viewport = document.querySelector('.ag-body-horizontal-scroll-viewport') as HTMLElement;
      if (viewport) {
        viewport.scrollLeft = scrollLeft;
      }
    }
  }, []);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    if (onCellChange && event.rowIndex !== null) {
      onCellChange(event.rowIndex, event.colDef.field!, event.oldValue, event.newValue);
    }
  }, [onCellChange]);

  const toggleColumn = (column: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(column)) {
        // Don't allow hiding all columns
        if (next.size > 1) {
          next.delete(column);
        }
      } else {
        next.add(column);
      }
      return next;
    });
  };

  const selectAllColumns = () => {
    if (data?.columns) {
      setVisibleColumns(new Set(data.columns));
    }
  };

  const deselectAllColumns = () => {
    if (data?.columns && data.columns.length > 0) {
      // Keep at least one column visible
      setVisibleColumns(new Set([data.columns[0]]));
    }
  };

  if (!data || data.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
        No data to display. Load a file or run a query.
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col" style={{ height: '100%', minHeight: '400px' }}>
      {/* Column Selector */}
      <div className="relative mb-2 flex items-center gap-2" ref={columnSelectorRef}>
        <button
          onClick={() => setShowColumnSelector(!showColumnSelector)}
          className="px-3 py-1 text-sm bg-gray-100 border rounded hover:bg-gray-200 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          Columns ({visibleColumns.size}/{data.columns.length})
        </button>

        <button
          onClick={() => setShowColumnCheckboxes(!showColumnCheckboxes)}
          className={`px-3 py-1 text-sm border rounded flex items-center gap-2 ${
            showColumnCheckboxes
              ? 'bg-blue-100 border-blue-300 text-blue-700'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          title="Toggle column checkboxes above headers"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Edit Columns
        </button>

        {showColumnSelector && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-hidden flex flex-col">
            <div className="p-2 border-b flex gap-2">
              <button
                onClick={selectAllColumns}
                className="text-xs text-blue-600 hover:underline"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={deselectAllColumns}
                className="text-xs text-blue-600 hover:underline"
              >
                Deselect All
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {data.columns.map(col => (
                <label
                  key={col}
                  className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col)}
                    onChange={() => toggleColumn(col)}
                    className="rounded"
                  />
                  <span className="text-sm truncate" title={col}>{col}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inline Column Checkboxes Row */}
      {showColumnCheckboxes && (
        <div
          ref={checkboxRowRef}
          onScroll={onCheckboxRowScroll}
          className="flex border-b bg-gray-50 mb-1 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {columnOrder
            .filter(col => visibleColumns.has(col))
            .map(col => (
              <div
                key={col}
                className="flex-shrink-0 flex items-center justify-center px-2 py-1"
                style={{ minWidth: 150, width: 200 }}
              >
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col)}
                    onChange={() => toggleColumn(col)}
                    className="rounded"
                  />
                  <span className="text-xs text-gray-500 truncate" title={`Hide ${col}`}>
                    {col}
                  </span>
                </label>
              </div>
            ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1">
        <AgGridReact
          ref={gridRef}
          theme={customTheme}
          rowData={data.rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChanged}
          onBodyScroll={onBodyScroll}
          onDragStopped={onDragStopped}
          quickFilterText={quickFilterText}
          pagination={true}
          paginationPageSize={100}
          paginationPageSizeSelector={[50, 100, 500, 1000]}
          enableCellTextSelection={true}
          animateRows={true}
          suppressMenuHide={true}
          maintainColumnOrder={true}
        />
      </div>
    </div>
  );
});
