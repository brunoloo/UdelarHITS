import { useState, useLayoutEffect } from 'react'
import { AppLayout } from '../../components/layout/AppLayout'
import { BetaGatePage } from './BetaGatePage'

const STORAGE_KEY = 'udelarhits_beta_entered'

export function RootWrapper() {
  const [entered, setEntered] = useState(true)

  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) !== '1') {
        setEntered(false)
      }
    } catch {
      setEntered(false)
    }
  }, [])

  function handleEnter() {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {}
    setEntered(true)
  }

  if (!entered) {
    return <BetaGatePage onEnter={handleEnter} />
  }

  return <AppLayout />
}