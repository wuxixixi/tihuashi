import { useState, useEffect, useCallback } from 'react'
import MarkdownRenderer from './MarkdownRenderer'

const API_BASE = ''

export default function HistoryPanel({ toast, confirm }) {
  const [history, setHistory] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState(null)
  const [detailIndex, setDetailIndex] = useState(-1)

  const loadHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page, pageSize: 12 })
      if (search) params.append('search', search)
      if (favoriteOnly) params.append('favoriteOnly', 'true')
      const res = await fetch(`${API_BASE}/api/history?${params}`)
      const data = await res.json()
      if (data.success) {
        setHistory(data.history)
        setPagination(data.pagination || { total: 0, totalPages: 1 })
      }
    } catch (err) {
      toast.error('加载历史失败')
    }
  }, [page, search, favoriteOnly, toast])

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
      }
    } catch (err) {
      toast.error('操作失败')
    }
  }

  const copyPoem = (item) => {
    const text = item.title ? `${item.title}\n\n${item.poem}` : item.poem
    navigator.clipboard.writeText(text).then(() => {
      toast.success('已复制到剪贴板')
    }).catch(() => toast.error('复制失败'))
  }

  const openDetail = (item, index) => {
    setSelectedHistory(item)
    setDetailIndex(index)
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

  return (
    <div className="history-section fade-in">
      <h2>历史记录</h2>

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
          {favoriteOnly ? '&#x2764; 仅收藏' : '&#x2661; 收藏筛选'}
        </button>
      </form>

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
                </div>
                <div className="history-card-content">
                  <h4>{item.title}</h4>
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

            <div className="detail-bottom-actions">
              <button className="icon-btn-labeled" onClick={() => copyPoem(selectedHistory)}>
                &#x1F4CB; 复制诗词
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
    </div>
  )
}
