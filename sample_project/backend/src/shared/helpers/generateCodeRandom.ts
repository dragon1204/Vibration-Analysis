import { Logger } from '@nestjs/common';

import * as crypto from 'crypto';

export function generateCodeRandom(
  type: 'number' | 'alphabet' | 'alphanumeric',
  length: number,
): string {
  let characters: string;

  switch (type) {
    case 'number':
      characters = '0123456789';
      break;
    case 'alphabet':
      characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      break;
    case 'alphanumeric':
      characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      break;
    default:
      throw new Error('Invalid type specified');
  }

  return Array.from({ length }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length)),
  ).join('');
}

export function generateDataQRCode(data: {
  qrCode: string;
  userId: number;
  expireAt?: number;
  times?: number;
}) {
  const encryptedData = encryptData(
    data,
    process.env.ALGORITHM,
    process.env.AES_KEY,
    process.env.AES_IV,
  );
  return encryptedData;
}

export function decryptDataQRCode(encryptedData: string) {
  const decryptedData = decryptData(
    encryptedData,
    process.env.ALGORITHM,
    process.env.AES_KEY,
    process.env.AES_IV,
  );
  return decryptedData;
}

export function encryptData(
  data: object,
  algorithm: string,
  key: string,
  iv: string,
): string {
  try {
    const cipher = crypto.createCipheriv(
      algorithm,
      Buffer.from(key, 'hex'),
      Buffer.from(iv, 'hex'),
    );
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    Logger.error(error);
  }
}

export function decryptData(
  encryptedData: string,
  algorithm: string,
  key: string,
  iv: string,
): object {
  if (!encryptedData || !algorithm || !key || !iv) {
    throw new Error(
      'Invalid input: encryptedData, algorithm, key, and iv are required',
    );
  }
  if (key.length !== 64 || iv.length !== 32) {
    throw new Error(
      'Invalid key or IV length: Ensure key is 256-bit and IV is 128-bit',
    );
  }
  try {
    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(key, 'hex'),
      Buffer.from(iv, 'hex'),
    );
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    try {
      return JSON.parse(decrypted);
    } catch (jsonError) {
      throw new Error(
        'Decryption succeeded, but JSON parsing failed: ' + jsonError.message,
      );
    }
  } catch (error) {
    Logger.error(error);
  }
}
