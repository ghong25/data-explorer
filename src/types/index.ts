export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
}

export type FileFormat = 'csv' | 'tsv' | 'parquet' | 'xlsx' | 'xls' | 'json';

export interface LoadedFile {
  name: string;
  tableName: string;
  format: FileFormat;
  columns: ColumnInfo[];
  rowCount: number;
}

export interface ExportOptions {
  format: FileFormat;
  filename: string;
}
