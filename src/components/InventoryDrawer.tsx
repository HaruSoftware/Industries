import {
  Megaphone,
  PackageOpen,
} from 'lucide-react'
import type { ProductionLineView } from '../game/types'
import { formatCurrency, formatNumber } from '../game/format'

type InventoryDrawerProps = {
  line: ProductionLineView
  demandBoostCostCents: number
  demandBoostActive: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  onBuyDemandBoost: () => void
  onUseDemandBoost: () => void
}

export function InventoryDrawer({
  line,
  demandBoostCostCents,
  demandBoostActive,
  collapsed,
  onToggleCollapsed,
  onBuyDemandBoost,
  onUseDemandBoost,
}: InventoryDrawerProps) {
  const inventoryId = `line-inventory-${line.id}`
  const demandBoostCount = line.inventoryItems.demandBoost

  return (
    <section
      className={`line-inventory-drawer${collapsed ? ' is-collapsed' : ''}`}
      aria-label={`Inventário da linha ${line.name}`}
    >
      <header className="inventory-drawer-header">
        <div className="inventory-drawer-title">
          <p className="panel-kicker">ESTOQUE DA LINHA</p>
          <h2>
            <PackageOpen aria-hidden="true" size={17} strokeWidth={2} />
            Inventário
          </h2>
        </div>
        <button
          className="drawer-toggle inventory-drawer-toggle"
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls={inventoryId}
          aria-label={collapsed ? 'Expandir inventário' : 'Recolher inventário'}
        >
          <span className="drawer-toggle-icons" aria-hidden="true">
            <PackageOpen size={16} strokeWidth={2} />
          </span>
        </button>
      </header>
      <div className="inventory-item-list" id={inventoryId}>
        <article className="inventory-item-card">
          <div className="inventory-item-overview">
            <span className="inventory-item-icon" aria-hidden="true">
              <Megaphone size={17} strokeWidth={2} />
            </span>
            <div className="inventory-item-copy">
              <span className="inventory-item-category">CONSUMÍVEL</span>
              <strong>Campanha de demanda</strong>
              <span>+100% de demanda por 60s</span>
            </div>
            <strong
              className="inventory-item-count"
              aria-label={`${formatNumber(demandBoostCount)} campanhas no inventário`}
            >
              ×{formatNumber(demandBoostCount)}
            </strong>
          </div>
          <div className="inventory-item-footer">
            <span
              className={`inventory-item-status${demandBoostActive ? ' is-active' : ''}`}
              aria-live="polite"
            >
              {demandBoostActive ? 'BOOST ATIVO' : 'PRONTO PARA USO'}
            </span>
            <div className="inventory-item-actions">
              <button
                className="inventory-action-button inventory-buy-button"
                type="button"
                onClick={onBuyDemandBoost}
                disabled={line.cashCents < demandBoostCostCents}
                aria-label={`Comprar campanha de demanda por ${formatCurrency(demandBoostCostCents / 100)}`}
              >
                Comprar · {formatCurrency(demandBoostCostCents / 100)}
              </button>
              <button
                className="inventory-action-button inventory-use-button"
                type="button"
                onClick={onUseDemandBoost}
                disabled={demandBoostCount === 0}
                aria-label={`Usar campanha de demanda, ${formatNumber(demandBoostCount)} no inventário`}
              >
                Usar
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}