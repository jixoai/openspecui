import { Tabs, type Tab } from '@/components/tabs'
import { renderReactStory } from '@/storybook/render-react-story'
import type { Meta, StoryObj } from '@storybook/web-components-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'

function TabsDemo() {
  const demoTabs: Tab[] = [
    { id: 'one', label: 'One', content: <div data-testid="panel-one">Panel One</div> },
    { id: 'two', label: 'Two', content: <div data-testid="panel-two">Panel Two</div> },
  ]

  const [active, setActive] = useState('one')
  return (
    <div className="h-[220px] w-[420px] border border-border">
      <Tabs tabs={demoTabs} selectedTab={active} onTabChange={setActive} />
    </div>
  )
}

const meta = {
  title: 'Components/Tabs',
  render: () => renderReactStory(<TabsDemo />),
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const SwitchTabs: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const oneButton = await canvas.findByRole('button', { name: 'One' })
    const twoButton = await canvas.findByRole('button', { name: 'Two' })

    await expect(canvas.getByTestId('panel-one')).toBeVisible()
    await expect(canvas.queryByTestId('panel-two')).toBeNull()

    await userEvent.click(twoButton)

    await expect(twoButton).toHaveClass('tab-selected')
    await expect(canvas.getByTestId('panel-two')).toBeVisible()
    await expect(oneButton).not.toHaveClass('tab-selected')
  },
}
