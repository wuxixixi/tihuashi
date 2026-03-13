import { useState, useCallback } from 'react'
import { useToast } from './contexts/ToastContext'
import { useConfirm } from './components/ConfirmDialog'
import UploadPanel from './components/UploadPanel'
import PoemPanel from './components/PoemPanel'
import HistoryPanel from './components/HistoryPanel'
import EmptyState from './components/EmptyState'
import ThemeSwitcher from './components/ThemeSwitcher'
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts'

const API_BASE = 'http://localhost:3001'

function App() {
  const toast = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()

  // Core state
  const [image, setImage] = useState(null)
  const [imagePath, setImagePath] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [feeling, setFeeling] = useState('')
  const [loadingStage, setLoadingStage] = useState(null)
  const [activeTab, setActiveTab] = useState('create')
  const [showGuide, setShowGuide] = useState(() => {
    return !localStorage.getItem('moyun-guide-seen')
  })

  const saveRecord = useCallback(async (title, poemText, style) => {
    try {
      await fetch(`${API_BASE}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: image,
          analysis,
          userFeeling: feeling,
          poem: poemText,
          title: title || '无题',
          style: style || ''
        })
      })
    } catch (err) {
      console.error('保存失败', err)
    }
  }, [image, analysis, feeling])

  const dismissGuide = useCallback(() => {
    setShowGuide(false)
    localStorage.setItem('moyun-guide-seen', '1')
  }, [])

  const handleSetImage = useCallback((img) => {
    setImage(img)
    if (img) dismissGuide()
  }, [dismissGuide])

  useKeyboardShortcuts({
    hasModal: false,
    onCloseModal: null,
    onGenerate: null
  })

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div></div>
          <div className="header-center">
            <h1>墨韵 AI</h1>
            <p>AI 赏析中国画，为您题诗</p>
          </div>
          <ThemeSwitcher />
        </div>
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          创作
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          历史记录
        </button>
        <div className="tab-hint">
          Ctrl+Enter 快速生成 | Esc 关闭弹窗
        </div>
      </div>

      {activeTab === 'create' && (
        <>
          {showGuide && !image ? (
            <EmptyState onStart={dismissGuide} />
          ) : (
            <div className="main-container">
              <UploadPanel
                image={image}
                setImage={handleSetImage}
                imagePath={imagePath}
                setImagePath={setImagePath}
                analysis={analysis}
                setAnalysis={setAnalysis}
                feeling={feeling}
                setFeeling={setFeeling}
                loadingStage={loadingStage}
                setLoadingStage={setLoadingStage}
                toast={toast}
              />
              <PoemPanel
                analysis={analysis}
                feeling={feeling}
                image={image}
                setLoadingStage={setLoadingStage}
                toast={toast}
                onSaveRecord={saveRecord}
              />
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <HistoryPanel toast={toast} confirm={confirm} />
      )}

      {confirmDialog}
    </div>
  )
}

export default App
