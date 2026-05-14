import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SoundSettingControl } from './sound-setting-control'

const customSoundsMock = vi.hoisted(() => ({
  list: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    sounds: {
      listCustom: {
        queryOptions: () => ({
          queryKey: ['sounds.listCustom'],
          queryFn: customSoundsMock.list,
        }),
      },
    },
  },
  trpcClient: {
    sounds: {
      renameCustom: {
        mutate: customSoundsMock.rename,
      },
      deleteCustom: {
        mutate: customSoundsMock.remove,
      },
    },
  },
}))

function renderWithClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>)
}

describe('SoundSettingControl', () => {
  beforeEach(() => {
    customSoundsMock.list.mockResolvedValue([])
    customSoundsMock.rename.mockResolvedValue({})
    customSoundsMock.remove.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders a joined select and primary icon preview button', async () => {
    const onPreview = vi.fn()
    const onVolumeChange = vi.fn()

    renderWithClient(
      <SoundSettingControl
        value="builtin:Basso"
        onValueChange={() => {}}
        onPreview={onPreview}
        ariaLabel="Bell Sound"
        volume={0.5}
        onVolumeChange={onVolumeChange}
      />
    )

    const select = screen.getByRole('combobox', { name: 'Bell Sound' })
    const preview = screen.getByRole('button', { name: 'Preview Bell Sound' })
    const volume = screen.getByRole('button', { name: 'Adjust Bell Sound volume' })

    expect(select.parentElement?.className).toContain('border')
    expect(select.parentElement?.className).toContain('overflow-hidden')
    expect(select.className).toContain('rounded-none')
    expect(select.className).toContain('border-0')
    expect(preview.className).toContain('bg-primary')
    expect(preview.className).toContain('w-9')
    expect(preview.className).toContain('border-l')
    expect(volume.className).toContain('w-[1.125rem]')
    expect(volume.querySelector('svg')).toBeTruthy()

    fireEvent.click(preview)
    expect(onPreview).toHaveBeenCalledTimes(1)
  })

  it('opens the inline volume popover and changes volume with wheel and drag', async () => {
    const onVolumeChange = vi.fn()

    renderWithClient(
      <SoundSettingControl
        value="builtin:Basso"
        onValueChange={() => {}}
        onPreview={() => {}}
        ariaLabel="Bell Sound"
        volume={0.5}
        onVolumeChange={onVolumeChange}
      />
    )

    const volume = screen.getByRole('button', { name: 'Adjust Bell Sound volume' })
    fireEvent.click(volume)

    const slider = await screen.findByRole('slider', { name: 'Bell Sound volume' })
    expect(slider).toHaveAttribute('aria-valuenow', '50')

    fireEvent.wheel(slider, { deltaY: -1 })
    expect(onVolumeChange).toHaveBeenLastCalledWith(0.51)

    fireEvent.pointerDown(volume, { pointerId: 1, clientY: 100 })
    fireEvent.pointerMove(volume, { pointerId: 1, clientY: 68 })
    fireEvent.pointerUp(volume, { pointerId: 1, clientY: 68 })
    expect(onVolumeChange).toHaveBeenLastCalledWith(0.7)
  })

  it('changes inline volume from a direct popover click', async () => {
    const onVolumeChange = vi.fn()

    const rendered = renderWithClient(
      <SoundSettingControl
        value="builtin:Basso"
        onValueChange={() => {}}
        onPreview={() => {}}
        ariaLabel="Bell Sound"
        volume={0.5}
        onVolumeChange={onVolumeChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Adjust Bell Sound volume' }))

    const slider = await screen.findByRole('slider', { name: 'Bell Sound volume' })
    const track = rendered.container.querySelector('[data-sound-volume-track="true"]')
    expect(track).toBeInstanceOf(HTMLDivElement)

    Object.defineProperty(track, 'getBoundingClientRect', {
      value: () =>
        ({
          top: 20,
          bottom: 120,
          height: 100,
          left: 0,
          right: 8,
          width: 8,
          x: 0,
          y: 20,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    })

    fireEvent.pointerDown(slider, { pointerId: 1, clientY: 45 })
    fireEvent.pointerUp(slider, { pointerId: 1, clientY: 45 })

    expect(onVolumeChange).toHaveBeenLastCalledWith(0.75)
  })

  it('renders system and custom sound groups', async () => {
    const customId = 'f'.repeat(64)
    customSoundsMock.list.mockResolvedValue([
      {
        id: customId,
        name: 'Deploy Chime',
        mime: 'audio/mp3',
        size: 123,
        createdAt: 1,
        updatedAt: 2,
      },
    ])

    renderWithClient(
      <SoundSettingControl
        value="builtin:Ping"
        onValueChange={() => {}}
        onPreview={() => {}}
        ariaLabel="Notification Sound"
      />
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Notification Sound' }))

    expect(await screen.findByRole('option', { name: 'Deploy Chime' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'System Sounds' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Custom Sounds' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Add sound...' })).toBeTruthy()
  })

  it('renames and removes selected custom sound', async () => {
    const onValueChange = vi.fn()
    const customId = 'a'.repeat(64)
    customSoundsMock.list.mockResolvedValue([
      {
        id: customId,
        name: 'Before',
        mime: 'audio/mp3',
        size: 123,
        createdAt: 1,
        updatedAt: 2,
      },
    ])

    renderWithClient(
      <SoundSettingControl
        value={`custom:${customId}`}
        defaultValue="builtin:Ping"
        onValueChange={onValueChange}
        onPreview={() => {}}
        ariaLabel="Notification Sound"
      />
    )

    const nameInput = await screen.findByRole('textbox', { name: 'Notification Sound name' })
    await waitFor(() => {
      expect(nameInput).toHaveValue('Before')
      expect(nameInput).not.toBeDisabled()
    })
    fireEvent.change(nameInput, { target: { value: 'After' } })
    fireEvent.blur(nameInput)

    await waitFor(() => {
      expect(customSoundsMock.rename).toHaveBeenCalledWith({
        id: `custom:${customId}`,
        name: 'After',
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Remove Notification Sound' }))

    await waitFor(() => {
      expect(customSoundsMock.remove).toHaveBeenCalledWith({ id: `custom:${customId}` })
    })
    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith('builtin:Ping')
    })
  })

  it('switches to add mode and uploads a custom sound with the draft name', async () => {
    const onValueChange = vi.fn()
    const uploadedId = 'b'.repeat(64)
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body
      expect(body).toBeInstanceOf(FormData)
      expect((body as FormData).get('name')).toBe('Deploy Ready')
      expect((body as FormData).get('file')).toBeInstanceOf(File)
      return new Response(
        JSON.stringify({
          id: uploadedId,
          name: 'Deploy Ready',
          mime: 'audio/mp3',
          size: 123,
          createdAt: 1,
          updatedAt: 2,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const rendered = renderWithClient(
      <SoundSettingControl
        value="builtin:Ping"
        onValueChange={onValueChange}
        onPreview={() => {}}
        ariaLabel="Notification Sound"
      />
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Notification Sound' }))
    const addOption = await screen.findByRole('option', { name: 'Add sound...' })
    fireEvent.mouseMove(addOption)
    fireEvent.click(addOption)

    const nameInput = screen.getByRole('textbox', { name: 'Notification Sound name' })
    expect(screen.getByRole('button', { name: 'Upload Notification Sound' })).toBeTruthy()
    expect(nameInput).not.toBeDisabled()
    fireEvent.change(nameInput, { target: { value: 'Deploy Ready' } })

    const fileInput = rendered.container.querySelector('input[type="file"]')
    expect(fileInput).toBeInstanceOf(HTMLInputElement)
    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [new File(['audio'], 'fallback-name.mp3', { type: 'audio/mp3' })],
      },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(onValueChange).toHaveBeenCalledWith(`custom:${uploadedId}`)
    })
  })
})
