import fetch from 'node-fetch';
import type {
  AuthResponse,
  AccountResponse,
  AccountBalanceResponse,
  TransferResponse,
} from './index';

const createEndpoint = (host: string, path: string) =>
  new URL(path, host).toString();

export class InvestecPbApi {
  host!: string;
  clientId!: string;
  clientSecret!: string;
  apiKey!: string;
  token!: string;
  expiresIn!: Date;

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

  async transferMultiple(accountId: string, transfers: object): Promise<TransferResponse> {
    if (!accountId || !transfers) {
      throw new Error('Missing required parameters');
    }
    const endpoint = createEndpoint(
      this.host,
      `/za//pb/v1/accounts/${encodeURIComponent(
        accountId,
      )}/transfermultiple`,
    );
    const token = this.token || (await this.getToken());
    return fetchPost<TransferResponse>(endpoint, token, transfers);
  }

  async getAccounts(): Promise<AccountResponse> {
    const endpoint = createEndpoint(this.host, `/za/pb/v1/accounts`);
    const token = this.token || (await this.getToken());
    return fetchGet<AccountResponse>(endpoint, token);
  }

  async getAccountBalances(accountId: string): Promise<AccountBalanceResponse> {
    if (!accountId) {
      throw new Error('Missing required parameters');
    }
    const endpoint = createEndpoint(this.host, `/za/pb/v1/accounts/${encodeURIComponent(accountId)}/balance`);
    const token = this.token || (await this.getToken());
    return fetchGet<AccountBalanceResponse>(endpoint, token);
  }

  async getAccountTransactions(accountId: string, fromDate: string|null, toDate: string|null, transactionType: string|null): Promise<AccountBalanceResponse> {
    if (!accountId) {
      throw new Error('Missing required parameters');
    }
    let url = `/za/pb/v1/accounts/${encodeURIComponent(accountId)}/transactions`;
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (transactionType) params.append('transactionType', transactionType);
    if ([fromDate, toDate, transactionType].some(Boolean)) {
      url += `?${params.toString()}`;
    }
    const endpoint = createEndpoint(this.host, url);
    const token = this.token || (await this.getToken());
    return fetchGet<AccountBalanceResponse>(endpoint, token);
  }

}

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
