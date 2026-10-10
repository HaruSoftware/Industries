import {
  initialFactoryState,
  MAX_PRICE_CENTS,
  MIN_PRICE_CENTS,
} from './types'
import type { ActiveGameEffect, FactoryState } from './types'

const SAVE_STORAGE_KEY = 'porca-works-save'
const SAVE_VERSION = 1
const MAX_SAVED_EFFECTS = 100

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

export function parseGameSave(text: string): FactoryState {
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
    (factory.operationsSkills !== undefined &&
      !isNonnegativeSafeInteger(factory.operationsSkills)) ||
    !isValidProgress(factory.productionProgress) ||
    !isValidProgress(factory.demandProgress) ||
    !Array.isArray(factory.eventEffects) ||
    factory.eventEffects.length > MAX_SAVED_EFFECTS
  ) {
    throw new Error('O save contém dados inválidos ou incompletos.')
  }

  return {
    priceCents: factory.priceCents,
    inventory: factory.inventory,
    cashCents: factory.cashCents,
    sold: factory.sold,
    produced: factory.produced,
    workers: factory.workers,
    workerSkills: factory.workerSkills,
    demandSkills: factory.demandSkills,
    operationsSkills: isNonnegativeSafeInteger(factory.operationsSkills)
      ? factory.operationsSkills
      : 0,
    eventEffects: factory.eventEffects
      .map(parseEffect)
      .filter((effect) => effect.expiresAt > Date.now()),
    productionProgress: factory.productionProgress,
    demandProgress: factory.demandProgress,
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
