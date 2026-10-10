import type { SkillBonuses, SkillMission } from './types'

const MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER
const WORKER_MISSION_BASE_COST_CENTS = 18_000
const DEMAND_MISSION_BASE_COST_CENTS = 35_000

const workerCampaign = [
  ['Calibração da Prensa', 'Padronize o primeiro turno e reduza paradas da prensa.'],
  ['Ritmo de Três Turnos', 'Sustente uma cadência que mantenha a esteira sempre ocupada.'],
  ['Controle de Tolerância', 'Aumente a precisão sem sacrificar o volume da linha.'],
  ['Auditoria de Gargalos', 'Redesenhe o fluxo para eliminar atrasos entre as estações.'],
  ['Protocolo de Manutenção', 'Treine a equipe para manter a produção em operação contínua.'],
  ['Célula de Alta Pressão', 'Coordene especialistas em uma célula de produção avançada.'],
  ['Padrão de Excelência', 'Consolide um método de fabricação replicável em escala.'],
  ['Linha Autônoma', 'Prepare a equipe para operar uma linha industrial de alto rendimento.'],
] as const

const marketCampaign = [
  ['Primeiro Lote Certificado', 'Entregue o lote piloto sem devoluções ou atrasos.'],
  ['Rota das Oficinas', 'Conquiste compradores recorrentes em uma nova rota regional.'],
  ['Contrato de Reposição', 'Comprove que a fábrica consegue atender pedidos frequentes.'],
  ['Rede de Distribuição', 'Expanda a cobertura sem deixar pedidos acumularem.'],
  ['Selo de Fornecedor', 'Atinja o volume exigido para entrar na cadeia industrial.'],
  ['Central de Compras', 'Negocie acesso a uma carteira maior de compradores.'],
  ['Corredor de Exportação', 'Demonstre capacidade para abastecer mercados distantes.'],
  ['Referência do Setor', 'Estabeleça a Porca Works como fornecedora de confiança.'],
] as const

function cappedCurve(base: number, level: number, exponent: number) {
  return Math.min(MAX_SAFE_AMOUNT, Math.ceil(base * level ** exponent))
}

function getCampaignEntry(
  campaign: readonly (readonly [string, string])[],
  level: number,
) {
  const entry = campaign[(level - 1) % campaign.length]
  const chapter = Math.floor((level - 1) / campaign.length) + 1
  return chapter === 1 ? entry : [`${entry[0]} · Ciclo ${chapter}`, entry[1]] as const
}

export function getWorkerMission(level: number): SkillMission {
  const [name, briefing] = getCampaignEntry(workerCampaign, level)
  const bonusPercent = Math.min(100_000_000, 15 + (level - 1) * 5)
  return {
    name,
    briefing,
    metric: 'produced',
    metricRequirement: cappedCurve(1_800, level, 1.55),
    costCents: cappedCurve(WORKER_MISSION_BASE_COST_CENTS, level, 2.15),
    reward: `+${bonusPercent}% de produção por trabalhador`,
    rewardKind: 'worker-production',
    rewardAmount: bonusPercent,
  }
}

export function getDemandMission(level: number): SkillMission {
  const [name, briefing] = getCampaignEntry(marketCampaign, level)
  return {
    name,
    briefing,
    metric: 'sold',
    metricRequirement: cappedCurve(1_000, level, 1.55),
    costCents: cappedCurve(DEMAND_MISSION_BASE_COST_CENTS, level, 2.2),
    reward: `+${new Intl.NumberFormat('pt-BR').format(level * 50)}% de demanda`,
    rewardKind: 'market-demand',
    rewardAmount: level * 50,
  }
}

const operationsCampaign = [
  {
    name: 'Gabarito de Bancada',
    briefing: 'Prepare dispositivos que aceleram a montagem manual.',
    metric: 'produced',
    rewardKind: 'manual-production',
    getReward: (cycle: number) => cycle,
    formatReward: (amount: number) =>
      `+${amount} ${amount === 1 ? 'porca' : 'porcas'} por clique`,
  },
  {
    name: 'Acordo de Matéria-prima',
    briefing: 'Negocie melhores condições para ampliar a equipe.',
    metric: 'sold',
    rewardKind: 'worker-discount',
    getReward: () => 5,
    formatReward: (amount: number) => `-${amount}% no custo de contratação`,
  },
  {
    name: 'Inspeção de Valor Agregado',
    briefing: 'Padronize o acabamento para vender cada lote com mais valor.',
    metric: 'produced',
    rewardKind: 'sale-margin',
    getReward: () => 5,
    formatReward: (amount: number) => `+${amount}% de receita por venda`,
  },
  {
    name: 'Incentivo à Expansão',
    briefing: 'Receba capital de implantação ao concluir este marco industrial.',
    metric: 'sold',
    rewardKind: 'cash',
    getReward: (cycle: number) => cycle * 15_000,
    formatReward: (amount: number) =>
      `Bônus de caixa de ${new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(amount / 100)}`,
  },
] as const

export function getOperationsMission(level: number): SkillMission {
  const campaignIndex = (level - 1) % operationsCampaign.length
  const cycle = Math.floor((level - 1) / operationsCampaign.length) + 1
  const campaign = operationsCampaign[campaignIndex]
  const name =
    cycle === 1 ? campaign.name : `${campaign.name} · Ciclo ${cycle}`
  const rewardAmount = campaign.getReward(cycle)
  return {
    name,
    briefing: campaign.briefing,
    metric: campaign.metric,
    metricRequirement:
      campaign.metric === 'produced'
        ? cappedCurve(2_500, level, 1.45)
        : cappedCurve(2_000, level, 1.45),
    costCents: cappedCurve(45_000, level, 2.1),
    reward: campaign.formatReward(rewardAmount),
    rewardKind: campaign.rewardKind,
    rewardAmount,
  }
}

function countRewardLevels(level: number, campaignIndex: number) {
  return Math.floor(level / operationsCampaign.length) +
    (level % operationsCampaign.length > campaignIndex ? 1 : 0)
}

export function getOperationsBonuses(level: number) {
  const fullCycles = Math.floor(level / operationsCampaign.length)
  const remainingContracts = level % operationsCampaign.length
  return {
    manualProduction:
      (fullCycles * (fullCycles + 1)) / 2 +
      (remainingContracts > 0 ? fullCycles + 1 : 0),
    workerDiscountPercent: Math.min(60, countRewardLevels(level, 1) * 5),
    saleMarginPercent: Math.min(100, countRewardLevels(level, 2) * 5),
  }
}

export function getSkillBonuses(
  workerSkills: number,
  demandSkills: number,
): SkillBonuses {
  return {
    productionPercent: Math.min(
      100_000_000,
      workerSkills * 15 + (5 * workerSkills * (workerSkills - 1)) / 2,
    ),
    demandPercent: demandSkills * 50,
  }
}

export function getFactoryMissionInvestmentCents(
  level: number,
  track: 'worker' | 'demand' | 'operations',
) {
  const baseCost =
    track === 'worker'
      ? WORKER_MISSION_BASE_COST_CENTS
      : track === 'demand'
        ? DEMAND_MISSION_BASE_COST_CENTS
        : 45_000
  const exponent =
    track === 'worker' ? 2.15 : track === 'demand' ? 2.2 : 2.1
  const cumulativePower =
    level ** (exponent + 1) / (exponent + 1) +
    level ** exponent / 2 +
    (exponent * level ** (exponent - 1)) / 12
  return Math.min(MAX_SAFE_AMOUNT, Math.round(baseCost * cumulativePower))
}
