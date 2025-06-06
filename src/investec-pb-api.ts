import fetch from 'node-fetch';
import type {
  AuthResponse,
  AccountResponse,
  AccountBalanceResponse,
  TransferResponse,
  AccountTransactionResponse,
} from './index';
import type {
  BeneficiaryResponse,
  PayMultiple,
  TransferMultiple,
} from './types';

const createEndpoint = (host: string, path: string) =>
  new URL(path, host).toString();

/**
 * Main API client for Investec Private Banking programmable banking API.
 * Handles authentication and provides methods for account, transaction, and payment operations.
 *
 * @example
 * const api = new InvestecPbApi(clientId, clientSecret, apiKey);
 * const accounts = await api.getAccounts();
 */
export class InvestecPbApi {
  host!: string;
  clientId!: string;
  clientSecret!: string;
  apiKey!: string;
  token!: string;
  expiresIn!: Date;

  /**
   * Create a new InvestecPbApi instance.
   * @param clientId OAuth client ID
   * @param clientSecret OAuth client secret
   * @param apiKey API key from Investec
   * @param host Optional API host (defaults to Investec production)
   */
  constructor(
    clientId: string,
    clientSecret: string,
    apiKey: string,
    host: string = 'https://openapi.investec.com',
  ) {
    this.host = host;
    this.apiKey = apiKey;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.expiresIn = new Date();
  }

  /**
   * Get a valid OAuth token, refreshing if necessary.
   * @returns Access token string
   */
  async getToken(): Promise<string> {
    const now = new Date();
    if (this.token) {
      if (now.getTime() < this.expiresIn.getTime()) {
        return this.token;
      }
    }

    const result = await this.getAccessToken();
    now.setSeconds(now.getSeconds() + result.expires_in);
    this.expiresIn = now;
    return result.access_token;
  }

