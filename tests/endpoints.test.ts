import { afterEach, describe, expect, test, vi } from 'vitest';
import { InvestecApiError, InvestecPbApi } from '../src/index';

const HOST = 'https://openapi.investec.com';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const auth = jsonResponse({
  access_token: 'test-token',
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'accounts',
});

function setup(...responses: Response[]) {
  const fetchMock = vi.fn();
  fetchMock.mockResolvedValueOnce(auth.clone());
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal('fetch', fetchMock);
  const api = new InvestecPbApi('id', 'secret', 'key', HOST);
  /** URL and init of the first API call (after the token request). */
  const call = () => {
    const [url, init] = fetchMock.mock.calls[1]!;
    return { url: new URL(String(url)), init };
  };
  return { api, fetchMock, call };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getAccountTransactions query object', () => {
  test('sends includePending=true along with the other filters', async () => {
    const { api, call } = setup(jsonResponse({ data: { transactions: [] } }));
    await api.getAccountTransactions('acc 1', {
      fromDate: '2024-01-01',
      toDate: '2024-01-31',
      transactionType: 'CardPurchases',
      includePending: true,
    });
    const { url } = call();
    expect(url.pathname).toBe('/za/pb/v1/accounts/acc%201/transactions');
    expect(url.searchParams.get('fromDate')).toBe('2024-01-01');
    expect(url.searchParams.get('toDate')).toBe('2024-01-31');
    expect(url.searchParams.get('transactionType')).toBe('CardPurchases');
    expect(url.searchParams.get('includePending')).toBe('true');
  });

  test('omits includePending when false and sends no query when empty', async () => {
    const { api, call } = setup(jsonResponse({ data: { transactions: [] } }));
    await api.getAccountTransactions('acc-1', { includePending: false });
    expect(call().url.search).toBe('');
  });

  test('positional filters still work', async () => {
    const { api, call } = setup(jsonResponse({ data: { transactions: [] } }));
    await api.getAccountTransactions('acc-1', '2024-01-01', null, 'Deposits');
    const { url } = call();
    expect(url.searchParams.get('fromDate')).toBe('2024-01-01');
    expect(url.searchParams.has('toDate')).toBe(false);
    expect(url.searchParams.get('transactionType')).toBe('Deposits');
    expect(url.searchParams.has('includePending')).toBe(false);
  });
});

