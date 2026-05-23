import React from 'react'
import ReactDOM from 'react-dom/client'
import { createRootStyles, getPreviewRootElement, getRequestedFileUrl } from './common'

function App() {
  const fileUrl = getRequestedFileUrl()
  return (
    <iframe
      title="HTML Preview"
      src={fileUrl}
      style={{ ...createRootStyles(), border: 0, display: 'block' }}
    />
  )
}

ReactDOM.createRoot(getPreviewRootElement()).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
