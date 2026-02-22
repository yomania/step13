import { createHmac, timingSafeEqual } from 'node:crypto';

type JwtHeader = {
    alg: 'HS256';
    typ: 'JWT';
};

export type TokenType = 'access' | 'refresh';

export type AuthJwtPayload = {
    sub: string;
    type: TokenType;
    jti: string;
    iat: number;
    exp: number;
};

export function signJwt(payload: Omit<AuthJwtPayload, 'iat' | 'exp'>, secret: string, expiresInSec: number): string {
    const now = Math.floor(Date.now() / 1000);
    const body: AuthJwtPayload = {
        ...payload,
        iat: now,
        exp: now + expiresInSec
    };

    const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = encodeBase64Url(JSON.stringify(header));
    const encodedPayload = encodeBase64Url(JSON.stringify(body));
    const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(token: string, secret: string, expectedType: TokenType): AuthJwtPayload | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
        return null;
    }

    const [headerPart, payloadPart, signaturePart] = parts;
    const expectedSignature = sign(`${headerPart}.${payloadPart}`, secret);

    const providedBuffer = Buffer.from(signaturePart);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (providedBuffer.length !== expectedBuffer.length) {
        return null;
    }
    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
        return null;
    }

    let payload: AuthJwtPayload;
    try {
        const decoded = decodeBase64Url(payloadPart);
        payload = JSON.parse(decoded) as AuthJwtPayload;
    } catch {
        return null;
    }

    if (typeof payload.sub !== 'string' || typeof payload.type !== 'string' || typeof payload.jti !== 'string') {
        return null;
    }
    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
        return null;
    }
    if (payload.type !== expectedType) {
        return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
        return null;
    }

    return payload;
}

function sign(data: string, secret: string): string {
    const digest = createHmac('sha256', secret).update(data).digest();
    return encodeBase64Url(digest);
}

function encodeBase64Url(input: string | Buffer): string {
    const source = typeof input === 'string' ? Buffer.from(input) : input;
    return source
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function decodeBase64Url(input: string): string {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    return Buffer.from(padded, 'base64').toString('utf8');
}
