export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface Account {
  accountId: string;
  accountNumber: string;
  accountName: boolean;
  referenceName: string;
  productName: string;
  kycCompliant: boolean;
  profileId: string;
  profileName: string;
}

export interface AccountBalanceResponse {
  accountId: string;
  currentBalance: number;
  availableBalance: number;
  budgetBalance: number;
  straightBalance: number;
  cashBalance: number;
  currency: string;
}

export interface AccountResponse {
  data: {
    accounts: Account[];
  };
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