import { useRef, useState, useEffect } from 'react'
import LoadingProgress from './LoadingProgress'
import MarkdownRenderer from './MarkdownRenderer'

const API_BASE = 'http://localhost:3001'

export default function UploadPanel({ image, setImage, imagePath, setImagePath, analysis, setAnalysis, feeling, setFeeling, loadingStage, setLoadingStage, toast, genre, setGenre }) {
  const fileInputRef = useRef(null)
  const multiFileInputRef = useRef(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [batchMode, setBatchMode] = useState(false)
  const [batchResults, setBatchResults] = useState([])
  const [batchProcessing, setBatchProcessing] = useState(false)

  const uploadImage = async (file) => {
    setLoadingStage('upload')
    setUploadProgress(0)
    const formData = new FormData()
    formData.append('image', file)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      })
      clearInterval(progressInterval)
      setUploadProgress(100)

      const text = await res.text()
      const data = JSON.parse(text)
      if (data.success) {
        setImage(data.url)
        setImagePath(data.fullPath)
        toast.success('图片上传成功')
        analyzeImage(data.fullPath)
      } else {
        toast.error('上传失败: ' + (data.error || '未知错误'))
        setLoadingStage(null)
      }
    } catch (err) {
      toast.error('上传失败: ' + err.message)
      setLoadingStage(null)
    }
    setUploadProgress(0)
  }

  const analyzeImage = async (imgPath) => {
    setLoadingStage('analyze')
    setAnalysis('')
    setGenre('')
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath: imgPath })
      })
      const data = await res.json()
      if (data.success) {
        setAnalysis(data.analysis)
        setGenre(data.genre || '')
        toast.success('AI 赏析完成')
      } else {
        toast.error('分析失败: ' + (data.error || '未知错误'))
      }
    } catch (err) {
      toast.error('分析失败: ' + err.message)
    }
    setLoadingStage(null)
  }

  // 批量分析图片
  const handleBatchUpload = async (files) => {
    if (!files || files.length === 0) return

    setBatchMode(true)
    setBatchProcessing(true)
    setBatchResults([])

    const results = []
    const total = files.length

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      toast.info(`正在处理 ${i + 1}/${total}: ${file.name}`)

      try {
        // 上传图片
        const formData = new FormData()
        formData.append('image', file)

        const uploadRes = await fetch(`${API_BASE}/api/upload`, {
          method: 'POST',
          body: formData
        })
        const uploadData = await uploadRes.json()

        if (!uploadData.success) {
          results.push({ file: file.name, error: '上传失败' })
          continue
        }

        // 分析图片
        const analyzeRes = await fetch(`${API_BASE}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagePath: uploadData.fullPath })
        })
        const analyzeData = await analyzeRes.json()

        if (analyzeData.success) {
          results.push({
            file: file.name,
            imageUrl: uploadData.url,
            imagePath: uploadData.fullPath,
            analysis: analyzeData.analysis,
            genre: analyzeData.genre || ''
          })
        } else {
          results.push({ file: file.name, error: '分析失败' })
        }
      } catch (err) {
        results.push({ file: file.name, error: err.message })
      }
    }

    setBatchResults(results)
    setBatchProcessing(false)
    toast.success(`批量处理完成，成功 ${results.filter(r => r.analysis).length}/${total} 张`)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadImage(file)
  }

  // 批量文件选择
  const handleMultiFileChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      await handleBatchUpload(files)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.currentTarget.classList.remove('dragover')
    const files = e.dataTransfer.files
    if (files && files.length > 1) {
      // 批量上传
      handleBatchUpload(Array.from(files).filter(f => f.type.startsWith('image/')))
    } else if (files?.[0]) {
      uploadImage(files[0])
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.currentTarget.classList.add('dragover')
  }

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('dragover')
  }

  // 退出批量模式
  const exitBatchMode = () => {
    setBatchMode(false)
    setBatchResults([])
    // 清空单图状态
    setImage(null)
    setImagePath('')
    setAnalysis('')
    setFeeling('')
    setGenre('')
  }

  // 使用批量结果中的某一项
  const useBatchResult = async (result) => {
    // 保存到历史记录
    try {
      await fetch(`${API_BASE}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: result.imageUrl,
          analysis: result.analysis,
          userFeeling: '',
          poem: '',
          title: result.file.replace(/\.[^/.]+$/, ''),
          style: '',
          genre: result.genre || ''
        })
      })
      toast.success('已保存到历史记录')
    } catch (err) {
      console.error('保存失败', err)
    }

    setImage(result.imageUrl)
    setImagePath(result.imagePath || '')
    setAnalysis(result.analysis || '')
    setGenre(result.genre || '')
    setFeeling('')
    setBatchMode(false)
    setBatchResults([])
  }

  // 保存批量结果到历史
  const saveBatchResults = async () => {
    const validResults = batchResults.filter(r => r.analysis)
    if (validResults.length === 0) {
      toast.warning('没有可保存的结果')
      return
    }

    for (const result of validResults) {
      try {
        await fetch(`${API_BASE}/api/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: result.imageUrl,
            analysis: result.analysis,
            userFeeling: '',
            poem: '',
            title: result.file.replace(/\.[^/.]+$/, ''),
            style: '',
            genre: result.genre || ''
          })
        })
      } catch (err) {
        console.error('保存失败', err)
      }
    }
    toast.success(`已保存 ${validResults.length} 条记录到历史`)
    exitBatchMode()
  }

  // Paste upload
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            uploadImage(file)
            break
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const replaceImage = () => {
    setImage(null)
    setImagePath('')
    setAnalysis('')
    setFeeling('')
    setGenre('')
    fileInputRef.current?.click()
  }

  // 批量模式 UI
  if (batchMode) {
    return (
      <div className="upload-section fade-in">
        <div className="batch-header">
          <h2>批量分析结果</h2>
          <div className="batch-actions">
            <button className="btn" onClick={saveBatchResults}>保存全部到历史</button>
            <button className="btn btn-secondary" onClick={exitBatchMode}>返回</button>
          </div>
        </div>

        {batchProcessing && <LoadingProgress stage="batch" />}

        <div className="batch-results">
          {batchResults.map((result, idx) => (
            <div key={idx} className={`batch-item ${result.analysis ? 'success' : 'error'}`}>
              <div className="batch-item-img">
                {result.imageUrl && <img src={result.imageUrl} alt={result.file} />}
              </div>
              <div className="batch-item-info">
                <h4>{result.file}</h4>
                {result.genre && <span className="genre-tag">{result.genre}</span>}
                {result.analysis ? (
                  <>
                    <div className="batch-analysis-full">
                      <MarkdownRenderer content={result.analysis} />
                    </div>
                    <button className="btn-small" onClick={() => useBatchResult(result)}>
                      使用此结果
                    </button>
                  </>
                ) : (
                  <p className="error-text">{result.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <input
          ref={multiFileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleMultiFileChange}
          style={{ display: 'none' }}
        />
      </div>
    )
  }

  return (
    <div className="upload-section fade-in">
      <h2>上传画作</h2>

      <div className="upload-mode-toggle">
        <button
          className={`mode-btn ${!batchMode ? 'active' : ''}`}
          onClick={() => fileInputRef.current?.click()}
        >
          单图上传
        </button>
        <button
          className={`mode-btn ${batchMode ? 'active' : ''}`}
          onClick={() => multiFileInputRef.current?.click()}
        >
          批量上传
        </button>
      </div>

      <div
        className="upload-area"
        onClick={() => !image && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {image ? (
          <div className="preview-container">
            <img src={image} alt="预览" className="preview-image" />
            {genre && <span className="genre-tag-preview">{genre}</span>}
            <div className="preview-actions">
              <button
                className="zoom-btn"
                onClick={(e) => { e.stopPropagation(); setIsImageModalOpen(true) }}
                title="放大查看"
              >
                &#x1F50D;
              </button>
              <button
                className="replace-btn"
                onClick={(e) => { e.stopPropagation(); replaceImage() }}
                title="更换图片"
              >
                &#x1F504;
              </button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '3rem', marginBottom: '10px' }}>&#x1F3A8;</p>
            <p>点击或拖拽上传中国画</p>
            <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '8px' }}>
              支持 JPG/PNG/WebP 格式，可直接粘贴 (Ctrl+V)<br />
              拖入多张图片可批量分析
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
      <input
        ref={multiFileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleMultiFileChange}
        style={{ display: 'none' }}
      />

      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="upload-progress-bar">
          <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
        </div>
      )}

      {loadingStage && <LoadingProgress stage={loadingStage} />}

      {analysis && (
        <div className="result-card analysis-card slide-up">
          <div className="analysis-header">
            <h3>&#x1F3A8; AI 赏析</h3>
            {genre && <span className="genre-tag">{genre}</span>}
          </div>
          <MarkdownRenderer content={analysis} />
        </div>
      )}

      {analysis && (
        <div className="result-card feeling-card slide-up">
          <h3>&#x1F4AD; 您的感悟</h3>
          <textarea
            className="feeling-input"
            placeholder="请写下您对这幅画的理解和感受..."
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
          />
        </div>
      )}

      {isImageModalOpen && image && (
        <div className="image-modal" onClick={() => setIsImageModalOpen(false)}>
          <div className="image-modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsImageModalOpen(false)}>&#x2715;</button>
            <img src={image} alt="放大查看" className="modal-image" />
          </div>
        </div>
      )}
    </div>
  )
}
