// Safari en iOS ignora user-scalable=no para el pinch: hay que cancelar los eventos de
// gesto de WebKit. No se escucha touchmove: un listener no pasivo haría que cada scroll
// espere al hilo principal.
export function preventPinchZoom() {
  const cancel = (e) => e.preventDefault()
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, cancel, { passive: false })
  }
}
