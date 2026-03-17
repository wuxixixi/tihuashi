import { useState, useEffect } from 'react'

const API_BASE = ''

export default function SettingsPanel({ toast }) {
  const [textModels, setTextModels] = useState({})
  const [visionModels, setVisionModels] = useState({})
  const [currentTextModel, setCurrentTextModel] = useState('')
  const [currentVisionModel, setCurrentVisionModel] = useState('')
  const [templates, setTemplates] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('models')

  // 模型测试状态
  const [testingModel, setTestingModel] = useState(null)
  const [testingAll, setTestingAll] = useState(false)
  const [testResults, setTestResults] = useState({ textModels: {}, visionModels: {} })

  // 编辑模板状态
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [editName, setEditName] = useState('')
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const [modelsRes, templatesRes] = await Promise.all([
        fetch(`${API_BASE}/api/models`),
        fetch(`${API_BASE}/api/templates`)
      ])

      const modelsData = await modelsRes.json()
      const templatesData = await templatesRes.json()

      if (modelsData.success) {
        setTextModels(modelsData.textModels)
        setVisionModels(modelsData.visionModels)
        setCurrentTextModel(modelsData.currentTextModel)
        setCurrentVisionModel(modelsData.currentVisionModel)
      }

      if (templatesData.success) {
        setTemplates(templatesData.templates)
      }
    } catch (err) {
      toast.error('加载设置失败')
    }
    setLoading(false)
  }

  const switchModel = async (type, model) => {
    try {
      const res = await fetch(`${API_BASE}/api/models/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textModel: type === 'text' ? model : undefined,
          visionModel: type === 'vision' ? model : undefined
        })
      })

      const data = await res.json()
      if (data.success) {
        if (type === 'text') setCurrentTextModel(model)
        else setCurrentVisionModel(model)
        toast.success('模型已切换')
      }
    } catch (err) {
      toast.error('切换失败')
    }
  }

  // 测试单个模型
  const testModel = async (modelId, type) => {
    setTestingModel(modelId)
    try {
      const res = await fetch(`${API_BASE}/api/models/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId, type })
      })
      const data = await res.json()

      setTestResults(prev => ({
        ...prev,
        [type === 'text' ? 'textModels' : 'visionModels']: {
          ...prev[type === 'text' ? 'textModels' : 'visionModels'],
          [modelId]: data
        }
      }))

      if (data.success && data.available) {
        toast.success(`${modelId} 测试成功 (${data.latency}ms)`)
      } else {
        toast.error(`${modelId} 测试失败: ${data.error}`)
      }
    } catch (err) {
      toast.error('测试请求失败')
    }
    setTestingModel(null)
  }

  // 测试所有模型
  const testAllModels = async () => {
    setTestingAll(true)
    toast.info('开始测试所有模型，请稍候...')
    try {
      const res = await fetch(`${API_BASE}/api/models/test-all`)
      const data = await res.json()
      if (data.success) {
        setTestResults(data.results)

        // 统计结果
        const textAvailable = Object.values(data.results.textModels).filter(r => r.available).length
        const visionAvailable = Object.values(data.results.visionModels).filter(r => r.available).length
        toast.success(`测试完成：文本模型 ${textAvailable}/${Object.keys(textModels).length} 可用，视觉模型 ${visionAvailable}/${Object.keys(visionModels).length} 可用`)
      }
    } catch (err) {
      toast.error('批量测试失败')
    }
    setTestingAll(false)
  }

  const startEditTemplate = (id) => {
    const template = templates[id]
    setEditingTemplate(id)
    setEditName(template.name)
    setEditContent(template.template)
  }

  const saveTemplate = async () => {
    if (!editName.trim() || !editContent.trim()) {
      toast.warning('名称和内容不能为空')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTemplate,
          name: editName,
          template: editContent
        })
      })

      const data = await res.json()
      if (data.success) {
        setTemplates(prev => ({
          ...prev,
          [editingTemplate]: {
            ...prev[editingTemplate],
            name: editName,
            template: editContent,
            isCustom: true
          }
        }))
        setEditingTemplate(null)
        toast.success('模板已保存')
      }
    } catch (err) {
      toast.error('保存失败')
    }
  }

  const resetTemplate = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/templates/${id}/reset`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.success) {
        setTemplates(prev => ({
          ...prev,
          [id]: data.template
        }))
        toast.success('模板已重置')
      }
    } catch (err) {
      toast.error('重置失败')
    }
  }

  // 获取模型状态显示
  const getModelStatus = (id, type) => {
    const results = type === 'text' ? testResults.textModels[id] : testResults.visionModels[id]
    if (!results) return null

    return results.available ? (
      <span className="model-status available" title={`延迟: ${results.latency}ms`}>
        ✓ {results.latency}ms
      </span>
    ) : (
      <span className="model-status unavailable" title={results.error}>
        ✗ 不可用
      </span>
    )
  }

  if (loading) {
    return (
      <div className="settings-section fade-in">
        <div className="settings-loading">
          <div className="loading-spinner"></div>
          <p>加载设置...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-section fade-in">
      <h2>模型设置</h2>
      <p className="settings-intro">配置 AI 模型和提示词模板</p>

      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeSection === 'models' ? 'active' : ''}`}
          onClick={() => setActiveSection('models')}
        >
          AI 模型
        </button>
        <button
          className={`settings-tab ${activeSection === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveSection('templates')}
        >
          提示词模板
        </button>
      </div>

      {activeSection === 'models' && (
        <div className="settings-content slide-up">
          {/* 批量测试按钮 */}
          <div className="test-all-section">
            <button
              className="btn btn-test-all"
              onClick={testAllModels}
              disabled={testingAll}
            >
              {testingAll ? '测试中...' : '🔍 测试所有模型可用性'}
            </button>
            <span className="test-hint">点击测试所有模型是否可用（约需30秒）</span>
          </div>

          {/* 文本模型选择 */}
          <div className="settings-group">
            <h3>🤖 文本生成模型</h3>
            <p className="settings-desc">用于诗词创作、润色、解析等文本生成任务</p>
            <div className="model-grid">
              {Object.entries(textModels).map(([id, model]) => (
                <div
                  key={id}
                  className={`model-card ${currentTextModel === id ? 'active' : ''} ${model.tested === false ? 'untested' : ''}`}
                  onClick={() => switchModel('text', id)}
                >
                  <div className="model-header">
                    <div className="model-name">{model.name}</div>
                    {!model.tested && <span className="new-badge">新</span>}
                  </div>
                  <div className="model-desc">{model.description}</div>
                  <div className="model-footer">
                    {getModelStatus(id, 'text')}
                    <button
                      className="btn-test"
                      onClick={(e) => { e.stopPropagation(); testModel(id, 'text') }}
                      disabled={testingModel === id}
                      title="测试此模型"
                    >
                      {testingModel === id ? '...' : '测试'}
                    </button>
                  </div>
                  {currentTextModel === id && <span className="model-check">✓</span>}
                </div>
              ))}
            </div>
          </div>

          {/* 视觉模型选择 */}
          <div className="settings-group">
            <h3>🎨 图像理解模型</h3>
            <p className="settings-desc">用于画作分析和图像理解</p>
            <div className="model-grid">
              {Object.entries(visionModels).map(([id, model]) => (
                <div
                  key={id}
                  className={`model-card ${currentVisionModel === id ? 'active' : ''} ${model.tested === false ? 'untested' : ''}`}
                  onClick={() => switchModel('vision', id)}
                >
                  <div className="model-header">
                    <div className="model-name">{model.name}</div>
                    {!model.tested && <span className="new-badge">新</span>}
                  </div>
                  <div className="model-desc">{model.description}</div>
                  <div className="model-footer">
                    {getModelStatus(id, 'vision')}
                    <button
                      className="btn-test"
                      onClick={(e) => { e.stopPropagation(); testModel(id, 'vision') }}
                      disabled={testingModel === id}
                      title="测试此模型"
                    >
                      {testingModel === id ? '...' : '测试'}
                    </button>
                  </div>
                  {currentVisionModel === id && <span className="model-check">✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'templates' && (
        <div className="settings-content slide-up">
          {editingTemplate ? (
            <div className="template-editor">
              <h3>编辑模板：{templates[editingTemplate]?.name}</h3>
              <div className="form-group">
                <label>模板名称</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>模板内容</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="form-textarea"
                  rows={12}
                />
                <p className="form-hint">
                  可用变量：{'{analysis}'} {'{userFeeling}'} {'{style}'} {'{title}'} {'{poem}'}
                </p>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={saveTemplate}>保存</button>
                <button className="btn btn-secondary" onClick={() => setEditingTemplate(null)}>取消</button>
              </div>
            </div>
          ) : (
            <div className="templates-list">
              {Object.entries(templates).map(([id, template]) => (
                <div key={id} className="template-card">
                  <div className="template-header">
                    <h4>{template.name}</h4>
                    {template.isCustom && <span className="custom-badge">自定义</span>}
                  </div>
                  <p className="template-preview">
                    {template.template.substring(0, 100)}...
                  </p>
                  <div className="template-actions">
                    <button className="btn-small" onClick={() => startEditTemplate(id)}>
                      编辑
                    </button>
                    {template.isCustom && (
                      <button className="btn-small btn-secondary" onClick={() => resetTemplate(id)}>
                        重置
                      </button>
                    )}
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
