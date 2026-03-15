import { useState, useCallback, useEffect } from 'react'
import { useToast } from './contexts/ToastContext'
import { useConfirm } from './components/ConfirmDialog'
import UploadPanel from './components/UploadPanel'
import PoemPanel from './components/PoemPanel'
import HistoryPanel from './components/HistoryPanel'
import EmptyState from './components/EmptyState'
import ThemeSwitcher from './components/ThemeSwitcher'
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts'

const API_BASE = ''

// 草稿键名
const DRAFT_KEY = 'moyun-draft'

function App() {
  const toast = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()

  // Core state
  const [image, setImage] = useState(null)
  const [imagePath, setImagePath] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [feeling, setFeeling] = useState('')
  const [genre, setGenre] = useState('')
  const [loadingStage, setLoadingStage] = useState(null)
  const [activeTab, setActiveTab] = useState('create')
  const [showGuide, setShowGuide] = useState(() => {
    return !localStorage.getItem('moyun-guide-seen')
  })

  // 恢复草稿
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY)
    if (draft) {
      try {
        const parsed = JSON.parse(draft)
        if (parsed.feeling) {
          setFeeling(parsed.feeling)
          toast.info('已恢复上次未完成的创作')
        }
      } catch (e) {
        console.error('恢复草稿失败', e)
      }
    }
  }, [])

  // 自动保存草稿
  useEffect(() => {
    if (feeling && !loadingStage) {
      const draft = { feeling, savedAt: new Date().toISOString() }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    }
  }, [feeling, loadingStage])

  // 保存成功后清除草稿
  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY)
  }, [])

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
          style: style || '',
          genre: genre || ''
        })
      })
    } catch (err) {
      console.error('保存失败', err)
    }
  }, [image, analysis, feeling, genre])

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
          <a
            href="https://github.com/wuxixixi/tihuashi"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
            title="GitHub 开源地址"
          >
            <svg height="28" width="28" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
          </a>
          <div className="header-center">
            <h1>墨韵 AI</h1>
            <p>AI 赏析中国画，为您题诗</p>
          </div>
          <ThemeSwitcher />
        </div>
        <div className="header-slogan">上海觉测信息科技有限公司 出品</div>
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
                genre={genre}
                setGenre={setGenre}
              />
              <PoemPanel
                analysis={analysis}
                feeling={feeling}
                image={image}
                setLoadingStage={setLoadingStage}
                toast={toast}
                onSaveRecord={saveRecord}
                genre={genre}
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
