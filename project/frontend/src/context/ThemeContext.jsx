import { useEffect, useState } from 'react'
import { isValidTheme } from '../config/themes'
import { ThemeContext } from './themeCtx'

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    // Un valor inválido en localStorage se normaliza a 'system'.
    const stored = localStorage.getItem('theme')
    return isValidTheme(stored) ? stored : 'system'
  })

  useEffect(() => {
    function apply() {
      // 'system' se resuelve por el sistema operativo; cualquier otro tema se escribe literal.
      const resolved =
        theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : theme
      document.documentElement.dataset.theme = resolved
    }

    apply()

    if (theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  function setTheme(value) {
    document.documentElement.classList.add('no-transitions')
    localStorage.setItem('theme', value)
    setThemeState(value)
    // Dos frames: el primero aplica el data-theme y el segundo deja pintar antes de reactivar las transiciones.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('no-transitions')
      })
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
