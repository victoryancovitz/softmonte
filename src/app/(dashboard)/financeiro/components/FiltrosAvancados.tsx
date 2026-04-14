'use client'

const CATEGORIAS_RECEITA = ['Faturamento HH', 'Serviços', 'Outras receitas']
const CATEGORIAS_DESPESA = ['Folha de Pagamento', 'Encargos', 'Aluguel', 'Materiais', 'Compras', 'Impostos', 'Honorários', 'Despesas Financeiras', 'Amortização de Empréstimos', 'Depreciação', 'Custo dos Serviços Prestados', 'Outras despesas']

export interface FilterState {
  categoria: string
  centroCusto: string
  fornecedor: string
  de: string
  ate: string
  valorMin: string
  valorMax: string
}

export const FILTER_INITIAL: FilterState = {
  categoria: '',
  centroCusto: '',
  fornecedor: '',
  de: '',
  ate: '',
  valorMin: '',
  valorMax: '',
}

interface FiltrosAvancadosProps {
  filters: FilterState
  onChange: (f: FilterState) => void
  visible: boolean
  onToggle: () => void
}

export default function FiltrosAvancados({ filters, onChange, visible, onToggle }: FiltrosAvancadosProps) {
  const hasAdvancedFilters = filters.categoria || filters.centroCusto || filters.fornecedor || filters.de || filters.ate || filters.valorMin || filters.valorMax

  return (
    <>
      <button onClick={onToggle}
        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${visible ? 'border-brand text-brand bg-brand/5' : 'border-gray-200 text-gray-600 hover:border-brand hover:text-brand'}`}>
        <span>🔍</span> Filtros avancados
        {hasAdvancedFilters && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
      </button>

      {visible && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase">Categoria</label>
              <select value={filters.categoria} onChange={e => onChange({ ...filters, categoria: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                <option value="">Todas</option>
                {[...CATEGORIAS_RECEITA, ...CATEGORIAS_DESPESA].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase">Centro de custo</label>
              <input value={filters.centroCusto} onChange={e => onChange({ ...filters, centroCusto: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" placeholder="Filtrar..." />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase">Fornecedor</label>
              <input value={filters.fornecedor} onChange={e => onChange({ ...filters, fornecedor: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" placeholder="Filtrar..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase">De</label>
                <input type="date" value={filters.de} onChange={e => onChange({ ...filters, de: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase">Ate</label>
                <input type="date" value={filters.ate} onChange={e => onChange({ ...filters, ate: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              </div>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="grid grid-cols-2 gap-2 flex-1 max-w-[200px]">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase">Valor min</label>
                <input type="number" value={filters.valorMin} onChange={e => onChange({ ...filters, valorMin: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" placeholder="0" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase">Valor max</label>
                <input type="number" value={filters.valorMax} onChange={e => onChange({ ...filters, valorMax: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" placeholder="999999" />
              </div>
            </div>
            <button onClick={() => onChange({ ...FILTER_INITIAL })}
              className="text-xs text-brand hover:underline font-medium pb-1">Limpar filtros</button>
          </div>
        </div>
      )}
    </>
  )
}
