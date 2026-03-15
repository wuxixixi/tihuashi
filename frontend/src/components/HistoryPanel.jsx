import { useState, useEffect, useCallback } from 'react'
import MarkdownRenderer from './MarkdownRenderer'

const API_BASE = ''

// 常用标签建议
const SUGGESTED_TAGS = ['山水', '花鸟', '人物', '写意', '工笔', '精品', '收藏', '思乡', '送别', '田园', '边塞', '怀古']

// 重写风格选项
const rewriteStyles = ['五言绝句', '七言绝句', '五言律诗', '七言律诗', '古体诗', '婉约词', '豪放词', '田园词', '边塞词']

export default function HistoryPanel({ toast, confirm }) {
  const [history, setHistory] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState(null)
  const [detailIndex, setDetailIndex] = useState(-1)
  const [selectedGenre, setSelectedGenre] = useState('')
  const [editingTags, setEditingTags] = useState(false)
  const [currentTags, setCurrentTags] = useState([])
  const [newTag, setNewTag] = useState('')

  // AI 增强功能状态
  const [rewriteLoading, setRewriteLoading] = useState(false)
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [showRewriteModal, setShowRewriteModal] = useState(false)
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false)
  const [selectedRewriteStyle, setSelectedRewriteStyle] = useState('')
  const [poemAnalysis, setPoemAnalysis] = useState('')

  // 解析 tags 字段
  const parseTags = (tagsStr) => {
    if (!tagsStr) return []
    try {
      return typeof tagsStr === 'string' ? JSON.parse(tagsStr) : tagsStr
    } catch {
      return []
    }
  }

  const loadHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page, pageSize: 12 })
      if (search) params.append('search', search)
      if (favoriteOnly) params.append('favoriteOnly', 'true')
      if (selectedGenre) params.append('genre', selectedGenre)
      const res = await fetch(`${API_BASE}/api/history?${params}`)
      const data = await res.json()
      if (data.success) {
        setHistory(data.history)
        setPagination(data.pagination || { total: 0, totalPages: 1 })
      }
    } catch (err) {
      toast.error('加载历史失败')
    }
  }, [page, search, favoriteOnly, selectedGenre, toast])

  useEffect(() => { loadHistory() }, [loadHistory])

  const deleteHistory = async (id) => {
    const ok = await confirm('确定要删除这条记录吗？删除后不可恢复。', '删除确认')
    if (!ok) return
    try {
      await fetch(`${API_BASE}/api/history/${id}`, { method: 'DELETE' })
      toast.success('已删除')
      loadHistory()
      if (selectedHistory?.id === id) setSelectedHistory(null)
    } catch (err) {
      toast.error('删除失败')
    }
  }

  const deleteAllHistory = async () => {
    const ok = await confirm('确定要删除全部历史记录吗？此操作不可恢复！', '删除全部确认')
    if (!ok) return
    try {
      const res = await fetch(`${API_BASE}/api/history`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success(`已删除 ${data.deleted} 条记录`)
        loadHistory()
        setSelectedHistory(null)
      } else {
        toast.error(data.error || '删除失败')
      }
    } catch (err) {
      toast.error('删除失败')
    }
  }

  const toggleFavorite = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/history/${id}/favorite`, { method: 'PATCH' })
      const data = await res.json()
      if (data.success) {
        setHistory(prev => prev.map(h =>
          h.id === id ? { ...h, favorite: data.favorite } : h
        ))
        if (selectedHistory?.id === id) {
          setSelectedHistory(prev => ({ ...prev, favorite: data.favorite }))
        }
        toast.success(data.favorite ? '已收藏' : '已取消收藏')
      } else {
        toast.error(data.error || '收藏操作失败')
      }
    } catch (err) {
      toast.error('网络请求失败，请检查后端服务是否运行')
    }
  }

  // 打开详情时初始化标签
  const openDetail = (item, index) => {
    setSelectedHistory(item)
    setDetailIndex(index)
    setCurrentTags(parseTags(item.tags))
    setEditingTags(false)
  }

  // 开始编辑标签
  const startEditTags = () => {
    setCurrentTags(parseTags(selectedHistory?.tags || []))
    setEditingTags(true)
  }

  // 添加标签
  const addTag = () => {
    const tag = newTag.trim()
    if (tag && !currentTags.includes(tag)) {
      setCurrentTags([...currentTags, tag])
    }
    setNewTag('')
  }

  // 移除标签
  const removeTag = (tag) => {
    setCurrentTags(currentTags.filter(t => t !== tag))
  }

  // 保存标签
  const saveTags = async () => {
    if (!selectedHistory) return
    try {
      const res = await fetch(`${API_BASE}/api/history/${selectedHistory.id}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: currentTags })
      })
      const data = await res.json()
      if (data.success) {
        // 更新列表中的数据
        setHistory(prev => prev.map(h =>
          h.id === selectedHistory.id ? { ...h, tags: JSON.stringify(currentTags) } : h
        ))
        setSelectedHistory(prev => ({ ...prev, tags: JSON.stringify(currentTags) }))
        setEditingTags(false)
        toast.success('标签已更新')
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch (err) {
      toast.error('保存失败')
    }
  }

  const copyPoem = (item) => {
    const text = item.title ? `${item.title}\n\n${item.poem}` : item.poem
    navigator.clipboard.writeText(text).then(() => {
      toast.success('已复制到剪贴板')
    }).catch(() => toast.error('复制失败'))
  }

  // AI 风格重写
  const rewritePoem = async () => {
    if (!selectedRewriteStyle || !selectedHistory) return
    setRewriteLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poem: selectedHistory.poem,
          title: selectedHistory.title,
          targetStyle: selectedRewriteStyle
        })
      })
      const data = await res.json()
      if (data.success) {
        // 更新当前显示的记录
        setSelectedHistory(prev => ({
          ...prev,
          title: data.newTitle,
          poem: data.newPoem
        }))
        // 更新列表中的记录
        setHistory(prev => prev.map(h =>
          h.id === selectedHistory.id ? { ...h, title: data.newTitle, poem: data.newPoem } : h
        ))
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

  // AI 诗词解析
  const analyzePoem = async () => {
    if (!selectedHistory?.poem) return
    setAnalyzeLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/analyze-poem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poem: selectedHistory.poem,
          title: selectedHistory.title
        })
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

  const navigateDetail = (dir) => {
    const newIdx = detailIndex + dir
    if (newIdx >= 0 && newIdx < history.length) {
      setDetailIndex(newIdx)
      setSelectedHistory(history[newIdx])
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    loadHistory()
  }

  // 导出数据
  const handleExport = async (format) => {
    try {
      const res = await fetch(`${API_BASE}/api/export?format=${format}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `moyun_backup_${new Date().toISOString().slice(0,10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`已导出为 ${format.toUpperCase()} 文件`)
    } catch (err) {
      toast.error('导出失败')
    }
  }

  // 导入数据
  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      let data
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text)
        data = data.data || []
      } else {
        toast.error('仅支持 JSON 格式导入')
        return
      }
      const res = await fetch(`${API_BASE}/api/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, mode: 'merge' })
      })
      const result = await res.json()
      if (result.success) {
        toast.success(`成功导入 ${result.imported} 条记录`)
        loadHistory()
      } else {
        toast.error(result.error || '导入失败')
      }
    } catch (err) {
      toast.error('导入失败，请检查文件格式')
    }
    e.target.value = ''
  }

  return (
    <div className="history-section fade-in">
      <h2>历史记录</h2>

      <div className="history-toolbar-row">
        <form className="history-toolbar" onSubmit={handleSearch}>
          <div className="search-box">
            <input
              type="text"
              placeholder="搜索标题、诗词、赏析..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-btn">搜索</button>
          </div>
          <button
            type="button"
            className={`filter-btn ${favoriteOnly ? 'active' : ''}`}
            onClick={() => { setFavoriteOnly(!favoriteOnly); setPage(1) }}
          >
            {favoriteOnly ? '♥ 仅收藏' : '♡ 收藏筛选'}
          </button>
        </form>

        <div className="history-actions">
          <button
            type="button"
            className="action-btn"
            onClick={() => handleExport('json')}
            title="导出为 JSON"
          >
            导出 JSON
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => handleExport('csv')}
            title="导出为 CSV"
          >
            导出 CSV
          </button>
          <label className="action-btn import-btn">
            导入 JSON
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
          <button
            type="button"
            className="action-btn delete-btn"
            onClick={deleteAllHistory}
            title="删除全部记录"
          >
            全删
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="empty-history">
          <p>{search || favoriteOnly ? '没有找到匹配的记录' : '暂无记录'}</p>
        </div>
      ) : (
        <>
          <div className="history-grid">
            {history.map((item, idx) => (
              <div key={item.id} className="history-card slide-up">
                <div className="history-card-img-wrap">
                  <img src={item.imageUrl} alt={item.title} />
                  <button
                    className={`fav-btn ${item.favorite ? 'fav-active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id) }}
                    title={item.favorite ? '取消收藏' : '收藏'}
                  >
                    {item.favorite ? '\u2764' : '\u2661'}
                  </button>
                  {item.genre && <span className="card-genre-tag">{item.genre}</span>}
                </div>
                <div className="history-card-content">
                  <h4>{item.title}</h4>
                  <div className="history-card-tags">
                    {parseTags(item.tags).slice(0, 3).map((tag, i) => (
                      <span key={i} className="tag-mini">{tag}</span>
                    ))}
                  </div>
                  <p>{item.poem}</p>
                  <div className="history-card-actions">
                    <button className="view-btn" onClick={() => openDetail(item, idx)}>查看</button>
                    <button className="delete-btn" onClick={() => deleteHistory(item.id)}>删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                上一页
              </button>
              <span className="page-info">
                {pagination.page} / {pagination.totalPages}
                <span className="page-total">（共 {pagination.total} 条）</span>
              </span>
              <button
                className="page-btn"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* History Detail Modal */}
      {selectedHistory && (
        <div className="history-detail-modal" onClick={() => setSelectedHistory(null)}>
          <div className="history-detail-content slide-up" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedHistory(null)}>&#x2715;</button>

            <div className="detail-nav">
              <button
                className="nav-btn"
                disabled={detailIndex <= 0}
                onClick={() => navigateDetail(-1)}
              >
                &#x2190; 上一条
              </button>
              <button
                className="nav-btn"
                disabled={detailIndex >= history.length - 1}
                onClick={() => navigateDetail(1)}
              >
                下一条 &#x2192;
              </button>
            </div>

            <h2>{selectedHistory.title || '无题'}</h2>

            <div className="history-detail-image">
              <img src={selectedHistory.imageUrl} alt={selectedHistory.title} />
            </div>

            {selectedHistory.analysis && (
              <div className="history-detail-section">
                <h3>&#x1F3A8; AI 赏析</h3>
                <MarkdownRenderer content={selectedHistory.analysis} />
              </div>
            )}

            {selectedHistory.userFeeling && (
              <div className="history-detail-section">
                <h3>&#x1F4AD; 您的感悟</h3>
                <p>{selectedHistory.userFeeling}</p>
              </div>
            )}

            {selectedHistory.poem && (
              <div className="history-detail-section">
                <h3>&#x1F4DC; 题诗</h3>
                <div className="history-poem-display">{selectedHistory.poem}</div>
              </div>
            )}

            {/* 标签编辑 */}
            <div className="history-detail-section">
              <h3>&#x1F3F7; 标签</h3>
              {editingTags ? (
                <div className="tags-editor">
                  <div className="tags-list">
                    {currentTags.map((tag, idx) => (
                      <span key={idx} className="tag-editable">
                        {tag}
                        <button onClick={() => removeTag(tag)}>&times;</button>
                      </span>
                    ))}
                  </div>
                  <div className="tag-input-row">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      placeholder="添加标签..."
                      list="suggested-tags"
                    />
                    <datalist id="suggested-tags">
                      {SUGGESTED_TAGS.filter(t => !currentTags.includes(t)).map(t => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                    <button onClick={addTag} className="btn-small">添加</button>
                  </div>
                  <div className="tags-edit-actions">
                    <button className="btn-small btn-save" onClick={saveTags}>保存</button>
                    <button className="btn-small btn-cancel-edit" onClick={() => setEditingTags(false)}>取消</button>
                  </div>
                </div>
              ) : (
                <div className="tags-display">
                  {parseTags(selectedHistory.tags).length > 0 ? (
                    <>
                      {parseTags(selectedHistory.tags).map((tag, idx) => (
                        <span key={idx} className="tag">{tag}</span>
                      ))}
                      <button className="btn-small" onClick={startEditTags}>编辑标签</button>
                    </>
                  ) : (
                    <button className="btn-small" onClick={startEditTags}>添加标签</button>
                  )}
                </div>
              )}
            </div>

            <div className="detail-bottom-actions">
              <button className="icon-btn-labeled" onClick={() => copyPoem(selectedHistory)}>
                &#x1F4CB; 复制诗词
              </button>
              <button className="icon-btn-labeled" onClick={() => setShowRewriteModal(true)}>
                &#x1F4DD; 风格重写
              </button>
              <button className="icon-btn-labeled" onClick={analyzePoem} disabled={analyzeLoading}>
                &#x1F50D; {analyzeLoading ? '解析中...' : 'AI解析'}
              </button>
              <button
                className={`icon-btn-labeled ${selectedHistory.favorite ? 'fav-active' : ''}`}
                onClick={() => toggleFavorite(selectedHistory.id)}
              >
                {selectedHistory.favorite ? '\u2764 已收藏' : '\u2661 收藏'}
              </button>
            </div>

            <div className="history-detail-date">
              创作时间：{new Date(selectedHistory.createdAt).toLocaleString('zh-CN')}
            </div>
          </div>
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
    </div>
  )
}
