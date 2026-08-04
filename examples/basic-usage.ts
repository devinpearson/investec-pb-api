/**
 * Read-only walkthrough of the Investec Private Banking API.
 *
 * Required env:
 *   INVESTEC_CLIENT_ID
 *   INVESTEC_CLIENT_SECRET
 *   INVESTEC_API_KEY
 *
 * Optional env:
 *   INVESTEC_HOST=https://openapisandbox.investec.com
 *
 * Run:
 *   npm run example:basic
 */

import { InvestecApiError } from '../src/index.js';
import { createClientFromEnv } from './create-client.js';

async function main() {
  const pb = createClientFromEnv();

  console.log('Requesting access token...');
  const token = await pb.getToken();
  console.log(`Authenticated (token length: ${token.length})`);

  const accountsResponse = await pb.getAccounts();
  const accounts = accountsResponse.data.accounts;
  console.log(`\nAccounts (${accounts.length}):`);
  for (const account of accounts) {
    console.log(
      `  - ${account.accountName} (${account.productName}) [${account.accountId}]`,
    );
  }

  const account = accounts[0];
  if (!account) {
    console.log('\nNo accounts available; skipping balances and transactions.');
  } else {
    const balances = await pb.getAccountBalances(account.accountId);
    console.log(`\nBalance for ${account.accountName}:`);
    console.log(
      `  available: ${balances.data.availableBalance} ${balances.data.currency}`,
    );
    console.log(
      `  current:   ${balances.data.currentBalance} ${balances.data.currency}`,
    );

    const toDate = new Date();
    const fromDate = new Date(toDate);
    fromDate.setDate(toDate.getDate() - 30);
    const toIso = toDate.toISOString().slice(0, 10);
    const fromIso = fromDate.toISOString().slice(0, 10);

    const transactions = await pb.getAccountTransactions(
      account.accountId,
      fromIso,
      toIso,
    );
    console.log(
      `\nTransactions for ${account.accountName} (${fromIso} → ${toIso}): ${transactions.data.transactions.length}`,
    );
    for (const tx of transactions.data.transactions.slice(0, 5)) {
      console.log(
        `  - ${tx.transactionDate} ${tx.description} ${tx.amount} (${tx.status})`,
      );
    }
    if (transactions.data.transactions.length > 5) {
      console.log('  ...');
    }
  }

  const beneficiaries = await pb.getBeneficiaries();
  console.log(`\nBeneficiaries (${beneficiaries.data.length}):`);
  for (const beneficiary of beneficiaries.data.slice(0, 5)) {
    console.log(
      `  - ${beneficiary.beneficiaryName} @ ${beneficiary.bank} [${beneficiary.beneficiaryId}]`,
    );
  }
  if (beneficiaries.data.length > 5) {
    console.log('  ...');
  }
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
