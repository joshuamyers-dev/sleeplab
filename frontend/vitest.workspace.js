import path from 'node:path';
import { fileURLToPath } from 'node:url';

// @ts-ignore
import { defineWorkspace } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// export default defineWorkspace([...]) fails with vitest 4.1 if defineWorkspace isn't exported in runtime
export default [
  'vitest.config.ts',
  {
    extends: 'vitest.config.ts',
    plugins: [
      storybookTest({ configDir: path.join(dirname, '.storybook') }),
    ],
    test: {
      name: 'storybook',
      browser: {
        enabled: true,
        headless: true,
        provider: 'playwright',
        instances: [{ browser: 'chromium' }],
      },
      setupFiles: ['.storybook/vitest.setup.ts'],
    },
  },
];