describe('getPendingTransactions', () => {
  test('calls the pending-transactions endpoint', async () => {
    const body = {
      data: {
        transactions: [
          {
            accountId: 'acc-1',
            type: 'DEBIT',
            status: 'PENDING',
            description: 'Coffee',
            transactionDate: '2024-01-01',
            amount: 35,
          },
        ],
      },
    };
    const { api, call } = setup(jsonResponse(body));
    const res = await api.getPendingTransactions('acc/1');
    expect(call().url.pathname).toBe(
      '/za/pb/v1/accounts/acc%2F1/pending-transactions',
    );
    expect(call().init.method).toBe('GET');
    expect(res).toEqual(body);
  });

  test('requires accountId', async () => {
    const { api, fetchMock } = setup();
    await expect(api.getPendingTransactions('')).rejects.toThrow(
      'Missing required parameters',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('profiles', () => {
  test('getProfiles lists profiles', async () => {
    const body = {
      data: [{ profileId: 'p1', profileName: 'A', defaultProfile: true }],
    };
    const { api, call } = setup(jsonResponse(body));
    expect(await api.getProfiles()).toEqual(body);
    expect(call().url.pathname).toBe('/za/pb/v1/profiles');
  });

  test('getProfileAccounts encodes the profile ID', async () => {
    const { api, call } = setup(jsonResponse({ data: [] }));
    await api.getProfileAccounts('p 1');
    expect(call().url.pathname).toBe('/za/pb/v1/profiles/p%201/accounts');
  });

  test('getProfileBeneficiaries encodes both IDs', async () => {
    const { api, call } = setup(jsonResponse({ data: [] }));
    await api.getProfileBeneficiaries('p/1', 'a 1');
    expect(call().url.pathname).toBe(
      '/za/pb/v1/profiles/p%2F1/accounts/a%201/beneficiaries',
    );
  });

  test('getAuthorisationSetupDetails encodes both IDs', async () => {
    const body = {
      data: {
        numberOfAuthorisationRequired: '2',
        period: [{ id: '1', description: '1 Working day' }],
        authorisersListA: [{ authoriserId: 'x', name: 'Auth 1' }],
        authorisersListB: [],
      },
    };
    const { api, call } = setup(jsonResponse(body));
    expect(await api.getAuthorisationSetupDetails('p/1', 'a 1')).toEqual(body);
    expect(call().url.pathname).toBe(
      '/za/pb/v1/profiles/p%2F1/accounts/a%201/authorisationsetupdetails',
    );
  });

  test.each([
    ['getProfileAccounts', (api: InvestecPbApi) => api.getProfileAccounts('')],
    [
      'getProfileBeneficiaries without profileId',
      (api: InvestecPbApi) => api.getProfileBeneficiaries('', 'a'),
    ],
    [
      'getProfileBeneficiaries without accountId',
      (api: InvestecPbApi) => api.getProfileBeneficiaries('p', ''),
    ],
    [
      'getAuthorisationSetupDetails without profileId',
      (api: InvestecPbApi) => api.getAuthorisationSetupDetails('', 'a'),
    ],
    [
      'getAuthorisationSetupDetails without accountId',
      (api: InvestecPbApi) => api.getAuthorisationSetupDetails('p', ''),
    ],
  ])('%s throws before calling the API', async (_name, run) => {
    const { api, fetchMock } = setup();
    await expect(run(api)).rejects.toThrow('Missing required parameters');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('getBeneficiaryCategories', () => {
  test('calls the beneficiarycategories endpoint', async () => {
    const body = {
      data: [
        {
          CategoryId: 'c1',
          DefaultCategory: 'true',
          CategoryName: 'Not Categorised',
        },
      ],
    };
    const { api, call } = setup(jsonResponse(body));
    expect(await api.getBeneficiaryCategories()).toEqual(body);
    expect(call().url.pathname).toBe(
      '/za/pb/v1/accounts/beneficiarycategories',
    );
  });
});

describe('documents', () => {
  test('getDocuments sends the date range', async () => {
    const body = {
      data: [{ documentType: 'Statement', documentDate: '2024-01-04' }],
    };
    const { api, call } = setup(jsonResponse(body));
    expect(await api.getDocuments('acc-1', '2024-01-01', '2024-02-01')).toEqual(
      body,
    );
    const { url } = call();
    expect(url.pathname).toBe('/za/pb/v1/accounts/acc-1/documents');
    expect(url.searchParams.get('fromDate')).toBe('2024-01-01');
    expect(url.searchParams.get('toDate')).toBe('2024-02-01');
  });

  test.each<[string, [string, string, string]]>([
    ['accountId', ['', '2024-01-01', '2024-02-01']],
    ['fromDate', ['acc', '', '2024-02-01']],
    ['toDate', ['acc', '2024-01-01', '']],
  ])('getDocuments requires %s', async (_name, args) => {
    const { api, fetchMock } = setup();
    await expect(api.getDocuments(...args)).rejects.toThrow(
      'Missing required parameters',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('getDocument returns the raw bytes', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7 test');
    const { api, call } = setup(
      new Response(pdf, { headers: { 'content-type': 'application/pdf' } }),
    );
    const bytes = await api.getDocument('acc 1', 'Statement', '2024-01-04');
    expect(new Uint8Array(bytes)).toEqual(pdf);
    const { url, init } = call();
    expect(url.pathname).toBe(
      '/za/pb/v1/accounts/acc%201/document/Statement/2024-01-04',
    );
    expect(init.method).toBe('GET');
    expect(init.headers.accept).toBe('*/*');
    expect(init.headers.Authorization).toBe('Bearer test-token');
  });

  test.each<[string, [string, string, string]]>([
    ['accountId', ['', 'Statement', '2024-01-04']],
    ['documentType', ['acc', '', '2024-01-04']],
    ['documentDate', ['acc', 'Statement', '']],
  ])('getDocument requires %s', async (_name, args) => {
    const { api, fetchMock } = setup();
    await expect(api.getDocument(...args)).rejects.toThrow(
      'Missing required parameters',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('getDocument maps errors to InvestecApiError', async () => {
    const { api } = setup(new Response('not found', { status: 404 }));
    const err = await api
      .getDocument('acc', 'Statement', '1999-01-01')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvestecApiError);
    expect((err as InvestecApiError).status).toBe(404);
  });

  test('getDocument retries once on 401', async () => {
    const pdf = new TextEncoder().encode('%PDF');
    const { api, fetchMock } = setup(
      new Response('', { status: 401 }),
      auth.clone(),
      new Response(pdf),
    );
    const bytes = await api.getDocument('acc', 'Statement', '2024-01-04');
    expect(new Uint8Array(bytes)).toEqual(pdf);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
