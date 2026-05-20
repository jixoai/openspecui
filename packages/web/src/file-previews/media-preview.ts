import { defineCustomElements } from 'vidstack/elements'
import 'vidstack/icons'
import 'vidstack/styles/base.css'
import 'vidstack/styles/defaults.css'
import 'vidstack/styles/community-skin/audio.css'
import 'vidstack/styles/community-skin/video.css'
import { createRootStyles, getPreviewRootElement, getRequestedFileUrl } from './common'

const PLAYER_ROOT_ID = 'root'

function createPlayerElement(viewType: 'audio' | 'video', fileUrl: string): HTMLDivElement {
  const title = decodeURIComponent(fileUrl.split('/').pop() ?? 'Preview media')
  const frame = document.createElement('div')
  frame.style.width = '100%'
  frame.style.maxWidth = viewType === 'video' ? '1200px' : '840px'
  frame.style.maxHeight = '100%'
  frame.style.display = 'flex'
  frame.style.flexDirection = 'column'
  frame.style.justifyContent = 'center'

  const player = document.createElement('media-player')
  player.setAttribute('src', fileUrl)
  player.setAttribute('title', title)
  player.setAttribute('view-type', viewType)
  player.setAttribute('stream-type', 'on-demand')
  player.setAttribute('playsinline', '')
  player.setAttribute('crossorigin', '')
  player.setAttribute('load', 'eager')

  if (viewType === 'video') {
    player.setAttribute('aspect-ratio', '16/9')
    player.style.setProperty('--media-max-height', '100%')
    player.style.maxHeight = '100%'
  } else {
    player.style.height = 'auto'
  }
  player.style.width = '100%'

  const outlet = document.createElement('media-outlet')
  const skin = document.createElement('media-community-skin')
  player.append(outlet, skin)
  frame.append(player)
  return frame
}

export async function mountMediaPreview(viewType: 'audio' | 'video'): Promise<void> {
  await defineCustomElements()

  const root = getPreviewRootElement(PLAYER_ROOT_ID)

  const fileUrl = getRequestedFileUrl()
  root.setAttribute(
    'style',
    Object.entries({
      ...createRootStyles(),
      display: 'grid',
      placeItems: 'center',
      overflow: 'auto',
      padding: viewType === 'video' ? '16px' : '24px',
      boxSizing: 'border-box',
    })
      .map(
        ([key, value]) => `${key.replace(/[A-Z]/g, (s) => `-${s.toLowerCase()}`)}:${String(value)}`
      )
      .join(';')
  )

  root.replaceChildren()
  if (!fileUrl) {
    const fallback = document.createElement('div')
    fallback.textContent = 'Preview resource missing.'
    fallback.style.color = '#94a3b8'
    fallback.style.font = '500 14px sans-serif'
    root.append(fallback)
    return
  }

  root.append(createPlayerElement(viewType, fileUrl))
}
