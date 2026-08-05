/**
 * Pay one or more beneficiaries from an account.
 *
 * This moves real money when pointed at production. Dry-run by default.
 *
 * Required env:
 *   INVESTEC_CLIENT_ID / INVESTEC_CLIENT_SECRET / INVESTEC_API_KEY
 *   INVESTEC_ACCOUNT_ID
 *   INVESTEC_BENEFICIARY_ID
 *
 * Optional env:
 *   INVESTEC_HOST=https://openapisandbox.investec.com
 *   INVESTEC_PAYMENT_AMOUNT=1.00
 *   INVESTEC_MY_REFERENCE=Example payment
 *   INVESTEC_THEIR_REFERENCE=Example payment
 *   CONFIRM_PAYMENT=true   # required to actually call payMultiple
 *
 * Run:
 *   npm run example:payments
 *   CONFIRM_PAYMENT=true npm run example:payments
 */

import { InvestecApiError, type PayMultiple } from '../src/index.js';
import { createClientFromEnv, requireEnv } from './create-client.js';

async function main() {
  const pb = createClientFromEnv();
  const accountId = requireEnv('INVESTEC_ACCOUNT_ID');
  const beneficiaryId = requireEnv('INVESTEC_BENEFICIARY_ID');
  const amount = process.env.INVESTEC_PAYMENT_AMOUNT ?? '1.00';
  const myReference = process.env.INVESTEC_MY_REFERENCE ?? 'Example payment';
  const theirReference =
    process.env.INVESTEC_THEIR_REFERENCE ?? 'Example payment';
  const confirm = process.env.CONFIRM_PAYMENT === 'true';

  const payment: PayMultiple = {
    beneficiaryId,
    amount,
    myReference,
    theirReference,
  };

  console.log('Payment preview:');
  console.log(JSON.stringify({ accountId, paymentList: [payment] }, null, 2));

  if (!confirm) {
    console.log(
      '\nDry run only. Re-run with CONFIRM_PAYMENT=true to submit this payment.',
    );
    return;
  }

  console.log('\nSubmitting payment...');
  const result = await pb.payMultiple(accountId, payment);
  console.log('TransferResponses:');
  console.log(JSON.stringify(result.data.TransferResponses, null, 2));
}

main().catch((err) => {
  if (err instanceof InvestecApiError) {
    console.error('Investec API error:', {
      status: err.status,
      endpoint: err.endpoint,
      body: err.body,
      message: err.message,
    });
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
