import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  InvestecApiError,
  InvestecPbApi,
  type InvestecPbApiOptions,
  InvestecValidationError,
} from '../src/index';

const creds = { clientId: 'id', clientSecret: 'secret', apiKey: 'key' };

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    ...init,
  });

const token = (expiresIn: number | string = 3600, accessToken = 'tok') =>
  json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: 'accounts',
  });

const status = (code: number, headers: Record<string, string> = {}) =>
  new Response('err', { status: code, headers });

const accounts = () => json({ data: { accounts: [] } });

/** Client with an injected fetch that returns the given responses in order. */
function client(
  responses: (Response | Error)[],
  options: Partial<InvestecPbApiOptions> = {},
) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const r of responses) {
    if (r instanceof Error) fetchMock.mockRejectedValueOnce(r);
    else fetchMock.mockResolvedValueOnce(r);
  }
  const api = new InvestecPbApi({ ...creds, fetch: fetchMock, ...options });
  const urls = () => fetchMock.mock.calls.map(([url]) => String(url));
  return { api, fetchMock, urls };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('options constructor', () => {
  test('uses the injected fetch instead of the global one', async () => {
    const globalFetch = vi.fn();
    vi.stubGlobal('fetch', globalFetch);
    const { api, fetchMock } = client([token(), accounts()]);
    await api.getAccounts();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  test('defaults to the production host', async () => {
    const { api, urls } = client([token()]);
    await api.getAccessToken();
    expect(urls()[0]).toBe(
      'https://openapi.investec.com/identity/v2/oauth2/token',
    );
  });

  test('applies timeoutMs to every request', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const { api } = client([token(), accounts()], { timeoutMs: 1234 });
    await api.getAccounts();
    expect(timeout).toHaveBeenCalledTimes(2);
    expect(timeout).toHaveBeenNthCalledWith(1, 1234);
    expect(timeout).toHaveBeenNthCalledWith(2, 1234);
  });

  test('defaults the timeout to 30 seconds', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const { api } = client([token()]);
    await api.getAccessToken();
    expect(timeout).toHaveBeenCalledWith(30_000);
  });

  test('positional constructor still works and uses the global fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(token());
    vi.stubGlobal('fetch', fetchMock);
    const api = new InvestecPbApi(
      'id',
      'secret',
      'key',
      'https://sandbox.test',
    );
    await api.getAccessToken();
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://sandbox.test/identity/v2/oauth2/token',
    );
  });
});

describe('host handling', () => {
  test.each([
    [
      'https://proxy.test/investec',
      'https://proxy.test/investec/za/pb/v1/accounts',
    ],
    [
      'https://proxy.test/investec/',
      'https://proxy.test/investec/za/pb/v1/accounts',
    ],
    ['https://api.test//', 'https://api.test/za/pb/v1/accounts'],
    ['http://localhost:3000', 'http://localhost:3000/za/pb/v1/accounts'],
  ])('host %s keeps its path prefix', async (host, expected) => {
    const { api, urls } = client([token(), accounts()], { host });
    await api.getAccounts();
    expect(urls()[1]).toBe(expected);
  });
});

