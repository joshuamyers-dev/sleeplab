import type { Meta, StoryObj } from '@storybook/react';
import App from './App';

const meta = {
  title: 'Pages/App',
  component: App,
  parameters: {
    layout: 'fullscreen',
    skipGlobalRouter: true,
  },
  tags: ['autodocs', 'ai-generated'],
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LightTheme: Story = {
  decorators: [
    (Story) => {
      window.localStorage.setItem('cpap-theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
      return <Story />;
    },
  ],
};

export const DarkTheme: Story = {
  decorators: [
    (Story) => {
      window.localStorage.setItem('cpap-theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      return <Story />;
    },
  ],
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};
