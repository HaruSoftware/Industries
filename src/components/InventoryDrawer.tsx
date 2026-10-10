import { Megaphone, PackageOpen, Store } from 'lucide-react'
import { useState } from 'react'
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
  const shopId = `line-inventory-shop-${line.id}`
  const demandBoostCount = line.inventoryItems.demandBoost
  const [shopOpen, setShopOpen] = useState(false)

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
        <div className="inventory-drawer-actions">
          <button
            className="inventory-shop-toggle"
            type="button"
            onClick={() => setShopOpen((open) => !open)}
            aria-expanded={shopOpen}
            aria-controls={shopId}
            aria-label={shopOpen ? 'Fechar loja de itens' : 'Abrir loja de itens'}
            title="Loja de itens"
          >
            <Store aria-hidden="true" size={15} strokeWidth={2} />
          </button>
          <button
            className="drawer-toggle inventory-drawer-toggle"
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls={inventoryId}
            aria-label={collapsed ? 'Expandir inventário' : 'Recolher inventário'}
          >
            <span className="drawer-toggle-icons" aria-hidden="true">
              <PackageOpen size={21} strokeWidth={2} />
            </span>
          </button>
        </div>
      </header>
      <div className="inventory-content" id={inventoryId}>
        <div className="inventory-grid" role="grid" aria-label="Itens no inventário">
          {Array.from({ length: 12 }, (_, slotIndex) => {
            if (slotIndex === 0 && demandBoostCount > 0) {
              return (
                <button
                  className="inventory-slot inventory-slot-item"
                  key={slotIndex}
                  type="button"
                  role="gridcell"
                  onClick={onUseDemandBoost}
                  title={`Campanha de demanda · +100% por 60s · ${formatNumber(demandBoostCount)} no inventário`}
                  aria-label={`Usar campanha de demanda, ${formatNumber(demandBoostCount)} no inventário`}
                >
                  <Megaphone aria-hidden="true" size={19} strokeWidth={2} />
                  <span className="inventory-slot-count">
                    {formatNumber(demandBoostCount)}
                  </span>
                </button>
              )
            }

            return (
              <div
                className="inventory-slot inventory-slot-empty"
                key={slotIndex}
                role="gridcell"
                aria-label={`Espaço vazio ${slotIndex + 1}`}
              />
            )
          })}
        </div>
        {demandBoostCount === 0 && (
          <p className="inventory-empty">Inventário vazio</p>
        )}
        {demandBoostActive && (
          <span className="inventory-active-status" aria-live="polite">
            BOOST DE DEMANDA ATIVO
          </span>
        )}
        <section
          className="inventory-shop"
          id={shopId}
          aria-label="Loja de itens"
          hidden={!shopOpen}
        >
          <div className="inventory-shop-item">
            <span className="inventory-shop-icon" aria-hidden="true">
              <Megaphone size={17} strokeWidth={2} />
            </span>
            <div className="inventory-shop-copy">
              <strong>Campanha de demanda</strong>
              <span>+100% de demanda por 60s</span>
            </div>
            <button
              className="inventory-action-button inventory-buy-button"
              type="button"
              onClick={onBuyDemandBoost}
              disabled={line.cashCents < demandBoostCostCents}
              aria-label={`Comprar campanha de demanda por ${formatCurrency(demandBoostCostCents / 100)}`}
            >
              {formatCurrency(demandBoostCostCents / 100)}
            </button>
          </div>
        </section>
      </div>
    </section>
  )
}