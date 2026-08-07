import { PrismaClient, CreditTransactionType } from '@prisma/client'
const prisma = new PrismaClient()

export class CreditsService {
  async getOrCreateCreditAccount(userIdOrEmail: string): Promise<{ id: string; balance: number }> {
    const identifier = userIdOrEmail.toLowerCase().trim()
    
    // Resolve user first
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ id: identifier }, { email: identifier }],
      },
    })
    
    if (!user) {
      // Fallback user
      user = await prisma.user.findFirst({
        orderBy: { createdAt: 'desc' },
      })
    }
    
    if (!user) {
      throw new Error('User not found')
    }

    let account = await prisma.creditAccount.findUnique({
      where: { userId: user.id },
    })

    if (!account) {
      account = await prisma.creditAccount.create({
        data: {
          userId: user.id,
          balance: 500,
        },
      })
    }

    return { id: account.id, balance: account.balance }
  }

  async deductCredit(userIdOrEmail: string, amount: number, description: string): Promise<boolean> {
    try {
      const account = await this.getOrCreateCreditAccount(userIdOrEmail)
      if (account.balance < amount) {
        return false // Insufficient balance
      }

      await prisma.creditAccount.update({
        where: { id: account.id },
        data: {
          balance: { decrement: amount },
        },
      })

      // Log transaction
      await prisma.creditTransaction.create({
        data: {
          accountId: account.id,
          type: CreditTransactionType.CONSUME,
          amount,
          referenceType: 'AI_PROMPT',
          metadata: { description },
        },
      })

      return true
    } catch (error) {
      console.error('[deductCredit error]:', error)
      return false
    }
  }

  async addCredit(userIdOrEmail: string, amount: number, description: string): Promise<void> {
    const account = await this.getOrCreateCreditAccount(userIdOrEmail)
    await prisma.creditAccount.update({
      where: { id: account.id },
      data: {
        balance: { increment: amount },
      },
    })

    await prisma.creditTransaction.create({
      data: {
        accountId: account.id,
        type: CreditTransactionType.PURCHASE,
        amount,
        referenceType: 'TOPUP',
        metadata: { description },
      },
    })
  }
}

export const creditsService = new CreditsService()
