import type {
  AuthResponse,
  AccountResponse,
  AccountBalanceResponse,
  BeneficiaryResponse,
  TransferResponse,
  AccountTransactionResponse,
  PayMultiple,
  TransferMultiple,
} from './types';
import { InvestecApiError } from './errors';

/** Refresh tokens this many seconds before actual expiry. */
const TOKEN_EXPIRY_SKEW_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 30_000;

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
  private readonly host: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiKey: string;
  private token: string | undefined;
  private expiresIn: Date = new Date(0);
  private refreshPromise: Promise<string> | null = null;

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
  }

  /**
   * Get a valid OAuth token, refreshing if necessary.
   * Concurrent callers share a single in-flight refresh.
   * @returns Access token string
   */
  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.expiresIn.getTime()) {
      return this.token;
    }

    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }

  private async refreshAccessToken(): Promise<string> {
    const result = await this.getAccessToken();
    return result.access_token;
  }

  /**
   * Request a new OAuth access token from Investec.
   * @returns AuthResponse object
   * @throws InvestecApiError if authentication fails
   */
  async getAccessToken(): Promise<AuthResponse> {
    const endpoint = createEndpoint(this.host, `/identity/v2/oauth2/token`);
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

    if (!response.ok) {
      throw await this.toApiError(response, endpoint);
    }

    const result = (await response.json()) as AuthResponse;
    this.token = result.access_token;
    this.expiresIn = new Date(
      Date.now() +
        Math.max(result.expires_in - TOKEN_EXPIRY_SKEW_SECONDS, 0) * 1000,
    );
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
      `/za/pb/v1/accounts/${encodeURIComponent(accountId)}/transfermultiple`,
    );
    const payload = {
      transferList: Array.isArray(transfers) ? transfers : [transfers],
    };
    return this.fetchPost<TransferResponse>(endpoint, payload);
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
      `/za/pb/v1/accounts/${encodeURIComponent(accountId)}/paymultiple`,
    );
    const payload = {
      paymentList: Array.isArray(payments) ? payments : [payments],
    };
    return this.fetchPost<TransferResponse>(endpoint, payload);
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
    return this.fetchGet<BeneficiaryResponse>(endpoint);
  }

  /**
   * Retrieve all accounts for the authenticated user.
   * @returns AccountResponse
   */
  async getAccounts(): Promise<AccountResponse> {
    const endpoint = createEndpoint(this.host, `/za/pb/v1/accounts`);
    return this.fetchGet<AccountResponse>(endpoint);
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
    return this.fetchGet<AccountBalanceResponse>(endpoint);
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
    return this.fetchGet<AccountTransactionResponse>(endpoint);
  }

  private async fetchGet<T>(endpoint: string): Promise<T> {
    return this.authorizedRequest<T>(endpoint, { method: 'GET' });
  }

  private async fetchPost<T>(endpoint: string, body: object): Promise<T> {
    return this.authorizedRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  private async authorizedRequest<T>(
    endpoint: string,
    init: RequestInit,
  ): Promise<T> {
    const response = await this.sendAuthorized(endpoint, init);
    if (response.status === 401) {
      this.invalidateToken();
      const retry = await this.sendAuthorized(endpoint, init);
      if (!retry.ok) {
        throw await this.toApiError(retry, endpoint);
      }
      return (await retry.json()) as T;
    }
    if (!response.ok) {
      throw await this.toApiError(response, endpoint);
    }
    return (await response.json()) as T;
  }

  private async sendAuthorized(
    endpoint: string,
    init: RequestInit,
  ): Promise<Response> {
    const token = await this.getToken();
    return fetch(endpoint, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  }

  private invalidateToken(): void {
    this.token = undefined;
    this.expiresIn = new Date(0);
  }

  private async toApiError(
    response: Response,
    endpoint: string,
  ): Promise<InvestecApiError> {
    let body: string | undefined;
    try {
      body = await response.text();
    } catch {
      body = undefined;
    }
    return new InvestecApiError(
      response.status,
      endpoint,
      response.statusText,
      body,
    );
  }
}
