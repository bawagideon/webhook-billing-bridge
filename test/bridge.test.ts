import crypto from 'crypto';
import { SignatureVerifier } from '../src/signature';
import { IdempotencyStore } from '../src/idempotency';
import { EventRouter } from '../src/router';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

function runTests() {
  console.log('Testing Webhook Billing Bridge Suite...');
  const secret = 'whsec_test_secret_for_staging';
  const payload = JSON.stringify({ id: 'evt_test_1', type: 'payment_intent.succeeded', data: { object: { amount_total: 5000 } } });

  // Test 1: Valid signature
  const now = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${now}.${payload}`).digest('hex');
  const validHeader = `t=${now},v1=${sig}`;
  assert(SignatureVerifier.verifyStripeSignature(payload, validHeader, secret), 'Valid signature failed');
  console.log('  ✓ Test 1 PASS: Valid signature verified');

  // Test 2: Tampered signature rejected
  const tamperedHeader = `t=${now},v1=invalid_tampered_sig`;
  assert(!SignatureVerifier.verifyStripeSignature(payload, tamperedHeader, secret), 'Tampered signature allowed');
  console.log('  ✓ Test 2 PASS: Tampered signature rejected');

  // Test 3: Expired replay rejected
  const expiredNow = now - 500;
  const expiredSig = crypto.createHmac('sha256', secret).update(`${expiredNow}.${payload}`).digest('hex');
  const expiredHeader = `t=${expiredNow},v1=${expiredSig}`;
  assert(!SignatureVerifier.verifyStripeSignature(payload, expiredHeader, secret), 'Expired replay allowed');
  console.log('  ✓ Test 3 PASS: Expired replay rejected');

  // Test 4: Idempotency deduplication
  IdempotencyStore.clear();
  assert(!IdempotencyStore.isDuplicate('evt_test_1'), 'Initial event marked duplicate');
  assert(IdempotencyStore.isDuplicate('evt_test_1'), 'Second event not marked duplicate');
  console.log('  ✓ Test 4 PASS: Idempotency deduplication verified');

  console.log('ALL 4 UNIT TESTS PASSING (100% OK)');
}

runTests();
