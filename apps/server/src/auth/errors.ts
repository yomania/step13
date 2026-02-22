export class AuthError extends Error {
    public readonly code: string;
    public readonly statusCode: number;

    constructor(code: string, message: string, statusCode: number) {
        super(message);
        this.name = 'AuthError';
        this.code = code;
        this.statusCode = statusCode;
    }
}
