export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

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

export interface AccountBalance {
  accountId: string;
  currentBalance: number;
  availableBalance: number;
  budgetBalance: number;
  straightBalance: number;
  cashBalance: number;
  currency: string;
}

export interface AccountBalanceResponse {
  data: AccountBalance;
}

export interface AccountResponse {
  data: {
    accounts: Account[];
  };
}

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

export interface BeneficiaryResponse {
  data: Beneficiary[];
  links: {
    self: string;
  };
  meta: {
    totalPages: number;
  };
}

export interface AccountTransactionResponse {
  data: {
    transactions: AccountTransaction[];
  };
}

export interface TransferMultiple {
  beneficiaryAccountId: string;
  amount: string;
  myReference: string;
  theirReference: string;
}

export interface PayMultiple {
  beneficiaryId: string;
  amount: string;
  myReference: string;
  theirReference: string;
}

export interface Transfer {
  PaymentReferenceNumber: string;
  PaymentDate: string;
  Status: string;
  BeneficiaryName: string;
  BeneficiaryAccountId: string;
  AuthorisationRequired: boolean;
}

export interface TransferResponse {
  data: {
    TransferResponses: Transfer[];
  };
}
