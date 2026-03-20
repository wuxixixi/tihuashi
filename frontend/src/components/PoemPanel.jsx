import { useState } from 'react'
<<<<<<< Updated upstream

const API_BASE = ''
=======
import API_BASE from '../config'
>>>>>>> Stashed changes

const poemStyles = {
  '诗': ['五言绝句', '七言绝句', '五言律诗', '七言律诗', '古体诗'],
  '词': ['婉约', '豪放', '田园', '边塞']
}

// 重写风格选项
const rewriteStyles = ['五言绝句', '七言绝句', '五言律诗', '七言律诗', '古体诗', '婉约词', '豪放词', '田园词', '边塞词']

// 语音合成配置
const getSpeechSynthesis = () => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    return window.speechSynthesis
  }
  return null
}

// 书法风格配置
const calligraphyStyles = {
  classic: { name: '古典雅致', bg: '#FEF9E7', border: '#8B4513', text: '#3E2723', accent: '#DEB887' },
  ink: { name: '水墨丹青', bg: '#F5F5F5', border: '#2C2C2C', text: '#1A1A1A', accent: '#666666' },
  vermilion: { name: '朱砂红韵', bg: '#FFF8F0', border: '#B22222', text: '#8B0000', accent: '#CD5C5C' },
  bamboo: { name: '竹韵清风', bg: '#F0F8F0', border: '#228B22', text: '#006400', accent: '#90EE90' }
}

