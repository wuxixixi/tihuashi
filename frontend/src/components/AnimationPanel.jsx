import { useState, useEffect, useRef } from 'react'
import API_BASE from '../config'

// 动画风格选项
const ANIMATION_STYLES = [
  { value: 'natural', label: '自然流畅', desc: '细腻自然的动态效果', icon: '🍃' },
  { value: 'artistic', label: '艺术抽象', desc: '富有艺术感的抽象动画', icon: '🎨' },
  { value: 'classical', label: '古典优雅', desc: '符合古画意境的优雅动画', icon: '📜' }
]

// 视频时长选项
const DURATION_OPTIONS = [
  { value: 3, label: '3秒', desc: '快速预览' },
  { value: 5, label: '5秒', desc: '标准时长' },
  { value: 8, label: '8秒', desc: '完整展示' },
  { value: 10, label: '10秒', desc: '详细演绎' }
]

// 分辨率选项
const RESOLUTION_OPTIONS = [
  { value: '480p', label: '480p', desc: '节省资源' },
  { value: '720p', label: '720p', desc: '高清标准' },
  { value: '1080p', label: '1080p', desc: '全高清' }
]

export default function AnimationPanel({ image, analysis, genre, historyId, toast }) {
  const [loading, setLoading] = useState(false)
  const [animation, setAnimation] = useState(null)
  const [style, setStyle] = useState('natural')
  const [prompt, setPrompt] = useState('')
  const [showPromptEdit, setShowPromptEdit] = useState(false)
  const [polling, setPolling] = useState(false)

  // 高级参数
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [duration, setDuration] = useState(5)
  const [resolution, setResolution] = useState('720p')
  const [customPrompt, setCustomPrompt] = useState('')

  // 视频模型状态
  const [videoModels, setVideoModels] = useState({})
  const [currentVideoModel, setCurrentVideoModel] = useState('kling-v1')
  const [showModelSelector, setShowModelSelector] = useState(false)

  // 提示词模板
  const [templates, setTemplates] = useState([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateContent, setNewTemplateContent] = useState('')

  // 动画历史
  const [animationHistory, setAnimationHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)

  // 批量生成
  const [batchMode, setBatchMode] = useState(false)
  const [selectedStyles, setSelectedStyles] = useState(['natural'])

  // 分享
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [shareLoading, setShareLoading] = useState(false)

  // 视频播放器
  const videoRef = useRef(null)
  const [videoProgress, setVideoProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // 加载视频模型列表
  useEffect(() => {
    fetch(`${API_BASE}/api/video-models`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setVideoModels(data.models)
          setCurrentVideoModel(data.currentModel)
        }
      })
      .catch(err => console.error('加载视频模型失败:', err))

    // 加载提示词模板
    loadTemplates()
  }, [])

  // 加载动画历史
  useEffect(() => {
    if (showHistory) {
      loadAnimationHistory()
    }
  }, [showHistory, historyPage])

  const loadTemplates = () => {
    fetch(`${API_BASE}/api/prompt-templates`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTemplates(data.templates)
        }
      })
      .catch(err => console.error('加载模板失败:', err))
  }

  const loadAnimationHistory = () => {
    fetch(`${API_BASE}/api/animations?page=${historyPage}&pageSize=10`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAnimationHistory(data.animations)
          setHistoryTotal(data.pagination.total)
        }
      })
      .catch(err => console.error('加载历史失败:', err))
  }

  // 生成动画
  const generateAnimation = async () => {
    if (!image) {
      toast.warning('请先上传画作')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/animate/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: image,
          analysis,
          genre,
          historyId,
          style,
          videoModel: currentVideoModel,
          duration,
          resolution,
          customPrompt: customPrompt || null
        })
      })

      const data = await res.json()
      if (data.success) {
        if (data.batch) {
          // 批量生成模式
          toast.success(data.message)
          loadAnimationHistory()
        } else {
          // 单个生成模式
          setAnimation({
            id: data.animationId,
            status: data.status,
            prompt: data.prompt,
            videoUrl: null,
            modelName: data.modelName,
            taskCheckUrl: data.taskCheckUrl,
            taskId: data.taskId,
            style,
            duration,
            resolution
          })
          setPrompt(data.prompt)

          if (data.status === 'processing' && !data.taskCheckUrl) {
            startPolling(data.animationId)
          } else if (data.status === 'completed') {
            setAnimation(prev => ({
              ...prev,
              videoUrl: image,
              status: 'completed'
            }))
            toast.success('动画生成完成！')
          }

          toast.success(data.message || '动画任务已提交')
        }
      } else {
        toast.error(data.error || '生成失败')
      }
    } catch (err) {
      toast.error('网络错误，请重试')
    }
    setLoading(false)
  }

  // 批量生成动画
  const generateBatchAnimations = async () => {
    if (!image) {
      toast.warning('请先上传画作')
      return
    }
    if (selectedStyles.length === 0) {
      toast.warning('请至少选择一个风格')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/animate/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: image,
          analysis,
          genre,
          historyId,
          styles: selectedStyles,
          videoModel: currentVideoModel,
          duration,
          resolution,
          customPrompt: customPrompt || null
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`已提交 ${data.count} 个动画生成任务`)
        loadAnimationHistory()
      } else {
        toast.error(data.error || '生成失败')
      }
    } catch (err) {
      toast.error('网络错误，请重试')
    }
    setLoading(false)
  }

  // 切换视频模型
  const switchVideoModel = async (modelId) => {
    try {
      const res = await fetch(`${API_BASE}/api/video-models/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId })
      })
      const data = await res.json()
      if (data.success) {
        setCurrentVideoModel(modelId)
        toast.success(`已切换到 ${data.modelInfo.name}`)
      }
    } catch (err) {
      toast.error('切换模型失败')
    }
    setShowModelSelector(false)
  }

  // 轮询动画状态
  const startPolling = (animationId) => {
    setPolling(true)
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/animate/${animationId}/status`)
        const data = await res.json()

        if (data.success) {
          setAnimation(prev => ({
            ...prev,
            ...data.animation
          }))

          if (data.animation.status === 'completed') {
            setPolling(false)
            toast.success('动画生成完成！')
            loadAnimationHistory()
          } else if (data.animation.status === 'failed') {
            setPolling(false)
            toast.error('动画生成失败: ' + (data.animation.errorMessage || '未知错误'))
          } else {
            setTimeout(poll, 3000)
          }
        }
      } catch (err) {
        console.error('轮询失败:', err)
        setTimeout(poll, 5000)
      }
    }
    poll()
  }

  // 下载视频
  const downloadVideo = () => {
    if (!animation?.videoUrl) return
    const a = document.createElement('a')
    a.href = animation.videoUrl
    a.download = `动画_${style}_${new Date().toISOString().slice(0, 10)}.mp4`
    a.click()
  }

  // 创建分享链接
  const createShareLink = async () => {
    if (!animation?.id) return
    setShareLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/animate/${animation.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: 7 })
      })
      const data = await res.json()
      if (data.success) {
        setShareUrl(data.shareUrl)
        setShowShareModal(true)
      } else {
        toast.error(data.error || '分享失败')
      }
    } catch (err) {
      toast.error('网络错误')
    }
    setShareLoading(false)
  }

  // 复制分享链接
  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl)
    toast.success('链接已复制到剪贴板')
  }

  // 收藏动画
  const toggleFavorite = async (animId, currentFavorite) => {
    try {
      const res = await fetch(`${API_BASE}/api/animate/${animId}/favorite`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        loadAnimationHistory()
      }
    } catch (err) {
      toast.error('操作失败')
    }
  }

  // 保存模板
  const saveTemplate = async () => {
    if (!newTemplateName || !newTemplateContent) {
      toast.warning('请填写模板名称和内容')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/prompt-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTemplateName, template: newTemplateContent })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('模板保存成功')
        loadTemplates()
        setShowTemplateModal(false)
        setNewTemplateName('')
        setNewTemplateContent('')
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch (err) {
      toast.error('网络错误')
    }
  }

  // 删除模板
  const deleteTemplate = async (templateId) => {
    if (!confirm('确定删除此模板？')) return
    try {
      await fetch(`${API_BASE}/api/prompt-templates/${templateId}`, { method: 'DELETE' })
      toast.success('模板已删除')
      loadTemplates()
    } catch (err) {
      toast.error('删除失败')
    }
  }

  // 使用模板
  const useTemplate = (templateContent) => {
    setCustomPrompt(templateContent)
    setShowTemplateModal(false)
  }

  // 视频进度更新
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100
      setVideoProgress(progress)
    }
  }

  // 切换批量风格选择
  const toggleStyleSelection = (styleValue) => {
    setSelectedStyles(prev => {
      if (prev.includes(styleValue)) {
        return prev.filter(s => s !== styleValue)
      } else {
        return [...prev, styleValue]
      }
    })
  }

  return (
    <div className="animation-panel fade-in">
      <div className="panel-header">
        <h3>🎬 让画作动起来</h3>
        <div className="header-actions">
          <button
            className="btn-small secondary"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? '返回生成' : '📋 历史记录'}
          </button>
        </div>
      </div>

      {/* 动画历史列表 */}
      {showHistory && (
        <div className="animation-history">
          <h4>动画历史 ({historyTotal})</h4>
          <div className="history-list">
            {animationHistory.map(anim => (
              <div key={anim.id} className="history-item">
                <div className="history-thumb">
                  {anim.videoUrl ? (
                    <video src={anim.videoUrl} muted className="thumb-video" />
                  ) : (
                    <img src={anim.imageUrl} alt="缩略图" className="thumb-image" />
                  )}
                </div>
                <div className="history-info">
                  <div className="history-title">{anim.title || '未命名动画'}</div>
                  <div className="history-meta">
                    <span className="history-style">{ANIMATION_STYLES.find(s => s.value === anim.style)?.label || anim.style}</span>
                    <span className="history-duration">{anim.duration}秒</span>
                    <span className={`history-status ${anim.status}`}>
                      {anim.status === 'completed' && '✅ 完成'}
                      {anim.status === 'processing' && '⏳ 生成中'}
                      {anim.status === 'failed' && '❌ 失败'}
                      {anim.status === 'pending' && '⏸️ 等待'}
                    </span>
                  </div>
                  <div className="history-date">{new Date(anim.createdAt).toLocaleString()}</div>
                </div>
                <div className="history-actions">
                  <button
                    className={`btn-icon ${anim.favorite ? 'active' : ''}`}
                    onClick={() => toggleFavorite(anim.id, anim.favorite)}
                    title={anim.favorite ? '取消收藏' : '收藏'}
                  >
                    {anim.favorite ? '⭐' : '☆'}
                  </button>
                  {anim.videoUrl && (
                    <a href={anim.videoUrl} download className="btn-icon" title="下载">
                      📥
                    </a>
                  )}
                  <button
                    className="btn-icon"
                    onClick={() => {
                      setAnimation({
                        id: anim.id,
                        status: anim.status,
                        prompt: anim.prompt,
                        videoUrl: anim.videoUrl,
                        style: anim.style,
                        duration: anim.duration
                      })
                      setShowHistory(false)
                    }}
                    title="查看详情"
                  >
                    👁️
                  </button>
                </div>
              </div>
            ))}
            {animationHistory.length === 0 && (
              <div className="empty-state">暂无动画记录</div>
            )}
          </div>
          {historyTotal > 10 && (
            <div className="history-pagination">
              <button
                disabled={historyPage === 1}
                onClick={() => setHistoryPage(p => p - 1)}
              >
                上一页
              </button>
              <span>第 {historyPage} 页</span>
              <button
                disabled={historyPage * 10 >= historyTotal}
                onClick={() => setHistoryPage(p => p + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}

      {/* 生成动画界面 */}
      {!showHistory && !animation && (
        <div className="animation-create">
          <p className="animation-desc">
            AI 将根据画作的意境和风格，为画作生成动态效果，让静态的名画"活"起来。
          </p>

          {/* 视频模型选择 */}
          <div className="model-selector">
            <div className="model-selector-header" onClick={() => setShowModelSelector(!showModelSelector)}>
              <span>🎥 视频模型：</span>
              <span className="current-model">
                {videoModels[currentVideoModel]?.name || currentVideoModel}
              </span>
              <span className="dropdown-arrow">{showModelSelector ? '▲' : '▼'}</span>
            </div>
            {showModelSelector && (
              <div className="model-dropdown">
                {Object.entries(videoModels).map(([id, model]) => (
                  <div
                    key={id}
                    className={`model-option ${currentVideoModel === id ? 'active' : ''}`}
                    onClick={() => switchVideoModel(id)}
                  >
                    <div className="model-name">{model.name}</div>
                    <div className="model-desc">{model.description}</div>
                    <div className="model-cost">约 ¥{model.cost}/次</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 生成模式切换 */}
          <div className="mode-toggle">
            <button
              className={`mode-btn ${!batchMode ? 'active' : ''}`}
              onClick={() => setBatchMode(false)}
            >
              单个生成
            </button>
            <button
              className={`mode-btn ${batchMode ? 'active' : ''}`}
              onClick={() => setBatchMode(true)}
            >
              批量生成
            </button>
          </div>

          {/* 风格选择 */}
          <div className="style-selector">
            <label>{batchMode ? '选择多个风格：' : '选择动画风格：'}</label>
            <div className="style-options">
              {ANIMATION_STYLES.map(s => (
                <button
                  key={s.value}
                  className={`style-option ${batchMode
                    ? (selectedStyles.includes(s.value) ? 'active' : '')
                    : (style === s.value ? 'active' : '')}`}
                  onClick={() => {
                    if (batchMode) {
                      toggleStyleSelection(s.value)
                    } else {
                      setStyle(s.value)
                    }
                  }}
                >
                  <span className="style-icon">{s.icon}</span>
                  <span className="style-label">{s.label}</span>
                  <span className="style-desc">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 高级参数 */}
          <div className="advanced-section">
            <div
              className="advanced-header"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>⚙️ 高级参数</span>
              <span className="dropdown-arrow">{showAdvanced ? '▲' : '▼'}</span>
            </div>
            {showAdvanced && (
              <div className="advanced-options">
                {/* 视频时长 */}
                <div className="param-group">
                  <label>视频时长：</label>
                  <div className="param-options">
                    {DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        className={`param-option ${duration === opt.value ? 'active' : ''}`}
                        onClick={() => setDuration(opt.value)}
                      >
                        {opt.label}
                        <span className="param-desc">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 分辨率 */}
                <div className="param-group">
                  <label>分辨率：</label>
                  <div className="param-options">
                    {RESOLUTION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        className={`param-option ${resolution === opt.value ? 'active' : ''}`}
                        onClick={() => setResolution(opt.value)}
                      >
                        {opt.label}
                        <span className="param-desc">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 自定义提示词 */}
                <div className="param-group">
                  <label>
                    自定义提示词：
                    <button
                      className="btn-small secondary"
                      onClick={() => setShowTemplateModal(true)}
                      style={{ marginLeft: '10px' }}
                    >
                      📝 模板
                    </button>
                  </label>
                  <textarea
                    className="custom-prompt"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="输入自定义动画提示词，或从模板中选择..."
                    rows={3}
                  />
                  {customPrompt && (
                    <button
                      className="btn-small"
                      onClick={() => setCustomPrompt('')}
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 生成按钮 */}
          <button
            className="btn animate-btn"
            onClick={batchMode ? generateBatchAnimations : generateAnimation}
            disabled={loading || !image || (batchMode && selectedStyles.length === 0)}
          >
            {loading ? '生成中...' : batchMode
              ? `✨ 批量生成 (${selectedStyles.length}个风格)`
              : '✨ 生成动画'}
          </button>
        </div>
      )}

      {/* 动画结果展示 */}
      {!showHistory && animation && (
        <div className="animation-result">
          {/* 使用的模型和参数显示 */}
          <div className="result-meta">
            {animation.modelName && (
              <span className="meta-item">🎥 {animation.modelName}</span>
            )}
            {animation.style && (
              <span className="meta-item">
                {ANIMATION_STYLES.find(s => s.value === animation.style)?.icon}
                {ANIMATION_STYLES.find(s => s.value === animation.style)?.label}
              </span>
            )}
            {animation.duration && (
              <span className="meta-item">⏱️ {animation.duration}秒</span>
            )}
            {animation.resolution && (
              <span className="meta-item">📺 {animation.resolution}</span>
            )}
          </div>

          {/* 提示词显示/编辑 */}
          <div className="prompt-section">
            <div className="prompt-header">
              <span>动画提示词：</span>
              <button
                className="btn-small"
                onClick={() => setShowPromptEdit(!showPromptEdit)}
              >
                {showPromptEdit ? '收起' : '查看'}
              </button>
            </div>
            {showPromptEdit && (
              <textarea
                className="prompt-edit"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="动画提示词..."
              />
            )}
          </div>

          {/* 状态显示 */}
          <div className={`status-badge ${animation.status}`}>
            {animation.status === 'processing' && '⏳ 生成中...'}
            {animation.status === 'completed' && '✅ 生成完成'}
            {animation.status === 'failed' && '❌ 生成失败'}
            {animation.status === 'pending' && '⏸️ 等待中'}
          </div>

          {/* 视频播放 */}
          {animation.videoUrl && (
            <div className="video-container">
              <div className="video-wrapper">
                <video
                  ref={videoRef}
                  src={animation.videoUrl}
                  controls
                  autoPlay
                  loop
                  className="animation-video"
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                {/* 自定义进度条 */}
                <div className="video-progress">
                  <div
                    className="progress-bar"
                    style={{ width: `${videoProgress}%` }}
                  />
                </div>
              </div>

              {/* 视频操作按钮 */}
              <div className="video-actions">
                <button className="btn-small" onClick={downloadVideo}>
                  📥 下载视频
                </button>
                <button
                  className="btn-small"
                  onClick={createShareLink}
                  disabled={shareLoading}
                >
                  🔗 分享
                </button>
                <button
                  className="btn-small secondary"
                  onClick={() => {
                    setAnimation(null)
                    setPrompt('')
                    setVideoProgress(0)
                  }}
                >
                  🔄 重新生成
                </button>
              </div>
            </div>
          )}

          {/* 处理中提示 */}
          {animation.status === 'processing' && (
            <div className="processing-hint">
              <div className="spinner"></div>
              {animation.taskCheckUrl ? (
                <>
                  <p>视频生成任务已提交到 DMXAPI</p>
                  {animation.taskId && <p>任务ID: {animation.taskId}</p>}
                  <a
                    href={animation.taskCheckUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="task-check-link"
                    style={{
                      display: 'inline-block',
                      marginTop: '10px',
                      padding: '10px 20px',
                      background: '#4CAF50',
                      color: 'white',
                      borderRadius: '5px',
                      textDecoration: 'none'
                    }}
                  >
                    🔗 点击查看生成结果
                  </a>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                    视频生成需要 2-5 分钟，请在上方链接中查看结果后下载
                  </p>
                </>
              ) : (
                <>
                  <p>正在生成动画，预计需要 1-2 分钟...</p>
                  {polling && (
                    <div className="polling-indicator">
                      <div className="polling-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span>自动检测中</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 错误显示 */}
          {animation.status === 'failed' && (
            <div className="error-section">
              <p className="error-message">{animation.errorMessage || '生成失败，请重试'}</p>
              <button className="btn" onClick={generateAnimation}>
                重新生成
              </button>
            </div>
          )}
        </div>
      )}

      {/* 模板弹窗 */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>📝 提示词模板</h4>
              <button className="btn-close" onClick={() => setShowTemplateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* 保存新模板 */}
              <div className="template-create">
                <h5>保存当前提示词为模板</h5>
                <input
                  type="text"
                  placeholder="模板名称"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                />
                <textarea
                  placeholder="模板内容"
                  value={newTemplateContent}
                  onChange={(e) => setNewTemplateContent(e.target.value)}
                  rows={3}
                />
                <button className="btn-small" onClick={saveTemplate}>保存模板</button>
              </div>

              {/* 模板列表 */}
              <div className="template-list">
                <h5>已保存的模板</h5>
                {templates.length === 0 ? (
                  <p className="empty-hint">暂无保存的模板</p>
                ) : (
                  templates.map(tpl => (
                    <div key={tpl.id} className="template-item">
                      <div className="template-info">
                        <div className="template-name">{tpl.name}</div>
                        <div className="template-preview">{tpl.template.slice(0, 50)}...</div>
                      </div>
                      <div className="template-actions">
                        <button className="btn-small" onClick={() => useTemplate(tpl.template)}>
                          使用
                        </button>
                        <button className="btn-small secondary" onClick={() => deleteTemplate(tpl.id)}>
                          删除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 分享弹窗 */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content share-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>🔗 分享动画</h4>
              <button className="btn-close" onClick={() => setShowShareModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>复制下方链接分享给好友：</p>
              <div className="share-url-box">
                <input type="text" value={shareUrl} readOnly />
                <button className="btn-small" onClick={copyShareUrl}>复制</button>
              </div>
              <p className="share-note">链接有效期为 7 天</p>

              {/* 社交分享按钮 */}
              <div className="social-share">
                <button
                  className="social-btn wechat"
                  onClick={() => {
                    toast.info('请复制链接后在微信中分享')
                  }}
                >
                  微信
                </button>
                <button
                  className="social-btn weibo"
                  onClick={() => {
                    window.open(`https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=分享一个精彩的中国画动画`, '_blank')
                  }}
                >
                  微博
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
