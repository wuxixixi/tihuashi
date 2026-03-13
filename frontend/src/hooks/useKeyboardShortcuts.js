import { useEffect } from 'react'

export default function useKeyboardShortcuts({ onGenerate, onCloseModal, hasModal }) {
  useEffect(() => {
    const handler = (e) => {
      // Esc - close modal
      if (e.key === 'Escape' && hasModal) {
        onCloseModal?.()
        return
      }
      // Ctrl+Enter - generate poem
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        onGenerate?.()
        return
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onGenerate, onCloseModal, hasModal])
}
