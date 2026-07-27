import { Request, Response } from 'express';
import { CreditService } from './credit.service';

export class CreditController {
  static async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const userId = String(req.query.userId || (req as any).user?.id);
      if (!userId) {
        res.status(400).json({ success: false, error: 'userId is required' });
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
