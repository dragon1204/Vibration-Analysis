import * as crypto from 'crypto';

export function formatObject(obj: any) {
  //sort all keys in object
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
}

export function hashObject(obj: any): string {
  const jsonString = JSON.stringify(obj);
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}
