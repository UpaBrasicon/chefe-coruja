import { useEffect } from 'react'

const NAVY = 'linear-gradient(145deg, #0c1445 0%, #0e2d6e 45%, #0e4d8a 100%)'

export function useNavyTheme() {
  useEffect(() => {
    const prevBody = document.body.style.background
    const prevHtml = document.documentElement.style.background
    document.body.style.background = NAVY
    document.documentElement.style.background = '#0c1445'
    return () => {
      document.body.style.background = prevBody
      document.documentElement.style.background = prevHtml
    }
  }, [])
}
