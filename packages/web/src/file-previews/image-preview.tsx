import React from 'react'
import ReactDOM from 'react-dom/client'
import Lightbox from 'yet-another-react-lightbox'
import Inline from 'yet-another-react-lightbox/plugins/inline'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import { createRootStyles, getPreviewRootElement, getRequestedFileUrl } from './common'

function App() {
  const fileUrl = getRequestedFileUrl()
  return (
    <div
      style={{
        ...createRootStyles(),
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <Lightbox
        open
        close={() => undefined}
        slides={fileUrl ? [{ src: fileUrl }] : []}
        plugins={[Inline, Zoom]}
        inline={{ style: { width: '100%', height: '100%', minHeight: '320px' } }}
        carousel={{ finite: true }}
        controller={{ closeOnBackdropClick: false }}
        render={{ buttonPrev: () => null, buttonNext: () => null }}
      />
    </div>
  )
}

ReactDOM.createRoot(getPreviewRootElement()).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
