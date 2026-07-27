"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationService = void 0;
const dns_1 = __importDefault(require("dns"));
const util_1 = require("util");
const resolveMx = (0, util_1.promisify)(dns_1.default.resolveMx);
class VerificationService {
    static async verifyEmail(email) {
        const parts = email.split('@');
        if (parts.length !== 2) {
            return { isVerified: false, mxValid: false, reason: 'Invalid email syntax' };
        }
        const domain = parts[1];
        try {
            const mxRecords = await resolveMx(domain);
            if (mxRecords && mxRecords.length > 0) {
                return { isVerified: true, mxValid: true };
            }
            return { isVerified: false, mxValid: false, reason: 'No MX records found for domain' };
        }
        catch (error) {
            return { isVerified: false, mxValid: false, reason: `DNS MX lookup error: ${error.message}` };
        }
    }
}
exports.VerificationService = VerificationService;
