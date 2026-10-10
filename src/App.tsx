import { useEffect, useRef, useState } from 'react'
import { MissionDrawer } from './components/MissionDrawer'
import { SaveDialog } from './components/SaveDialog'
import {
  getDemandMission,
  getFactoryMissionInvestmentCents,
  getOperationsBonuses,
  getOperationsMission,
  getSkillBonuses,
  getWorkerMission,
} from './game/missions'
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRate,
} from './game/format'
import {
  createGameSaveJson,
  parseGameSave,
  persistLocalSave,
  readLocalSave,
} from './game/save'
import {
  MAX_PRICE_CENTS,
  MIN_PRICE_CENTS,
} from './game/types'
import type {
  ActiveGameEffect,
  FactoryState,
  GameEvent,
  GameEventReward,
} from './game/types'
import './App.css'

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
const FIRST_EVENT_MIN_DELAY_MS = 45_000
const FIRST_EVENT_MAX_DELAY_MS = 90_000
const MIN_EVENT_DELAY_MS = 60_000
const MAX_EVENT_DELAY_MS = 120_000
const GAME_EVENT_DURATION_MS = 15_000
const GAME_EVENT_EFFECT_DURATIONS_MS = [30_000, 45_000, 60_000, 90_000]
const CASH_EVENT_MIN_REWARD_CENTS = 5_000
const BASE_EVENT_DEMAND_BONUS_PERCENT = 50

type ProductionAnimation = {
  id: number
  quantities: number[]
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

function getCappedMoneyAmount(value: number) {
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(value)))
}

function getMissionInvestmentCents(
  level: number,
  track: 'worker' | 'demand' | 'operations',
) {
  return getFactoryMissionInvestmentCents(level, track)
}

function getWorkerInvestmentCents(workers: number) {
  if (workers <= 0) return 0
  const total =
    (FIRST_WORKER_COST_CENTS *
      (WORKER_COST_GROWTH ** workers - 1)) /
    (WORKER_COST_GROWTH - 1)
  return getCappedMoneyAmount(total)
}

function getFactoryNetWorthCents(factory: FactoryState) {
  const inventoryValue = getCappedMoneyAmount(
    factory.inventory * factory.priceCents,
  )
  return getCappedMoneyAmount(
    factory.cashCents +
      inventoryValue +
      getWorkerInvestmentCents(factory.workers) +
      getMissionInvestmentCents(factory.workerSkills, 'worker') +
      getMissionInvestmentCents(factory.demandSkills, 'demand') +
      getMissionInvestmentCents(factory.operationsSkills, 'operations'),
  )
}

function createRandomGameEvent(
  now: number,
  factory: FactoryState,
): GameEvent {
  const organization =
    EVENT_ORGANIZATIONS[
      Math.floor(Math.random() * EVENT_ORGANIZATIONS.length)
    ]
  const durationMs =
    GAME_EVENT_EFFECT_DURATIONS_MS[
      Math.floor(Math.random() * GAME_EVENT_EFFECT_DURATIONS_MS.length)
    ]
  const rewardType = Math.random()
  let reward: GameEventReward
  if (rewardType < 0.25) {
    const netWorth = getFactoryNetWorthCents(factory)
    const proportion = 0.005 + Math.random() * 0.015
    reward = {
      target: 'cash',
      operation: 'add',
      amount: getCappedMoneyAmount(
        Math.max(CASH_EVENT_MIN_REWARD_CENTS, netWorth * proportion),
      ),
    }
  } else if (rewardType < 0.5) {
    const netWorth = getFactoryNetWorthCents(factory)
    const progressionScale =
      1 + Math.log10(1 + netWorth / FIRST_WORKER_COST_CENTS)
    reward = {
      target: 'demand',
      operation: 'add',
      amount:
        Math.round(
          BASE_EVENT_DEMAND_BONUS_PERCENT * progressionScale * 10,
        ) / 10,
      durationMs,
    }
  } else if (rewardType < 0.75) {
    reward = {
      target: 'production-rate',
      operation: 'add',
      amount:
        EVENT_PRODUCTION_REWARDS[
          Math.floor(Math.random() * EVENT_PRODUCTION_REWARDS.length)
        ],
      durationMs,
    }
  } else {
    reward = {
      target: 'production-rate',
      operation: 'multiply',
      amount:
        EVENT_PRODUCTION_MULTIPLIERS[
          Math.floor(Math.random() * EVENT_PRODUCTION_MULTIPLIERS.length)
        ],
      durationMs,
    }
  }

  return {
    id: now,
    organization,
    message:
      reward.target === 'cash'
        ? `${organization} quer investir no crescimento da sua fábrica.`
        : reward.target === 'demand'
          ? `${organization} vai divulgar seus produtos e ampliar sua demanda por tempo limitado.`
          : `${organization} ficou impressionada com o ritmo da sua fábrica e quer reconhecer sua produção.`,
    reward,
    createdAt: now,
    expiresAt: now + GAME_EVENT_DURATION_MS,
  }
}

