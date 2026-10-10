import {
  initialFactoryState,
  MAX_PRICE_CENTS,
  MIN_PRICE_CENTS,
} from './types'
import type {
  ActiveGameEffect,
  FactoryState,
  ProductionLineState,
} from './types'

const SAVE_STORAGE_KEY = 'porca-works-save'
const SAVE_VERSION = 2
const LEGACY_SAVE_VERSION = 1
const MAX_SAVED_EFFECTS = 100
const MAX_PRODUCTION_LINES = 8

export type LocalSaveReadResult = {
  factory: FactoryState
  error: string | null
}

type GameSave = {
  version: typeof SAVE_VERSION
  savedAt: number
  factory: FactoryState
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

function parseEffect(value: unknown): ActiveGameEffect {
  if (
    !isRecord(value) ||
    (value.target !== 'production-rate' && value.target !== 'demand') ||
    (value.target === 'production-rate' &&
      value.operation !== 'add' &&
      value.operation !== 'multiply') ||
    (value.target === 'demand' && value.operation !== 'add') ||
    typeof value.amount !== 'number' ||
    !Number.isFinite(value.amount) ||
    value.amount <= 0 ||
    typeof value.durationMs !== 'number' ||
    !Number.isFinite(value.durationMs) ||
    value.durationMs <= 0 ||
    !isNonnegativeSafeInteger(value.id) ||
    typeof value.source !== 'string' ||
    value.source.length > 200 ||
    typeof value.expiresAt !== 'number' ||
    !Number.isFinite(value.expiresAt)
  ) {
    throw new Error('O save contém um bônus ativo inválido.')
  }

  if (value.target === 'demand') {
    return {
      target: 'demand',
      operation: 'add',
      amount: value.amount,
      durationMs: value.durationMs,
      id: value.id,
      source: value.source,
      expiresAt: value.expiresAt,
    }
  }

  const operation = value.operation
  if (operation !== 'add' && operation !== 'multiply') {
    throw new Error('O save contém um bônus ativo inválido.')
  }

  return {
    target: 'production-rate',
    operation,
    amount: value.amount,
    durationMs: value.durationMs,
    id: value.id,
    source: value.source,
    expiresAt: value.expiresAt,
  }
}

function parseProductionLine(
  value: unknown,
  fallbackId: string,
): ProductionLineState {
  const line = value
  if (
    !isRecord(line) ||
    !isNonnegativeSafeInteger(line.priceCents) ||
    line.priceCents < MIN_PRICE_CENTS ||
    line.priceCents > MAX_PRICE_CENTS ||
    !isNonnegativeSafeInteger(line.inventory) ||
    !isNonnegativeSafeInteger(line.sold) ||
    !isNonnegativeSafeInteger(line.produced) ||
    !isNonnegativeSafeInteger(line.workers) ||
    (line.marketingAgents !== undefined &&
      !isNonnegativeSafeInteger(line.marketingAgents)) ||
    !isNonnegativeSafeInteger(line.workerSkills) ||
    !isNonnegativeSafeInteger(line.demandSkills) ||
    (line.operationsSkills !== undefined &&
      !isNonnegativeSafeInteger(line.operationsSkills)) ||
    !isValidProgress(line.productionProgress) ||
    !isValidProgress(line.demandProgress) ||
    !Array.isArray(line.eventEffects) ||
    line.eventEffects.length > MAX_SAVED_EFFECTS ||
    (line.id !== undefined &&
      (typeof line.id !== 'string' || line.id.length === 0 || line.id.length > 80)) ||
    (line.name !== undefined &&
      (typeof line.name !== 'string' || line.name.length === 0 || line.name.length > 80)) ||
    (line.investmentLevel !== undefined &&
      !isNonnegativeSafeInteger(line.investmentLevel))
  ) {
    throw new Error('O save contém dados inválidos ou incompletos.')
  }

  const inventoryItems = line.inventoryItems
  if (
    inventoryItems !== undefined &&
    (!isRecord(inventoryItems) ||
      !isNonnegativeSafeInteger(inventoryItems.demandBoost))
  ) {
    throw new Error('O save contém dados de inventário inválidos.')
  }

  return {
    id: typeof line.id === 'string' ? line.id : fallbackId,
    name: typeof line.name === 'string' ? line.name : 'Porcas',
    priceCents: line.priceCents,
    inventory: line.inventory,
    sold: line.sold,
    produced: line.produced,
    workers: line.workers,
    marketingAgents: isNonnegativeSafeInteger(line.marketingAgents)
      ? line.marketingAgents
      : 0,
    workerSkills: line.workerSkills,
    demandSkills: line.demandSkills,
    operationsSkills: isNonnegativeSafeInteger(line.operationsSkills)
      ? line.operationsSkills
      : 0,
    eventEffects: line.eventEffects
      .map(parseEffect)
      .filter((effect) => effect.expiresAt > Date.now()),
    productionProgress: line.productionProgress,
    demandProgress: line.demandProgress,
    inventoryItems:
      inventoryItems === undefined
        ? { demandBoost: 0 }
        : { demandBoost: inventoryItems.demandBoost as number },
    investmentLevel: isNonnegativeSafeInteger(line.investmentLevel)
      ? line.investmentLevel
      : 0,
  }
}

export function parseGameSave(text: string): FactoryState {
  const parsed: unknown = JSON.parse(text)
  if (!isRecord(parsed)) {
    throw new Error('O arquivo não é um save compatível do Porca Works.')
  }

  const savedFactory = parsed.factory
  if (parsed.version === LEGACY_SAVE_VERSION) {
    if (
      !isRecord(savedFactory) ||
      !isNonnegativeSafeInteger(savedFactory.cashCents)
    ) {
      throw new Error('O save antigo contém dados inválidos ou incompletos.')
    }

    return {
      cashCents: savedFactory.cashCents,
      lines: [parseProductionLine(savedFactory, 'line-1')],
    }
  }

  if (
    parsed.version !== SAVE_VERSION ||
    !isRecord(savedFactory) ||
    !isNonnegativeSafeInteger(savedFactory.cashCents) ||
    !Array.isArray(savedFactory.lines) ||
    savedFactory.lines.length === 0 ||
    savedFactory.lines.length > MAX_PRODUCTION_LINES
  ) {
    throw new Error('O arquivo não é um save compatível do Porca Works.')
  }

  const lines = savedFactory.lines.map((line, index) =>
    parseProductionLine(line, `line-${index + 1}`),
  )
  if (new Set(lines.map((line) => line.id)).size !== lines.length) {
    throw new Error('O save contém linhas de montagem duplicadas.')
  }

  return {
    cashCents: savedFactory.cashCents,
    lines,
  }
}

export function createGameSaveJson(factory: FactoryState) {
  const save: GameSave = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    factory,
  }
  return JSON.stringify(save, null, 2)
}

export function readLocalSave(): LocalSaveReadResult {
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

export function persistLocalSave(factory: FactoryState) {
  window.localStorage.setItem(SAVE_STORAGE_KEY, createGameSaveJson(factory))
}
