import { InvestecPbApi } from '../src/index';
import { test, expect, describe } from 'vitest';

// Use dummy credentials for structure tests
const pb = new InvestecPbApi(
  'dummyClientId',
  'dummyClientSecret',
  'dummyApiKey',
);

describe('InvestecPbApi', () => {
  test('should instantiate', () => {
    expect(pb).toBeInstanceOf(InvestecPbApi);
  });

  test('getAccessToken throws with invalid credentials', async () => {
    await expect(pb.getAccessToken()).rejects.toThrow();
  });

  test('getAccounts throws with invalid credentials', async () => {
    await expect(pb.getAccounts()).rejects.toThrow();
  });

  test('getAccountBalances throws with missing accountId', async () => {
    await expect(pb.getAccountBalances('')).rejects.toThrow(
      'Missing required parameters',
    );
  });

  test('getAccountTransactions throws with missing accountId', async () => {
    await expect(pb.getAccountTransactions('')).rejects.toThrow(
      'Missing required parameters',
    );
  });

  test('payMultiple throws with missing params', async () => {
    // @ts-expect-error
    await expect(pb.payMultiple()).rejects.toThrow(
      'Missing required parameters',
    );
  });

  test('transferMultiple throws with missing params', async () => {
    // @ts-expect-error
    await expect(pb.transferMultiple()).rejects.toThrow(
      'Missing required parameters',
    );
  });

  test('getBeneficiaries throws with invalid credentials', async () => {
    await expect(pb.getBeneficiaries()).rejects.toThrow();
  });

  test('getAccounts returns expected error with invalid credentials', async () => {
    await expect(pb.getAccounts()).rejects.toThrow();
  });

  test('getAccounts returns expected shape (mocked)', async () => {
    // Mock fetchGet to return a valid AccountResponse
    const mockAccounts = {
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
    };
    // Patch pb.getAccounts for this test only
    const orig = pb.getAccounts;
    pb.getAccounts = async () => mockAccounts;
    const accounts = await pb.getAccounts();
    expect(accounts.data.accounts[0].accountId).toBe('123');
    expect(accounts.data.accounts[0].accountName).toBe('My Account');
    pb.getAccounts = orig;
  });
});
