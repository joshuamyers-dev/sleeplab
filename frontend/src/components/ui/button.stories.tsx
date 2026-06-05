import type { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs', 'ai-generated'],
}

export default meta
type Story = StoryObj<typeof Button>

export const DefaultVariant: Story = {
  args: {
    variant: 'default',
    children: 'Button',
  },
}

export const SecondaryVariant: Story = {
  args: {
    variant: 'secondary',
    children: 'Button',
  },
}

export const GhostVariant: Story = {
  args: {
    variant: 'ghost',
    children: 'Button',
  },
}

export const OutlineVariant: Story = {
  args: {
    variant: 'outline',
    children: 'Button',
  },
}

export const SmallSize: Story = {
  args: {
    size: 'sm',
    children: 'Button',
  },
}

export const LargeSize: Story = {
  args: {
    size: 'lg',
    children: 'Button',
  },
}

export const CssCheck: Story = {
  args: { children: 'Submit', variant: 'default' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /submit/i })
    await expect(getComputedStyle(button).backgroundColor).toBe('rgb(82, 81, 167)')
  },
}
