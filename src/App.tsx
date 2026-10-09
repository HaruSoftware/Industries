import { useEffect, useRef, useState } from 'react'
import './App.css'

const SAVE_STORAGE_KEY = 'porca-works-save'
const SAVE_VERSION = 1
const MAX_SAVED_EFFECTS = 100
const MIN_PRICE_CENTS = 1
const MAX_PRICE_CENTS = 10_000
const REFERENCE_PRICE_CENTS = 10
const REFERENCE_DEMAND_PER_MINUTE = 60
const REFERENCE_DEMAND_PERCENT = 100
const LOW_PRICE_DEMAND_PERCENT = 500
const LOW_PRICE_DEMAND_CENTS = 1
const LOW_PRICE_DEMAND_ELASTICITY =
  Math.log(LOW_PRICE_DEMAND_PERCENT / REFERENCE_DEMAND_PERCENT) /
  Math.log(REFERENCE_PRICE_CENTS / LOW_PRICE_DEMAND_CENTS)
const HIGH_PRICE_DEMAND_PERCENT = 5
const HIGH_PRICE_DEMAND_CENTS = 30
const HIGH_PRICE_DEMAND_ELASTICITY =
  Math.log(REFERENCE_DEMAND_PERCENT / HIGH_PRICE_DEMAND_PERCENT) /
  Math.log(HIGH_PRICE_DEMAND_CENTS / REFERENCE_PRICE_CENTS)
const SALES_PER_MINUTE_PER_DEMAND_PERCENT =
  REFERENCE_DEMAND_PER_MINUTE / REFERENCE_DEMAND_PERCENT
const FIRST_WORKER_COST_CENTS = 10_000
const WORKER_COST_GROWTH = 1.15
const MAX_VISIBLE_PRODUCTION_ANIMATIONS = 8
const PRODUCTION_ANIMATION_DURATION_MS = 850
const PRODUCTION_ANIMATION_STAGGER_MS = 65
const FIRST_SKILL_COST_CENTS = 15_000
const FIRST_SKILL_PRODUCTION_REQUIREMENT = 1_500
const FIRST_EVENT_MIN_DELAY_MS = 45_000
const FIRST_EVENT_MAX_DELAY_MS = 90_000
const MIN_EVENT_DELAY_MS = 60_000
const MAX_EVENT_DELAY_MS = 120_000
const GAME_EVENT_DURATION_MS = 15_000
const GAME_EVENT_EFFECT_DURATIONS_MS = [30_000, 45_000, 60_000, 90_000]

type ProductionAnimation = {
  id: number
  quantities: number[]
}

type ProductionEventReward = {
  target: 'production-rate'
  operation: 'add' | 'multiply'
  amount: number
  durationMs: number
}

type GameEventReward = ProductionEventReward

type ActiveGameEffect = ProductionEventReward & {
  id: number
  source: string
  expiresAt: number
}

type GameEvent = {
  id: number
  organization: string
  message: string
  reward: GameEventReward
  createdAt: number
  expiresAt: number
}

type SkillMission = {
  name: string
  productionRequirement: number
  costCents: number
  reward: string
}

type SkillBonuses = {
  productionPercent: number
  demandPercent: number
}

type FactoryState = {
  priceCents: number
  inventory: number
  cashCents: number
  sold: number
  produced: number
  workers: number
  workerSkills: number
  demandSkills: number
  eventEffects: ActiveGameEffect[]
  productionProgress: number
  demandProgress: number
}

type GameSave = {
  version: typeof SAVE_VERSION
  savedAt: number
  factory: FactoryState
}

type LocalSaveReadResult = {
  factory: FactoryState
  error: string | null
}

const initialFactoryState: FactoryState = {
  priceCents: 10,
  inventory: 0,
  cashCents: 0,
  sold: 0,
  produced: 0,
  workers: 0,
  workerSkills: 0,
  demandSkills: 0,
  eventEffects: [],
  productionProgress: 0,
  demandProgress: 0,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  )
}

function isValidProgress(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value < 1
  )
}

