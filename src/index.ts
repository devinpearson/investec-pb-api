export type {
  AuthResponse,
  AccountResponse,
  AccountBalance,
  AccountBalanceResponse,
  Beneficiary,
  BeneficiaryResponse,
  TransferResponse,
  Transfer,
  TransferMultiple,
  AccountTransactionResponse,
  AccountTransaction,
} from './types';

// Ensure the file './investec-pb-api.ts' exists in the same directory.
// If the file is missing, create it or update the import path accordingly.
export { InvestecPbApi } from './investec-pb-api';
