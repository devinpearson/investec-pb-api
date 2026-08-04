# Investec PB API

Connect with the Investec Private Banking API.

[![Node.js CI](https://github.com/devinpearson/investec-pb-api/actions/workflows/node.js.yml/badge.svg)](https://github.com/devinpearson/investec-pb-api/actions/workflows/node.js.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/investec-pb-api.svg)](https://badge.fury.io/js/investec-pb-api)

## About

A TypeScript package to connect to the Investec Private Banking API. It provides convenient methods for authentication, account info, balances, transactions, payments, and beneficiaries.

This package was created to support the investec-ipb command line application, but can be used in any Node.js/TypeScript project.

## Features

- OAuth2 authentication (client credentials)
- Fetch accounts, balances, and transactions
- Make payments and transfers (single or multiple)
- Manage beneficiaries
- Fully typed responses and request payloads

## Installation

Install the package using npm:

```sh
npm install investec-pb-api
```

## Usage

### Import and Initialize

```typescript
import { InvestecPbApi } from 'investec-pb-api';

const pb = new InvestecPbApi('<clientId>', '<clientSecret>', '<apiKey>');

// Optional: use the Investec sandbox host
// const pb = new InvestecPbApi(
//   '<clientId>',
//   '<clientSecret>',
//   '<apiKey>',
//   'https://openapisandbox.investec.com',
// );
```

### Fetch Accounts

```typescript
const accounts = await pb.getAccounts();
console.log(accounts.data.accounts);
```

### Fetch Account Balances

```typescript
const balances = await pb.getAccountBalances(accountId);
console.log(balances.data);
```

### Fetch Transactions (with optional filters)

```typescript
const transactions = await pb.getAccountTransactions(
  accountId,
  '2024-01-01',
  '2024-01-31',
  'DEBIT',
);
console.log(transactions.data.transactions);
```

### Make Multiple Payments

```typescript
const payments = [
  {
    beneficiaryId: '123',
    amount: '100.00',
    myReference: 'Invoice 001',
    theirReference: 'Payment',
  },
];
const paymentResult = await pb.payMultiple(accountId, payments);
console.log(paymentResult.data.TransferResponses);
```

### Make Multiple Transfers

```typescript
const transfers = [
  {
    beneficiaryAccountId: '987654321',
    amount: '50.00',
    myReference: 'Savings',
    theirReference: 'Transfer',
  },
];
const transferResult = await pb.transferMultiple(accountId, transfers);
console.log(transferResult.data.TransferResponses);
```

### Get Beneficiaries

```typescript
const beneficiaries = await pb.getBeneficiaries();
console.log(beneficiaries.data);
```

## API Reference

All methods are fully typed. See the [src/types.ts](src/types.ts) file for detailed type definitions.

### Error Handling

API failures throw `InvestecApiError` with `status`, `endpoint`, and optional `body`. Validation failures throw a plain `Error`. Use try/catch to handle errors:

```typescript
import { InvestecApiError } from 'investec-pb-api';

try {
  const accounts = await pb.getAccounts();
} catch (err) {
  if (err instanceof InvestecApiError) {
    console.error(err.status, err.endpoint, err.body);
  } else {
    console.error('API error:', err);
  }
}
```

## API Response Shape

All methods return objects with a `data` property containing the main result. Here are example response shapes for key methods:

### AccountResponse

```json
{
  "data": {
    "accounts": [
      {
        "accountId": "123456789",
        "accountNumber": "123456789",
        "accountName": "My Account",
        "referenceName": "My Reference",
        "productName": "Private Bank Account",
        "kycCompliant": true,
        "profileId": "abc123",
        "profileName": "John Doe"
      }
    ]
  }
}
```

### AccountBalanceResponse

```json
{
  "data": {
    "accountId": "123456789",
    "currentBalance": 1000.0,
    "availableBalance": 950.0,
    "budgetBalance": 0.0,
    "straightBalance": 0.0,
    "cashBalance": 950.0,
    "currency": "ZAR"
  }
}
```

### AccountTransactionResponse

```json
{
  "data": {
    "transactions": [
      {
        "accountId": "123456789",
        "type": "DEBIT",
        "transactionType": "PURCHASE",
        "status": "POSTED",
        "description": "Coffee Shop",
        "cardNumber": null,
        "postedOrder": 1,
        "postingDate": "2024-05-01",
        "valueDate": "2024-05-01",
        "actionDate": "2024-05-01",
        "transactionDate": "2024-05-01",
        "amount": -35.0,
        "runningBalance": 965.0,
        "uuid": "767676123"
      }
    ]
  }
}
```

### TransferResponse (for payMultiple/transferMultiple)

```json
{
  "data": {
    "TransferResponses": [
      {
        "PaymentReferenceNumber": "PRN123",
        "PaymentDate": "05/01/2025",
        "Status": "- No authorisation necessary <BR> - Payment/Transfer effective date: 05/01/2025",
        "BeneficiaryName": "Jane Doe",
        "BeneficiaryAccountId": "987654321",
        "AuthorisationRequired": false
      }
    ]
  }
}
```

### BeneficiaryResponse

```json
{
  "data": [
    {
      "beneficiaryId": "123",
      "accountNumber": "987654321",
      "code": "632005",
      "bank": "Investec",
      "beneficiaryName": "Jane Doe",
      "lastPaymentAmount": "100.00",
      "lastPaymentDate": "2024-04-30",
      "cellNo": "0821234567",
      "emailAddress": "jane@example.com",
      "name": "Jane Doe",
      "referenceAccountNumber": "123456789",
      "referenceName": "My Account",
      "categoryId": "1",
      "profileId": "abc123",
      "fasterPaymentAllowed": true
    }
  ],
  "links": {
    "self": "..."
  },
  "meta": {
    "totalPages": 1
  }
}
```

Refer to [src/types.ts](src/types.ts) for full type definitions and details.

## Types

You can import types for strict typing in your own code:

```typescript
import type {
  Account,
  AccountResponse,
  AccountTransaction,
  PayMultiple,
} from 'investec-pb-api';
import { InvestecApiError } from 'investec-pb-api';
```

## Troubleshooting

- Ensure your API credentials are correct and have the required permissions.
- The package requires Node.js 18+ (for fetch and AbortController support).
- If you see authentication errors, check your client ID, secret, and API key.

## Example Usage

Runnable examples live in [`examples/`](examples/). See [`examples/README.md`](examples/README.md) for the full list.

| Script                      | Purpose                                               |
| --------------------------- | ----------------------------------------------------- |
| `npm run example:basic`     | Auth, accounts, balances, transactions, beneficiaries |
| `npm run example:payments`  | Dry-run / submit a beneficiary payment                |
| `npm run example:transfers` | Dry-run / submit an account transfer                  |
| `npm run example:errors`    | Demonstrate `InvestecApiError`                        |

### Running the examples

1. **Set your credentials as environment variables** (recommended):

   - `INVESTEC_CLIENT_ID`
   - `INVESTEC_CLIENT_SECRET`
   - `INVESTEC_API_KEY`
   - Optional: `INVESTEC_HOST=https://openapisandbox.investec.com`

   Example (macOS/Linux):

   ```sh
   export INVESTEC_CLIENT_ID=your_client_id
   export INVESTEC_CLIENT_SECRET=your_client_secret
   export INVESTEC_API_KEY=your_api_key
   ```

2. **Run a read-only walkthrough:**

   ```sh
   npm run example:basic
   ```

3. **Payments / transfers are dry-run by default.** Set account/beneficiary IDs and an explicit confirm flag to submit:

   ```sh
   export INVESTEC_ACCOUNT_ID=...
   export INVESTEC_BENEFICIARY_ID=...
   CONFIRM_PAYMENT=true npm run example:payments
   ```

> Tip: Prefer the sandbox host while experimenting. Amounts are rand strings (e.g. `"1.00"`), not cents.

---

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
