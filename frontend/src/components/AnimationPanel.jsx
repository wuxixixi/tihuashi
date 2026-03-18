import { useState, useEffect } from 'react'

const API_BASE = ''

// 动画风格选项
const ANIMATION_STYLES = [
  { value: 'natural', label: '自然流畅', desc: '细腻自然的动态效果' },
  { value: 'artistic', label: '艺术抽象', desc: '富有艺术感的抽象动画' },
  { value: 'classical', label: '古典优雅', desc: '符合古画意境的优雅动画' }
]

export default function AnimationPanel({ image, analysis, genre, historyId, toast }) {
  const [loading, setLoading] = useState(false)
  const [animation, setAnimation] = useState(null)
  const [style, setStyle] = useState('natural')
  const [prompt, setPrompt] = useState('')
  const [showPromptEdit, setShowPromptEdit] = useState(false)
  const [polling, setPolling] = useState(false)

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
          style
        })
      })

      const data = await res.json()
      if (data.success) {
        setAnimation({
          id: data.animationId,
          status: data.status,
          prompt: data.prompt,
          videoUrl: null
        })
        setPrompt(data.prompt)

        if (data.status === 'processing') {
          // 开始轮询状态
          startPolling(data.animationId)
        } else if (data.status === 'completed') {
          setAnimation(prev => ({
            ...prev,
            videoUrl: image, // 模拟模式
            status: 'completed'
          }))
          toast.success('动画生成完成！')
        }

        toast.success(data.message || '动画任务已提交')
      } else {
        toast.error(data.error || '生成失败')
      }
    } catch (err) {
      toast.error('网络错误，请重试')
    }
    setLoading(false)
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
          } else if (data.animation.status === 'failed') {
            setPolling(false)
            toast.error('动画生成失败: ' + (data.animation.errorMessage || '未知错误'))
          } else {
            // 继续轮询
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
    a.download = `动画_${new Date().toISOString().slice(0, 10)}.mp4`
    a.click()
  }

  return (
    <div className="animation-panel fade-in">
      <h3>🎬 让画作动起来</h3>

      {!animation ? (
        <div className="animation-create">
          <p className="animation-desc">
            AI 将根据画作的意境和风格，为画作生成动态效果，让静态的名画"活"起来。
          </p>

          <div className="style-selector">
            <label>选择动画风格：</label>
            <div className="style-options">
              {ANIMATION_STYLES.map(s => (
                <button
                  key={s.value}
                  className={`style-option ${style === s.value ? 'active' : ''}`}
                  onClick={() => setStyle(s.value)}
                >
                  <span className="style-label">{s.label}</span>
                  <span className="style-desc">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn animate-btn"
            onClick={generateAnimation}
            disabled={loading || !image}
          >
            {loading ? '生成中...' : '✨ 生成动画'}
          </button>
        </div>
      ) : (
        <div className="animation-result">
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
              <video
                src={animation.videoUrl}
                controls
                autoPlay
                loop
                className="animation-video"
              />
              <div className="video-actions">
                <button className="btn-small" onClick={downloadVideo}>
                  📥 下载视频
                </button>
                <button
                  className="btn-small"
                  onClick={() => {
                    setAnimation(null)
                    setPrompt('')
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
              <p>正在生成动画，预计需要 1-2 分钟...</p>
              {polling && <p className="polling-hint">自动检测中...</p>}
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
    </div>
  )
}