function parseGameSave(text: string): FactoryState {
  const parsed: unknown = JSON.parse(text)
  if (!isRecord(parsed) || parsed.version !== SAVE_VERSION) {
    throw new Error('O arquivo não é um save compatível do Porca Works.')
  }

  const factory = parsed.factory
  if (
    !isRecord(factory) ||
    !isNonnegativeSafeInteger(factory.priceCents) ||
    factory.priceCents < MIN_PRICE_CENTS ||
    factory.priceCents > MAX_PRICE_CENTS ||
    !isNonnegativeSafeInteger(factory.inventory) ||
    !isNonnegativeSafeInteger(factory.cashCents) ||
    !isNonnegativeSafeInteger(factory.sold) ||
    !isNonnegativeSafeInteger(factory.produced) ||
    !isNonnegativeSafeInteger(factory.workers) ||
    !isNonnegativeSafeInteger(factory.workerSkills) ||
    !isNonnegativeSafeInteger(factory.demandSkills) ||
    !isValidProgress(factory.productionProgress) ||
    !isValidProgress(factory.demandProgress) ||
    !Array.isArray(factory.eventEffects) ||
    factory.eventEffects.length > MAX_SAVED_EFFECTS
  ) {
    throw new Error('O save contém dados inválidos ou incompletos.')
  }

  const eventEffects: ActiveGameEffect[] = factory.eventEffects.map(
    (effect): ActiveGameEffect => {
      if (
        !isRecord(effect) ||
        effect.target !== 'production-rate' ||
        (effect.operation !== 'add' && effect.operation !== 'multiply') ||
        typeof effect.amount !== 'number' ||
        !Number.isFinite(effect.amount) ||
        effect.amount <= 0 ||
        typeof effect.durationMs !== 'number' ||
        !Number.isFinite(effect.durationMs) ||
        effect.durationMs <= 0 ||
        !isNonnegativeSafeInteger(effect.id) ||
        typeof effect.source !== 'string' ||
        effect.source.length > 200 ||
        typeof effect.expiresAt !== 'number' ||
        !Number.isFinite(effect.expiresAt)
      ) {
        throw new Error('O save contém um bônus ativo inválido.')
      }

      return {
        target: 'production-rate',
        operation: effect.operation,
        amount: effect.amount,
        durationMs: effect.durationMs,
        id: effect.id,
        source: effect.source,
        expiresAt: effect.expiresAt,
      }
    },
  )

  return {
    priceCents: factory.priceCents,
    inventory: factory.inventory,
    cashCents: factory.cashCents,
    sold: factory.sold,
    produced: factory.produced,
    workers: factory.workers,
    workerSkills: factory.workerSkills,
    demandSkills: factory.demandSkills,
    eventEffects: eventEffects.filter(
      (effect) => effect.expiresAt > Date.now(),
    ),
    productionProgress: factory.productionProgress,
    demandProgress: factory.demandProgress,
  }
}

function createGameSaveJson(factory: FactoryState) {
  const save: GameSave = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    factory,
  }
  return JSON.stringify(save, null, 2)
}

function readLocalSave(): LocalSaveReadResult {
  try {
    const savedText = window.localStorage.getItem(SAVE_STORAGE_KEY)
    if (!savedText) return { factory: initialFactoryState, error: null }
    return { factory: parseGameSave(savedText), error: null }
  } catch (error) {
    console.error('Não foi possível carregar o save local.', error)
    return {
      factory: initialFactoryState,
      error:
        error instanceof Error
          ? `Falha ao carregar save local: ${error.message}`
          : 'Falha ao carregar save local.',
    }
  }
}

const EVENT_ORGANIZATIONS = [
  'Metalúrgica Aurora',
  'Grupo Parafuso Forte',
  'Indústrias Horizonte',
  'Oficina Vale do Aço',
  'Companhia Ponto Firme',
]

const EVENT_PRODUCTION_REWARDS = [0.25, 0.5, 0.75, 1, 1.5, 2.5]
const EVENT_PRODUCTION_MULTIPLIERS = [1.25, 1.5, 2]

function getRandomEventDelay(
  minimum = MIN_EVENT_DELAY_MS,
  maximum = MAX_EVENT_DELAY_MS,
) {
  return minimum + Math.random() * (maximum - minimum)
}

function createRandomGameEvent(now: number): GameEvent {
  const organization =
    EVENT_ORGANIZATIONS[
      Math.floor(Math.random() * EVENT_ORGANIZATIONS.length)
    ]
  const durationMs =
    GAME_EVENT_EFFECT_DURATIONS_MS[
      Math.floor(Math.random() * GAME_EVENT_EFFECT_DURATIONS_MS.length)
    ]
  const reward: GameEventReward =
    Math.random() < 0.5
      ? {
          target: 'production-rate',
          operation: 'add',
          amount:
            EVENT_PRODUCTION_REWARDS[
              Math.floor(Math.random() * EVENT_PRODUCTION_REWARDS.length)
            ],
          durationMs,
        }
      : {
          target: 'production-rate',
          operation: 'multiply',
          amount:
            EVENT_PRODUCTION_MULTIPLIERS[
              Math.floor(Math.random() * EVENT_PRODUCTION_MULTIPLIERS.length)
            ],
          durationMs,
        }

  return {
    id: now,
    organization,
    message: `${organization} ficou impressionada com o ritmo da sua fábrica e quer reconhecer sua produção.`,
    reward,
    createdAt: now,
    expiresAt: now + GAME_EVENT_DURATION_MS,
  }
}

