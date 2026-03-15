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
        <button
          className={`tab ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          关于我们
        </button>
        <div className="tab-hint">
          Ctrl+Enter 快速生成 | Esc 关闭弹窗
        </div>
      </div>

      {activeTab === 'about' && (
        <div className="about-section fade-in">
          <div className="about-hero">
            <div className="about-logo">
              <span className="logo-icon">墨</span>
              <h2>上海觉测信息科技有限公司</h2>
            </div>
            <p className="about-tagline">以 AI 之力，传承文化之美</p>
          </div>

          <div className="about-cards">
            <div className="about-card">
              <div className="card-icon">🤖</div>
              <h3>人工智能</h3>
              <p>深耕 AI 视觉理解与自然语言生成，让机器读懂艺术，让技术服务人文。</p>
            </div>
            <div className="about-card">
              <div className="card-icon">📊</div>
              <h3>智能营销</h3>
              <p>基于用户行为分析的个性化推荐引擎，精准触达目标受众，提升转化效率。</p>
            </div>
            <div className="about-card">
              <div className="card-icon">🎯</div>
              <h3>定制方案</h3>
              <p>为企业量身打造 AI 解决方案，从需求分析到落地实施，全程专业服务。</p>
            </div>
          </div>

          <div className="about-features">
            <h3>我们的优势</h3>
            <div className="features-grid">
              <div className="feature-item">
                <span className="feature-num">01</span>
                <span className="feature-text">多模态 AI 技术积累</span>
              </div>
              <div className="feature-item">
                <span className="feature-num">02</span>
                <span className="feature-text">垂直领域深度优化</span>
              </div>
              <div className="feature-item">
                <span className="feature-num">03</span>
                <span className="feature-text">私有化部署支持</span>
              </div>
              <div className="feature-item">
                <span className="feature-num">04</span>
                <span className="feature-text">7×24 技术保障</span>
              </div>
            </div>
          </div>

          <div className="about-contact">
            <h3>联系我们</h3>
            <p>商务合作 · 技术咨询 · 定制开发</p>
            <div className="contact-info">
              <span>📧 contact@juece.ai</span>
              <span>🌐 上海 · 浦东新区</span>
            </div>
          </div>

          <div className="about-footer">
            <p>© 2026 上海觉测信息科技有限公司 · 用科技赋能文化传承</p>
          </div>
        </div>
      )}

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

      <footer className="app-footer">
        <div className="footer-content">
          <p className="copyright">© 2026 上海觉测信息科技有限公司 版权所有</p>
          <p className="footer-slogan">以 AI 之力，传承文化之美</p>
        </div>
      </footer>

      {confirmDialog}
    </div>
  )
}

export default App
