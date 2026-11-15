import { useEffect, useRef } from 'react'

// Sticky para columnas más altas que el viewport: ajusta `top` según la dirección del scroll
// para que la columna acompañe al feed y se detenga al llegar a su borde.
export function useFollowSticky({ topGap = 80, bottomGap = 24 } = {}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let lastScrollY = window.scrollY
    let currentTop = topGap
    let ticking = false

    function apply() {
      ticking = false
      const vh = window.innerHeight
      const elH = el.offsetHeight
      const scrollY = window.scrollY

      // Entra completa → sticky común arriba.
      if (elH + topGap + bottomGap <= vh) {
        currentTop = topGap
        el.style.top = `${currentTop}px`
        lastScrollY = scrollY
        return
      }

      const delta = scrollY - lastScrollY
      lastScrollY = scrollY

      const minTop = vh - elH - bottomGap // negativo: borde inferior en el fondo
      const maxTop = topGap
      currentTop -= delta
      if (currentTop > maxTop) currentTop = maxTop
      if (currentTop < minTop) currentTop = minTop
      el.style.top = `${currentTop}px`
    }

    function onScroll() {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(apply)
      }
    }

    // La altura de la columna cambia al cargar datos o al redimensionar.
    const ro = new ResizeObserver(apply)
    ro.observe(el)

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', apply)
    apply()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', apply)
      ro.disconnect()
    }
  }, [topGap, bottomGap])

  return ref
}
