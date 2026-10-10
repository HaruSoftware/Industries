import type { FactoryState, SkillMission } from '../game/types'
import { formatCurrency, formatNumber } from '../game/format'

type MissionTrack = 'worker' | 'demand' | 'operations'

type MissionDrawerProps = {
  factory: FactoryState
  workerMission: SkillMission
  demandMission: SkillMission
  operationsMission: SkillMission
  canUnlockWorkerMission: boolean
  canUnlockDemandMission: boolean
  canUnlockOperationsMission: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  onUnlock: (track: MissionTrack) => void
}

function MissionCard({
  mission,
  progress,
  track,
  level,
  canUnlock,
  cashCents,
  onUnlock,
}: {
  mission: SkillMission
  progress: number
  track: MissionTrack
  level: number
  canUnlock: boolean
  cashCents: number
  onUnlock: () => void
}) {
  const metricValue = progress
  const metricLabel = mission.metric === 'produced' ? 'produzidas' : 'vendidas'
  const metricProgress = Math.min(
    100,
    (metricValue / mission.metricRequirement) * 100,
  )
  const trackName =
    track === 'worker'
      ? 'TRABALHADORES'
      : track === 'demand'
        ? 'MERCADO'
        : 'GESTÃO'
  const titleId = `${track}-mission-title`
  const trackClass =
    track === 'worker'
      ? 'worker-mission'
      : track === 'demand'
        ? 'demand-mission'
        : 'operations-mission'

  return (
    <article
      className={`skill-mission ${trackClass}`}
      key={`${track}-${level}`}
      aria-labelledby={titleId}
    >
      <div className="skill-mission-info">
        <p className="panel-kicker">
          {trackName} · CONTRATO {formatNumber(level)}
        </p>
        <h2 id={titleId}>{mission.name}</h2>
        <p className="mission-briefing">{mission.briefing}</p>
        <span className="skill-reward">{mission.reward}</span>
      </div>
      <div className="skill-progress">
        <div
          className="skill-progress-track"
          role="progressbar"
          aria-label={`Progresso para ${mission.name}`}
          aria-valuemin={0}
          aria-valuemax={mission.metricRequirement}
          aria-valuenow={Math.min(metricValue, mission.metricRequirement)}
        >
          <span style={{ width: `${metricProgress}%` }} />
        </div>
        <span>
          {formatNumber(Math.min(metricValue, mission.metricRequirement))} /{' '}
          {formatNumber(mission.metricRequirement)} porcas {metricLabel}
        </span>
      </div>
      <div className="skill-unlock">
        <span className="skill-cost">
          {formatCurrency(mission.costCents / 100)}
        </span>
        <button
          className="skill-unlock-button"
          type="button"
          onClick={onUnlock}
          disabled={!canUnlock}
        >
          Assinar contrato
        </button>
        {metricValue >= mission.metricRequirement &&
          cashCents < mission.costCents && (
            <span className="skill-status">Caixa insuficiente</span>
          )}
      </div>
    </article>
  )
}

export function MissionDrawer({
  factory,
  workerMission,
  demandMission,
  operationsMission,
  canUnlockWorkerMission,
  canUnlockDemandMission,
  canUnlockOperationsMission,
  collapsed,
  onToggleCollapsed,
  onUnlock,
}: MissionDrawerProps) {
  return (
    <section
      className={`mission-tracks${collapsed ? ' is-collapsed' : ''}`}
      aria-label="Contratos de especialização"
    >
      <header className="mission-drawer-header">
        <div className="mission-drawer-title">
          <p className="panel-kicker">CAMPANHA INDUSTRIAL</p>
          <h2>Contratos</h2>
        </div>
        <button
          className="mission-drawer-toggle"
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="mission-track-list"
          aria-label={collapsed ? 'Expandir contratos' : 'Recolher contratos'}
        >
          <span aria-hidden="true">{collapsed ? '‹' : '›'}</span>
        </button>
      </header>
      <div className="mission-track-list" id="mission-track-list">
        <MissionCard
          mission={workerMission}
          progress={factory.produced}
          track="worker"
          level={factory.workerSkills + 1}
          canUnlock={canUnlockWorkerMission}
          cashCents={factory.cashCents}
          onUnlock={() => onUnlock('worker')}
        />
        <MissionCard
          mission={demandMission}
          progress={factory.sold}
          track="demand"
          level={factory.demandSkills + 1}
          canUnlock={canUnlockDemandMission}
          cashCents={factory.cashCents}
          onUnlock={() => onUnlock('demand')}
        />
        <MissionCard
          mission={operationsMission}
          progress={
            operationsMission.metric === 'produced'
              ? factory.produced
              : factory.sold
          }
          track="operations"
          level={factory.operationsSkills + 1}
          canUnlock={canUnlockOperationsMission}
          cashCents={factory.cashCents}
          onUnlock={() => onUnlock('operations')}
        />
      </div>
    </section>
  )
}
