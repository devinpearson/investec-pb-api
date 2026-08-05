# Examples

Runnable scripts that exercise `investec-pb-api` against Investec production or sandbox.

## Setup

```sh
export INVESTEC_CLIENT_ID=your_client_id
export INVESTEC_CLIENT_SECRET=your_client_secret
export INVESTEC_API_KEY=your_api_key

# Optional — prefer sandbox while experimenting
export INVESTEC_HOST=https://openapisandbox.investec.com
```

## Scripts

| Command                     | File                                       | What it does                                                 |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `npm run example:basic`     | [`basic-usage.ts`](./basic-usage.ts)       | Auth, accounts, balances, recent transactions, beneficiaries |
| `npm run example:payments`  | [`payments.ts`](./payments.ts)             | Preview (and optionally submit) a beneficiary payment        |
| `npm run example:transfers` | [`transfers.ts`](./transfers.ts)           | Preview (and optionally submit) an account transfer          |
| `npm run example:errors`    | [`error-handling.ts`](./error-handling.ts) | Print a typed `InvestecApiError`                             |

Shared client setup lives in [`create-client.ts`](./create-client.ts).

## Money-moving examples

`payments` and `transfers` are **dry-run by default**. They only call the API when you set an explicit confirm flag:

```sh
export INVESTEC_ACCOUNT_ID=...
export INVESTEC_BENEFICIARY_ID=...
CONFIRM_PAYMENT=true npm run example:payments

export INVESTEC_ACCOUNT_ID=...
export INVESTEC_BENEFICIARY_ACCOUNT_ID=...
CONFIRM_TRANSFER=true npm run example:transfers
```

Amounts default to `1.00` (rand strings, not cents). Override with `INVESTEC_PAYMENT_AMOUNT` or `INVESTEC_TRANSFER_AMOUNT`.
