/**
 * DuckDB datetime type patterns
 */
const DATETIME_TYPES = [
  'TIMESTAMP',
  'TIMESTAMP WITH TIME ZONE',
  'TIMESTAMPTZ',
  'DATE',
  'TIME',
  'TIME WITH TIME ZONE',
  'TIMETZ',
  'DATETIME',
];

/**
 * Column name patterns that suggest epoch timestamps
 */
const EPOCH_COLUMN_PATTERNS = [
  /created[_-]?at/i,
  /updated[_-]?at/i,
  /deleted[_-]?at/i,
  /modified[_-]?at/i,
  /[_-]at$/i,
  /timestamp/i,
  /[_-]time$/i,
  /[_-]date$/i,
  /epoch/i,
  /created[_-]?on/i,
  /updated[_-]?on/i,
];

/**
 * Check if a DuckDB column type is a datetime type
 */
export function isDatetimeType(columnType: string): boolean {
  const normalized = columnType.toUpperCase().trim();
  return DATETIME_TYPES.some(dt => normalized.includes(dt));
}

/**
 * Check if a column might contain epoch timestamps based on name and type
 */
export function mightBeEpochColumn(columnName: string, columnType: string): boolean {
  const normalizedType = columnType.toUpperCase();
  // Only consider integer types
  if (!normalizedType.includes('INT') && !normalizedType.includes('BIGINT')) {
    return false;
  }
  // Check if column name matches epoch patterns
  return EPOCH_COLUMN_PATTERNS.some(pattern => pattern.test(columnName));
}

/**
 * Check if a value looks like a valid epoch timestamp
 * Returns 'ms' for milliseconds, 's' for seconds, or null if not an epoch
 */
export function detectEpochFormat(value: unknown): 'ms' | 's' | null {
  if (typeof value !== 'number' && typeof value !== 'bigint') {
    return null;
  }

  const num = typeof value === 'bigint' ? Number(value) : value;

  // Epoch seconds range: 1990 to 2050
  // 631152000 (1990-01-01) to 2524608000 (2050-01-01)
  if (num >= 631152000 && num <= 2524608000) {
    return 's';
  }

  // Epoch milliseconds range: 1990 to 2050
  // 631152000000 to 2524608000000
  if (num >= 631152000000 && num <= 2524608000000) {
    return 'ms';
  }

  return null;
}

/**
 * Format a datetime value from DuckDB
 * Handles: epoch integers (ms or microseconds), BigInt, Date objects, ISO strings
 */
export function formatDatetime(
  value: unknown,
  columnType: string,
  locale: string = 'en-US'
): string {
  if (value === null || value === undefined) {
    return '';
  }

  const normalizedType = columnType.toUpperCase();
  let date: Date;

  // Handle BigInt (DuckDB WASM often returns BigInt for timestamps)
  if (typeof value === 'bigint') {
    // DuckDB TIMESTAMP is microseconds since epoch
    const ms = Number(value / 1000n);
    date = new Date(ms);
  } else if (typeof value === 'number') {
    // Check if microseconds (> year 3000 in ms) or milliseconds
    if (Math.abs(value) > 32503680000000) {
      // Likely microseconds
      date = new Date(value / 1000);
    } else {
      date = new Date(value);
    }
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else {
    return String(value);
  }

  // Validate date
  if (isNaN(date.getTime())) {
    return String(value);
  }

  // Format based on type
  if (normalizedType.includes('DATE') && !normalizedType.includes('TIME') && !normalizedType.includes('TIMESTAMP')) {
    // DATE only - no time component
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  if (normalizedType.includes('TIME') && !normalizedType.includes('DATE') && !normalizedType.includes('TIMESTAMP')) {
    // TIME only - no date component
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  // TIMESTAMP or DATETIME - full date and time
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format an epoch integer value to a readable datetime string
 */
export function formatEpoch(value: unknown, locale: string = 'en-US'): string {
  if (value === null || value === undefined) {
    return '';
  }

  const epochFormat = detectEpochFormat(value);
  if (!epochFormat) {
    return String(value);
  }

  const num = typeof value === 'bigint' ? Number(value) : (value as number);
  const ms = epochFormat === 's' ? num * 1000 : num;
  const date = new Date(ms);

  if (isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
