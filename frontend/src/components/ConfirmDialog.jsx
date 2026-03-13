import { useState } from 'react'

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog fade-in" onClick={e => e.stopPropagation()}>
        <h3>{title || '确认操作'}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onCancel}>取消</button>
          <button className="btn-confirm" onClick={onConfirm}>确认</button>
        </div>
      </div>
    </div>
  )
}

export function useConfirm() {
  const [state, setState] = useState({ open: false, title: '', message: '', resolve: null })

  const confirm = (message, title) => {
    return new Promise((resolve) => {
      setState({ open: true, title, message, resolve })
    })
  }

  const handleConfirm = () => {
    state.resolve?.(true)
    setState({ open: false, title: '', message: '', resolve: null })
  }

  const handleCancel = () => {
    state.resolve?.(false)
    setState({ open: false, title: '', message: '', resolve: null })
  }

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, dialog }
}
