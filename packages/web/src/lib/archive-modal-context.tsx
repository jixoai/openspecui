import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface ArchiveModalState {
  open: boolean
  changeId: string
  changeName: string
}

interface ArchiveModalContextValue {
  state: ArchiveModalState
  openArchiveModal: (changeId: string, changeName: string) => void
  closeArchiveModal: () => void
}

const ArchiveModalContext = createContext<ArchiveModalContextValue | null>(null)

export function ArchiveModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ArchiveModalState>({
    open: false,
    changeId: '',
    changeName: '',
  })

  const openArchiveModal = useCallback((changeId: string, changeName: string) => {
    setState({ open: true, changeId, changeName })
  }, [])

  const closeArchiveModal = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }))
  }, [])

  return (
    <ArchiveModalContext.Provider value={{ state, openArchiveModal, closeArchiveModal }}>
      {children}
    </ArchiveModalContext.Provider>
  )
}

export function useArchiveModal() {
  const context = useContext(ArchiveModalContext)
  if (!context) {
    throw new Error('useArchiveModal must be used within ArchiveModalProvider')
  }
  return context
}
