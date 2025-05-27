import { InvestecPbApi } from '../src/index';
import { test, expect } from 'vitest';

const pb = new InvestecPbApi('', '', '');

test('get an access token', async () => {
  let dateTime = new Date();
  const token = await pb.getAccessToken();
  //console.log(token);
  expect(token.access_token).toBeTypeOf('string');
});

test('get account list', async () => {
  const cards = await pb.getAccounts();
  expect(cards.data.cards[0].CardKey).toBeTypeOf('string');
  expect(cards.data).toBeDefined();
  expect(cards.links).toBeDefined();
  expect(cards.meta).toBeDefined();
});
