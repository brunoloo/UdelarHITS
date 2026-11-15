// De 1000 en adelante se abrevia con un decimal como máximo; se trunca para no inflar la cifra.
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
