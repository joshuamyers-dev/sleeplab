import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config.ts'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'

export default mergeConfig(baseConfig, defineConfig({
  plugins: [
    storybookTest({ configDir: '.storybook' })
  ],
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    name: 'storybook',
    css: true,
    browser: {
      enabled: true,
      name: 'chromium',
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
}))
