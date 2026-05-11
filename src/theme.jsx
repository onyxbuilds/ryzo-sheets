import { createContext, useContext, useState, useEffect } from 'react'

// ── THEME CONTEXT ─────────────────────────────────────────
// Provides dark/light theme toggle across the entire app
// Persists user preference in localStorage

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem('ryzo-theme')
    if (saved) return saved === 'dark'
    // Default to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    // Save preference
    localStorage.setItem('ryzo-theme', isDark ? 'dark' : 'light')

    // Apply to document root for Tailwind dark mode
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  function toggleTheme() {
    setIsDark(prev => !prev)
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}