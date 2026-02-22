import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_KEY_LENGTH = 64;

export function hashPassword(plainPassword: string): string {
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(plainPassword, salt, SCRYPT_KEY_LENGTH).toString('hex');
    return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(plainPassword: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
        return false;
    }

    const salt = parts[1];
    const digestHex = parts[2];
    const expected = Buffer.from(digestHex, 'hex');
    const actual = scryptSync(plainPassword, salt, expected.length);

    if (expected.length !== actual.length) {
        return false;
    }

    return timingSafeEqual(expected, actual);
}
