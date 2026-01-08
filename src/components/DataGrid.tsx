import { useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import type { ColDef, GridApi, GridReadyEvent, CellValueChangedEvent } from 'ag-grid-community';
import type { QueryResult } from '../types';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Custom theme
const customTheme = themeQuartz;

interface DataGridProps {
  data: QueryResult | null;
  onCellChange?: (rowIndex: number, field: string, oldValue: unknown, newValue: unknown) => void;
  quickFilterText?: string;
}

export function DataGrid({ data, onCellChange, quickFilterText }: DataGridProps) {
  const gridRef = useRef<AgGridReact>(null);
  const gridApiRef = useRef<GridApi | null>(null);

  const columnDefs = useMemo<ColDef[]>(() => {
    if (!data || data.columns.length === 0) return [];

    return data.columns.map((col) => ({
      field: col,
      headerName: col,
      sortable: true,
      filter: true,
      resizable: true,
      editable: true,
      floatingFilter: true,
      minWidth: 150,
      width: 200,
    }));
  }, [data?.columns]);

  const defaultColDef = useMemo<ColDef>(() => ({
    minWidth: 150,
    filter: true,
    sortable: true,
    resizable: true,
  }), []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
  }, []);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    if (onCellChange && event.rowIndex !== null) {
      onCellChange(event.rowIndex, event.colDef.field!, event.oldValue, event.newValue);
    }
  }, [onCellChange]);

  if (!data || data.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
        No data to display. Load a file or run a query.
      </div>
    );
  }

  return (
    <div className="w-full flex-1" style={{ height: '100%', minHeight: '400px' }}>
      <AgGridReact
        ref={gridRef}
        theme={customTheme}
        rowData={data.rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        onCellValueChanged={onCellValueChanged}
        quickFilterText={quickFilterText}
        pagination={true}
        paginationPageSize={100}
        paginationPageSizeSelector={[50, 100, 500, 1000]}
        enableCellTextSelection={true}
        animateRows={true}
        suppressMenuHide={true}
      />
    </div>
  );
}
