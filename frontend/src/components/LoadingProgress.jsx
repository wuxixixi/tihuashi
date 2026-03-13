export default function LoadingProgress({ stage }) {
  const stages = [
    { key: 'upload', label: '上传图片' },
    { key: 'analyze', label: 'AI 赏析中' },
    { key: 'poem', label: '诗词创作中' },
  ]

  const currentIndex = stages.findIndex(s => s.key === stage)

  return (
    <div className="loading-progress fade-in">
      <div className="loading-spinner"></div>
      <div className="progress-steps">
        {stages.map((s, i) => (
          <div key={s.key} className={`progress-step ${i < currentIndex ? 'done' : ''} ${i === currentIndex ? 'active' : ''}`}>
            <div className="step-dot">
              {i < currentIndex ? '\u2714' : i + 1}
            </div>
            <span className="step-label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
