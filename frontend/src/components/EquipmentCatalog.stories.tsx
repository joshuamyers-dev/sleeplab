import type { Meta, StoryObj } from '@storybook/react'
import EquipmentCatalog from './EquipmentCatalog'

const meta: Meta<typeof EquipmentCatalog> = {
  title: 'Components/EquipmentCatalog',
  component: EquipmentCatalog,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof EquipmentCatalog>

export const Default: Story = {
  args: {} as any,
}
