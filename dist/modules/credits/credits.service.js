"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditsService = exports.CreditsService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class CreditsService {
    async getOrCreateCreditAccount(userIdOrEmail) {
        const identifier = userIdOrEmail.toLowerCase().trim();
        // Resolve user first
        let user = await prisma.user.findFirst({
            where: {
                OR: [{ id: identifier }, { email: identifier }],
            },
        });
        if (!user) {
            // Fallback user
            user = await prisma.user.findFirst({
                orderBy: { createdAt: 'desc' },
            });
        }
        if (!user) {
            throw new Error('User not found');
        }
        let account = await prisma.creditAccount.findUnique({
            where: { userId: user.id },
        });
        if (!account) {
            account = await prisma.creditAccount.create({
                data: {
                    userId: user.id,
                    balance: 500,
                },
            });
        }
        return { id: account.id, balance: account.balance };
    }
    async deductCredit(userIdOrEmail, amount, description) {
        try {
            const account = await this.getOrCreateCreditAccount(userIdOrEmail);
            if (account.balance < amount) {
                return false; // Insufficient balance
            }
            await prisma.creditAccount.update({
                where: { id: account.id },
                data: {
                    balance: { decrement: amount },
                },
            });
            // Log transaction
            await prisma.creditTransaction.create({
                data: {
                    accountId: account.id,
                    type: client_1.CreditTransactionType.CONSUME,
                    amount,
                    referenceType: 'AI_PROMPT',
                    metadata: { description },
                },
            });
            return true;
        }
        catch (error) {
            console.error('[deductCredit error]:', error);
            return false;
        }
    }
    async addCredit(userIdOrEmail, amount, description) {
        const account = await this.getOrCreateCreditAccount(userIdOrEmail);
        await prisma.creditAccount.update({
            where: { id: account.id },
            data: {
                balance: { increment: amount },
            },
        });
        await prisma.creditTransaction.create({
            data: {
                accountId: account.id,
                type: client_1.CreditTransactionType.PURCHASE,
                amount,
                referenceType: 'TOPUP',
                metadata: { description },
            },
        });
    }
}
exports.CreditsService = CreditsService;
exports.creditsService = new CreditsService();
