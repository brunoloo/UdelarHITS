// Formatea un contador para la UI. Hasta 999 se muestra el número exacto; a
// partir de 1000 se abrevia con (como máximo) un decimal, sin ceros sobrantes.
// El valor se trunca (no se redondea hacia arriba) para no inflar la cifra.
//
// Abreviaciones usadas:
//   k → miles      (1 000)
//   M → millones   (1 000 000)
//   B → mil millones / billones cortos (1 000 000 000)
//
// Ejemplos:
//   999            → "999"
//   1 000          → "1k"
//   1 200          → "1.2k"
//   12 000         → "12k"
//   999 000        → "999k"
//   1 000 000      → "1M"
//   3 400 000      → "3.4M"
//   1 000 000 000  → "1B"
export function formatCount(n) {
  const num = Number(n) || 0
  if (num < 1000) return String(num)

  const units = [
    { value: 1e9, symbol: 'B' },
    { value: 1e6, symbol: 'M' },
    { value: 1e3, symbol: 'k' },
  ]
  const unit = units.find(u => num >= u.value)
  const scaled = num / unit.value

  // Un decimal solo cuando el valor escalado es < 10 (1.2k, pero 12k).
  const formatted = scaled < 10
    ? (Math.floor(scaled * 10) / 10).toFixed(1).replace(/\.0$/, '')
    : String(Math.floor(scaled))

  return `${formatted}${unit.symbol}`
}
