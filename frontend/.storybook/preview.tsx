import React from 'react';
import type { Preview } from '@storybook/react-vite';
import '../src/index.css';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { mswHandlers } from './msw-handlers';

initialize({ onUnhandledRequest: 'bypass' });

const preview: Preview = {
  decorators: [
    (Story, context) => {
      if (context.parameters.skipGlobalRouter) {
        return <Story />
      }
      const initialEntries: string[] = context.parameters.initialEntries ?? ['/']
      return (
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>
            <Story />
          </AuthProvider>
        </MemoryRouter>
      )
    },
  ],
  loaders: [mswLoader],
  parameters: {
    msw: { handlers: mswHandlers },
  },
  async beforeEach() {
    localStorage.setItem('cpap-theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
  },
};

export default preview;
