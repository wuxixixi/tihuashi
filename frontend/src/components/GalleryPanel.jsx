import { useState, useEffect, useCallback } from 'react'
import LazyImage from './LazyImage'

const API_BASE = ''

// 生成或获取会话ID
function getSessionId() {
  let sessionId = localStorage.getItem('moyun_session_id')
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('moyun_session_id', sessionId)
  }
  return sessionId
}

export default function GalleryPanel({ toast, onSelectPainting }) {
  const [paintings, setPaintings] = useState([])
  const [filters, setFilters] = useState({ dynasties: [], categories: [] })
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, page: 1 })
  const [search, setSearch] = useState('')
  const [selectedDynasty, setSelectedDynasty] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedPainting, setSelectedPainting] = useState(null)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('all') // 'all' | 'favorites'

  const sessionId = getSessionId()

  const loadPaintings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: pagination.page, pageSize: 12, sessionId })
      if (search) params.append('search', search)
      if (selectedDynasty) params.append('dynasty', selectedDynasty)
      if (selectedCategory) params.append('category', selectedCategory)

      const url = viewMode === 'favorites'
        ? `${API_BASE}/api/gallery/favorites/${sessionId}?${params}`
        : `${API_BASE}/api/gallery?${params}`

      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setPaintings(data.paintings)
        if (data.filters) setFilters(data.filters)
        setPagination(prev => ({ ...data.pagination, page: data.pagination.page }))
      }
    } catch (err) {
      toast.error('加载画廊失败')
    }
    setLoading(false)
  }, [pagination.page, search, selectedDynasty, selectedCategory, sessionId, viewMode, toast])

  useEffect(() => {
    loadPaintings()
  }, [loadPaintings])

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    loadPaintings()
  }

  const toggleFavorite = async (paintingId, e) => {
    if (e) e.stopPropagation()
    try {
      const res = await fetch(`${API_BASE}/api/gallery/${paintingId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })
      const data = await res.json()
      if (data.success) {
        setPaintings(prev => prev.map(p =>
          p.id === paintingId ? { ...p, isFavorite: data.isFavorite } : p
        ))
        if (selectedPainting?.id === paintingId) {
          setSelectedPainting(prev => ({ ...prev, isFavorite: data.isFavorite }))
        }
        toast.success(data.message)
      }
    } catch (err) {
      toast.error('操作失败')
    }
  }

  const openDetail = (painting) => {
    setSelectedPainting(painting)
  }

  const handleSelectForPoem = () => {
    if (selectedPainting && onSelectPainting) {
      onSelectPainting(selectedPainting)
      setSelectedPainting(null)
    }
  }

  return (
    <div className="gallery-section fade-in">
      <h2>名画赏析</h2>
      <p className="gallery-intro">精选历代名家画作，一键生成题画诗</p>

      <div className="gallery-toolbar">
        <form className="gallery-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="搜索画作、画家..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-btn">搜索</button>
        </form>

        <div className="gallery-filters">
          <select
            value={selectedDynasty}
            onChange={(e) => { setSelectedDynasty(e.target.value); setPagination(prev => ({ ...prev, page: 1 })) }}
            className="filter-select"
          >
            <option value="">全部朝代</option>
            {filters.dynasties.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPagination(prev => ({ ...prev, page: 1 })) }}
            className="filter-select"
          >
            <option value="">全部类别</option>
            {filters.categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => { setViewMode('all'); setPagination(prev => ({ ...prev, page: 1 })) }}
            >
              全部
            </button>
            <button
              className={`toggle-btn ${viewMode === 'favorites' ? 'active' : ''}`}
              onClick={() => { setViewMode('favorites'); setPagination(prev => ({ ...prev, page: 1 })) }}
            >
              我的收藏
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="gallery-loading">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      ) : paintings.length === 0 ? (
        <div className="gallery-empty">
          <p>{viewMode === 'favorites' ? '还没有收藏任何画作' : '没有找到匹配的画作'}</p>
        </div>
      ) : (
        <>
          <div className="gallery-grid">
            {paintings.map(painting => (
              <div key={painting.id} className="gallery-card slide-up" onClick={() => openDetail(painting)}>
                <div className="gallery-card-img">
                  <LazyImage src={painting.imageUrl} alt={painting.name} style={{ width: '100%', height: '100%' }} />
                  <button
                    className={`fav-btn ${painting.isFavorite ? 'fav-active' : ''}`}
                    onClick={(e) => toggleFavorite(painting.id, e)}
                    title={painting.isFavorite ? '取消收藏' : '收藏'}
                  >
                    {painting.isFavorite ? '\u2764' : '\u2661'}
                  </button>
                </div>
                <div className="gallery-card-content">
                  <h4>{painting.name}</h4>
                  <p className="gallery-card-artist">{painting.artist} · {painting.dynasty}</p>
                  <span className="gallery-card-category">{painting.category}</span>
                </div>
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                disabled={pagination.page <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                上一页
              </button>
              <span className="page-info">
                {pagination.page} / {pagination.totalPages}
                <span className="page-total">（共 {pagination.total} 幅）</span>
              </span>
              <button
                className="page-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* 画作详情弹窗 */}
      {selectedPainting && (
        <div className="gallery-detail-modal" onClick={() => setSelectedPainting(null)}>
          <div className="gallery-detail-content slide-up" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedPainting(null)}>&#x2715;</button>

            <h2>{selectedPainting.name}</h2>
            <p className="gallery-detail-meta">
              {selectedPainting.artist} · {selectedPainting.dynasty} · {selectedPainting.school}
            </p>

            <div className="gallery-detail-image">
              <LazyImage src={selectedPainting.imageUrl} alt={selectedPainting.name} style={{ width: '100%', maxHeight: '500px' }} />
            </div>

            {selectedPainting.description && (
              <div className="gallery-detail-section">
                <h3>&#x1F3A8; 画作简介</h3>
                <p>{selectedPainting.description}</p>
              </div>
            )}

            <div className="gallery-detail-actions">
              <button className="btn btn-primary" onClick={handleSelectForPoem}>
                &#x270D;&#xFE0F; 为此画题诗
              </button>
              <button
                className={`btn ${selectedPainting.isFavorite ? 'btn-favorited' : 'btn-secondary'}`}
                onClick={(e) => toggleFavorite(selectedPainting.id, e)}
              >
                {selectedPainting.isFavorite ? '\u2764 已收藏' : '\u2661 收藏'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
