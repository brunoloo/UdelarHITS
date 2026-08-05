import { useEffect, useRef } from 'react'

// Sticky "que acompaña el scroll" (comportamiento tipo Twitter) para columnas
// más altas que el viewport. Un `position: sticky` normal pinea un solo borde:
// si la columna es más alta que la pantalla, su parte inferior queda
// inalcanzable mientras el feed de al lado sea más largo. Este hook ajusta el
// `top` del elemento sticky en runtime según la dirección del scroll:
//   - al bajar, la columna sube junto con el feed hasta que su borde inferior
//     llega al fondo del viewport, y ahí se frena (pin abajo);
//   - al subir, baja junto con el feed hasta que su borde superior vuelve al
//     offset de arriba, y ahí se frena (pin arriba);
//   - en el medio, scrollea libre con la página.
// Si la columna entra completa, se comporta como un sticky común pineado arriba.
//
// topGap = distancia desde el tope del viewport cuando está pineada arriba
// (header + aire). bottomGap = aire que se deja abajo cuando está pineada abajo.
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

    // La altura del sidebar cambia cuando cargan los datos (categorías nuevas,
    // etiquetas populares) o al redimensionar: recalculamos en ambos casos.
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
