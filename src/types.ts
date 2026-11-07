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
 * Fields typed `| null` are returned as null by the API when not captured.
 */
export interface Beneficiary {
  beneficiaryId: string;
  accountNumber: string;
  code: string;
  bank: string;
  beneficiaryName: string | null;
  lastPaymentAmount: string;
  lastPaymentDate: string;
  cellNo: string | null;
  emailAddress: string | null;
  name: string;
  referenceAccountNumber: string;
  referenceName: string | null;
  categoryId: string;
  profileId: string;
  /** Not returned by every beneficiary endpoint. */
  fasterPaymentAllowed?: boolean;
  /** e.g. "PERSONALEXTERNAL". */
  beneficiaryType?: string;
  approvedBeneficiaryCategory?: string | null;
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
 * `T` is `AccountTransactionWithPending` when `includePending` is requested.
 */
export interface AccountTransactionResponse<T = AccountTransaction> {
  data: {
    transactions: T[];
  };
  links?: ApiLinks;
  meta?: ApiMeta;
}

/**
 * A transaction from the transactions endpoint with `includePending=true`.
 * Pending items have no posting details, so those fields are null.
 */
export type AccountTransactionWithPending = Omit<
  AccountTransaction,
  'transactionType' | 'postingDate' | 'valueDate' | 'actionDate'
> & {
  transactionType: string | null;
  postingDate: string | null;
  valueDate: string | null;
  actionDate: string | null;
};

/**
 * Filters for `getAccountTransactions`. Dates are YYYY-MM-DD.
 */
export interface TransactionQuery {
  fromDate?: string | null;
  toDate?: string | null;
  transactionType?: string | null;
  /** Include card authorisations that have not posted yet. */
  includePending?: boolean;
}

/**
 * A pending (not yet posted) transaction, from the pending-transactions
 * endpoint. Only the properties known before posting are returned.
 */
export interface PendingTransaction {
  accountId: string;
  type: string;
  status: string;
  description: string;
  transactionDate: string;
  amount: number;
}

export interface PendingTransactionResponse {
  data: {
    transactions: PendingTransaction[];
  };
  links?: ApiLinks;
  meta?: ApiMeta;
}

/**
 * A banking profile. Accounts and beneficiaries belong to a profile.
 */
export interface Profile {
  profileId: string;
  profileName: string;
  defaultProfile: boolean;
}

export interface ProfileResponse {
  data: Profile[];
  links?: ApiLinks;
  meta?: ApiMeta;
}

/** API response for the accounts in one profile. */
export interface ProfileAccountResponse {
  data: Account[];
  links?: ApiLinks;
  meta?: ApiMeta;
}

/**
 * A beneficiary category. The API returns these fields in PascalCase and
 * `DefaultCategory` as the string "true" or "false".
 */
export interface BeneficiaryCategory {
  CategoryId: string;
  DefaultCategory: string;
  CategoryName: string;
}

export interface BeneficiaryCategoryResponse {
  data: BeneficiaryCategory[];
  links?: ApiLinks;
  meta?: ApiMeta;
}

/**
 * A document (statement, tax certificate, ...) available for an account.
 * Pass both fields to `getDocument` to download it.
 */
export interface AccountDocument {
  /** e.g. "Statement" or "TaxCertificate". */
  documentType: string;
  /** YYYY-MM-DD */
  documentDate: string;
}

export interface AccountDocumentResponse {
  data: AccountDocument[];
  links?: ApiLinks;
  meta?: ApiMeta;
}

export interface Authoriser {
  authoriserId: string;
  name: string;
}

export interface AuthorisationPeriod {
  id: string;
  description: string;
}

/**
 * Who has to authorise payments on an account, and within which periods.
 */
export interface AuthorisationSetupDetails {
  /** A number as a string, e.g. "2". */
  numberOfAuthorisationRequired: string;
  period: AuthorisationPeriod[];
  authorisersListA: Authoriser[];
  authorisersListB: Authoriser[];
}

export interface AuthorisationSetupDetailsResponse {
  data: AuthorisationSetupDetails;
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
