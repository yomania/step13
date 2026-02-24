import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                createdAt: true,
                lastLoginAt: true
            }
        });

        if (users.length === 0) {
            console.log('No users found.');
            return;
        }

        for (const user of users) {
            console.log([
                user.id,
                user.email,
                `createdAt=${user.createdAt.toISOString()}`,
                `lastLoginAt=${user.lastLoginAt ? user.lastLoginAt.toISOString() : 'null'}`
            ].join(' | '));
        }
    } finally {
        await prisma.$disconnect();
    }
}

void main();
