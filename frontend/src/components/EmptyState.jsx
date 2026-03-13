export default function EmptyState({ onStart }) {
  return (
    <div className="empty-state fade-in">
      <div className="empty-state-icon">&#x1F3A8;</div>
      <h3>欢迎来到墨韵 AI</h3>
      <p>上传一幅中国画，AI 将为您赏析并题诗</p>
      <div className="empty-state-steps">
        <div className="guide-step">
          <div className="guide-number">1</div>
          <span>上传画作</span>
        </div>
        <div className="guide-arrow">&#x2192;</div>
        <div className="guide-step">
          <div className="guide-number">2</div>
          <span>AI 赏析</span>
        </div>
        <div className="guide-arrow">&#x2192;</div>
        <div className="guide-step">
          <div className="guide-number">3</div>
          <span>写下感悟</span>
        </div>
        <div className="guide-arrow">&#x2192;</div>
        <div className="guide-step">
          <div className="guide-number">4</div>
          <span>为画题诗</span>
        </div>
      </div>
      <button className="btn" onClick={onStart} style={{ marginTop: '20px' }}>
        开始创作
      </button>
    </div>
  )
}
