import React, { createContext, useContext, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { springs } from '@/tokens'

export type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // 1. Check saved manual preference
    const saved = localStorage.getItem('iare_theme') as Theme | null
    if (saved === 'light' || saved === 'dark') return saved

    // 2. Fall back to OS preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Listen to OS-level preference changes if not manually locked
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      const manualSaved = localStorage.getItem('iare_theme')
      if (!manualSaved) {
        setThemeState(e.matches ? 'dark' : 'light')
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('iare_theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

/** Apple-style Theme toggle button component */
export function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      transition={springs.snappy}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        color: 'var(--text-primary)',
        borderRadius: 'var(--radius-full)',
        padding: '6px 12px',
        fontSize: '0.8125rem',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: 'var(--shadow-subtle)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        ...style,
      }}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
    >
      <span style={{ display: 'inline-flex', color: isDark ? '#FFD60A' : '#FF9500' }}>
        {isDark ? <Moon size={14} /> : <Sun size={14} />}
      </span>
      <span>{isDark ? 'Dark' : 'Light'}</span>
    </motion.button>
  )
}
