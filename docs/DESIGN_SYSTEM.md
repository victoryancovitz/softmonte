# Design System — Softmonte

## Cores

| Token | Valor | Uso |
|-------|-------|-----|
| brand-navy | #00215B | Topbar, CTAs primários |
| brand-gold | #c8960c | Destaques, ícones ativos |
| success | #10b981 | Confirmações, status positivo |
| warning | #f59e0b | Alertas, atenção |
| danger | #ef4444 | Erros, exclusões |
| info | #3b82f6 | Informativo |
| neutral-50..900 | Tailwind gray | Textos, bordas, fundos |

## Tipografia

| Elemento | Classes |
|----------|---------|
| h1 | `text-2xl font-bold tracking-tight` |
| h2 | `text-xl font-semibold` |
| h3 | `text-lg font-semibold` |
| body | `text-sm` |
| small | `text-xs` |
| caption | `text-[10px]` |

## Espaçamento

| Contexto | Valor |
|----------|-------|
| Padding de card | `p-6` (desktop), `p-4` (mobile) |
| Gap entre seções | `gap-6` |
| Gap entre campos | `gap-4` |
| Margin bottom título | `mb-6` |

## Componentes

### Card
```
rounded-xl border border-gray-200 bg-white p-6 shadow-sm
```

### Modal
```
rounded-2xl shadow-2xl max-w-lg w-full mx-4
Backdrop: fixed inset-0 bg-black/40 z-40
```

### Input
```
w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
focus:outline-none focus:ring-2 focus:ring-brand
```

### Botões

| Variante | Classes |
|----------|---------|
| primary | `bg-brand text-white hover:bg-brand-dark` |
| secondary | `border border-gray-200 text-gray-700 hover:bg-gray-50` |
| danger | `bg-red-600 text-white hover:bg-red-700` |
| ghost | `text-gray-600 hover:bg-gray-100` |

### Badge de status

| Status | Fundo | Texto |
|--------|-------|-------|
| em_aberto | `bg-amber-50` | `text-amber-700` |
| pago | `bg-green-50` | `text-green-700` |
| pendente | `bg-blue-50` | `text-blue-700` |
| cancelado | `bg-gray-50` | `text-gray-600` |
| atrasado | `bg-red-50` | `text-red-700` |

### Tabela
```
<thead>: bg-gray-50 text-xs uppercase text-gray-500 tracking-wide
<tr>: hover:bg-gray-50
<td>: px-4 py-3
Texto: left | Números: right | Ações: center
```

### Ícones (lucide-react)

| Tamanho | Classes | Uso |
|---------|---------|-----|
| 16px | `w-4 h-4` | Botões |
| 20px | `w-5 h-5` | Títulos |
| 24px | `w-6 h-6` | KPIs |
| 48px | `w-12 h-12` | Empty states |
