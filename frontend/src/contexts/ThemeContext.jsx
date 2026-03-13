import { createContext, useContext, useState, useEffect } from 'react'

const themes = {
  classic: {
    name: '古典棕',
    primary: '#8B4513',
    secondary: '#D2691E',
    bg: '#FDF5E6',
    paper: '#FEF9E7',
    text: '#3E2723',
    border: '#DEB887',
    accent: '#A0522D',
    cardBg: '#ffffff',
    gradientStart: 'rgba(139,69,19,0.05)',
    gradientEnd: 'rgba(210,105,30,0.05)',
  },
  ink: {
    name: '水墨黑',
    primary: '#2C2C2C',
    secondary: '#555555',
    bg: '#F5F5F0',
    paper: '#FAFAF5',
    text: '#1A1A1A',
    border: '#CCCCBB',
    accent: '#444444',
    cardBg: '#ffffff',
    gradientStart: 'rgba(44,44,44,0.04)',
    gradientEnd: 'rgba(85,85,85,0.04)',
  },
  blue: {
    name: '青花蓝',
    primary: '#1565C0',
    secondary: '#1976D2',
    bg: '#F0F4FA',
    paper: '#F5F8FC',
    text: '#1A237E',
    border: '#90CAF9',
    accent: '#0D47A1',
    cardBg: '#ffffff',
    gradientStart: 'rgba(21,101,192,0.05)',
    gradientEnd: 'rgba(25,118,210,0.05)',
  }
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem('moyun-theme') || 'classic'
  })

  const theme = themes[themeName] || themes.classic

  useEffect(() => {
    localStorage.setItem('moyun-theme', themeName)
    const root = document.documentElement
    Object.entries(theme).forEach(([key, value]) => {
      if (key !== 'name') {
        root.style.setProperty(`--${key}`, value)
      }
    })
  }, [themeName, theme])

  return (
    <ThemeContext.Provider value={{ themeName, setThemeName, theme, themes }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
