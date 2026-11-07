import { beforeAll, describe, expect, test } from 'vitest';
import { type Account, InvestecApiError, type InvestecPbApi } from '../../src';
import { createSimClient, simUrl, uniqueRef } from './simulator';

const today = new Date().toISOString().slice(0, 10);

describe.skipIf(!simUrl)('programmable-banking-sim', () => {
  let api: InvestecPbApi;
  let accounts: Account[];

  beforeAll(async () => {
    api = createSimClient();
    accounts = (await api.getAccounts()).data.accounts;
  });

  async function balanceOf(accountId: string): Promise<number> {
    return (await api.getAccountBalances(accountId)).data.currentBalance;
  }

  describe('authentication', () => {
    test('issues a bearer token for the seeded credentials', async () => {
      const auth = await createSimClient().getAccessToken();
      expect(auth.token_type).toBe('Bearer');
      expect(auth.access_token).toEqual(expect.any(String));
      expect(auth.expires_in).toBeGreaterThan(0);
    });

    test('rejects a wrong client secret with InvestecApiError 401', async () => {
      const bad = createSimClient({ clientSecret: 'wrong' });
      const err = await bad.getAccessToken().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InvestecApiError);
      expect((err as InvestecApiError).status).toBe(401);
      expect((err as InvestecApiError).endpoint).toContain(
        '/identity/v2/oauth2/token',
      );
    });

    test('rejects a wrong API key with InvestecApiError 401', async () => {
      const bad = createSimClient({ apiKey: 'wrong' });
      await expect(bad.getAccounts()).rejects.toMatchObject({ status: 401 });
    });
  });

  describe('accounts', () => {
    test('lists the seeded accounts with the documented fields', () => {
      expect(accounts.length).toBeGreaterThanOrEqual(2);
      for (const account of accounts) {
        expect(account).toEqual(
          expect.objectContaining({
            accountId: expect.any(String),
            accountNumber: expect.any(String),
            accountName: expect.any(String),
            referenceName: expect.any(String),
            productName: expect.any(String),
            kycCompliant: expect.any(Boolean),
            profileId: expect.any(String),
            profileName: expect.any(String),
          }),
        );
      }
    });

    test('returns a numeric balance for an account', async () => {
      const account = accounts[0]!;
      const balance = await api.getAccountBalances(account.accountId);
      expect(balance.data.accountId).toBe(account.accountId);
      expect(balance.data.currentBalance).toEqual(expect.any(Number));
      expect(balance.data.availableBalance).toEqual(expect.any(Number));
      expect(balance.data.currency).toBe('ZAR');
    });

    test('maps an unknown account to InvestecApiError 404', async () => {
      const err = await api
        .getAccountBalances('does-not-exist')
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(InvestecApiError);
      expect((err as InvestecApiError).status).toBe(404);
    });
  });

  describe('transactions', () => {
    test('only returns transactions inside the requested date range', async () => {
      const account = accounts[0]!;
      const from = '2020-01-01';
      const res = await api.getAccountTransactions(
        account.accountId,
        from,
        today,
      );
      for (const tx of res.data.transactions) {
        expect(tx.accountId).toBe(account.accountId);
        expect(tx.postingDate >= from).toBe(true);
        expect(tx.postingDate <= today).toBe(true);
        expect(['DEBIT', 'CREDIT']).toContain(tx.type);
      }
    });

    test('filters by transaction type', async () => {
      const account = accounts[0]!;
      const all = await api.getAccountTransactions(
        account.accountId,
        '2000-01-01',
        today,
      );
      const type = all.data.transactions[0]?.transactionType;
      if (!type) return; // no seeded transactions to filter on
      const filtered = await api.getAccountTransactions(
        account.accountId,
        '2000-01-01',
        today,
        type,
      );
      expect(filtered.data.transactions.length).toBeGreaterThan(0);
      for (const tx of filtered.data.transactions) {
        expect(tx.transactionType).toBe(type);
      }
    });
  });

  describe('transfers', () => {
    test('moves money between two accounts', async () => {
      const [from, to] = [accounts[0]!, accounts[1]!];
      const myReference = uniqueRef('it-out');
      const theirReference = uniqueRef('it-in');
      const [fromBefore, toBefore] = [
        await balanceOf(from.accountId),
        await balanceOf(to.accountId),
      ];

      await api.transferMultiple(from.accountId, {
        beneficiaryAccountId: to.accountId,
        amount: '12.34',
        myReference,
        theirReference,
      });

      expect(await balanceOf(from.accountId)).toBeCloseTo(
        fromBefore - 12.34,
        2,
      );
      expect(await balanceOf(to.accountId)).toBeCloseTo(toBefore + 12.34, 2);

      const out = await api.getAccountTransactions(
        from.accountId,
        today,
        today,
      );
      expect(out.data.transactions).toContainEqual(
        expect.objectContaining({ description: myReference, type: 'DEBIT' }),
      );
    });

    test('maps an unknown beneficiary account to InvestecApiError 404', async () => {
      await expect(
        api.transferMultiple(accounts[0]!.accountId, {
          beneficiaryAccountId: 'does-not-exist',
          amount: '1.00',
          myReference: 'x',
          theirReference: 'x',
        }),
      ).rejects.toMatchObject({ status: 404 });
    });

    // Known simulator divergence: it echoes the request's transferList as
    // `data` instead of `{ TransferResponses: [...] }`. This test passes while
    // the simulator is wrong and starts failing once it is fixed; flip
    // `test.fails` to `test` then.
    test.fails('returns TransferResponses like the real API', async () => {
      const res = await api.transferMultiple(accounts[0]!.accountId, {
        beneficiaryAccountId: accounts[1]!.accountId,
        amount: '0.01',
        myReference: uniqueRef('it-shape'),
        theirReference: uniqueRef('it-shape'),
      });
      expect(Array.isArray(res.data.TransferResponses)).toBe(true);
    });
  });

  describe('beneficiaries and payments', () => {
    // Known simulator divergence: it returns `data: { result: [...] }` rather
    // than `data: [...]`. Flip to `test` once the simulator is fixed.
    test.fails('lists beneficiaries as an array', async () => {
      const res = await api.getBeneficiaries();
      expect(Array.isArray(res.data)).toBe(true);
    });

    test('pays a beneficiary and debits the account', async () => {
      const raw = (await api.getBeneficiaries()).data as unknown as
        | { beneficiaryId: string }[]
        | { result: { beneficiaryId: string }[] };
      const beneficiaries = Array.isArray(raw) ? raw : raw.result;
      const beneficiary = beneficiaries[0];
      expect(beneficiary).toBeDefined();

      const account = accounts[0]!;
      const myReference = uniqueRef('it-pay');
      const before = await balanceOf(account.accountId);

      await api.payMultiple(account.accountId, {
        beneficiaryId: beneficiary!.beneficiaryId,
        amount: '5.50',
        myReference,
        theirReference: myReference,
      });

      expect(await balanceOf(account.accountId)).toBeCloseTo(before - 5.5, 2);
    });

    test('maps an unknown beneficiary to InvestecApiError 404', async () => {
      await expect(
        api.payMultiple(accounts[0]!.accountId, {
          beneficiaryId: 'does-not-exist',
          amount: '1.00',
          myReference: 'x',
          theirReference: 'x',
        }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});
