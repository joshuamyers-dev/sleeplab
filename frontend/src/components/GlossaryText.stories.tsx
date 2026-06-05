import type { Meta, StoryObj } from '@storybook/react'
import GlossaryText from './GlossaryText'

const meta: Meta<typeof GlossaryText> = {
  title: 'Components/GlossaryText',
  component: GlossaryText,
  tags: ['autodocs'],
  args: {
    text: 'Your AHI of 2.1 is within normal range. The CPAP machine adjusted pressure to manage mild hypopnea events. Leak rate stayed low throughout the night.',
  },
}

export default meta
type Story = StoryObj<typeof GlossaryText>

export const Default: Story = {}

export const NoGlossaryTerms: Story = {
  args: { text: 'You slept well last night. No issues detected.' },
}

export const ManyTerms: Story = {
  args: {
    text: 'APAP therapy reduced obstructive apnea and central apnea events. AHI improved, EPR helped with compliance. Ramp was used at start. Humidity and mask fit were optimal.',
  },
}