function formatEventReward(reward: GameEventReward) {
  if (reward.operation === 'multiply') {
    return `×${formatNumber(reward.amount)} produção`
  }
  return `+${formatNumber(reward.amount)} porcas/s`
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${seconds}s`
}

function getProductionRate(
  workers: number,
  productionPercent: number,
  effects: ActiveGameEffect[],
  now: number,
) {
  const activeEffects = effects.filter((effect) => effect.expiresAt > now)
  const additionalProduction = activeEffects
    .filter((effect) => effect.operation === 'add')
    .reduce((total, effect) => total + effect.amount, 0)
  const productionMultiplier = activeEffects
    .filter((effect) => effect.operation === 'multiply')
    .reduce((total, effect) => total * effect.amount, 1)

  return (
    (workers * (1 + productionPercent / 100) + additionalProduction) *
    productionMultiplier
  )
}

function formatPriceInput(priceCents: number) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceCents / 100)
}

function getPriceDemandPercent(priceCents: number) {
  return priceCents <= REFERENCE_PRICE_CENTS
    ? REFERENCE_DEMAND_PERCENT *
        (REFERENCE_PRICE_CENTS / priceCents) **
          LOW_PRICE_DEMAND_ELASTICITY
    : REFERENCE_DEMAND_PERCENT *
        (REFERENCE_PRICE_CENTS / priceCents) **
          HIGH_PRICE_DEMAND_ELASTICITY
}

function getDemandPercent(priceCents: number, bonusDemandPercent = 0) {
  return Math.max(0, getPriceDemandPercent(priceCents) + bonusDemandPercent)
}

function getSalesPerMinute(demandPercent: number) {
  return demandPercent * SALES_PER_MINUTE_PER_DEMAND_PERCENT
}

function getWorkerCostCents(workers: number) {
  return Math.round(FIRST_WORKER_COST_CENTS * WORKER_COST_GROWTH ** workers)
}

function getMissionProductionRequirement(number: number) {
  return Math.min(
    Number.MAX_SAFE_INTEGER,
    FIRST_SKILL_PRODUCTION_REQUIREMENT * number,
  )
}

function getMissionCostCents(number: number, multiplier = 1) {
  return Math.min(
    Number.MAX_SAFE_INTEGER,
    FIRST_SKILL_COST_CENTS * multiplier * number ** 2,
  )
}

function getWorkerMission(number: number): SkillMission {
  const names = [
    'Trabalhador Eficiente',
    'Trabalhador Graduado',
    'Masterpiece em Produção',
    'Especialista de Precisão',
    'Mestre de Turno',
    'Engenheiro de Bancada',
  ]
  const bonusPercent = Math.min(100_000_000, 15 + (number - 1) * 5)
  return {
    name: `${names[(number - 1) % names.length]} · Missão ${formatNumber(number)}`,
    productionRequirement: getMissionProductionRequirement(number),
    costCents: getMissionCostCents(number),
    reward: `+${bonusPercent}% de produção por trabalhador`,
  }
}

function getDemandMission(number: number): SkillMission {
  const names = [
    'Acordo com Distribuidores',
    'Feira de Fornecedores',
    'Rede de Oficinas',
    'Catálogo Industrial',
    'Parceria Regional',
    'Mercado em Expansão',
  ]
  const bonusDemandPercent = number * 50
  return {
    name: `${names[(number - 1) % names.length]} · Missão ${formatNumber(number)}`,
    productionRequirement: getMissionProductionRequirement(number),
    costCents: getMissionCostCents(number, 2),
    reward: `+${formatPercent(bonusDemandPercent)} de demanda, mesmo preço`,
  }
}

function getSkillBonuses(workerSkills: number, demandSkills: number): SkillBonuses {
  return {
    productionPercent: Math.min(
      100_000_000,
      workerSkills * 15 + (5 * workerSkills * (workerSkills - 1)) / 2,
    ),
    demandPercent: demandSkills * 50,
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(value)}%`
}

function formatRate(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(value)
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount)
}

