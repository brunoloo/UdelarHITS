import { useContext } from 'react'
import { ThemeContext } from '../context/themeCtx'

export function useTheme() {
  return useContext(ThemeContext)
}
