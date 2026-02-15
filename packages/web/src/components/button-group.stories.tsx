import { ButtonGroup } from '@/components/button-group'
import { renderReactStory } from '@/storybook/render-react-story'
import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'

type GroupValue = 'main' | 'bottom' | 'off'

interface ButtonGroupStoryArgs {
  initialValue: GroupValue
}

function ButtonGroupDemo({ initialValue }: ButtonGroupStoryArgs) {
  const [value, setValue] = useState<GroupValue>(initialValue)
  return (
    <div className="p-4">
      <ButtonGroup<GroupValue>
        value={value}
        onChange={setValue}
        options={[
          { value: 'main', label: 'Main' },
          { value: 'bottom', label: 'Bottom' },
          { value: 'off', label: 'Off' },
        ]}
      />
      <div className="mt-3 text-sm" data-testid="selected-value">
        {value}
      </div>
    </div>
  )
}

const meta = {
  title: 'Components/ButtonGroup',
  args: {
    initialValue: 'main',
  },
  render: (args: ButtonGroupStoryArgs) => renderReactStory(<ButtonGroupDemo {...args} />),
} satisfies Meta<ButtonGroupStoryArgs>

export default meta

type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const mainButton = await canvas.findByRole('button', { name: 'Main' })
    const bottomButton = await canvas.findByRole('button', { name: 'Bottom' })
    const selected = await canvas.findByTestId('selected-value')

    await expect(mainButton).toHaveAttribute('aria-pressed', 'true')
    await expect(selected).toHaveTextContent('main')

    await userEvent.click(bottomButton)

    await expect(bottomButton).toHaveAttribute('aria-pressed', 'true')
    await expect(selected).toHaveTextContent('bottom')
  },
}
