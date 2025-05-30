// Example usage of the InvestecPbApi package
// Save this file as examples/basic-usage.ts and run with ts-node or after compiling with tsc

import { InvestecPbApi } from '../src';

async function main() {
  // Replace with your actual credentials
  const clientId = process.env.INVESTEC_CLIENT_ID || '<clientId>';
  const clientSecret = process.env.INVESTEC_CLIENT_SECRET || '<clientSecret>';
  const apiKey = process.env.INVESTEC_API_KEY || '<apiKey>';

  const pb = new InvestecPbApi(clientId, clientSecret, apiKey);

  try {
    // Fetch accounts
    const accounts = await pb.getAccounts();
    console.log('Accounts:', accounts.data.accounts);

    // Fetch balances for the first account
    if (accounts.data.accounts.length > 0) {
      const accountId = accounts.data.accounts[0].accountId;
      const balances = await pb.getAccountBalances(accountId);
      console.log('Balances:', balances.data);

      // Fetch recent transactions
      const transactions = await pb.getAccountTransactions(accountId);
      console.log('Transactions:', transactions.data.transactions);
    }

    // Fetch beneficiaries
    const beneficiaries = await pb.getBeneficiaries();
    console.log('Beneficiaries:', beneficiaries.data);
  } catch (err) {
    console.error('API error:', err);
  }
}

main();
