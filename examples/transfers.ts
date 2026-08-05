/**
 * Transfer between your own accounts.
 *
 * This moves real money when pointed at production. Dry-run by default.
 *
 * Required env:
 *   INVESTEC_CLIENT_ID / INVESTEC_CLIENT_SECRET / INVESTEC_API_KEY
 *   INVESTEC_ACCOUNT_ID              # source account
 *   INVESTEC_BENEFICIARY_ACCOUNT_ID  # destination account
 *
 * Optional env:
 *   INVESTEC_HOST=https://openapisandbox.investec.com
 *   INVESTEC_TRANSFER_AMOUNT=1.00
 *   INVESTEC_MY_REFERENCE=Example transfer
 *   INVESTEC_THEIR_REFERENCE=Example transfer
 *   INVESTEC_PROFILE_ID              # optional cross-profile transfer
 *   CONFIRM_TRANSFER=true            # required to actually call transferMultiple
 *
 * Run:
 *   npm run example:transfers
 *   CONFIRM_TRANSFER=true npm run example:transfers
 */

import { InvestecApiError, type TransferMultiple } from '../src/index.js';
import { createClientFromEnv, requireEnv } from './create-client.js';

async function main() {
  const pb = createClientFromEnv();
  const accountId = requireEnv('INVESTEC_ACCOUNT_ID');
  const beneficiaryAccountId = requireEnv('INVESTEC_BENEFICIARY_ACCOUNT_ID');
  const amount = process.env.INVESTEC_TRANSFER_AMOUNT ?? '1.00';
  const myReference = process.env.INVESTEC_MY_REFERENCE ?? 'Example transfer';
  const theirReference =
    process.env.INVESTEC_THEIR_REFERENCE ?? 'Example transfer';
  const profileId = process.env.INVESTEC_PROFILE_ID;
  const confirm = process.env.CONFIRM_TRANSFER === 'true';

  const transfer: TransferMultiple = {
    beneficiaryAccountId,
    amount,
    myReference,
    theirReference,
    ...(profileId ? { profileId } : {}),
  };

  console.log('Transfer preview:');
  console.log(JSON.stringify({ accountId, transferList: [transfer] }, null, 2));

  if (!confirm) {
    console.log(
      '\nDry run only. Re-run with CONFIRM_TRANSFER=true to submit this transfer.',
    );
    return;
  }

  console.log('\nSubmitting transfer...');
  const result = await pb.transferMultiple(accountId, transfer);
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
