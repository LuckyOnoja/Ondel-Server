"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditController = void 0;
const credit_service_1 = require("./credit.service");
class CreditController {
    static async getBalance(req, res) {
        try {
            const userId = String(req.query.userId || req.user?.id);
            if (!userId) {
                res.status(400).json({ success: false, error: 'userId is required' });
                return;
            }
            const balance = await credit_service_1.CreditService.getBalance(userId);
            res.status(200).json({ success: true, data: { balance } });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    static async purchaseCredits(req, res) {
        try {
            const { userId, amount, referenceId } = req.body;
            if (!userId || !amount) {
                res.status(400).json({ success: false, error: 'userId and amount are required' });
                return;
            }
            const result = await credit_service_1.CreditService.addCredits(userId, Number(amount), referenceId);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
}
exports.CreditController = CreditController;
