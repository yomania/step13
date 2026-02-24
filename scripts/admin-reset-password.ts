import { PrismaClient } from '@prisma/client';
import { AuthService, PrismaAuthStore } from '../apps/server/src/auth';

async function main() {
    const args = process.argv.slice(2);
    const emailArg = args.find(arg => !arg.startsWith('-')) ?? '';

    if (!emailArg) {
        console.error('Usage: pnpm --filter server exec tsx ../../scripts/admin-reset-password.ts <email>');
        process.exit(1);
    }

    const prisma = new PrismaClient();
    const authStore = new PrismaAuthStore(prisma);
    const jwtSecret = process.env.JWT_SECRET?.trim() || 'dev-insecure-jwt-secret-change-me';
    const authService = new AuthService({
        store: authStore,
        jwtSecret,
        accessTokenTtlSec: 15 * 60,
        refreshTokenTtlSec: 30 * 24 * 60 * 60,
        wsTicketTtlSec: 30
    });

    try {
        const result = await authService.adminResetPassword({ email: emailArg });
        if (result.temporaryPassword) {
            console.log(`Temporary password for ${result.email}: ${result.temporaryPassword}`);
        } else {
            console.log(`Password reset for ${result.email} (no temporary password returned).`);
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error(`Failed to reset password: ${error.message}`);
        } else {
            console.error('Failed to reset password.');
        }
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

void main();
