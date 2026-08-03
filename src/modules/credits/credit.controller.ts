import { Request, Response } from 'express';
import { CreditService } from './credit.service';
import { prisma } from '../../config/prisma';
import { AuthRequest } from '../../middleware/authMiddleware';

export class CreditController {
  static async getBalance(req: AuthRequest, res: Response): Promise<void> {
    try {
      // 1. Primary: Extract userId directly from authenticated JWT token
      let userId = req.user?.userId || (req.user as any)?.id || String(req.query.userId || '');
      const email = req.user?.email || String(req.query.email || '');

      if (!userId && email) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) userId = user.id;
      }

      if (!userId) {
        const fallbackUser = await prisma.user.findFirst({
          where: { creditAccount: { isNot: null } },
        }) || await prisma.user.findFirst();
        
        if (fallbackUser) userId = fallbackUser.id;
      }

      if (!userId) {
        res.status(200).json({ success: true, data: { balance: 0 } });
        return;
      }

      const balance = await CreditService.getBalance(userId);
      res.status(200).json({ success: true, data: { balance } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async purchaseCredits(req: Request, res: Response): Promise<void> {
    try {
      const { userId, amount, referenceId } = req.body;
      if (!userId || !amount) {
        res.status(400).json({ success: false, error: 'userId and amount are required' });
        return;
      }
      const result = await CreditService.addCredits(userId, Number(amount), referenceId);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
