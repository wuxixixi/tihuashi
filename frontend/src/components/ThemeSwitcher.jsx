import { useTheme } from '../contexts/ThemeContext'

export default function ThemeSwitcher() {
  const { themeName, setThemeName, themes } = useTheme()

  return (
    <div className="theme-switcher">
      {Object.entries(themes).map(([key, t]) => (
        <button
          key={key}
          className={`theme-btn ${themeName === key ? 'active' : ''}`}
          onClick={() => setThemeName(key)}
          title={t.name}
          style={{ '--swatch': t.primary }}
        >
          <span className="theme-swatch" style={{ background: t.primary }}></span>
          <span className="theme-name">{t.name}</span>
        </button>
      ))}
    </div>
  )
}
