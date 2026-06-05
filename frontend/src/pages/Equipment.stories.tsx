import type { Meta, StoryObj } from '@storybook/react';
import EquipmentPage from './Equipment';

const meta: Meta<typeof EquipmentPage> = {
  title: 'Pages/Equipment',
  component: EquipmentPage,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof EquipmentPage>;

export const Default: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};