function formatEventReward(reward: GameEventReward) {
  if (reward.target === 'cash') {
    return formatCurrency(reward.amount / 100)
  }
  if (reward.target === 'demand') {
    return `+${formatPercent(reward.amount)} demanda`
  }
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
    .filter(
      (effect) =>
        effect.target === 'production-rate' && effect.operation === 'add',
    )
    .reduce((total, effect) => total + effect.amount, 0)
  const productionMultiplier = activeEffects
    .filter(
      (effect) =>
        effect.target === 'production-rate' && effect.operation === 'multiply',
    )
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

function getEventDemandBonusPercent(effects: ActiveGameEffect[], now: number) {
  return effects
    .filter(
      (effect) => effect.target === 'demand' && effect.expiresAt > now,
    )
    .reduce((total, effect) => total + effect.amount, 0)
}

function getSalesPerMinute(demandPercent: number) {
  return demandPercent * SALES_PER_MINUTE_PER_DEMAND_PERCENT
}

function getWorkerCostCents(workers: number, discountPercent = 0) {
  return Math.max(
    1,
    Math.round(
      FIRST_WORKER_COST_CENTS *
        WORKER_COST_GROWTH ** workers *
        (1 - discountPercent / 100),
    ),
  )
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
  const [areMissionsCollapsed, setAreMissionsCollapsed] = useState(false)
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
  const factoryForEvents = useRef(factory)
  factoryForEvents.current = factory
  const nextAnimationId = useRef(0)
  const animationTimeouts = useRef(new Set<number>())
  const lastAnimatedProduction = useRef(factory.produced)
  const skillBonuses = getSkillBonuses(
    factory.workerSkills,
    factory.demandSkills,
  )
  const operationsBonuses = getOperationsBonuses(factory.operationsSkills)
  const productionPerSecond = getProductionRate(
    factory.workers,
    skillBonuses.productionPercent,
    factory.eventEffects,
    eventClock,
  )
  const nextWorkerMission = getWorkerMission(factory.workerSkills + 1)
  const nextDemandMission = getDemandMission(factory.demandSkills + 1)
  const nextOperationsMission = getOperationsMission(
    factory.operationsSkills + 1,
  )
  const priceDemandPercent = getPriceDemandPercent(factory.priceCents)
  const eventDemandBonusPercent = getEventDemandBonusPercent(
    factory.eventEffects,
    eventClock,
  )
  const demandPercent = getDemandPercent(
    factory.priceCents,
    skillBonuses.demandPercent + eventDemandBonusPercent,
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
  const canUnlockWorkerMission =
    factory.produced >= nextWorkerMission.metricRequirement &&
    factory.cashCents >= nextWorkerMission.costCents
  const canUnlockDemandMission =
    factory.sold >= nextDemandMission.metricRequirement &&
    factory.cashCents >= nextDemandMission.costCents
  const operationsProgress =
    nextOperationsMission.metric === 'produced'
      ? factory.produced
      : factory.sold
  const canUnlockOperationsMission =
    operationsProgress >= nextOperationsMission.metricRequirement &&
    factory.cashCents >= nextOperationsMission.costCents

  useEffect(() => {
    try {
      persistLocalSave(factory)
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
        setGameEvent(createRandomGameEvent(now, factoryForEvents.current))
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
          bonuses.demandPercent +
            getEventDemandBonusPercent(activeEffects, now),
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
        const unitRevenueCents = Math.round(
          currentFactory.priceCents *
            (1 + operationsBonuses.saleMarginPercent / 100),
        )
        return {
          ...currentFactory,
          inventory: inventoryAfterProduction - soldNow,
          cashCents:
            currentFactory.cashCents + soldNow * unitRevenueCents,
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
    operationsBonuses.saleMarginPercent,
  ])

  function produceNut() {
    const quantity = 1 + operationsBonuses.manualProduction
    setFactory((currentFactory) => ({
      ...currentFactory,
      inventory: currentFactory.inventory + quantity,
      produced: currentFactory.produced + quantity,
    }))

    addProductionAnimations(quantity)
  }

  function hireWorker() {
    setFactory((currentFactory) => {
      const costCents = getWorkerCostCents(
        currentFactory.workers,
        operationsBonuses.workerDiscountPercent,
      )
      if (currentFactory.cashCents < costCents) return currentFactory

      return {
        ...currentFactory,
        cashCents: currentFactory.cashCents - costCents,
        workers: currentFactory.workers + 1,
      }
    })
  }

  function unlockSkillMission(
    track: 'worker' | 'demand' | 'operations',
  ) {
    setFactory((currentFactory) => {
      const mission =
        track === 'worker'
          ? getWorkerMission(currentFactory.workerSkills + 1)
          : track === 'demand'
            ? getDemandMission(currentFactory.demandSkills + 1)
            : getOperationsMission(currentFactory.operationsSkills + 1)
      const progress =
        mission.metric === 'produced'
          ? currentFactory.produced
          : currentFactory.sold
      if (
        progress < mission.metricRequirement ||
        currentFactory.cashCents < mission.costCents
      ) {
        return currentFactory
      }

      return {
        ...currentFactory,
        cashCents: getCappedMoneyAmount(
          currentFactory.cashCents -
            mission.costCents +
            (mission.rewardKind === 'cash' ? mission.rewardAmount : 0),
        ),
        workerSkills:
          currentFactory.workerSkills + (track === 'worker' ? 1 : 0),
        demandSkills:
          currentFactory.demandSkills + (track === 'demand' ? 1 : 0),
        operationsSkills:
          currentFactory.operationsSkills + (track === 'operations' ? 1 : 0),
      }
    })
  }

  function claimGameEvent() {
    if (!gameEvent || Date.now() >= gameEvent.expiresAt) return

    const now = Date.now()
    const reward = gameEvent.reward
    if (reward.target === 'cash') {
      setFactory((currentFactory) => ({
        ...currentFactory,
        cashCents: Math.min(
          Number.MAX_SAFE_INTEGER,
          currentFactory.cashCents + reward.amount,
        ),
      }))
    } else {
      const effect: ActiveGameEffect = {
        ...reward,
        id: gameEvent.id,
        source: gameEvent.organization,
        expiresAt: now + reward.durationMs,
      }
      setFactory((currentFactory) => ({
        ...currentFactory,
        eventEffects: [...currentFactory.eventEffects, effect],
      }))
    }

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
                <span className="production-rate">
                  {formatNumber(1 + operationsBonuses.manualProduction)}{' '}
                  {1 + operationsBonuses.manualProduction === 1
                    ? 'porca'
                    : 'porcas'}{' '}
                  por clique
                </span>
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
                      factory.cashCents <
                      getWorkerCostCents(
                        factory.workers,
                        operationsBonuses.workerDiscountPercent,
                      )
                    }
                    aria-label={`Contratar trabalhador por ${formatCurrency(getWorkerCostCents(factory.workers, operationsBonuses.workerDiscountPercent) / 100)}`}
                  >
                    <span className="worker-summary-icon" aria-hidden="true">
                      👷
                    </span>
                    <span className="hire-worker-copy">
                      <strong>{factory.workers}</strong>
                    </span>
                    <span className="hire-worker-price">
                      {formatCurrency(
                        getWorkerCostCents(
                          factory.workers,
                          operationsBonuses.workerDiscountPercent,
                        ) / 100,
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
                  {formatPercent(skillBonuses.demandPercent)} de habilidades
                  {eventDemandBonusPercent > 0 &&
                    ` + ${formatPercent(eventDemandBonusPercent)} de eventos`}
                  {operationsBonuses.saleMarginPercent > 0 &&
                    ` · margem +${formatPercent(operationsBonuses.saleMarginPercent)}`}
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

        <MissionDrawer
          factory={factory}
          workerMission={nextWorkerMission}
          demandMission={nextDemandMission}
          operationsMission={nextOperationsMission}
          canUnlockWorkerMission={canUnlockWorkerMission}
          canUnlockDemandMission={canUnlockDemandMission}
          canUnlockOperationsMission={canUnlockOperationsMission}
          collapsed={areMissionsCollapsed}
          onToggleCollapsed={() =>
            setAreMissionsCollapsed((collapsed) => !collapsed)
          }
          onUnlock={unlockSkillMission}
        />
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
              aria-label={
                gameEvent.reward.target === 'cash'
                  ? `Aceitar evento de ${gameEvent.organization}: receber ${formatEventReward(gameEvent.reward)}`
                  : `Aceitar evento de ${gameEvent.organization}: ${formatEventReward(gameEvent.reward)} por ${gameEvent.reward.durationMs / 1000} segundos`
              }
            >
              <span className="event-toast-copy">
                <strong>{gameEvent.organization} tem uma proposta especial</strong>
                <span>{gameEvent.message}</span>
                <small>
                  {gameEvent.reward.target === 'cash'
                    ? 'Clique para receber o valor'
                    : `Clique para aceitar · bônus válido por ${gameEvent.reward.durationMs / 1000}s`}
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
        <SaveDialog
          saveText={saveText}
          saveMessage={saveMessage}
          onClose={() => setIsSaveDialogOpen(false)}
          onTextChange={(text) => {
            setSaveText(text)
            setIsSaveTextEdited(true)
          }}
          onCopy={() => void copySaveText()}
          onDownload={downloadSave}
          onLoadText={() => loadSaveText()}
          onReadFile={(file) => void readSaveFile(file)}
        />
      )}
    </main>
  )
}

export default App
