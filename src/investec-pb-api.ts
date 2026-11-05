import { InvestecApiError } from './errors';
import type {
  AccountBalanceResponse,
  AccountDocumentResponse,
  AccountResponse,
  AccountTransaction,
  AccountTransactionResponse,
  AccountTransactionWithPending,
  AuthorisationSetupDetailsResponse,
  AuthResponse,
  BeneficiaryCategoryResponse,
  BeneficiaryResponse,
  PayMultiple,
  PendingTransactionResponse,
  ProfileAccountResponse,
  ProfileResponse,
  TransactionQuery,
  TransferMultiple,
  TransferResponse,
} from './types';

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
          Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
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
   *
   * Accepts either positional filters or a `TransactionQuery` object. Only the
   * object form supports `includePending`; with `includePending: true` the
   * result may contain pending items whose posting fields are null.
   *
   * @example
   * await api.getAccountTransactions(id, '2024-01-01', '2024-01-31');
   * await api.getAccountTransactions(id, { fromDate: '2024-01-01', includePending: true });
   * @throws Error if accountId is missing or API call fails
   */
  async getAccountTransactions(
    accountId: string,
    query: TransactionQuery & { includePending: true },
  ): Promise<AccountTransactionResponse<AccountTransactionWithPending>>;
  async getAccountTransactions(
    accountId: string,
    query?: TransactionQuery,
  ): Promise<AccountTransactionResponse>;
  async getAccountTransactions(
    accountId: string,
    fromDate?: string | null,
    toDate?: string | null,
    transactionType?: string | null,
  ): Promise<AccountTransactionResponse>;
  async getAccountTransactions(
    accountId: string,
    queryOrFromDate: TransactionQuery | string | null = null,
    toDate: string | null = null,
    transactionType: string | null = null,
  ): Promise<
    AccountTransactionResponse<
      AccountTransaction | AccountTransactionWithPending
    >
  > {
    if (!accountId) {
      throw new Error('Missing required parameters');
    }
    const query: TransactionQuery =
      queryOrFromDate !== null && typeof queryOrFromDate === 'object'
        ? queryOrFromDate
        : { fromDate: queryOrFromDate, toDate, transactionType };
    const params = new URLSearchParams();
    if (query.fromDate) params.append('fromDate', query.fromDate);
    if (query.toDate) params.append('toDate', query.toDate);
    if (query.transactionType) {
      params.append('transactionType', query.transactionType);
    }
    if (query.includePending) params.append('includePending', 'true');
    return this.fetchGet(
      this.accountEndpoint(accountId, '/transactions', params),
    );
  }

  /**
   * Get pending (authorised but not yet posted) transactions for an account.
   * @param accountId The account ID
   * @throws Error if accountId is missing or API call fails
   */
  async getPendingTransactions(
    accountId: string,
  ): Promise<PendingTransactionResponse> {
    if (!accountId) {
      throw new Error('Missing required parameters');
    }
    return this.fetchGet(
      this.accountEndpoint(accountId, '/pending-transactions'),
    );
  }

  /**
   * List the profiles the authenticated user has access to.
   */
  async getProfiles(): Promise<ProfileResponse> {
    return this.fetchGet(createEndpoint(this.host, '/za/pb/v1/profiles'));
  }

  /**
   * List the accounts in a profile.
   * @param profileId The profile ID (see `getProfiles`)
   * @throws Error if profileId is missing or API call fails
   */
  async getProfileAccounts(profileId: string): Promise<ProfileAccountResponse> {
    if (!profileId) {
      throw new Error('Missing required parameters');
    }
    return this.fetchGet(this.profileEndpoint(profileId, '/accounts'));
  }

  /**
   * List the beneficiaries that can be paid from an account in a profile.
   * @param profileId The profile ID
   * @param accountId The account ID
   * @throws Error if either ID is missing or API call fails
   */
  async getProfileBeneficiaries(
    profileId: string,
    accountId: string,
  ): Promise<BeneficiaryResponse> {
    if (!profileId || !accountId) {
      throw new Error('Missing required parameters');
    }
    return this.fetchGet(
      this.profileEndpoint(
        profileId,
        `/accounts/${encodeURIComponent(accountId)}/beneficiaries`,
      ),
    );
  }

  /**
   * Get who must authorise payments from an account in a profile, and within
   * which periods.
   * @param profileId The profile ID
   * @param accountId The account ID
   * @throws Error if either ID is missing or API call fails
   */
  async getAuthorisationSetupDetails(
    profileId: string,
    accountId: string,
  ): Promise<AuthorisationSetupDetailsResponse> {
    if (!profileId || !accountId) {
      throw new Error('Missing required parameters');
    }
    return this.fetchGet(
      this.profileEndpoint(
        profileId,
        `/accounts/${encodeURIComponent(accountId)}/authorisationsetupdetails`,
      ),
    );
  }

  /**
   * List the beneficiary categories.
   */
  async getBeneficiaryCategories(): Promise<BeneficiaryCategoryResponse> {
    return this.fetchGet(
      createEndpoint(this.host, '/za/pb/v1/accounts/beneficiarycategories'),
    );
  }

  /**
   * List the documents (statements, tax certificates, ...) for an account
   * within a date range. Both dates are required by the API.
   * @param accountId The account ID
   * @param fromDate Start date (YYYY-MM-DD)
   * @param toDate End date (YYYY-MM-DD)
   * @throws Error if a parameter is missing or API call fails
   */
  async getDocuments(
    accountId: string,
    fromDate: string,
    toDate: string,
  ): Promise<AccountDocumentResponse> {
    if (!accountId || !fromDate || !toDate) {
      throw new Error('Missing required parameters');
    }
    return this.fetchGet(
      this.accountEndpoint(
        accountId,
        '/documents',
        new URLSearchParams({ fromDate, toDate }),
      ),
    );
  }

  /**
   * Download one document as raw bytes (a PDF for statements).
   * Use the `documentType` and `documentDate` returned by `getDocuments`.
   *
   * @example
   * const pdf = await api.getDocument(id, 'Statement', '2025-06-06');
   * await writeFile('statement.pdf', new Uint8Array(pdf));
   * @throws Error if a parameter is missing or API call fails
   */
  async getDocument(
    accountId: string,
    documentType: string,
    documentDate: string,
  ): Promise<ArrayBuffer> {
    if (!accountId || !documentType || !documentDate) {
      throw new Error('Missing required parameters');
    }
    const endpoint = this.accountEndpoint(
      accountId,
      `/document/${encodeURIComponent(documentType)}/${encodeURIComponent(
        documentDate,
      )}`,
    );
    const response = await this.authorizedFetch(endpoint, {
      method: 'GET',
      headers: { accept: '*/*' },
    });
    return response.arrayBuffer();
  }

  private accountEndpoint(
    accountId: string,
    suffix: string,
    params?: URLSearchParams,
  ): string {
    const qs = params?.toString();
    const query = qs ? `?${qs}` : '';
    return createEndpoint(
      this.host,
      `/za/pb/v1/accounts/${encodeURIComponent(accountId)}${suffix}${query}`,
    );
  }

  private profileEndpoint(profileId: string, suffix: string): string {
    return createEndpoint(
      this.host,
      `/za/pb/v1/profiles/${encodeURIComponent(profileId)}${suffix}`,
    );
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
    const response = await this.authorizedFetch(endpoint, init);
    return (await response.json()) as T;
  }

  /** Sends an authorized request, retrying once on 401; throws on non-2xx. */
  private async authorizedFetch(
    endpoint: string,
    init: RequestInit,
  ): Promise<Response> {
    let response = await this.sendAuthorized(endpoint, init);
    if (response.status === 401) {
      this.invalidateToken();
      response = await this.sendAuthorized(endpoint, init);
    }
    if (!response.ok) {
      throw await this.toApiError(response, endpoint);
    }
    return response;
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
