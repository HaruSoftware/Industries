export type ProductionEventReward = {
  target: 'production-rate'
  operation: 'add' | 'multiply'
  amount: number
  durationMs: number
}

export type DemandEventReward = {
  target: 'demand'
  operation: 'add'
  amount: number
  durationMs: number
}

export type CashEventReward = {
  target: 'cash'
  operation: 'add'
  amount: number
}

export type TimedGameEventReward = ProductionEventReward | DemandEventReward
export type GameEventReward = TimedGameEventReward | CashEventReward

export type ActiveGameEffect = TimedGameEventReward & {
  id: number
  source: string
  expiresAt: number
}

export type GameEvent = {
  id: number
  organization: string
  message: string
  reward: GameEventReward
  createdAt: number
  expiresAt: number
}

export type SkillMission = {
  name: string
  briefing: string
  metric: 'produced' | 'sold'
  metricRequirement: number
  costCents: number
  reward: string
  rewardKind:
    | 'worker-production'
    | 'market-demand'
    | 'manual-production'
    | 'worker-discount'
    | 'sale-margin'
    | 'cash'
  rewardAmount: number
}

export type SkillBonuses = {
  productionPercent: number
  demandPercent: number
}

export type ProductionLineState = {
  id: string
  name: string
  priceCents: number
  inventory: number
  sold: number
  produced: number
  workers: number
  marketingAgents: number
  workerSkills: number
  demandSkills: number
  operationsSkills: number
  eventEffects: ActiveGameEffect[]
  productionProgress: number
  demandProgress: number
  inventoryItems: {
    demandBoost: number
  }
  investmentLevel: number
}

export type FactoryState = {
  cashCents: number
  lines: ProductionLineState[]
}

export const MIN_PRICE_CENTS = 1
export const MAX_PRICE_CENTS = 10_000

export const initialProductionLineState: ProductionLineState = {
  id: 'line-1',
  name: 'Porcas',
  priceCents: 10,
  inventory: 0,
  sold: 0,
  produced: 0,
  workers: 0,
  marketingAgents: 0,
  workerSkills: 0,
  demandSkills: 0,
  operationsSkills: 0,
  eventEffects: [],
  productionProgress: 0,
  demandProgress: 0,
  inventoryItems: {
    demandBoost: 0,
  },
  investmentLevel: 0,
}

export type ProductionLineView = ProductionLineState & {
  cashCents: number
}

export const initialFactoryState: FactoryState = {
  cashCents: 0,
  lines: [initialProductionLineState],
}
