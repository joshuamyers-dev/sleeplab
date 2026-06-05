import type { Meta, StoryObj } from '@storybook/react';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  HomeIcon,
  CalendarIcon,
  ActivityIcon,
  EquipmentIcon,
  SparklesIcon,
  SunIcon,
  MoonIcon,
  CheckCircleIcon,
} from './ChevronIcons';

const meta: Meta<typeof ChevronRightIcon> = {
  title: 'UI Components/ChevronIcons',
  component: ChevronRightIcon,
  tags: ['autodocs'],
  args: {
    width: 24,
    height: 24,
  },
};

export default meta;
type Story = StoryObj<typeof ChevronRightIcon>;

export const ChevronRight: Story = {
  render: (args) => <ChevronRightIcon {...args} />,
};

export const ChevronLeft: Story = {
  render: (args) => <ChevronLeftIcon {...args} />,
};

export const Home: Story = {
  render: (args) => <HomeIcon {...args} />,
};

export const Calendar: Story = {
  render: (args) => <CalendarIcon {...args} />,
};

export const Activity: Story = {
  render: (args) => <ActivityIcon {...args} />,
};

export const Equipment: Story = {
  render: (args) => <EquipmentIcon {...args} />,
};

export const Sparkles: Story = {
  render: (args) => <SparklesIcon {...args} />,
};

export const Sun: Story = {
  render: (args) => <SunIcon {...args} />,
};

export const Moon: Story = {
  render: (args) => <MoonIcon {...args} />,
};

export const CheckCircle: Story = {
  render: (args) => <CheckCircleIcon {...args} />,
};

export const CustomStyling: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: '16px', color: '#3b82f6' }}>
      <ChevronRightIcon {...args} width={48} height={48} />
      <HomeIcon {...args} width={48} height={48} />
      <SparklesIcon {...args} width={48} height={48} />
      <SunIcon {...args} width={48} height={48} />
      <CheckCircleIcon {...args} width={48} height={48} />
    </div>
  ),
};
