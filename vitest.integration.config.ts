import { defineConfig } from 'vitest/config';

/**
 * Runs the client end to end against programmable-banking-sim.
 * Start the simulator first and point PB_SIM_URL at it, e.g.
 *   PB_SIM_URL=http://localhost:3000 npm run test:integration
 */
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    // Tests share one simulator database and assert on balance deltas,
    // so run them one file at a time.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
