import { createContext, useContext, useEffect, useState } from 'react'
import { isValidTheme } from '../config/themes'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    // Un valor inválido en localStorage (basura o un tema que ya no existe) se
    // normaliza a 'system'. El script inline ya deja el sitio legible (cae al
    // tema claro vía CSS); esto además hace que el selector muestre un estado
    // coherente en vez de una opción rota.
    const stored = localStorage.getItem('theme')
    return isValidTheme(stored) ? stored : 'system'
  })

  useEffect(() => {
    function apply() {
      // 'system' se resuelve por el SO; cualquier otro tema válido (claro,
      // oscuro o una paleta) se escribe literal. Como el listener de abajo solo
      // se engancha en 'system', una paleta elegida nunca la pisa el modo del SO.
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
    // Two rAF frames: first lets React apply the new data-theme,
    // second lets the browser paint it before re-enabling transitions.
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

export function useTheme() {
  return useContext(ThemeContext)
}
