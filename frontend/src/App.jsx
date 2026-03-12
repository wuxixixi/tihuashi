import { useState, useRef } from 'react'

function App() {
  const [image, setImage] = useState(null)
  const [imagePath, setImagePath] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [feeling, setFeeling] = useState('')
  const [poem, setPoem] = useState('')
  const [poemTitle, setPoemTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [poemLoading, setPoemLoading] = useState(false)
  const [style, setStyle] = useState('')
  const poemStyles = {
    诗: ['五言绝句', '七言绝句', '五言律诗', '七言律诗', '古体诗'],
    词: ['婉约', '豪放', '田园', '边塞']
  }
  const [history, setHistory] = useState([])
  const [activeTab, setActiveTab] = useState('create')
  const fileInputRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadImage(file)
  }

  const uploadImage = async (file) => {
    setLoading(true)
    const formData = new FormData()
    formData.append('image', file)

    try {
      console.log('开始上传图片...')
      const res = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData
      })
      console.log('响应状态:', res.status)
      const text = await res.text()
      console.log('响应内容:', text)
      const data = JSON.parse(text)
      if (data.success) {
        setImage(data.url)
        setImagePath(data.fullPath)
        analyzeImage(data.fullPath)
      } else {
        alert('上传失败: ' + (data.error || '未知错误'))
      }
    } catch (err) {
      console.error('上传失败:', err)
      alert('上传失败: ' + err.message)
    }
    setLoading(false)
  }

  const analyzeImage = async (path) => {
    setLoading(true)
    setAnalysis('')
    try {
      console.log('开始分析图片:', path)
      const res = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath: path })
      })
      const data = await res.json()
      console.log('分析结果:', data)
      if (data.success) {
        setAnalysis(data.analysis)
      } else {
        alert('分析失败: ' + (data.error || '未知错误'))
      }
    } catch (err) {
      console.error('分析失败:', err)
      alert('分析失败: ' + err.message)
    }
    setLoading(false)
  }

  const generatePoem = async () => {
    if (!analysis) return
    setPoemLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/poem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, userFeeling: feeling, style })
      })
      const data = await res.json()
      if (data.success) {
        setPoem(data.poem)
        setPoemTitle(data.title || '')
        saveRecord(data.title, data.poem)
      }
    } catch (err) {
      alert('创作失败')
    }
    setPoemLoading(false)
  }

  const saveRecord = async (title, poemText) => {
    try {
      await fetch('http://localhost:3001/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: image,
          analysis,
          userFeeling: feeling,
          poem: poemText,
          title: title || poemTitle || analysis?.slice(0, 20) || '无题'
        })
      })
      loadHistory()
    } catch (err) {
      console.error('保存失败', err)
    }
  }

  const loadHistory = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/history')
      const data = await res.json()
      if (data.success) {
        setHistory(data.history)
      }
    } catch (err) {
      console.error('加载历史失败', err)
    }
  }

  const deleteHistory = async (id) => {
    try {
      await fetch(`http://localhost:3001/api/history/${id}`, { method: 'DELETE' })
      loadHistory()
    } catch (err) {
      console.error('删除失败', err)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      uploadImage(file)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  return (
    <div className="app">
      <header className="header">
        <h1>墨韵 AI</h1>
        <p>AI 赏析中国画，为您题诗</p>
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
          onClick={() => { setActiveTab('history'); loadHistory(); }}
        >
          历史记录
        </button>
      </div>

      {activeTab === 'create' && (
        <div className="main-container">
          <div className="upload-section">
            <h2>上传画作</h2>
            <div 
              className="upload-area"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {image ? (
                <img src={image} alt="预览" className="preview-image" />
              ) : (
                <>
                  <p style={{ fontSize: '3rem', marginBottom: '10px' }}>🎨</p>
                  <p>点击或拖拽上传中国画</p>
                  <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '10px' }}>
                    支持 JPG、PNG 格式
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            
            {loading && (
              <div className="loading">
                <div className="loading-spinner"></div>
                <p>AI 正在赏析画作...</p>
              </div>
            )}
          </div>

          <div className="result-section">
            {analysis && (
              <div className="result-card">
                <h3>🎨 AI 赏析</h3>
                <p>{analysis}</p>
              </div>
            )}

            <div className="result-card">
              <h3>💭 您的感悟</h3>
              <textarea
                className="feeling-input"
                placeholder="请写下您对这幅画的理解和感受..."
                value={feeling}
                onChange={(e) => setFeeling(e.target.value)}
              />
            </div>

            <div className="result-card">
              <h3>✍️ 诗词风格</h3>
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
                          className={`style-btn ${style === value ? 'active' : ''}`}
                          onClick={() => setStyle(value)}
                        >
                          {s}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn"
              onClick={() => {
                console.log('生成诗词按钮点击', { analysis, poemLoading, feeling, style })
                if (!analysis) {
                  alert('请先上传图片并等待AI赏析完成')
                  return
                }
                generatePoem()
              }}
              disabled={poemLoading}
            >
              {poemLoading ? '创作中...' : '为画题诗'}
            </button>

            {(poem || poemTitle) && (
              <div className="result-card" style={{ marginTop: '20px' }}>
                <h3>📜 题诗</h3>
                {poemTitle && <div className="poem-title">{poemTitle}</div>}
                <div className="poem-display">{poem}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-section">
          <h2>历史记录</h2>
          {history.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888' }}>暂无记录</p>
          ) : (
            <div className="history-grid">
              {history.map(item => (
                <div key={item.id} className="history-card">
                  <img src={item.imageUrl} alt={item.title} />
                  <div className="history-card-content">
                    <h4>{item.title}</h4>
                    <p>{item.poem}</p>
                    <button 
                      className="delete-btn"
                      onClick={() => deleteHistory(item.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
