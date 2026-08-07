import { prisma } from '../../config/prisma';
import { CreditTransactionType } from '@prisma/client';

export class CreditService {
  static async getBalance(userId: string): Promise<number> {
    let account = await prisma.creditAccount.findUnique({
      where: { userId },
    });
    if (!account) {
      account = await prisma.creditAccount.create({
        data: { userId, balance: 500 },
      });
    }
    return account.balance;
  }

  static async addCredits(userId: string, amount: number, referenceId?: string, metadata?: any) {
    if (amount <= 0) throw new Error('Credit amount must be positive');

    return prisma.$transaction(async (tx) => {
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
          type: CreditTransactionType.PURCHASE,
          amount,
          referenceType: 'PAYMENT',
          referenceId,
          metadata,
        },
      });

      return { balance: updatedAccount.balance, transaction };
    });
  }

  static async reserveCredits(userId: string, amount: number, referenceId: string) {
    if (amount <= 0) throw new Error('Reserve amount must be positive');

    return prisma.$transaction(async (tx) => {
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
          type: CreditTransactionType.RESERVE,
          amount: -amount,
          referenceType: 'CAMPAIGN_RESERVATION',
          referenceId,
        },
      });

      return { balance: updatedAccount.balance, transaction };
    });
  }
}
