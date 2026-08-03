"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditController = void 0;
const credit_service_1 = require("./credit.service");
const prisma_1 = require("../../config/prisma");
class CreditController {
    static async getBalance(req, res) {
        try {
            // 1. Primary: Extract userId directly from authenticated JWT token
            let userId = req.user?.userId || req.user?.id || String(req.query.userId || '');
            const email = req.user?.email || String(req.query.email || '');
            if (!userId && email) {
                const user = await prisma_1.prisma.user.findUnique({ where: { email } });
                if (user)
                    userId = user.id;
            }
            if (!userId) {
                const fallbackUser = await prisma_1.prisma.user.findFirst({
                    where: { creditAccount: { isNot: null } },
                }) || await prisma_1.prisma.user.findFirst();
                if (fallbackUser)
                    userId = fallbackUser.id;
            }
            if (!userId) {
                res.status(200).json({ success: true, data: { balance: 0 } });
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
