import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

export interface VerificationResult {
  isVerified: boolean;
  mxValid: boolean;
  reason?: string;
}

export class VerificationService {
  static async verifyEmail(email: string): Promise<VerificationResult> {
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
    } catch (error: any) {
      return { isVerified: false, mxValid: false, reason: `DNS MX lookup error: ${error.message}` };
    }
  }
}
