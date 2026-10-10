export function toBoolean(value: any): boolean | undefined {
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return value;
}