describe('authentication', () => {
  test('builds the Basic header without Buffer', async () => {
    const { api, fetchMock } = client([token()]);
    await api.getAccessToken();
    const init = fetchMock.mock.calls[0]![1]!;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${btoa('id:secret')}`);
  });

  test('normalises a string expires_in to a number', async () => {
    const { api, fetchMock } = client([token('1799'), accounts(), accounts()]);
    const auth = await api.getAccessToken();
    expect(auth.expires_in).toBe(1799);
    await api.getAccounts();
    await api.getAccounts();
    // token reused: 1 token call + 2 account calls
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('treats a missing expires_in as already expired', async () => {
    const { api, fetchMock } = client([
      json({ access_token: 'a', token_type: 'Bearer', scope: 'accounts' }),
      token(3600, 'b'),
    ]);
    await api.getAccessToken();
    expect(await api.getToken()).toBe('b');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('validation', () => {
  test.each([
    [
      'getAccountBalances',
      'accountId',
      (a: InvestecPbApi) => a.getAccountBalances(''),
    ],
    [
      'getProfileBeneficiaries',
      'accountId',
      (a: InvestecPbApi) => a.getProfileBeneficiaries('p', ''),
    ],
    [
      'getDocuments',
      'toDate',
      (a: InvestecPbApi) => a.getDocuments('a', '2024-01-01', ''),
    ],
    [
      'getDocument',
      'documentType',
      (a: InvestecPbApi) => a.getDocument('a', '', '2024-01-01'),
    ],
  ])('%s names the missing %s', async (_method, parameter, run) => {
    const { api, fetchMock } = client([]);
    const err = await run(api).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvestecValidationError);
    expect(err).toBeInstanceOf(Error);
    expect((err as InvestecValidationError).parameter).toBe(parameter);
    expect((err as InvestecValidationError).name).toBe(
      'InvestecValidationError',
    );
    expect((err as Error).message).toBe(
      `Missing required parameters: ${parameter}`,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects an empty transfer list before calling the API', async () => {
    const { api, fetchMock } = client([]);
    const err = await api.transferMultiple('acc', []).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvestecValidationError);
    expect((err as InvestecValidationError).parameter).toBe('transfers');
    expect((err as Error).message).toBe(
      'transfers must contain at least one transfer',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects an empty payment list before calling the API', async () => {
    const { api, fetchMock } = client([]);
    const err = await api.payMultiple('acc', []).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvestecValidationError);
    expect((err as InvestecValidationError).parameter).toBe('payments');
    expect((err as Error).message).toBe(
      'payments must contain at least one payment',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('treats null as missing', async () => {
    const { api, fetchMock } = client([]);
    const err = await api
      // @ts-expect-error intentional null argument
      .getAccountBalances(null)
      .catch((e: unknown) => e);
    expect((err as InvestecValidationError).parameter).toBe('accountId');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('names the missing list when payments is undefined', async () => {
    const { api } = client([]);
    // @ts-expect-error intentional missing argument
    const err = await api.payMultiple('acc').catch((e: unknown) => e);
    expect((err as InvestecValidationError).parameter).toBe('payments');
  });
});

describe('empty response bodies', () => {
  test('a 204 resolves to undefined instead of throwing', async () => {
    const { api } = client([token(), new Response(null, { status: 204 })]);
    await expect(api.getAccounts()).resolves.toBeUndefined();
  });

  test('a 200 with an empty body resolves to undefined', async () => {
    const { api } = client([token(), new Response('', { status: 200 })]);
    await expect(api.getAccounts()).resolves.toBeUndefined();
  });
});

describe('retries', () => {
  test('are off by default', async () => {
    const { api, fetchMock } = client([token(), status(503)]);
    await expect(api.getAccounts()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test.each([429, 500, 502, 503, 504])(
    'retry a GET after %i and succeed',
    async (code) => {
      const { api, fetchMock } = client([token(), status(code), accounts()], {
        retries: 1,
        retryDelayMs: 0,
      });
      await expect(api.getAccounts()).resolves.toEqual({
        data: { accounts: [] },
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
  );

  test('do not retry other error statuses', async () => {
    const { api, fetchMock } = client([token(), status(404)], {
      retries: 3,
      retryDelayMs: 0,
    });
    await expect(api.getAccounts()).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('give up after the configured number and throw the last error', async () => {
    const { api, fetchMock } = client(
      [token(), status(503), status(502), status(500)],
      { retries: 2, retryDelayMs: 0 },
    );
    const err = await api.getAccounts().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvestecApiError);
    expect((err as InvestecApiError).status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test('retry network errors on GET', async () => {
    const { api, fetchMock } = client(
      [token(), new TypeError('fetch failed'), accounts()],
      { retries: 1, retryDelayMs: 0 },
    );
    await expect(api.getAccounts()).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('rethrow a network error once retries run out', async () => {
    const { api } = client([token(), new TypeError('fetch failed')]);
    await expect(api.getAccounts()).rejects.toThrow('fetch failed');
  });

  test('never retry payments or transfers', async () => {
    const payment = {
      beneficiaryId: 'b',
      amount: '1.00',
      myReference: 'm',
      theirReference: 't',
    };
    const { api, fetchMock } = client(
      [token(), status(503), new TypeError('fetch failed')],
      { retries: 3, retryDelayMs: 0 },
    );
    await expect(api.payMultiple('acc', payment)).rejects.toMatchObject({
      status: 503,
    });
    await expect(
      api.transferMultiple('acc', {
        beneficiaryAccountId: 'b',
        amount: '1.00',
        myReference: 'm',
        theirReference: 't',
      }),
    ).rejects.toThrow('fetch failed');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('do not retry a failed token request', async () => {
    const { api, fetchMock } = client([status(401)], {
      retries: 3,
      retryDelayMs: 0,
    });
    await expect(api.getAccounts()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('still refresh the token once on 401', async () => {
    const { api, fetchMock } = client(
      [token(3600, 'old'), status(401), token(3600, 'new'), accounts()],
      { retries: 2, retryDelayMs: 0 },
    );
    await api.getAccounts();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const last = fetchMock.mock.calls[3]![1]!.headers as Record<string, string>;
    expect(last.Authorization).toBe('Bearer new');
  });

  test('back off exponentially from retryDelayMs', async () => {
    vi.useFakeTimers();
    const { api, fetchMock } = client(
      [token(), status(503), status(503), accounts()],
      { retries: 2, retryDelayMs: 100 },
    );
    const done = api.getAccounts();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(99);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(199);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await expect(done).resolves.toBeDefined();
  });

  test('default to a 500 ms base delay', async () => {
    vi.useFakeTimers();
    const { api, fetchMock } = client([token(), status(503), accounts()], {
      retries: 1,
    });
    const done = api.getAccounts();
    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await done;
  });

  test("honour a 429's Retry-After seconds", async () => {
    vi.useFakeTimers();
    const { api, fetchMock } = client(
      [token(), status(429, { 'retry-after': '2' }), accounts()],
      { retries: 1, retryDelayMs: 10 },
    );
    const done = api.getAccounts();
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await done;
  });

  test('ignore Retry-After on statuses other than 429', async () => {
    vi.useFakeTimers();
    const { api, fetchMock } = client(
      [token(), status(503, { 'retry-after': '20' }), accounts()],
      { retries: 1, retryDelayMs: 10 },
    );
    const done = api.getAccounts();
    await vi.advanceTimersByTimeAsync(10);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await done;
  });

  test('cap any single wait at 30 seconds', async () => {
    vi.useFakeTimers();
    const { api, fetchMock } = client(
      [token(), status(429, { 'retry-after': '120' }), accounts()],
      { retries: 1 },
    );
    const done = api.getAccounts();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await done;
  });

  test('back off normally on a 429 without Retry-After', async () => {
    vi.useFakeTimers();
    const { api, fetchMock } = client([token(), status(429), accounts()], {
      retries: 1,
      retryDelayMs: 100,
    });
    const done = api.getAccounts();
    await vi.advanceTimersByTimeAsync(99);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await done;
  });

  test('retry a bodiless 503', async () => {
    const { api, fetchMock } = client(
      [token(), new Response(null, { status: 503 }), accounts()],
      { retries: 1, retryDelayMs: 0 },
    );
    await expect(api.getAccounts()).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test('treat negative retries as zero', async () => {
    const { api, fetchMock } = client([token(), status(503)], {
      retries: -1,
    });
    await expect(api.getAccounts()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
