import { useState } from 'react'

const API_BASE = 'http://localhost:3001'

const poemStyles = {
  '诗': ['五言绝句', '七言绝句', '五言律诗', '七言律诗', '古体诗'],
  '词': ['婉约', '豪放', '田园', '边塞']
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
  }

  const copyPoem = () => {
    const text = poemTitle ? `${poemTitle}\n\n${poem}` : poem
    navigator.clipboard.writeText(text).then(() => {
      toast.success('已复制到剪贴板')
    }).catch(() => {
      toast.error('复制失败')
    })
  }

  const exportAsImage = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const w = 800
    const h = 1000
    canvas.width = w
    canvas.height = h

    // Background
    ctx.fillStyle = '#FEF9E7'
    ctx.fillRect(0, 0, w, h)

    // Border decoration
    ctx.strokeStyle = '#8B4513'
    ctx.lineWidth = 3
    ctx.strokeRect(30, 30, w - 60, h - 60)
    ctx.strokeStyle = '#DEB887'
    ctx.lineWidth = 1
    ctx.strokeRect(40, 40, w - 80, h - 80)

    // Title
    ctx.fillStyle = '#8B4513'
    ctx.font = 'bold 36px "Ma Shan Zheng", "KaiTi", serif'
    ctx.textAlign = 'center'
    if (poemTitle) {
      ctx.fillText(poemTitle, w / 2, 120)
    }

    // Poem body
    ctx.font = '28px "Ma Shan Zheng", "KaiTi", serif'
    ctx.fillStyle = '#3E2723'
    const lines = poem.split('\n').filter(Boolean)
    let y = poemTitle ? 200 : 160
    for (const line of lines) {
      ctx.fillText(line, w / 2, y)
      y += 50
    }

    // Watermark
    ctx.fillStyle = '#DEB887'
    ctx.font = '16px "Noto Serif SC", serif'
    ctx.fillText('墨韵 AI', w / 2, h - 60)

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${poemTitle || '题画诗'}.png`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('已导出为图片')
    })
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
              <button className="icon-btn" onClick={copyPoem} title="复制">
                &#x1F4CB;
              </button>
              <button className="icon-btn" onClick={exportAsImage} title="导出图片">
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
              <div className="poem-edit-actions">
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
    </div>
  )
}
