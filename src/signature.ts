import crypto from 'crypto';

export class SignatureVerifier {
  public static verifyStripeSignature(payload: string, header: string, secret: string, toleranceSeconds = 300): boolean {
    if (!header || !secret) return false;
    const parts = header.split(',');
    let timestamp = -1;
    const signatures: string[] = [];

    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === 't') timestamp = parseInt(v, 10);
      if (k === 'v1') signatures.push(v);
    }

    if (timestamp === -1 || signatures.length === 0) return false;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

    for (const sig of signatures) {
      const expectedBuf = Buffer.from(expected);
      const actualBuf = Buffer.from(sig);
      if (expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)) {
        return true;
      }
    }
    return false;
  }
}
