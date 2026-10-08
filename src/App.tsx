import { useEffect, useRef, useState } from 'react'
import './App.css'

const MIN_PRICE_CENTS = 1
const MAX_PRICE_CENTS = 10_000
const FIRST_WORKER_COST_CENTS = 10_000
const WORKER_COST_GROWTH = 1.15
const MAX_VISIBLE_PRODUCTION_ANIMATIONS = 8
const MIN_ANIMATION_INTERVAL_MS = 75
const FIRST_SKILL_COST_CENTS = 15_000
const FIRST_SKILL_PRODUCTION_REQUIREMENT = 1_500

type SkillMission = {
  name: string
  productionRequirement: number
  costCents: number
  reward: string
}

type SkillBonuses = {
  productionPercent: number
  demandPerMinute: number
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
  productionProgress: number
  demandProgress: number
}

const initialFactoryState: FactoryState = {
  priceCents: 1_000,
  inventory: 0,
  cashCents: 0,
  sold: 0,
  produced: 0,
  workers: 0,
  workerSkills: 0,
  demandSkills: 0,
  productionProgress: 0,
  demandProgress: 0,
}

function formatPriceInput(priceCents: number) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceCents / 100)
}

function getDemandPerMinute(priceCents: number, bonusDemandPerMinute = 0) {
  return Math.round(
    Math.max(0, 120 - (priceCents / 100) * 1.2 + bonusDemandPerMinute),
  )
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
  const bonusDemandPerMinute = Math.min(1_000_000_000, 12 + (number - 1) * 4)
  return {
    name: `${names[(number - 1) % names.length]} · Missão ${formatNumber(number)}`,
    productionRequirement: getMissionProductionRequirement(number),
    costCents: getMissionCostCents(number, 2),
    reward: `+${formatNumber(bonusDemandPerMinute)} clientes/min, mesmo preço`,
  }
}

function getSkillBonuses(workerSkills: number, demandSkills: number): SkillBonuses {
  return {
    productionPercent: Math.min(
      100_000_000,
      workerSkills * 15 + (5 * workerSkills * (workerSkills - 1)) / 2,
    ),
    demandPerMinute: Math.min(
      1_000_000_000,
      demandSkills * 12 + (4 * demandSkills * (demandSkills - 1)) / 2,
    ),
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount)
}

function App() {
  const [factory, setFactory] = useState(initialFactoryState)
  const [priceInput, setPriceInput] = useState(() =>
    formatPriceInput(initialFactoryState.priceCents),
  )
  const [productionAnimations, setProductionAnimations] = useState<number[]>([])
  const nextAnimationId = useRef(0)
  const animationTimeout = useRef<number | null>(null)
  const lastAnimationAt = useRef(0)
  const skillBonuses = getSkillBonuses(
    factory.workerSkills,
    factory.demandSkills,
  )
  const nextWorkerMission = getWorkerMission(factory.workerSkills + 1)
  const nextDemandMission = getDemandMission(factory.demandSkills + 1)
  const demandPerMinute = getDemandPerMinute(
    factory.priceCents,
    skillBonuses.demandPerMinute,
  )
  const maximumDemand = getDemandPerMinute(MIN_PRICE_CENTS)
  const demandPercentage = maximumDemand
    ? (demandPerMinute / maximumDemand) * 100
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

  function addProductionAnimations(quantity: number) {
    const now = Date.now()
    if (now - lastAnimationAt.current < MIN_ANIMATION_INTERVAL_MS) return
    lastAnimationAt.current = now

    const animationCount = Math.min(
      quantity,
      MAX_VISIBLE_PRODUCTION_ANIMATIONS,
    )
    const animationIds = Array.from({ length: animationCount }, () => {
      nextAnimationId.current += 1
      return nextAnimationId.current
    })
    setProductionAnimations(animationIds)
    if (animationTimeout.current !== null) {
      window.clearTimeout(animationTimeout.current)
    }
    animationTimeout.current = window.setTimeout(() => {
      setProductionAnimations([])
      animationTimeout.current = null
    }, 900)
  }

  useEffect(
    () => () => {
      if (animationTimeout.current !== null) {
        window.clearTimeout(animationTimeout.current)
      }
    },
    [],
  )

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setFactory((currentFactory) => {
        const bonuses = getSkillBonuses(
          currentFactory.workerSkills,
          currentFactory.demandSkills,
        )
        const productionThisSecond =
          currentFactory.productionProgress +
          currentFactory.workers * (1 + bonuses.productionPercent / 100)
        const producedThisSecond = Math.floor(productionThisSecond)
        const inventoryAfterProduction =
          currentFactory.inventory + producedThisSecond
        const producedAfterTick = currentFactory.produced + producedThisSecond
        const productionProgress = productionThisSecond - producedThisSecond
        const demand = getDemandPerMinute(
          currentFactory.priceCents,
          bonuses.demandPerMinute,
        )
        if (inventoryAfterProduction === 0 || demand === 0) {
          return {
            ...currentFactory,
            inventory: inventoryAfterProduction,
            produced: producedAfterTick,
            productionProgress,
            demandProgress: 0,
          }
        }

        const accumulatedDemand =
          currentFactory.demandProgress + demand / 60
        const orders = Math.floor(accumulatedDemand)
        if (orders === 0) {
          return {
            ...currentFactory,
            inventory: inventoryAfterProduction,
            produced: producedAfterTick,
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
          productionProgress,
          demandProgress:
            soldNow === inventoryAfterProduction
              ? 0
              : accumulatedDemand - orders,
        }
      })

      const productionPerSecond =
        factory.workers * (1 + skillBonuses.productionPercent / 100)
      const visibleNuts = Math.min(
        Math.floor(productionPerSecond),
        MAX_VISIBLE_PRODUCTION_ANIMATIONS,
      )
      if (visibleNuts > 0) addProductionAnimations(visibleNuts)
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [factory.workers, skillBonuses.productionPercent])

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
                  1 porca por clique
                  {factory.workers > 0 &&
                    ` · +${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(factory.workers * (1 + skillBonuses.productionPercent / 100))} porcas/s`}
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
                {productionAnimations.map((animationId) => (
                  <div
                    key={animationId}
                    className="nut-part"
                    aria-hidden="true"
                  >
                    <span />
                  </div>
                ))}
                <div className="floor-shadow" />
              </div>

              <div className="production-row">
                <div>
                  <span className="production-count">{factory.produced}</span>
                  <span className="production-caption">produzidas</span>
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
                  <strong>
                    {demandPerMinute} <span>porcas / min</span>
                  </strong>
                </div>
                <div
                  className="demand-meter"
                  role="meter"
                  aria-label="Demanda estimada para esta linha"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(demandPercentage)}
                >
                  <span style={{ width: `${demandPercentage}%` }} />
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
    </main>
  )
}

export default App
