export const compareValues = (
  conditionValue: string | number | boolean,
  value: string | number | boolean,
  operator: string,
) => {
  switch (operator) {
    case '>':
      return conditionValue > value;
    case '<':
      return conditionValue < value;
    case '>=':
      return conditionValue >= value;
    case '<=':
      return conditionValue <= value;
    case '=':
      return conditionValue === value;
    case '!=':
      return conditionValue !== value;
    default:
      return false;
  }
};

export const checkExpr = (expr: any, valueDevice: any) => {
  const property = expr[0];
  const operator = expr[1];
  const value = expr[2];
  const curValueWithProperty = valueDevice[property];

  // Check if both values are strings
  if (typeof value === 'string' && typeof curValueWithProperty === 'string') {
    return compareValues(value, curValueWithProperty, operator);
  } else if (
    typeof value === 'boolean' &&
    typeof curValueWithProperty === 'boolean'
  ) {
    return compareValues(value, curValueWithProperty, operator);
  }
  const numValue = Number(value);
  const numCurValueWithProperty = Number(curValueWithProperty);
  // Check if both values are valid numbers
  if (isNaN(numValue) || isNaN(numCurValueWithProperty)) {
    return false;
  }
  return compareValues(numValue, numCurValueWithProperty, operator);
};