export default function PoemPanel({ analysis, feeling, image, setLoadingStage, toast, onSaveRecord, genre }) {
  const [style, setStyle] = useState('')
  const [customStyle, setCustomStyle] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [poem, setPoem] = useState('')
  const [poemTitle, setPoemTitle] = useState('')
  const [poemLoading, setPoemLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editPoem, setEditPoem] = useState('')
  const [editTitle, setEditTitle] = useState('')

  // AI 增强功能状态
  const [polishLoading, setPolishLoading] = useState(false)
  const [rewriteLoading, setRewriteLoading] = useState(false)
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [showRewriteModal, setShowRewriteModal] = useState(false)
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false)
  const [showCalligraphyModal, setShowCalligraphyModal] = useState(false)
  const [selectedRewriteStyle, setSelectedRewriteStyle] = useState('')
  const [selectedCalligraphyStyle, setSelectedCalligraphyStyle] = useState('classic')
  const [poemAnalysis, setPoemAnalysis] = useState('')
  const [polishSuggestion, setPolishSuggestion] = useState('')

  // 语音朗读状态
  const [speaking, setSpeaking] = useState(false)
  const [speechRate, setSpeechRate] = useState(0.85)

  const generatePoem = async () => {
    if (!analysis) {
      toast.warning('请先上传图片并等待AI赏析完成')
      return
    }
    setPoemLoading(true)
    setLoadingStage('poem')
    try {
      const body = { analysis, userFeeling: feeling, style }
      if (useCustom && customStyle.trim()) {
        body.customStyle = customStyle.trim()
      }
      const res = await fetch(`${API_BASE}/api/poem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        setPoem(data.poem)
        setPoemTitle(data.title || '')
        toast.success('诗词创作完成')
        onSaveRecord(data.title, data.poem, style)
      } else {
        toast.error('创作失败: ' + (data.error || ''))
      }
    } catch (err) {
      toast.error('创作失败，请重试')
    }
    setPoemLoading(false)
    setLoadingStage(null)
  }

  const startEdit = () => {
    setEditPoem(poem)
    setEditTitle(poemTitle)
    setPolishSuggestion('')
    setIsEditing(true)
  }

  const saveEdit = () => {
    setPoem(editPoem)
    setPoemTitle(editTitle)
    setIsEditing(false)
    toast.success('诗词已更新')
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setPolishSuggestion('')
  }

  // AI 润色
  const polishPoem = async () => {
    if (!editPoem.trim()) {
      toast.warning('请先输入诗词内容')
      return
    }
    setPolishLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/polish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poem: editPoem, title: editTitle, style })
      })
      const data = await res.json()
      if (data.success) {
        setEditTitle(data.polishedTitle)
        setEditPoem(data.polishedPoem)
        setPolishSuggestion(data.suggestions)
        toast.success('润色完成')
      } else {
        toast.error('润色失败: ' + (data.error || ''))
      }
    } catch (err) {
      toast.error('润色失败，请重试')
    }
    setPolishLoading(false)
  }

  // 风格重写
  const rewritePoem = async () => {
    if (!selectedRewriteStyle) {
      toast.warning('请选择目标风格')
      return
    }
    setRewriteLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poem, title: poemTitle, targetStyle: selectedRewriteStyle })
      })
      const data = await res.json()
      if (data.success) {
        setPoem(data.newPoem)
        setPoemTitle(data.newTitle)
        setShowRewriteModal(false)
        setSelectedRewriteStyle('')
        toast.success(`已重写为${selectedRewriteStyle}`)
      } else {
        toast.error('重写失败: ' + (data.error || ''))
      }
    } catch (err) {
      toast.error('重写失败，请重试')
    }
    setRewriteLoading(false)
  }

  // 诗词解析
  const analyzePoem = async () => {
    if (!poem.trim()) {
      toast.warning('请先生成诗词')
      return
    }
    setAnalyzeLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/analyze-poem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poem, title: poemTitle })
      })
      const data = await res.json()
      if (data.success) {
        setPoemAnalysis(data.analysis)
        setShowAnalyzeModal(true)
      } else {
        toast.error('解析失败: ' + (data.error || ''))
      }
    } catch (err) {
      toast.error('解析失败，请重试')
    }
    setAnalyzeLoading(false)
  }

  const copyPoem = () => {
    const text = poemTitle ? `${poemTitle}\n\n${poem}` : poem
    navigator.clipboard.writeText(text).then(() => {
      toast.success('已复制到剪贴板')
    }).catch(() => {
      toast.error('复制失败')
    })
  }

  // 语音朗读诗词
  const speakPoem = () => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    if (!synth) {
      toast.warning('您的浏览器不支持语音合成')
      return
    }

    if (speaking) {
      synth.cancel()
      setSpeaking(false)
      return
    }

    const text = poemTitle ? `${poemTitle}。${poem}` : poem
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = speechRate
    utterance.pitch = 0.9

    // 尝试选择中文语音
    const voices = synth.getVoices()
    const zhVoice = voices.find(v => v.lang.includes('zh'))
    if (zhVoice) {
      utterance.voice = zhVoice
    }

    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    synth.speak(utterance)
  }

  // 书法风格导出
  const exportCalligraphy = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const w = 800
    const h = 1200
    canvas.width = w
    canvas.height = h

    const cstyle = calligraphyStyles[selectedCalligraphyStyle]

    // 背景
    ctx.fillStyle = cstyle.bg
    ctx.fillRect(0, 0, w, h)

    // 添加宣纸纹理效果
    ctx.globalAlpha = 0.03
    for (let i = 0; i < 1000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff'
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1)
    }
    ctx.globalAlpha = 1

    // 双层边框
    ctx.strokeStyle = cstyle.border
    ctx.lineWidth = 4
    ctx.strokeRect(30, 30, w - 60, h - 60)
    ctx.strokeStyle = cstyle.accent
    ctx.lineWidth = 1
    ctx.strokeRect(45, 45, w - 90, h - 90)

    // 标题
    ctx.fillStyle = cstyle.border
    ctx.font = 'bold 42px "Ma Shan Zheng", "KaiTi", serif'
    ctx.textAlign = 'center'
    if (poemTitle) {
      ctx.fillText(poemTitle, w / 2, 140)
    }

    // 分隔线
    ctx.strokeStyle = cstyle.accent
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(200, 180)
    ctx.lineTo(w - 200, 180)
    ctx.stroke()

    // 诗词正文（竖排效果改为横排）
    ctx.font = '32px "Ma Shan Zheng", "KaiTi", serif'
    ctx.fillStyle = cstyle.text
    const lines = poem.split('\n').filter(Boolean)
    let y = poemTitle ? 260 : 200
    for (const line of lines) {
      ctx.fillText(line, w / 2, y)
      y += 60
    }

    // 印章效果
    ctx.fillStyle = '#C41E3A'
    ctx.font = 'bold 24px "Ma Shan Zheng", serif'
    ctx.textAlign = 'right'
    ctx.fillText('墨韵', w - 80, h - 120)
    ctx.strokeStyle = '#C41E3A'
    ctx.lineWidth = 2
    ctx.strokeRect(w - 130, h - 150, 60, 50)

    // 底部水印
    ctx.fillStyle = cstyle.accent
    ctx.font = '14px "Noto Serif SC", serif'
    ctx.textAlign = 'center'
    ctx.fillText('墨韵 AI · ' + cstyle.name, w / 2, h - 40)

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${poemTitle || '题画诗'}_${cstyle.name}.png`
      a.click()
      URL.revokeObjectURL(url)
      setShowCalligraphyModal(false)
      toast.success('已导出书法风格图片')
    })
  }

  const exportAsImage = () => {
    setShowCalligraphyModal(true)
  }

  // 生成分享卡片
  const generateShareCard = async () => {
    if (!image || !poem) {
      toast.warning('请先上传画作并生成诗词')
      return
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const w = 1080
    const h = 1620
    canvas.width = w
    canvas.height = h

    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = image
      })

      // 背景
      ctx.fillStyle = '#FDF8F0'
      ctx.fillRect(0, 0, w, h)

      // 画作区域
      const imgAreaHeight = 700
      const imgMargin = 40
      const imgWidth = w - imgMargin * 2
      const imgHeight = imgAreaHeight - imgMargin * 2
      const imgRatio = img.width / img.height
      let drawW = imgWidth
      let drawH = imgWidth / imgRatio
      if (drawH > imgHeight) {
        drawH = imgHeight
        drawW = imgHeight * imgRatio
      }
      const drawX = imgMargin + (imgWidth - drawW) / 2
      const drawY = imgMargin + (imgHeight - drawH) / 2

      ctx.strokeStyle = '#8B4513'
      ctx.lineWidth = 4
      ctx.strokeRect(drawX - 10, drawY - 10, drawW + 20, drawH + 20)
      ctx.drawImage(img, drawX, drawY, drawW, drawH)

      if (genre) {
        ctx.fillStyle = '#8D6E63'
        ctx.font = 'bold 24px serif'
        ctx.textAlign = 'left'
        ctx.fillText(genre, imgMargin, drawY + drawH + 40)
      }

      // 分隔线
      ctx.strokeStyle = '#D4A574'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(imgMargin + 100, imgAreaHeight + 20)
      ctx.lineTo(w - imgMargin - 100, imgAreaHeight + 20)
      ctx.stroke()

      // 标题
      ctx.fillStyle = '#5D4037'
      ctx.font = 'bold 48px serif'
      ctx.textAlign = 'center'
      const titleY = imgAreaHeight + 90
      if (poemTitle) {
        ctx.fillText(poemTitle, w / 2, titleY)
      }

      // 诗词
      ctx.font = '36px serif'
      ctx.fillStyle = '#3E2723'
      const poemLines = poem.split('\n').filter(Boolean)
      let poemY = poemTitle ? titleY + 80 : titleY + 50
      for (const line of poemLines) {
        ctx.fillText(line, w / 2, poemY)
        poemY += 55
      }

      // 底部水印
      ctx.fillStyle = '#BDBDBD'
      ctx.font = '20px serif'
      ctx.textAlign = 'center'
      ctx.fillText('墨韵 AI · 中国画智能赏析', w / 2, h - 50)

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${poemTitle || '墨韵作品'}_分享卡片.png`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('已生成分享卡片')
      })
    } catch (err) {
      console.error('生成分享卡片失败', err)
      toast.error('生成分享卡片失败，请重试')
    }
  }

  return (
    <div className="result-section fade-in">
      <div className="result-card">
        <h3>&#x270D;&#xFE0F; 诗词风格</h3>
        <div className="style-select">
          {Object.entries(poemStyles).map(([category, list]) => (
            <div key={category} className="style-group">
              <span className="style-group-label">{category}</span>
              {list.map(s => {
                const value = `${category}-${s}`
                return (
                  <button
                    key={value}
                    type="button"
                    className={`style-btn ${!useCustom && style === value ? 'active' : ''}`}
                    onClick={() => { setStyle(value); setUseCustom(false) }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="custom-style-section">
          <label className="custom-style-toggle">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
            />
            <span>自定义风格</span>
          </label>
          {useCustom && (
            <input
              className="custom-style-input"
              type="text"
              placeholder="如：仿李白风格、现代自由诗、五言排律..."
              value={customStyle}
              onChange={(e) => setCustomStyle(e.target.value)}
            />
          )}
        </div>
      </div>

      <button
        className="btn generate-btn"
        onClick={generatePoem}
        disabled={poemLoading}
      >
        {poemLoading ? '创作中...' : '为画题诗'}
      </button>

      {(poem || poemTitle) && (
        <div className="result-card poem-card slide-up" style={{ marginTop: '20px' }}>
          <div className="poem-header">
            <h3>&#x1F4DC; 题诗</h3>
            <div className="poem-actions">
              <button className="icon-btn" onClick={generatePoem} title="换一首" disabled={poemLoading}>
                &#x1F504;
              </button>
              <button className="icon-btn" onClick={startEdit} title="编辑">
                &#x270F;&#xFE0F;
              </button>
              <button className="icon-btn" onClick={() => setShowRewriteModal(true)} title="风格重写">
                &#x1F4DD;
              </button>
              <button className="icon-btn" onClick={analyzePoem} title="AI解析" disabled={analyzeLoading}>
                &#x1F50D;
              </button>
              <button className="icon-btn" onClick={copyPoem} title="复制">
                &#x1F4CB;
              </button>
              <button
                className={`icon-btn ${speaking ? 'speaking' : ''}`}
                onClick={speakPoem}
                title={speaking ? '停止朗读' : '朗读诗词'}
                style={{ color: speaking ? '#E91E63' : 'inherit' }}
              >
                {speaking ? '\u23F9' : '\u1F3A4'}
              </button>
              <button className="icon-btn" onClick={exportAsImage} title="书法导出">
                &#x1F4E5;
              </button>
              <button className="icon-btn" onClick={generateShareCard} title="生成分享卡片" style={{ color: '#1976D2' }}>
                &#x1F4E4;
              </button>
            </div>
          </div>

          {isEditing ? (
            <div className="poem-edit">
              <input
                className="poem-edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="标题"
              />
              <textarea
                className="poem-edit-body"
                value={editPoem}
                onChange={(e) => setEditPoem(e.target.value)}
              />
              {polishSuggestion && (
                <div className="polish-suggestion">
                  <strong>AI建议：</strong>{polishSuggestion}
                </div>
              )}
              <div className="poem-edit-actions">
                <button className="btn-small btn-polish" onClick={polishPoem} disabled={polishLoading}>
                  {polishLoading ? '润色中...' : 'AI润色'}
                </button>
                <button className="btn-small btn-save" onClick={saveEdit}>保存</button>
                <button className="btn-small btn-cancel-edit" onClick={cancelEdit}>取消</button>
              </div>
            </div>
          ) : (
            <>
              {poemTitle && <div className="poem-title">{poemTitle}</div>}
              <div className="poem-display">{poem}</div>
            </>
          )}
        </div>
      )}

      {/* 风格重写弹窗 */}
      {showRewriteModal && (
        <div className="modal-overlay" onClick={() => setShowRewriteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>&#x1F4DD; 风格重写</h3>
            <p>选择目标风格，AI将保持原诗意境进行改写：</p>
            <div className="rewrite-style-grid">
              {rewriteStyles.map(s => (
                <button
                  key={s}
                  className={`rewrite-style-btn ${selectedRewriteStyle === s ? 'active' : ''}`}
                  onClick={() => setSelectedRewriteStyle(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={rewritePoem} disabled={rewriteLoading || !selectedRewriteStyle}>
                {rewriteLoading ? '重写中...' : '开始重写'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowRewriteModal(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 诗词解析弹窗 */}
      {showAnalyzeModal && (
        <div className="modal-overlay" onClick={() => setShowAnalyzeModal(false)}>
          <div className="modal-content analyze-modal" onClick={e => e.stopPropagation()}>
            <h3>&#x1F50D; 诗词解析</h3>
            <div className="analyze-result">
              {poemAnalysis.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAnalyzeModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 书法风格选择弹窗 */}
      {showCalligraphyModal && (
        <div className="modal-overlay" onClick={() => setShowCalligraphyModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>&#x1F4E5; 书法风格导出</h3>
            <p>选择书法风格：</p>
            <div className="calligraphy-style-grid">
              {Object.entries(calligraphyStyles).map(([key, val]) => (
                <button
                  key={key}
                  className={`calligraphy-style-btn ${selectedCalligraphyStyle === key ? 'active' : ''}`}
                  style={{ backgroundColor: val.bg, borderColor: val.border, color: val.text }}
                  onClick={() => setSelectedCalligraphyStyle(key)}
                >
                  {val.name}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={exportCalligraphy}>导出图片</button>
              <button className="btn btn-secondary" onClick={() => setShowCalligraphyModal(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
