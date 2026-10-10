export function inferType(
  value: unknown,
): 'Int64' | 'String' | 'Float64' | 'Bool' | 'DateTime' | `Array(${string})` {
  const numberTypeMap = new Map<
    'INT_SAFE' | 'INT_UNSAFE' | 'FLOAT',
    'Int64' | 'Float64'
  >([
    ['INT_SAFE', 'Int64'],
    ['INT_UNSAFE', 'Float64'],
    ['FLOAT', 'Float64'],
  ]);

  if (typeof value === 'bigint') {
    return 'Int64';
  }

  if (typeof value === 'string') {
    return 'String';
  }

  if (typeof value === 'boolean') {
    return 'Bool';
  }

  if (value instanceof Date) {
    return 'DateTime';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new Error('Cannot infer ClickHouse type from empty array');
    }
    return `Array(${this.inferType(value[0])})`;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Invalid number (NaN or Infinity)');
    }

    const kind = Number.isInteger(value)
      ? Number.isSafeInteger(value)
        ? 'INT_SAFE'
        : 'INT_UNSAFE'
      : 'FLOAT';

    const chType = numberTypeMap.get(kind);
    if (!chType) {
      throw new Error(`Unsupported number kind: ${kind}`);
    }

    return chType;
  }

  throw new Error(`Unsupported value type: ${typeof value}`);
}
