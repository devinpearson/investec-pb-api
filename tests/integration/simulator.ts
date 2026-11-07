import { InvestecPbApi } from '../../src';

/**
 * Credentials seeded by programmable-banking-sim (prisma/settings.ts).
 * These are the public Investec sandbox values, not secrets. Override them
 * with PB_SIM_CLIENT_ID / PB_SIM_CLIENT_SECRET / PB_SIM_API_KEY if your
 * simulator is configured differently.
 */
export const simCredentials = {
  clientId: process.env.PB_SIM_CLIENT_ID ?? 'yAxzQRFX97vOcyQAwluEU6H6ePxMA5eY',
  clientSecret: process.env.PB_SIM_CLIENT_SECRET ?? '4dY0PjEYqoBrZ99r',
  apiKey:
    process.env.PB_SIM_API_KEY ??
    'eUF4elFSRlg5N3ZPY3lRQXdsdUVVNkg2ZVB4TUE1ZVk6YVc1MlpYTjBaV010ZW1FdGNHSXRZV05qYjNWdWRITXRjMkZ1WkdKdmVBPT0=',
};

export const simUrl = process.env.PB_SIM_URL;

export function createSimClient(
  overrides: Partial<typeof simCredentials> = {},
): InvestecPbApi {
  if (!simUrl) {
    throw new Error('PB_SIM_URL is not set');
  }
  const creds = { ...simCredentials, ...overrides };
  return new InvestecPbApi(
    creds.clientId,
    creds.clientSecret,
    creds.apiKey,
    simUrl,
  );
}

/** A reference unique to this run, so tests can find their own transactions. */
export function uniqueRef(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
