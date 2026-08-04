/**
 * OAuth authentication response from Investec API.
 */
export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * Shared pagination / self-link envelope fields returned by many endpoints.
 */
export interface ApiLinks {
  self: string;
}

export interface ApiMeta {
  totalPages: number;
}

/**
 * Represents a single Investec account.
 */
export interface Account {
  accountId: string;
  accountNumber: string;
  accountName: string;
  referenceName: string;
  productName: string;
  kycCompliant: boolean;
  profileId: string;
  profileName: string;
}

/**
 * Balance details for a specific account.
 */
export interface AccountBalance {
  accountId: string;
  currentBalance: number;
  availableBalance: number;
  budgetBalance: number;
  straightBalance: number;
  cashBalance: number;
  currency: string;
}

/**
 * API response for a single account's balance.
 */
export interface AccountBalanceResponse {
  data: AccountBalance;
  links?: ApiLinks;
  meta?: ApiMeta;
}

/**
 * API response for a list of accounts.
 */
export interface AccountResponse {
  data: {
    accounts: Account[];
  };
  links?: ApiLinks;
  meta?: ApiMeta;
}

/**
 * Represents a single transaction on an account.
 */
export interface AccountTransaction {
  accountId: string;
  type: string;
  transactionType: string;
  status: string;
  description: string;
  cardNumber: string | null;
  postedOrder: number;
  postingDate: string;
  valueDate: string;
  actionDate: string;
  transactionDate: string;
  amount: number;
  runningBalance: number;
  uuid: string;
}

/**
 * Represents a single beneficiary for payments.
 */
export interface Beneficiary {
  beneficiaryId: string;
  accountNumber: string;
  code: string;
  bank: string;
  beneficiaryName: string;
  lastPaymentAmount: string;
  lastPaymentDate: string;
  cellNo: string;
  emailAddress: string;
  name: string;
  referenceAccountNumber: string;
  referenceName: string;
  categoryId: string;
  profileId: string;
  fasterPaymentAllowed: boolean;
}

/**
 * API response for a list of beneficiaries.
 */
export interface BeneficiaryResponse {
  data: Beneficiary[];
  links: ApiLinks;
  meta: ApiMeta;
}

/**
 * API response for a list of transactions on an account.
 */
export interface AccountTransactionResponse {
  data: {
    transactions: AccountTransaction[];
  };
  links?: ApiLinks;
  meta?: ApiMeta;
}

/**
 * Transfer instruction for multiple transfers.
 * Amounts are rand strings (e.g. "100.00"), not cents.
 */
export interface TransferMultiple {
  beneficiaryAccountId: string;
  amount: string;
  myReference: string;
  theirReference: string;
  /** Optional profile ID when transferring across profiles. */
  profileId?: string;
}

/**
 * Payment instruction for multiple payments.
 * Amounts are rand strings (e.g. "100.00"), not cents.
 */
export interface PayMultiple {
  beneficiaryId: string;
  amount: string;
  myReference: string;
  theirReference: string;
}

/**
 * Details of a single transfer result.
 */
export interface Transfer {
  PaymentReferenceNumber: string;
  PaymentDate: string;
  Status: string;
  BeneficiaryName: string;
  BeneficiaryAccountId: string;
  AuthorisationRequired: boolean;
  ErrorMessage?: string;
}

/**
 * API response for multiple transfer results.
 */
export interface TransferResponse {
  data: {
    TransferResponses: Transfer[];
  };
  links?: ApiLinks;
  meta?: ApiMeta;
}
