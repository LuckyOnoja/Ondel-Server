"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditService = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
class CreditService {
    static async getBalance(userId) {
        let account = await prisma_1.prisma.creditAccount.findUnique({
            where: { userId },
        });
        if (!account) {
            account = await prisma_1.prisma.creditAccount.create({
                data: { userId, balance: 500 },
            });
        }
        return account.balance;
    }
    static async addCredits(userId, amount, referenceId, metadata) {
        if (amount <= 0)
            throw new Error('Credit amount must be positive');
        return prisma_1.prisma.$transaction(async (tx) => {
            let account = await tx.creditAccount.findUnique({ where: { userId } });
            if (!account) {
                account = await tx.creditAccount.create({ data: { userId, balance: 0 } });
            }
            const updatedAccount = await tx.creditAccount.update({
                where: { id: account.id },
                data: { balance: { increment: amount } },
            });
            const transaction = await tx.creditTransaction.create({
                data: {
                    accountId: account.id,
                    type: client_1.CreditTransactionType.PURCHASE,
                    amount,
                    referenceType: 'PAYMENT',
                    referenceId,
                    metadata,
                },
            });
            return { balance: updatedAccount.balance, transaction };
        });
    }
    static async reserveCredits(userId, amount, referenceId) {
        if (amount <= 0)
            throw new Error('Reserve amount must be positive');
        return prisma_1.prisma.$transaction(async (tx) => {
            const account = await tx.creditAccount.findUnique({ where: { userId } });
            if (!account || account.balance < amount) {
                throw new Error('Insufficient credit balance');
            }
            const updatedAccount = await tx.creditAccount.update({
                where: { id: account.id },
                data: { balance: { decrement: amount } },
            });
            const transaction = await tx.creditTransaction.create({
                data: {
                    accountId: account.id,
                    type: client_1.CreditTransactionType.RESERVE,
                    amount: -amount,
                    referenceType: 'CAMPAIGN_RESERVATION',
                    referenceId,
                },
            });
            return { balance: updatedAccount.balance, transaction };
        });
    }
}
exports.CreditService = CreditService;
