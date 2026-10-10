const BIG_NUMBER_SUFFIXES = [
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
  'Ud',
  'Dd',
  'Td',
  'Qad',
  'Qid',
  'Sxd',
  'Spd',
  'Ocd',
  'Nod',
  'Vg',
]

function formatCompactNumber(value: number) {
  const absoluteValue = Math.abs(value)
  if (absoluteValue < 1_000) {
    return new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 1,
    }).format(value)
  }

  let scale = Math.floor(Math.log10(absoluteValue) / 3)
  let scaledValue = value / 1_000 ** scale
  if (Math.abs(scaledValue) >= 1_000) {
    scale += 1
    scaledValue = value / 1_000 ** scale
  }

  const suffix = BIG_NUMBER_SUFFIXES[scale - 1] ?? `e${scale * 3}`
  const truncatedValue =
    Math.trunc(Math.abs(scaledValue) * 10) * Math.sign(scaledValue) / 10
  const formattedValue = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(truncatedValue)
  return `${formattedValue}${suffix}`
}

export function formatNumber(value: number) {
  return formatCompactNumber(value)
}

export function formatPercent(value: number) {
  return `${formatCompactNumber(value)}%`
}

export function formatRate(value: number) {
  return formatCompactNumber(value)
}

export function formatCurrency(amount: number) {
  if (Math.abs(amount) >= 1_000) {
    return `R$ ${formatCompactNumber(amount)}`
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount)
}
