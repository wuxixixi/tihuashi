/**
 * 简易 Markdown 渲染组件
 * 支持：标题(#)、加粗(**)、斜体(*)、有序/无序列表、段落、换行
 */
export default function MarkdownRenderer({ content, className }) {
  if (!content) return null

  const renderInline = (text) => {
    const parts = []
    // 处理加粗和斜体
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      if (match[2]) {
        parts.push(<strong key={match.index}>{match[2]}</strong>)
      } else if (match[3]) {
        parts.push(<em key={match.index}>{match[3]}</em>)
      }
      lastIndex = regex.lastIndex
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }
    return parts.length > 0 ? parts : text
  }

  const lines = content.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // 空行 -> 跳过
    if (!trimmed) {
      i++
      continue
    }

    // 标题 ### / ## / #
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2]
      const Tag = `h${Math.min(level + 2, 6)}` // 映射为 h3-h6，避免抢占页面主标题
      elements.push(<Tag key={i} className="md-heading">{renderInline(text)}</Tag>)
      i++
      continue
    }

    // 有序列表 1. / 2. ...
    if (/^\d+[.、]\s/.test(trimmed)) {
      const listItems = []
      while (i < lines.length && /^\d+[.、]\s/.test(lines[i].trim())) {
        const text = lines[i].trim().replace(/^\d+[.、]\s*/, '')
        listItems.push(<li key={i}>{renderInline(text)}</li>)
        i++
      }
      elements.push(<ol key={`ol-${i}`} className="md-ol">{listItems}</ol>)
      continue
    }

    // 无序列表 - / * / •
    if (/^[-*•]\s/.test(trimmed)) {
      const listItems = []
      while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
        const text = lines[i].trim().replace(/^[-*•]\s*/, '')
        listItems.push(<li key={i}>{renderInline(text)}</li>)
        i++
      }
      elements.push(<ul key={`ul-${i}`} className="md-ul">{listItems}</ul>)
      continue
    }

    // 普通段落（合并连续非空行）
    const paraLines = []
    while (i < lines.length && lines[i].trim() && !/^#{1,4}\s/.test(lines[i].trim()) && !/^\d+[.、]\s/.test(lines[i].trim()) && !/^[-*•]\s/.test(lines[i].trim())) {
      paraLines.push(lines[i].trim())
      i++
    }
    if (paraLines.length > 0) {
      elements.push(<p key={`p-${i}`} className="md-para">{renderInline(paraLines.join(''))}</p>)
    }
  }

  return <div className={`markdown-body ${className || ''}`}>{elements}</div>
}
