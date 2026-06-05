import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/react-vite';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'],
  staticDirs: ['../public'],
  addons: [getAbsolutePath("@storybook/addon-vitest")],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {
      builder: {
        viteConfigPath: join(__dirname, '../vite.config.ts'),
      },
    },
  },
};


function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')));
}

export default config;

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
