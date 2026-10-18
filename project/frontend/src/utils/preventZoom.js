// Bloqueo del pinch-zoom en iOS. Desde iOS 10 Safari ignora `user-scalable=no`
// y `maximum-scale` del viewport para el pinch (sí los respeta para no hacer
// zoom al enfocar inputs), así que la única vía es cancelar los eventos de
// gesto propios de WebKit. Chrome/Firefox en iOS usan WebKit, aplica igual.
// En Android alcanza con el viewport de index.html: estos eventos no existen
// ahí y los listeners quedan inertes.
//
// No se escucha `touchmove`: un listener no pasivo en document haría que cada
// scroll espere al hilo principal.
export function preventPinchZoom() {
  const cancel = (e) => e.preventDefault()
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, cancel, { passive: false })
  }
}