  /**
   * Request a new OAuth access token from Investec.
   * @returns AuthResponse object
   * @throws Error if authentication fails
   */
  async getAccessToken(): Promise<AuthResponse> {
    const endpoint = createEndpoint(this.host, `/identity/v2/oauth2/token`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(this.clientId + ':' + this.clientSecret).toString(
            'base64',
          ),
        'x-api-key': this.apiKey,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    // console.log(response.status);
    if (response.status !== 200) {
      throw new Error(response.statusText);
    }
    const result = (await response.json()) as AuthResponse;

    // if (!result.scope.includes('cards')) {
    //   throw new Error('You require the cards scope to use this tool');
    // }

    this.token = result.access_token;
    return result;
  }

  /**
   * Make multiple transfers from an account.
   * @param accountId The account ID to transfer from
   * @param transfers One or more transfer instructions
   * @returns TransferResponse
   * @throws Error if parameters are missing or API call fails
   */
  async transferMultiple(
    accountId: string,
    transfers: TransferMultiple[] | TransferMultiple,
  ): Promise<TransferResponse> {
    if (!accountId || !transfers) {
      throw new Error('Missing required parameters');
    }
    const endpoint = createEndpoint(
      this.host,
      `/za//pb/v1/accounts/${encodeURIComponent(accountId)}/transfermultiple`,
    );
    const token = this.token || (await this.getToken());
    if (!Array.isArray(transfers)) {
      transfers = [transfers];
    }
    const payload = {
      transferList: transfers,
    };
    return fetchPost<TransferResponse>(endpoint, token, payload);
  }

  /**
   * Make multiple payments from an account.
   * @param accountId The account ID to pay from
   * @param payments One or more payment instructions
   * @returns TransferResponse
   * @throws Error if parameters are missing or API call fails
   */
  async payMultiple(
    accountId: string,
    payments: PayMultiple[] | PayMultiple,
  ): Promise<TransferResponse> {
    if (!accountId || !payments) {
      throw new Error('Missing required parameters');
    }
    const endpoint = createEndpoint(
      this.host,
      `/za//pb/v1/accounts/${encodeURIComponent(accountId)}/paymultiple`,
    );
    const token = this.token || (await this.getToken());
    if (!Array.isArray(payments)) {
      payments = [payments];
    }
    const payload = {
      paymentList: payments,
    };
    return fetchPost<TransferResponse>(endpoint, token, payload);
  }

  /**
   * Retrieve all beneficiaries for the authenticated user.
   * @returns BeneficiaryResponse
   */
  async getBeneficiaries(): Promise<BeneficiaryResponse> {
    const endpoint = createEndpoint(
      this.host,
      `/za/pb/v1/accounts/beneficiaries`,
    );
    const token = this.token || (await this.getToken());
    return fetchGet<BeneficiaryResponse>(endpoint, token);
  }

  /**
   * Retrieve all accounts for the authenticated user.
   * @returns AccountResponse
   */
  async getAccounts(): Promise<AccountResponse> {
    const endpoint = createEndpoint(this.host, `/za/pb/v1/accounts`);
    const token = this.token || (await this.getToken());
    return fetchGet<AccountResponse>(endpoint, token);
  }

  /**
   * Get the balance for a specific account.
   * @param accountId The account ID
   * @returns AccountBalanceResponse
   * @throws Error if accountId is missing or API call fails
   */
  async getAccountBalances(accountId: string): Promise<AccountBalanceResponse> {
    if (!accountId) {
      throw new Error('Missing required parameters');
    }
    const endpoint = createEndpoint(
      this.host,
      `/za/pb/v1/accounts/${encodeURIComponent(accountId)}/balance`,
    );
    const token = this.token || (await this.getToken());
    return fetchGet<AccountBalanceResponse>(endpoint, token);
  }

  /**
   * Get transactions for a specific account, optionally filtered by date and type.
   * @param accountId The account ID
   * @param fromDate Optional start date (YYYY-MM-DD)
   * @param toDate Optional end date (YYYY-MM-DD)
   * @param transactionType Optional transaction type filter
   * @returns AccountTransactionResponse
   * @throws Error if accountId is missing or API call fails
   */
  async getAccountTransactions(
    accountId: string,
    fromDate: string | null = null,
    toDate: string | null = null,
    transactionType: string | null = null,
  ): Promise<AccountTransactionResponse> {
    if (!accountId) {
      throw new Error('Missing required parameters');
    }
    let url = `/za/pb/v1/accounts/${encodeURIComponent(
      accountId,
    )}/transactions`;
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (transactionType) params.append('transactionType', transactionType);
    if ([fromDate, toDate, transactionType].some(Boolean)) {
      url += `?${params.toString()}`;
    }
    const endpoint = createEndpoint(this.host, url);
    const token = this.token || (await this.getToken());
    return fetchGet<AccountTransactionResponse>(endpoint, token);
  }
}

/**
 * Internal helper for GET requests with authentication.
 * @param endpoint Full URL
 * @param token Bearer token
 * @returns Parsed JSON response
 * @throws Error if request fails
 */
async function fetchGet<T>(endpoint: string, token: string) {
  const response = await fetch(endpoint, {
    method: 'GET',
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: 'Bearer ' + token,
      'content-type': 'application/json',
    },
  });
  if (response.status !== 200) {
    if (response.status === 404) {
      throw new Error('Card not found');
    }
    throw new Error(response.statusText);
  }
  return (await response.json()) as T;
}

/**
 * Internal helper for POST requests with authentication.
 * @param endpoint Full URL
 * @param token Bearer token
 * @param body Request payload
 * @returns Parsed JSON response
 * @throws Error if request fails
 */
async function fetchPost<T>(endpoint: string, token: string, body: object) {
  const response = await fetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: 'Bearer ' + token,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (response.status !== 200) {
    if (response.status === 404) {
      throw new Error('Card not found');
    }
    throw new Error(response.statusText);
  }
  return (await response.json()) as T;
}
