# Investec PB API

Connect with the Investec Card API.

[![Node.js CI](https://github.com/devinpearson/investec-pb-api/actions/workflows/node.js.yml/badge.svg)](https://github.com/devinpearson/investec-pb-api/actions/workflows/node.js.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/investec-pb-api.svg)](https://badge.fury.io/js/investec-pb-api)

## About

A basic package to connect to the investec private banking api.
It was created to service the investec-ipb command line application.

## Installation

Install the package using npm:

```
npm i investec-pb-api
```

## Usage

Import the connector into your code:

```typescript
import { InvestecPbApi } from 'investec-pb-api';
```

Create a new instance of the InvestecPbApi class:

```typescript
const pb = new InvestecPbApi('<clientId>', '<clientSecret>', '<apiKey>');
```

Fetch a list of accounts:

```typescript
const accounts = await pb.getAccounts();
```

Fetch account balances:

```typescript
const balances = await pb.getAccountBalances(accountId);
```

Fetch a list of transactions:

```typescript
const accounts = await pb.getAccountTransactions(accountId);
```

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
