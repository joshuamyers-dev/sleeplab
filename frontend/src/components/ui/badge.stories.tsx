import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge';

const meta = {
  title: 'UI Components/Badge',
  component: Badge,
  tags: ['autodocs'],
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Badge',
  },
};

export const CustomStyle: Story = {
  args: {
    children: 'New Release',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-200 rounded-full px-3 py-1',
  },
};