function App() {
  const [initialSave] = useState(readLocalSave)
  const [factory, setFactory] = useState(initialSave.factory)
  const [priceInput, setPriceInput] = useState(() =>
    formatPriceInput(initialSave.factory.priceCents),
  )
  const [productionAnimations, setProductionAnimations] = useState<
    ProductionAnimation[]
  >([])
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [saveText, setSaveText] = useState('')
  const [isSaveTextEdited, setIsSaveTextEdited] = useState(false)
  const [saveMessage, setSaveMessage] = useState(
    initialSave.error ?? 'O progresso é salvo automaticamente neste navegador.',
  )
  const [gameEvent, setGameEvent] = useState<GameEvent | null>(null)
  const [nextEventAt, setNextEventAt] = useState(
    () =>
      Date.now() +
      getRandomEventDelay(FIRST_EVENT_MIN_DELAY_MS, FIRST_EVENT_MAX_DELAY_MS),
  )
  const [eventClock, setEventClock] = useState(Date.now())
  const nextAnimationId = useRef(0)
  const animationTimeouts = useRef(new Set<number>())
  const lastAnimatedProduction = useRef(factory.produced)
  const saveFileInput = useRef<HTMLInputElement>(null)
  const skillBonuses = getSkillBonuses(
    factory.workerSkills,
    factory.demandSkills,
  )
  const productionPerSecond = getProductionRate(
    factory.workers,
    skillBonuses.productionPercent,
    factory.eventEffects,
    eventClock,
  )
  const nextWorkerMission = getWorkerMission(factory.workerSkills + 1)
  const nextDemandMission = getDemandMission(factory.demandSkills + 1)
  const priceDemandPercent = getPriceDemandPercent(factory.priceCents)
  const demandPercent = getDemandPercent(
    factory.priceCents,
    skillBonuses.demandPercent,
  )
  const salesPerMinute = getSalesPerMinute(demandPercent)
  const demandMeterPercentage =
    (demandPercent / (demandPercent + REFERENCE_DEMAND_PERCENT)) * 100
  const gameEventTimeRemaining = gameEvent
    ? Math.max(
        0,
        Math.min(
          100,
          ((gameEvent.expiresAt - eventClock) /
            (gameEvent.expiresAt - gameEvent.createdAt)) *
            100,
        ),
      )
    : 0
  const workerMissionProgress = Math.min(
    100,
    (factory.produced / nextWorkerMission.productionRequirement) * 100,
  )
  const demandMissionProgress = Math.min(
    100,
    (factory.produced / nextDemandMission.productionRequirement) * 100,
  )
  const canUnlockWorkerMission =
    factory.produced >= nextWorkerMission.productionRequirement &&
    factory.cashCents >= nextWorkerMission.costCents
  const canUnlockDemandMission =
    factory.produced >= nextDemandMission.productionRequirement &&
    factory.cashCents >= nextDemandMission.costCents

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SAVE_STORAGE_KEY,
        createGameSaveJson(factory),
      )
      setSaveMessage('Progresso salvo automaticamente neste navegador.')
    } catch (error) {
      console.error('Não foi possível salvar o progresso local.', error)
      setSaveMessage(
        'Falha ao salvar neste navegador. Exporte o save para não perder o progresso.',
      )
    }
  }, [factory])

  useEffect(() => {
    if (isSaveDialogOpen && !isSaveTextEdited) {
      setSaveText(createGameSaveJson(factory))
    }
  }, [factory, isSaveDialogOpen, isSaveTextEdited])

  function addProductionAnimations(quantity: number) {
    if (quantity <= 0) return

    const animationCount = Math.min(
      quantity,
      MAX_VISIBLE_PRODUCTION_ANIMATIONS,
    )
    const quantityPerAnimation = Math.floor(quantity / animationCount)
    const remainder = quantity % animationCount
    const animation: ProductionAnimation = {
      id: ++nextAnimationId.current,
      quantities: Array.from(
        { length: animationCount },
        (_, index) => quantityPerAnimation + (index < remainder ? 1 : 0),
      ),
    }
    setProductionAnimations((currentAnimations) => [
      ...currentAnimations,
      animation,
    ])

    const animationLifetime =
      PRODUCTION_ANIMATION_DURATION_MS +
      animationCount * PRODUCTION_ANIMATION_STAGGER_MS
    const timeoutId = window.setTimeout(() => {
      setProductionAnimations((currentAnimations) =>
        currentAnimations.filter(({ id }) => id !== animation.id),
      )
      animationTimeouts.current.delete(timeoutId)
    }, animationLifetime)
    animationTimeouts.current.add(timeoutId)
  }

  useEffect(() => {
    const producedSinceLastRender =
      factory.produced - lastAnimatedProduction.current
    lastAnimatedProduction.current = factory.produced
    addProductionAnimations(producedSinceLastRender)
  }, [factory.produced])

  useEffect(
    () => () => {
      animationTimeouts.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      )
    },
    [],
  )

  useEffect(() => {
    const timerId = window.setInterval(() => {
      const now = Date.now()
      setEventClock(now)

      if (gameEvent && now >= gameEvent.expiresAt) {
        setGameEvent(null)
        setNextEventAt(now + getRandomEventDelay())
      } else if (!gameEvent && now >= nextEventAt) {
        setGameEvent(createRandomGameEvent(now))
      }
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [gameEvent, nextEventAt])

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setFactory((currentFactory) => {
        const bonuses = getSkillBonuses(
          currentFactory.workerSkills,
          currentFactory.demandSkills,
        )
        const now = Date.now()
        const activeEffects = currentFactory.eventEffects.filter(
          (effect) => effect.expiresAt > now,
        )
        const productionThisSecond =
          currentFactory.productionProgress +
          getProductionRate(
            currentFactory.workers,
            bonuses.productionPercent,
            activeEffects,
            now,
          )
        const producedThisSecond = Math.floor(productionThisSecond)
        const inventoryAfterProduction =
          currentFactory.inventory + producedThisSecond
        const producedAfterTick = currentFactory.produced + producedThisSecond
        const productionProgress = productionThisSecond - producedThisSecond
        const demandPercent = getDemandPercent(
          currentFactory.priceCents,
          bonuses.demandPercent,
        )
        const salesPerMinute = getSalesPerMinute(demandPercent)
        if (inventoryAfterProduction === 0 || salesPerMinute === 0) {
          return {
            ...currentFactory,
            inventory: inventoryAfterProduction,
            produced: producedAfterTick,
            eventEffects: activeEffects,
            productionProgress,
            demandProgress: 0,
          }
        }

        const accumulatedDemand =
          currentFactory.demandProgress + salesPerMinute / 60
        const orders = Math.floor(accumulatedDemand)
        if (orders === 0) {
          return {
            ...currentFactory,
            inventory: inventoryAfterProduction,
            produced: producedAfterTick,
            eventEffects: activeEffects,
            productionProgress,
            demandProgress: accumulatedDemand,
          }
        }

        const soldNow = Math.min(inventoryAfterProduction, orders)
        return {
          ...currentFactory,
          inventory: inventoryAfterProduction - soldNow,
          cashCents:
            currentFactory.cashCents + soldNow * currentFactory.priceCents,
          sold: currentFactory.sold + soldNow,
          produced: producedAfterTick,
          eventEffects: activeEffects,
          productionProgress,
          demandProgress:
            soldNow === inventoryAfterProduction
              ? 0
              : accumulatedDemand - orders,
        }
      })

    }, 1000)

    return () => window.clearInterval(timerId)
  }, [
    factory.workers,
    skillBonuses.demandPercent,
    skillBonuses.productionPercent,
  ])

  function produceNut() {
    setFactory((currentFactory) => ({
      ...currentFactory,
      inventory: currentFactory.inventory + 1,
      produced: currentFactory.produced + 1,
    }))

    addProductionAnimations(1)
  }

  function hireWorker() {
    setFactory((currentFactory) => {
      const costCents = getWorkerCostCents(currentFactory.workers)
      if (currentFactory.cashCents < costCents) return currentFactory

      return {
        ...currentFactory,
        cashCents: currentFactory.cashCents - costCents,
        workers: currentFactory.workers + 1,
      }
    })
  }

  function unlockSkillMission(track: 'worker' | 'demand') {
    setFactory((currentFactory) => {
      const mission =
        track === 'worker'
          ? getWorkerMission(currentFactory.workerSkills + 1)
          : getDemandMission(currentFactory.demandSkills + 1)
      if (
        currentFactory.produced < mission.productionRequirement ||
        currentFactory.cashCents < mission.costCents
      ) {
        return currentFactory
      }

      return {
        ...currentFactory,
        cashCents: currentFactory.cashCents - mission.costCents,
        workerSkills:
          currentFactory.workerSkills + (track === 'worker' ? 1 : 0),
        demandSkills:
          currentFactory.demandSkills + (track === 'demand' ? 1 : 0),
      }
    })
  }

  function claimGameEvent() {
    if (!gameEvent || Date.now() >= gameEvent.expiresAt) return

    const now = Date.now()
    const effect: ActiveGameEffect = {
      ...gameEvent.reward,
      id: gameEvent.id,
      source: gameEvent.organization,
      expiresAt: now + gameEvent.reward.durationMs,
    }
    setFactory((currentFactory) => ({
      ...currentFactory,
      eventEffects: [...currentFactory.eventEffects, effect],
    }))

    setEventClock(now)
    setGameEvent(null)
    setNextEventAt(now + getRandomEventDelay())
  }

  function changePrice(priceCents: number) {
    setFactory((currentFactory) => ({ ...currentFactory, priceCents }))
    setPriceInput(formatPriceInput(priceCents))
  }

  function handlePriceInputChange(value: string) {
    setPriceInput(value)
    const parsedPrice = Number(value.replace(',', '.'))
    if (!Number.isFinite(parsedPrice)) return

    const priceCents = Math.round(parsedPrice * 100)
    if (
      priceCents < MIN_PRICE_CENTS ||
      priceCents > MAX_PRICE_CENTS
    ) {
      return
    }
    setFactory((currentFactory) => ({ ...currentFactory, priceCents }))
  }

  function commitPriceInput() {
    const parsedPrice = Number(priceInput.replace(',', '.'))
    if (!Number.isFinite(parsedPrice)) {
      setPriceInput(formatPriceInput(factory.priceCents))
      return
    }

    const priceCents = Math.min(
      MAX_PRICE_CENTS,
      Math.max(MIN_PRICE_CENTS, Math.round(parsedPrice * 100)),
    )
    changePrice(priceCents)
  }

  function openSaveDialog() {
    setSaveText(createGameSaveJson(factory))
    setIsSaveTextEdited(false)
    setIsSaveDialogOpen(true)
  }

  function loadSaveText(text = saveText) {
    try {
      const importedFactory = parseGameSave(text)
      setFactory(importedFactory)
      setIsSaveTextEdited(false)
      setPriceInput(formatPriceInput(importedFactory.priceCents))
      setProductionAnimations([])
      lastAnimatedProduction.current = importedFactory.produced
      setEventClock(Date.now())
      setGameEvent(null)
      setNextEventAt(
        Date.now() +
          getRandomEventDelay(
            FIRST_EVENT_MIN_DELAY_MS,
            FIRST_EVENT_MAX_DELAY_MS,
          ),
      )
      setSaveMessage('Save carregado com sucesso.')
    } catch (error) {
      console.error('Não foi possível carregar o save informado.', error)
      setSaveMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar o save informado.',
      )
    }
  }

  async function copySaveText() {
    try {
      await navigator.clipboard.writeText(saveText)
      setSaveMessage('Save copiado para a área de transferência.')
    } catch (error) {
      console.error('Não foi possível copiar o save.', error)
      setSaveMessage(
        'Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.',
      )
    }
  }

  function downloadSave() {
    try {
      const file = new Blob([saveText], { type: 'application/json' })
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = 'porca-works-save.json'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setSaveMessage('Arquivo JSON exportado.')
    } catch (error) {
      console.error('Não foi possível exportar o save.', error)
      setSaveMessage('Não foi possível exportar o arquivo JSON.')
    }
  }

  async function readSaveFile(file: File | undefined) {
    if (!file) return

    try {
      const text = await file.text()
      setSaveText(text)
      loadSaveText(text)
    } catch (error) {
      console.error('Não foi possível ler o arquivo de save.', error)
      setSaveMessage('Não foi possível ler o arquivo selecionado.')
    }
  }

  return (
    <main className="factory-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Porca Works, início">
          <span className="brand-mark" aria-hidden="true">
            PW
          </span>
          <span>PORCA WORKS</span>
        </a>
        <span className="topbar-note">
          <span className="status-light" />
          FÁBRICA EM OPERAÇÃO
        </span>
        <button
          className="save-open-button"
          type="button"
          onClick={openSaveDialog}
        >
          Salvar / carregar
        </button>
      </header>

      <section className="factory-content" aria-labelledby="factory-title">
        <div className="intro">
          <p className="eyebrow">SIMULADOR DE INDÚSTRIA · 01          </p>
          <h1 id="factory-title">
            Sua fábrica. Suas regras.
          </h1>
          <p className="description">
            Produza, venda e amplie sua fábrica.
          </p>
        </div>

        <section className="stats" aria-label="Resumo da fábrica">
          <article className="stat-card">
            <span className="stat-label">CAIXA</span>
            <strong className="stat-value">
              {formatCurrency(factory.cashCents / 100)}
            </strong>
          </article>
        </section>

        <section
          className="panel assembly-panel production-line"
          aria-labelledby="line-title"
        >
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">LINHA DE MONTAGEM 01</p>
              <h2 id="line-title">Porcas</h2>
            </div>
            <span className="manual-tag">
              {factory.workers > 0 ? 'AUTOMÁTICA' : 'MANUAL'}
            </span>
          </div>

          <div className="line-layout">
            <section
              className="line-production"
              aria-labelledby="production-title"
            >
              <div className="line-section-heading">
                <h3 id="production-title">Produção</h3>
                <span className="production-rate">1 porca por clique</span>
              </div>

              <div
                className="assembly-floor"
                role="img"
                aria-label="Prensa industrial e esteira de montagem"
              >
                <div className="conveyor">
                  <span className="conveyor-roller" />
                  <span className="conveyor-roller" />
                  <span className="conveyor-roller" />
                  <span className="conveyor-roller" />
                  <span className="conveyor-roller" />
                </div>
                <div
                  key={factory.produced}
                  className={`press${factory.produced > 0 ? ' is-pressing' : ''}`}
                >
                  <div className="press-cap" />
                  <div className="press-column" />
                  <div className="press-head" />
                  <div className="press-foot" />
                </div>
                {productionAnimations.flatMap(({ id, quantities }) =>
                  quantities.map((quantity, index) => (
                    <div
                      key={`${id}-${index}`}
                      className="nut-part"
                      style={{
                        animationDelay: `${index * PRODUCTION_ANIMATION_STAGGER_MS}ms`,
                      }}
                      aria-hidden="true"
                    >
                      <span />
                      {quantity > 1 && (
                        <small className="nut-quantity">
                          ×{formatNumber(quantity)}
                        </small>
                      )}
                    </div>
                  )),
                )}
                <div className="floor-shadow" />
              </div>

              <div className="production-row">
                <div>
                  <span className="production-count">{factory.produced}</span>
                  <span className="production-caption">produzidas</span>
                  <span className="production-per-second">
                    {new Intl.NumberFormat('pt-BR', {
                      maximumFractionDigits: 2,
                    }).format(productionPerSecond)}{' '}
                    porcas/s
                  </span>
                </div>
                <button
                  className="produce-button"
                  onClick={produceNut}
                  type="button"
                >
                  <span aria-hidden="true">+</span>
                  Produzir porca
                </button>
              </div>

            </section>

            <section className="line-section" aria-labelledby="market-title">
              <h3 className="visually-hidden" id="market-title">
                Venda
              </h3>

              <div className="line-inventory" aria-label="Estoque desta linha">
                <div className="line-inventory-stat">
                  <span>Estoque</span>
                  <strong>{factory.inventory}</strong>
                </div>
                <div className="line-inventory-stat">
                  <span>Vendidas</span>
                  <strong>{factory.sold}</strong>
                </div>
              </div>

              <div className="market-tools">
                <div className="worker-hiring">
                  <button
                    className="hire-worker-button"
                    onClick={hireWorker}
                    type="button"
                    disabled={
                      factory.cashCents < getWorkerCostCents(factory.workers)
                    }
                    aria-label={`Contratar trabalhador por ${formatCurrency(getWorkerCostCents(factory.workers) / 100)}`}
                  >
                    <span className="worker-summary-icon" aria-hidden="true">
                      👷
                    </span>
                    <span className="hire-worker-copy">
                      <strong>{factory.workers}</strong>
                    </span>
                    <span className="hire-worker-price">
                      {formatCurrency(
                        getWorkerCostCents(factory.workers) / 100,
                      )}
                    </span>
                  </button>
                </div>

                <div className="price-setting">
                  <label
                    className="price-label"
                    htmlFor="price-input"
                    title="Preço por porca"
                  >
                    Preço
                  </label>
                  <div className="price-control">
                    <span className="currency-prefix">R$</span>
                    <input
                      id="price-input"
                      className="price-input"
                      type="text"
                      inputMode="decimal"
                      value={priceInput}
                      onChange={(event) =>
                        handlePriceInputChange(event.target.value)
                      }
                      onBlur={commitPriceInput}
                      aria-label="Preço por porca em reais"
                    />
                    <button
                      className="price-step-button"
                      type="button"
                      onClick={() =>
                        changePrice(
                          Math.max(
                            MIN_PRICE_CENTS,
                            factory.priceCents - 1,
                          ),
                        )
                      }
                      disabled={factory.priceCents <= MIN_PRICE_CENTS}
                      aria-label="Diminuir preço em um centavo"
                    >
                      ‹
                    </button>
                    <button
                      className="price-step-button"
                      type="button"
                      onClick={() =>
                        changePrice(
                          Math.min(
                            MAX_PRICE_CENTS,
                            factory.priceCents + 1,
                          ),
                        )
                      }
                      disabled={factory.priceCents >= MAX_PRICE_CENTS}
                      aria-label="Aumentar preço em um centavo"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>

              <div className="demand-box" aria-live="polite">
                <div className="demand-copy">
                  <span className="demand-label">Demanda</span>
                  <strong>{formatPercent(demandPercent)}</strong>
                </div>
                <span className="demand-breakdown">
                  {formatPercent(priceDemandPercent)} pelo preço +{' '}
                  {formatPercent(skillBonuses.demandPercent)} de bônus
                </span>
                <span className="demand-sales-rate">
                  {formatRate(salesPerMinute)} porcas / min
                </span>
                <div
                  className="demand-meter"
                  aria-hidden="true"
                >
                  <span style={{ width: `${demandMeterPercentage}%` }} />
                </div>
              </div>
            </section>
          </div>

        </section>

        <section className="mission-tracks" aria-label="Missões da linha">
          <article className="skill-mission" aria-labelledby="worker-mission-title">
            <div className="skill-mission-info">
              <p className="panel-kicker">
                TRABALHADORES · MISSÃO {formatNumber(factory.workerSkills + 1)}
              </p>
              <h2 id="worker-mission-title">{nextWorkerMission.name}</h2>
              <span className="skill-reward">{nextWorkerMission.reward}</span>
            </div>
            <div className="skill-progress">
              <div
                className="skill-progress-track"
                role="progressbar"
                aria-label={`Progresso para ${nextWorkerMission.name}`}
                aria-valuemin={0}
                aria-valuemax={nextWorkerMission.productionRequirement}
                aria-valuenow={Math.min(
                  factory.produced,
                  nextWorkerMission.productionRequirement,
                )}
              >
                <span style={{ width: `${workerMissionProgress}%` }} />
              </div>
              <span>
                {formatNumber(
                  Math.min(
                    factory.produced,
                    nextWorkerMission.productionRequirement,
                  ),
                )}{' '}
                / {formatNumber(nextWorkerMission.productionRequirement)} porcas
              </span>
            </div>
            <div className="skill-unlock">
              <span className="skill-cost">
                {formatCurrency(nextWorkerMission.costCents / 100)}
              </span>
              <button
                className="skill-unlock-button"
                type="button"
                onClick={() => unlockSkillMission('worker')}
                disabled={!canUnlockWorkerMission}
              >
                Desbloquear
              </button>
              {factory.produced >= nextWorkerMission.productionRequirement &&
                factory.cashCents < nextWorkerMission.costCents && (
                  <span className="skill-status">Caixa insuficiente</span>
                )}
            </div>
          </article>

          <article className="skill-mission" aria-labelledby="demand-mission-title">
            <div className="skill-mission-info">
              <p className="panel-kicker">
                DEMANDA · MISSÃO {formatNumber(factory.demandSkills + 1)}
              </p>
              <h2 id="demand-mission-title">{nextDemandMission.name}</h2>
              <span className="skill-reward">{nextDemandMission.reward}</span>
            </div>
            <div className="skill-progress">
              <div
                className="skill-progress-track"
                role="progressbar"
                aria-label={`Progresso para ${nextDemandMission.name}`}
                aria-valuemin={0}
                aria-valuemax={nextDemandMission.productionRequirement}
                aria-valuenow={Math.min(
                  factory.produced,
                  nextDemandMission.productionRequirement,
                )}
              >
                <span style={{ width: `${demandMissionProgress}%` }} />
              </div>
              <span>
                {formatNumber(
                  Math.min(
                    factory.produced,
                    nextDemandMission.productionRequirement,
                  ),
                )}{' '}
                / {formatNumber(nextDemandMission.productionRequirement)} porcas
              </span>
            </div>
            <div className="skill-unlock">
              <span className="skill-cost">
                {formatCurrency(nextDemandMission.costCents / 100)}
              </span>
              <button
                className="skill-unlock-button"
                type="button"
                onClick={() => unlockSkillMission('demand')}
                disabled={!canUnlockDemandMission}
              >
                Desbloquear
              </button>
              {factory.produced >= nextDemandMission.productionRequirement &&
                factory.cashCents < nextDemandMission.costCents && (
                  <span className="skill-status">Caixa insuficiente</span>
                )}
            </div>
          </article>
        </section>
      </section>

      <footer className="page-footer">
        <span>PORCA WORKS</span>
        <span>PRODUZA · PRECIFIQUE · VENDA</span>
      </footer>

      {factory.eventEffects.some((effect) => effect.expiresAt > eventClock) && (
        <section className="active-effects-list" aria-label="Habilidades ativas">
          {factory.eventEffects
            .filter((effect) => effect.expiresAt > eventClock)
            .map((effect) => {
              const effectTimeRemaining = Math.max(
                0,
                Math.min(
                  100,
                  ((effect.expiresAt - eventClock) / effect.durationMs) * 100,
                ),
              )

              return (
                <article
                  className="active-effect-card"
                  key={effect.id}
                  aria-label={`Bônus ativo: ${formatEventReward(effect)} de ${effect.source}`}
                >
                  <span className="active-effect-icon" aria-hidden="true">
                    ✦
                  </span>
                  <span className="active-effect-info">
                    <span className="active-effect-heading">
                      <strong>{formatEventReward(effect)}</strong>
                      <time>{formatDuration(effect.expiresAt - eventClock)}</time>
                    </span>
                    <small>{effect.source}</small>
                    <span
                      className="active-effect-duration"
                      role="progressbar"
                      aria-label="Duração restante do bônus"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.ceil(effectTimeRemaining)}
                    >
                      <span style={{ width: `${effectTimeRemaining}%` }} />
                    </span>
                  </span>
                </article>
              )
            })}
        </section>
      )}

      {gameEvent && (
        <div className="event-toast-stack">
          <div
            className="game-event-toast"
            role="status"
            aria-label={`Novo evento de ${gameEvent.organization}`}
          >
            <button
              className="event-toast-card game-event"
              type="button"
              onClick={claimGameEvent}
              aria-label={`Aceitar evento de ${gameEvent.organization}: ${formatEventReward(gameEvent.reward)} por ${gameEvent.reward.durationMs / 1000} segundos`}
            >
              <span className="event-toast-copy">
                <strong>{gameEvent.organization} está impressionada</strong>
                <span>{gameEvent.message}</span>
                <small>
                  Clique para aceitar · bônus válido por{' '}
                  {gameEvent.reward.durationMs / 1000}s
                </small>
              </span>
              <span className="event-toast-reward">
                <span className="event-reward-symbol" aria-hidden="true">
                  {gameEvent.reward.operation === 'multiply' ? '×' : '+'}
                </span>
                <span>
                  <small>RECOMPENSA</small>
                  <strong>{formatEventReward(gameEvent.reward)}</strong>
                </span>
              </span>
              <span
                className="event-toast-deadline"
                role="progressbar"
                aria-label="Tempo restante para aceitar o evento"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.ceil(gameEventTimeRemaining)}
              >
                <span style={{ width: `${gameEventTimeRemaining}%` }} />
              </span>
            </button>
          </div>
        </div>
      )}

      {isSaveDialogOpen && (
        <div
          className="save-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsSaveDialogOpen(false)
            }
          }}
        >
          <section
            className="save-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-dialog-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsSaveDialogOpen(false)
            }}
          >
            <div className="save-dialog-heading">
              <div>
                <p className="panel-kicker">SEU PROGRESSO</p>
                <h2 id="save-dialog-title">Salvar ou carregar jogo</h2>
              </div>
              <button
                className="save-dialog-close"
                type="button"
                onClick={() => setIsSaveDialogOpen(false)}
                aria-label="Fechar janela de save"
              >
                ×
              </button>
            </div>
            <p className="save-dialog-description">
              O jogo salva automaticamente neste navegador. Copie o texto ou
              exporte o JSON para levar seu progresso a outro dispositivo.
            </p>
            <label className="save-text-label" htmlFor="save-text">
              Save em texto (JSON)
            </label>
            <textarea
              id="save-text"
              className="save-textarea"
              value={saveText}
              onChange={(event) => {
                setSaveText(event.target.value)
                setIsSaveTextEdited(true)
              }}
              autoFocus
              spellCheck={false}
              rows={12}
            />
            <div className="save-dialog-actions">
              <button
                className="save-action-button save-action-primary"
                type="button"
                onClick={() => void copySaveText()}
              >
                Copiar texto
              </button>
              <button
                className="save-action-button"
                type="button"
                onClick={downloadSave}
              >
                Exportar JSON
              </button>
              <button
                className="save-action-button"
                type="button"
                onClick={() => loadSaveText()}
              >
                Carregar texto
              </button>
              <button
                className="save-action-button"
                type="button"
                onClick={() => saveFileInput.current?.click()}
              >
                Abrir arquivo
              </button>
              <input
                ref={saveFileInput}
                className="save-file-input"
                type="file"
                accept="application/json,.json"
                aria-label="Selecionar arquivo de save JSON"
                onChange={(event) => {
                  void readSaveFile(event.currentTarget.files?.[0])
                  event.currentTarget.value = ''
                }}
              />
            </div>
            <p className="save-dialog-status" role="status">
              {saveMessage}
            </p>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
