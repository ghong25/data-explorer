import { useState, useEffect, useCallback, useRef } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdb_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import type { QueryResult, ColumnInfo, LoadedFile, FileFormat, JoinConfig } from '../types';
import * as XLSX from 'xlsx';

function detectFormat(filename: string): FileFormat {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'csv': return 'csv';
    case 'tsv': return 'tsv';
    case 'parquet': return 'parquet';
    case 'xlsx': return 'xlsx';
    case 'xls': return 'xls';
    case 'json': return 'json';
    default: return 'csv';
  }
}

function sanitizeTableName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return base.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
}

export function useDuckDB() {
  const [db, setDb] = useState<duckdb.AsyncDuckDB | null>(null);
  const [conn, setConn] = useState<duckdb.AsyncDuckDBConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const initPromise = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (initPromise.current) return;

    initPromise.current = (async () => {
      try {
        const worker = new Worker(duckdb_worker);
        const logger = new duckdb.ConsoleLogger();
        const database = new duckdb.AsyncDuckDB(logger, worker);
        await database.instantiate(duckdb_wasm);
        const connection = await database.connect();
        setDb(database);
        setConn(connection);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize DuckDB');
        setIsLoading(false);
      }
    })();
  }, []);

  const executeQuery = useCallback(async (sql: string): Promise<QueryResult> => {
    if (!conn) throw new Error('Database not initialized');

    const result = await conn.query(sql);
    const columns = result.schema.fields.map(f => f.name);
    const rows: Record<string, unknown>[] = [];

    for (let i = 0; i < result.numRows; i++) {
      const row: Record<string, unknown> = {};
      for (const col of columns) {
        const value = result.getChild(col)?.get(i);
        row[col] = value;
      }
      rows.push(row);
    }

    return { columns, rows, rowCount: result.numRows };
  }, [conn]);

  const loadFile = useCallback(async (file: File): Promise<LoadedFile> => {
    if (!db || !conn) throw new Error('Database not initialized');

    const format = detectFormat(file.name);
    const tableName = sanitizeTableName(file.name);

    // Drop table if exists
    await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);

    if (format === 'xlsx' || format === 'xls') {
      // Handle Excel files via SheetJS
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const csvData = XLSX.utils.sheet_to_csv(firstSheet);

      // Register CSV data as a file
      await db.registerFileText(`${tableName}.csv`, csvData);
      await conn.query(`CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${tableName}.csv')`);
    } else if (format === 'csv' || format === 'tsv') {
      const text = await file.text();
      await db.registerFileText(file.name, text);
      const delimiter = format === 'tsv' ? '\t' : ',';
      await conn.query(`CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${file.name}', delim='${delimiter}')`);
    } else if (format === 'parquet') {
      const buffer = await file.arrayBuffer();
      await db.registerFileBuffer(file.name, new Uint8Array(buffer));
      await conn.query(`CREATE TABLE "${tableName}" AS SELECT * FROM read_parquet('${file.name}')`);
    } else if (format === 'json') {
      const text = await file.text();
      await db.registerFileText(file.name, text);
      await conn.query(`CREATE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${file.name}')`);
    }

    // Get table info
    const schemaResult = await conn.query(`DESCRIBE "${tableName}"`);
    const columns: ColumnInfo[] = [];
    for (let i = 0; i < schemaResult.numRows; i++) {
      columns.push({
        name: schemaResult.getChild('column_name')?.get(i) as string,
        type: schemaResult.getChild('column_type')?.get(i) as string,
      });
    }

    const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
    const rowCount = Number(countResult.getChild('cnt')?.get(0) ?? 0);

    const loadedFile: LoadedFile = {
      name: file.name,
      tableName,
      format,
      columns,
      rowCount,
    };

    setLoadedFiles(prev => [...prev.filter(f => f.tableName !== tableName), loadedFile]);

    return loadedFile;
  }, [db, conn]);

  // Load file from text/buffer content (for restoring from IndexedDB)
  const loadFileFromContent = useCallback(async (
    content: string,
    filename: string,
    format: FileFormat
  ): Promise<LoadedFile> => {
    if (!db || !conn) throw new Error('Database not initialized');

    const tableName = sanitizeTableName(filename);

    // Drop table if exists
    await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);

    if (format === 'xlsx' || format === 'xls') {
      // Handle Excel files - content is base64 encoded
      const binary = atob(content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const workbook = XLSX.read(bytes, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const csvData = XLSX.utils.sheet_to_csv(firstSheet);
      await db.registerFileText(`${tableName}.csv`, csvData);
      await conn.query(`CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${tableName}.csv')`);
    } else if (format === 'csv' || format === 'tsv') {
      await db.registerFileText(filename, content);
      const delimiter = format === 'tsv' ? '\t' : ',';
      await conn.query(`CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${filename}', delim='${delimiter}')`);
    } else if (format === 'parquet') {
      // Content is base64 encoded
      const binary = atob(content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      await db.registerFileBuffer(filename, bytes);
      await conn.query(`CREATE TABLE "${tableName}" AS SELECT * FROM read_parquet('${filename}')`);
    } else if (format === 'json') {
      await db.registerFileText(filename, content);
      await conn.query(`CREATE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${filename}')`);
    }

    // Get table info
    const schemaResult = await conn.query(`DESCRIBE "${tableName}"`);
    const columns: ColumnInfo[] = [];
    for (let i = 0; i < schemaResult.numRows; i++) {
      columns.push({
        name: schemaResult.getChild('column_name')?.get(i) as string,
        type: schemaResult.getChild('column_type')?.get(i) as string,
      });
    }

    const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
    const rowCount = Number(countResult.getChild('cnt')?.get(0) ?? 0);

    const loadedFile: LoadedFile = {
      name: filename,
      tableName,
      format,
      columns,
      rowCount,
    };

    setLoadedFiles(prev => [...prev.filter(f => f.tableName !== tableName), loadedFile]);

    return loadedFile;
  }, [db, conn]);

  // Create a joined table from two tables
  const createJoinedTable = useCallback(async (
    config: JoinConfig,
    newTableName: string
  ): Promise<LoadedFile> => {
    if (!conn) throw new Error('Database not initialized');

    const sanitizedName = sanitizeTableName(newTableName);

    // Build column selection with aliases for duplicates
    const columnSelections: string[] = [];
    for (const col of config.selectedColumns) {
      const tableAlias = col.table === 'left' ? 't1' : 't2';
      const colName = `${tableAlias}."${col.column}"`;
      if (col.alias) {
        columnSelections.push(`${colName} AS "${col.alias}"`);
      } else {
        columnSelections.push(colName);
      }
    }

    // Build join conditions
    const conditions = config.joinConditions.map(cond =>
      `t1."${cond.leftColumn}" ${cond.operator} t2."${cond.rightColumn}"`
    ).join(' AND ');

    // Map join type to SQL
    const joinTypeSQL = config.joinType === 'FULL OUTER' ? 'FULL OUTER JOIN' : `${config.joinType} JOIN`;

    // Build and execute the CREATE TABLE query
    const sql = `
      CREATE TABLE "${sanitizedName}" AS
      SELECT ${columnSelections.join(', ')}
      FROM "${config.leftTable.tableName}" t1
      ${joinTypeSQL} "${config.rightTable.tableName}" t2
      ON ${conditions}
    `;

    await conn.query(`DROP TABLE IF EXISTS "${sanitizedName}"`);
    await conn.query(sql);

    // Get table info
    const schemaResult = await conn.query(`DESCRIBE "${sanitizedName}"`);
    const columns: ColumnInfo[] = [];
    for (let i = 0; i < schemaResult.numRows; i++) {
      columns.push({
        name: schemaResult.getChild('column_name')?.get(i) as string,
        type: schemaResult.getChild('column_type')?.get(i) as string,
      });
    }

    const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM "${sanitizedName}"`);
    const rowCount = Number(countResult.getChild('cnt')?.get(0) ?? 0);

    const loadedFile: LoadedFile = {
      name: `${newTableName}.joined`,
      tableName: sanitizedName,
      format: 'csv', // Joined tables are virtual
      columns,
      rowCount,
    };

    setLoadedFiles(prev => [...prev.filter(f => f.tableName !== sanitizedName), loadedFile]);

    return loadedFile;
  }, [conn]);

  const exportData = useCallback(async (
    sql: string,
    format: FileFormat,
    _filename: string
  ): Promise<Blob> => {
    if (!conn || !db) throw new Error('Database not initialized');

    const tempTable = `_export_${Date.now()}`;
    await conn.query(`CREATE TEMP TABLE ${tempTable} AS ${sql}`);

    let blob: Blob;

    if (format === 'csv' || format === 'tsv') {
      const delimiter = format === 'tsv' ? '\t' : ',';
      const exportFile = `${tempTable}.${format}`;
      await conn.query(`COPY ${tempTable} TO '${exportFile}' (DELIMITER '${delimiter}', HEADER)`);
      const buffer = await db.copyFileToBuffer(exportFile);
      blob = new Blob([new Uint8Array(buffer).buffer as ArrayBuffer], { type: 'text/plain' });
    } else if (format === 'parquet') {
      const exportFile = `${tempTable}.parquet`;
      await conn.query(`COPY ${tempTable} TO '${exportFile}' (FORMAT PARQUET)`);
      const buffer = await db.copyFileToBuffer(exportFile);
      blob = new Blob([new Uint8Array(buffer).buffer as ArrayBuffer], { type: 'application/octet-stream' });
    } else if (format === 'json') {
      const result = await executeQuery(`SELECT * FROM ${tempTable}`);
      blob = new Blob([JSON.stringify(result.rows, null, 2)], { type: 'application/json' });
    } else if (format === 'xlsx' || format === 'xls') {
      const result = await executeQuery(`SELECT * FROM ${tempTable}`);
      const ws = XLSX.utils.json_to_sheet(result.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      const buffer = XLSX.write(wb, { bookType: format === 'xlsx' ? 'xlsx' : 'xls', type: 'array' });
      blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    await conn.query(`DROP TABLE ${tempTable}`);

    return blob;
  }, [conn, db, executeQuery]);

  // Export data directly from a QueryResult (for filtered/visible data export)
  const exportFromData = useCallback(async (
    data: { columns: string[]; rows: Record<string, unknown>[] },
    format: FileFormat,
  ): Promise<Blob> => {
    if (format === 'json') {
      return new Blob([JSON.stringify(data.rows, null, 2)], { type: 'application/json' });
    }

    if (format === 'xlsx' || format === 'xls') {
      const ws = XLSX.utils.json_to_sheet(data.rows, { header: data.columns });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      const buffer = XLSX.write(wb, { bookType: format === 'xlsx' ? 'xlsx' : 'xls', type: 'array' });
      return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    if (format === 'csv' || format === 'tsv') {
      const delimiter = format === 'tsv' ? '\t' : ',';
      const escapeField = (val: unknown): string => {
        const str = val === null || val === undefined ? '' : String(val);
        if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      const header = data.columns.map(escapeField).join(delimiter);
      const rows = data.rows.map(row =>
        data.columns.map(col => escapeField(row[col])).join(delimiter)
      );
      const content = [header, ...rows].join('\n');
      return new Blob([content], { type: 'text/plain' });
    }

    if (format === 'parquet') {
      // For parquet, we need to use DuckDB - create temp table from data
      if (!conn) throw new Error('Database not initialized');
      const tempTable = `_export_${Date.now()}`;

      // Create table with columns
      const colDefs = data.columns.map(col => `"${col}" VARCHAR`).join(', ');
      await conn.query(`CREATE TEMP TABLE ${tempTable} (${colDefs})`);

      // Insert data
      for (const row of data.rows) {
        const values = data.columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          return `'${String(val).replace(/'/g, "''")}'`;
        }).join(', ');
        await conn.query(`INSERT INTO ${tempTable} VALUES (${values})`);
      }

      const exportFile = `${tempTable}.parquet`;
      await conn.query(`COPY ${tempTable} TO '${exportFile}' (FORMAT PARQUET)`);
      const buffer = await db!.copyFileToBuffer(exportFile);
      await conn.query(`DROP TABLE ${tempTable}`);

      return new Blob([new Uint8Array(buffer).buffer as ArrayBuffer], { type: 'application/octet-stream' });
    }

    throw new Error(`Unsupported export format: ${format}`);
  }, [conn, db]);

  // Export with filters - builds SQL query from export params
  const exportWithFilters = useCallback(async (
    tableName: string,
    visibleColumns: string[],
    format: FileFormat,
    quickFilterText?: string,
    filterModel?: Record<string, unknown>,
  ): Promise<Blob> => {
    if (!conn || !db) throw new Error('Database not initialized');

    // Build column selection
    const columns = visibleColumns.map(col => `"${col}"`).join(', ');

    // Build WHERE clause from filters
    const whereClauses: string[] = [];

    // Quick filter - search across all visible columns
    if (quickFilterText && quickFilterText.trim()) {
      const searchTerm = quickFilterText.trim().replace(/'/g, "''");
      const orClauses = visibleColumns.map(col =>
        `CAST("${col}" AS VARCHAR) ILIKE '%${searchTerm}%'`
      );
      whereClauses.push(`(${orClauses.join(' OR ')})`);
    }

    // Column filters from AG Grid filter model
    if (filterModel && Object.keys(filterModel).length > 0) {
      for (const [column, filter] of Object.entries(filterModel)) {
        const f = filter as { type?: string; filter?: string | number; filterTo?: number; filterType?: string };
        if (f.filterType === 'text' && f.filter) {
          const value = String(f.filter).replace(/'/g, "''");
          switch (f.type) {
            case 'contains':
              whereClauses.push(`CAST("${column}" AS VARCHAR) ILIKE '%${value}%'`);
              break;
            case 'notContains':
              whereClauses.push(`CAST("${column}" AS VARCHAR) NOT ILIKE '%${value}%'`);
              break;
            case 'equals':
              whereClauses.push(`CAST("${column}" AS VARCHAR) = '${value}'`);
              break;
            case 'notEqual':
              whereClauses.push(`CAST("${column}" AS VARCHAR) != '${value}'`);
              break;
            case 'startsWith':
              whereClauses.push(`CAST("${column}" AS VARCHAR) ILIKE '${value}%'`);
              break;
            case 'endsWith':
              whereClauses.push(`CAST("${column}" AS VARCHAR) ILIKE '%${value}'`);
              break;
            default:
              whereClauses.push(`CAST("${column}" AS VARCHAR) ILIKE '%${value}%'`);
          }
        } else if (f.filterType === 'number' && f.filter !== undefined) {
          switch (f.type) {
            case 'equals':
              whereClauses.push(`"${column}" = ${f.filter}`);
              break;
            case 'notEqual':
              whereClauses.push(`"${column}" != ${f.filter}`);
              break;
            case 'greaterThan':
              whereClauses.push(`"${column}" > ${f.filter}`);
              break;
            case 'greaterThanOrEqual':
              whereClauses.push(`"${column}" >= ${f.filter}`);
              break;
            case 'lessThan':
              whereClauses.push(`"${column}" < ${f.filter}`);
              break;
            case 'lessThanOrEqual':
              whereClauses.push(`"${column}" <= ${f.filter}`);
              break;
            case 'inRange':
              if (f.filterTo !== undefined) {
                whereClauses.push(`"${column}" BETWEEN ${f.filter} AND ${f.filterTo}`);
              }
              break;
          }
        }
      }
    }

    // Build final query
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `SELECT ${columns} FROM "${tableName}" ${whereClause}`;

    // Use existing exportData function with the built query
    return exportData(sql, format, '');
  }, [conn, db, exportData]);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return {
    isLoading,
    error,
    loadedFiles,
    executeQuery,
    loadFile,
    loadFileFromContent,
    createJoinedTable,
    exportData,
    exportFromData,
    exportWithFilters,
    downloadBlob,
  };
}
