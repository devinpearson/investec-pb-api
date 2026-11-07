import { afterEach, describe, expect, test, vi } from 'vitest';
import { InvestecApiError, InvestecPbApi } from '../src/index';

const HOST = 'https://openapi.investec.com';
const SANDBOX = 'https://openapisandbox.investec.com';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'content-type': 'application/json' },
  });
}

function textResponse(body: string, status: number, statusText = 'Error') {
  return new Response(body, {
    status,
    statusText,
    headers: { 'content-type': 'text/plain' },
  });
}

function authResponse(expiresIn = 3600, accessToken = 'test-token') {
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: 'accounts',
  };
}

function setupFetch(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('InvestecApiError', () => {
  test('prefers trimmed body in message', () => {
    const error = new InvestecApiError(
      500,
      'https://example/x',
      'Internal Server Error',
      '  boom  ',
    );
    expect(error.name).toBe('InvestecApiError');
    expect(error.message).toBe('Investec API request failed (500): boom');
    expect(error.status).toBe(500);
    expect(error.endpoint).toBe('https://example/x');
    expect(error.body).toBe('  boom  ');
  });

  test('falls back to statusText when body is empty', () => {
    const error = new InvestecApiError(
      403,
      'https://example/x',
      'Forbidden',
      '',
    );
    expect(error.message).toBe('Investec API request failed (403): Forbidden');
  });

  test('falls back to statusText when body is only whitespace', () => {
    const error = new InvestecApiError(
      404,
      'https://example/x',
      'Not Found',
      '   ',
    );
    expect(error.message).toBe('Investec API request failed (404): Not Found');
  });

  test('omits detail when body and statusText are empty', () => {
    const error = new InvestecApiError(418, 'https://example/x', '');
    expect(error.message).toBe('Investec API request failed (418)');
    expect(error.body).toBeUndefined();
  });
});

describe('InvestecPbApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('defaults to production host', async () => {
    const fetchMock = setupFetch(jsonResponse(authResponse()));
    const pb = new InvestecPbApi('id', 'secret', 'key');
    await pb.getAccessToken();
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `${HOST}/identity/v2/oauth2/token`,
    );
  });

  test('uses custom host when provided', async () => {
    const fetchMock = setupFetch(jsonResponse(authResponse()));
    const pb = new InvestecPbApi('id', 'secret', 'key', SANDBOX);
    await pb.getAccessToken();
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `${SANDBOX}/identity/v2/oauth2/token`,
    );
  });

  test('should instantiate', () => {
    const pb = new InvestecPbApi('id', 'secret', 'key');
    expect(pb).toBeInstanceOf(InvestecPbApi);
  });

  test('getAccountBalances throws with missing accountId', async () => {
    const pb = new InvestecPbApi('id', 'secret', 'key');
    await expect(pb.getAccountBalances('')).rejects.toThrow(
      'Missing required parameters',
    );
  });

  test('getAccountTransactions throws with missing accountId', async () => {
    const pb = new InvestecPbApi('id', 'secret', 'key');
    await expect(pb.getAccountTransactions('')).rejects.toThrow(
      'Missing required parameters',
    );
  });

  test('payMultiple throws with missing params', async () => {
    const pb = new InvestecPbApi('id', 'secret', 'key');
    await expect(
      // @ts-expect-error intentional missing args
      pb.payMultiple(),
    ).rejects.toThrow('Missing required parameters');
  });

  test('payMultiple throws when accountId is missing', async () => {
    const pb = new InvestecPbApi('id', 'secret', 'key');
    await expect(
      pb.payMultiple('', {
        beneficiaryId: 'b',
        amount: '1.00',
        myReference: 'm',
        theirReference: 't',
      }),
    ).rejects.toThrow('Missing required parameters');
  });

  test('transferMultiple throws with missing params', async () => {
    const pb = new InvestecPbApi('id', 'secret', 'key');
    await expect(
      // @ts-expect-error intentional missing args
      pb.transferMultiple(),
    ).rejects.toThrow('Missing required parameters');
  });

  test('transferMultiple throws when only accountId is missing', async () => {
    const fetchMock = setupFetch();
    const pb = new InvestecPbApi('id', 'secret', 'key');
    await expect(
      pb.transferMultiple('', {
        beneficiaryAccountId: 'b',
        amount: '1.00',
        myReference: 'm',
        theirReference: 't',
      }),
    ).rejects.toThrow('Missing required parameters');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('getAccessToken posts to identity endpoint and stores token', async () => {
    const fetchMock = setupFetch(jsonResponse(authResponse()));
    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const result = await pb.getAccessToken();

    expect(result.access_token).toBe('test-token');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${HOST}/identity/v2/oauth2/token`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('grant_type=client_credentials');
    expect(init.headers['x-api-key']).toBe('key');
    expect(init.headers['content-type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from('id:secret').toString('base64')}`,
    );
  });

  test('getAccessToken throws InvestecApiError on failure', async () => {
    setupFetch(textResponse('bad credentials', 401, 'Unauthorized'));
    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const error = await pb.getAccessToken().catch((e) => e);

    expect(error).toBeInstanceOf(InvestecApiError);
    expect(error.status).toBe(401);
    expect(error.body).toBe('bad credentials');
  });

  test('getToken returns cached token until expiry', async () => {
    const fetchMock = setupFetch(jsonResponse(authResponse(3600)));
    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);

    const first = await pb.getToken();
    const second = await pb.getToken();
    expect(first).toBe('test-token');
    expect(second).toBe('test-token');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('getAccounts uses bearer token and correct path', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({
        data: {
          accounts: [
            {
              accountId: '123',
              accountNumber: '123456789',
              accountName: 'My Account',
              referenceName: 'Ref',
              productName: 'Private Bank Account',
              kycCompliant: true,
              profileId: 'abc',
              profileName: 'John Doe',
            },
          ],
        },
      }),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const accounts = await pb.getAccounts();

    expect(accounts.data.accounts[0]?.accountId).toBe('123');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe(`${HOST}/za/pb/v1/accounts`);
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(init.method).toBe('GET');
    expect(init.headers['content-type']).toBe('application/json');
  });

  test('getAccountBalances encodes accountId and returns balance', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({
        data: {
          accountId: 'acc/1',
          currentBalance: 100,
          availableBalance: 90,
          budgetBalance: 0,
          straightBalance: 0,
          cashBalance: 90,
          currency: 'ZAR',
        },
      }),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const balance = await pb.getAccountBalances('acc/1');

    expect(balance.data.availableBalance).toBe(90);
    expect(fetchMock.mock.calls[1]![0]).toBe(
      `${HOST}/za/pb/v1/accounts/acc%2F1/balance`,
    );
  });

  test('getAccountTransactions omits query when filters are null', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({ data: { transactions: [] } }),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    await pb.getAccountTransactions('acc-1');

    expect(fetchMock.mock.calls[1]![0]).toBe(
      `${HOST}/za/pb/v1/accounts/acc-1/transactions`,
    );
  });

  test('getAccountTransactions appends provided filters', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({
        data: {
          transactions: [
            {
              accountId: 'acc-1',
              type: 'DEBIT',
              transactionType: 'CardPurchases',
              status: 'POSTED',
              description: 'Coffee',
              cardNumber: null,
              postedOrder: 1,
              postingDate: '2024-01-02',
              valueDate: '2024-01-02',
              actionDate: '2024-01-02',
              transactionDate: '2024-01-01',
              amount: -42,
              runningBalance: 100,
              uuid: 'tx-1',
            },
          ],
        },
      }),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const result = await pb.getAccountTransactions(
      'acc-1',
      '2024-01-01',
      '2024-01-31',
      'DEBIT',
    );

    expect(result.data.transactions).toHaveLength(1);
    const url = new URL(String(fetchMock.mock.calls[1]![0]));
    expect(url.pathname).toBe('/za/pb/v1/accounts/acc-1/transactions');
    expect(url.searchParams.get('fromDate')).toBe('2024-01-01');
    expect(url.searchParams.get('toDate')).toBe('2024-01-31');
    expect(url.searchParams.get('transactionType')).toBe('DEBIT');
  });

  test('getAccountTransactions supports partial filters', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({ data: { transactions: [] } }),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    await pb.getAccountTransactions('acc-1', '2024-01-01');

    const url = new URL(String(fetchMock.mock.calls[1]![0]));
    expect(url.searchParams.get('fromDate')).toBe('2024-01-01');
    expect(url.searchParams.has('toDate')).toBe(false);
    expect(url.searchParams.has('transactionType')).toBe(false);
  });

  test('getAccountTransactions omits fromDate when only toDate is given', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({ data: { transactions: [] } }),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    await pb.getAccountTransactions('acc-1', null, '2024-02-01');

    const url = new URL(String(fetchMock.mock.calls[1]![0]));
    expect(url.searchParams.has('fromDate')).toBe(false);
    expect(url.searchParams.get('toDate')).toBe('2024-02-01');
  });

  test('getBeneficiaries returns beneficiary list', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({
        data: [
          {
            beneficiaryId: 'ben-1',
            accountNumber: '123',
            code: '000000',
            bank: 'Investec',
            beneficiaryName: 'Alex',
            lastPaymentAmount: '10.00',
            lastPaymentDate: '2024-01-01',
            cellNo: '',
            emailAddress: '',
            name: 'Alex',
            referenceAccountNumber: '123',
            referenceName: 'Alex',
            categoryId: 'cat',
            profileId: 'prof',
            fasterPaymentAllowed: true,
          },
        ],
        links: { self: 'https://example/self' },
        meta: { totalPages: 1 },
      }),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const result = await pb.getBeneficiaries();

    expect(result.data[0]?.beneficiaryId).toBe('ben-1');
    expect(fetchMock.mock.calls[1]![0]).toBe(
      `${HOST}/za/pb/v1/accounts/beneficiaries`,
    );
  });

  test('payMultiple and transferMultiple use single-slash paths', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({ data: { TransferResponses: [] } }),
      jsonResponse({ data: { TransferResponses: [] } }),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    await pb.payMultiple('acc-1', {
      beneficiaryId: 'ben-1',
      amount: '10.00',
      myReference: 'mine',
      theirReference: 'theirs',
    });
    await pb.transferMultiple('acc-1', {
      beneficiaryAccountId: 'acc-2',
      amount: '20.00',
      myReference: 'mine',
      theirReference: 'theirs',
    });

    expect(fetchMock.mock.calls[1]![0]).toBe(
      `${HOST}/za/pb/v1/accounts/acc-1/paymultiple`,
    );
    expect(fetchMock.mock.calls[2]![0]).toBe(
      `${HOST}/za/pb/v1/accounts/acc-1/transfermultiple`,
    );
    expect(String(fetchMock.mock.calls[1]![0])).not.toContain('/za//pb');
  });

  test('payMultiple wraps a single payment and posts paymentList', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({ data: { TransferResponses: [] } }),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const payment = {
      beneficiaryId: 'ben-1',
      amount: '10.00',
      myReference: 'mine',
      theirReference: 'theirs',
    };
    await pb.payMultiple('acc-1', payment);

    const init = fetchMock.mock.calls[1]![1];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ paymentList: [payment] });
  });

  test('payMultiple posts an array of payments unchanged', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({ data: { TransferResponses: [] } }),
    );

    const payments = [
      {
        beneficiaryId: 'ben-1',
        amount: '10.00',
        myReference: 'mine',
        theirReference: 'theirs',
      },
      {
        beneficiaryId: 'ben-2',
        amount: '5.00',
        myReference: 'mine-2',
        theirReference: 'theirs-2',
      },
    ];
    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    await pb.payMultiple('acc-1', payments);

    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({
      paymentList: payments,
    });
  });

  test('transferMultiple wraps a single transfer into transferList', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({ data: { TransferResponses: [] } }),
    );

    const transfer = {
      beneficiaryAccountId: 'acc-2',
      amount: '20.00',
      myReference: 'mine',
      theirReference: 'theirs',
    };
    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    await pb.transferMultiple('acc-1', transfer);

    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({
      transferList: [transfer],
    });
  });

  test('transferMultiple posts array payload and optional profileId', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({
        data: {
          TransferResponses: [
            {
              PaymentReferenceNumber: 'ref-1',
              PaymentDate: '2024-01-01',
              Status: 'Success',
              BeneficiaryName: 'Alex',
              BeneficiaryAccountId: 'acc-2',
              AuthorisationRequired: false,
              ErrorMessage: '',
            },
          ],
        },
      }),
    );

    const transfers = [
      {
        beneficiaryAccountId: 'acc-2',
        amount: '20.00',
        myReference: 'mine',
        theirReference: 'theirs',
        profileId: 'profile-1',
      },
    ];
    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const result = await pb.transferMultiple('acc-1', transfers);

    expect(result.data.TransferResponses[0]?.PaymentReferenceNumber).toBe(
      'ref-1',
    );
    const init = fetchMock.mock.calls[1]![1];
    expect(JSON.parse(init.body)).toEqual({ transferList: transfers });
  });

  test('reuses token until near expiry then refreshes', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse(3600)),
      jsonResponse({ data: { accounts: [] } }),
      jsonResponse({ data: { accounts: [] } }),
      jsonResponse(authResponse(0)),
      jsonResponse(authResponse(3600)),
      jsonResponse({ data: { accounts: [] } }),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    await pb.getAccounts();
    await pb.getAccounts();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // expires_in: 0 + skew leaves token immediately stale
    await pb.getAccessToken();
    await pb.getAccounts();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls[4]![0]).toBe(
      `${HOST}/identity/v2/oauth2/token`,
    );
  });

  test('keeps a token for expires_in minus the skew, in seconds', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = setupFetch(
        jsonResponse(authResponse(3600, 'first')),
        jsonResponse(authResponse(3600, 'second')),
      );
      const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
      expect(await pb.getToken()).toBe('first');

      // 3600s - 60s skew = 3540s of validity
      vi.advanceTimersByTime(3539 * 1000);
      expect(await pb.getToken()).toBe('first');
      expect(fetchMock).toHaveBeenCalledOnce();

      vi.advanceTimersByTime(2 * 1000);
      expect(await pb.getToken()).toBe('second');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test('coalesces concurrent token refreshes', async () => {
    let resolveAuth!: (value: Response) => void;
    const authPending = new Promise<Response>((resolve) => {
      resolveAuth = resolve;
    });

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/oauth2/token')) {
        return authPending;
      }
      return Promise.resolve(jsonResponse({ data: { accounts: [] } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const first = pb.getAccounts();
    const second = pb.getAccounts();

    resolveAuth(jsonResponse(authResponse()));
    await Promise.all([first, second]);

    const authCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/oauth2/token'),
    );
    expect(authCalls).toHaveLength(1);
  });

  test('retries once after 401 by refreshing the token', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse(3600, 'old-token')),
      jsonResponse({ message: 'expired' }, 401),
      jsonResponse(authResponse(3600, 'fresh-token')),
      jsonResponse({ data: { accounts: [] } }),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const result = await pb.getAccounts();

    expect(result.data.accounts).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3]![1].headers.Authorization).toBe(
      'Bearer fresh-token',
    );
  });

  test('throws when 401 retry also fails', async () => {
    const fetchMock = setupFetch(
      jsonResponse(authResponse(3600, 'old-token')),
      jsonResponse({ message: 'expired' }, 401),
      jsonResponse(authResponse(3600, 'fresh-token')),
      textResponse('still forbidden', 403, 'Forbidden'),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const error = await pb.getAccounts().catch((e) => e);

    expect(error).toBeInstanceOf(InvestecApiError);
    expect(error.status).toBe(403);
    expect(error.body).toBe('still forbidden');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test('throws InvestecApiError with status and body', async () => {
    setupFetch(
      jsonResponse(authResponse()),
      jsonResponse({ message: 'nope' }, 404),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const error = await pb.getAccounts().catch((e) => e);

    expect(error).toBeInstanceOf(InvestecApiError);
    expect(error.status).toBe(404);
    expect(error.endpoint).toBe(`${HOST}/za/pb/v1/accounts`);
    expect(error.body).toContain('nope');
    expect(error.message).not.toContain('Card not found');
  });

  test('throws InvestecApiError when POST fails', async () => {
    setupFetch(
      jsonResponse(authResponse()),
      textResponse('payment failed', 400, 'Bad Request'),
    );

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const error = await pb
      .payMultiple('acc-1', {
        beneficiaryId: 'ben-1',
        amount: '10.00',
        myReference: 'mine',
        theirReference: 'theirs',
      })
      .catch((e) => e);

    expect(error).toBeInstanceOf(InvestecApiError);
    expect(error.status).toBe(400);
    expect(error.body).toBe('payment failed');
  });

  test('still throws InvestecApiError if reading error body fails', async () => {
    const broken = {
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => {
        throw new Error('stream failed');
      },
    } as unknown as Response;

    setupFetch(jsonResponse(authResponse()), broken);

    const pb = new InvestecPbApi('id', 'secret', 'key', HOST);
    const error = await pb.getAccounts().catch((e) => e);

    expect(error).toBeInstanceOf(InvestecApiError);
    expect(error.status).toBe(502);
    expect(error.body).toBeUndefined();
    expect(error.message).toContain('Bad Gateway');
  });
});
