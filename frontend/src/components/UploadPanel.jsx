import { useRef, useState, useEffect } from 'react'
import LoadingProgress from './LoadingProgress'
import MarkdownRenderer from './MarkdownRenderer'

const API_BASE = ''

export default function UploadPanel({ image, setImage, imagePath, setImagePath, analysis, setAnalysis, feeling, setFeeling, loadingStage, setLoadingStage, toast }) {
  const fileInputRef = useRef(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

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
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath: imgPath })
      })
      const data = await res.json()
      if (data.success) {
        setAnalysis(data.analysis)
        toast.success('AI 赏析完成')
      } else {
        toast.error('分析失败: ' + (data.error || '未知错误'))
      }
    } catch (err) {
      toast.error('分析失败: ' + err.message)
    }
    setLoadingStage(null)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadImage(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.currentTarget.classList.remove('dragover')
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      uploadImage(file)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.currentTarget.classList.add('dragover')
  }

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('dragover')
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
    fileInputRef.current?.click()
  }

  return (
    <div className="upload-section fade-in">
      <h2>上传画作</h2>
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
              支持 JPG/PNG/WebP 格式，可直接粘贴 (Ctrl+V)
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

      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="upload-progress-bar">
          <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
        </div>
      )}

      {loadingStage && <LoadingProgress stage={loadingStage} />}

      {analysis && (
        <div className="result-card analysis-card slide-up">
          <h3>&#x1F3A8; AI 赏析</h3>
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
