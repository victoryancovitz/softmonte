'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type ImportMode = 'funcionarios' | 'efetivo'

export default function ImportarPage() {
  const [mode, setMode] = useState<ImportMode>('funcionarios')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)

    // Parse CSV preview
    const text = await f.text()
    const lines = text.split('\n').filter(l => l.trim())
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g,''))
    const rows = lines.slice(1, 6).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g,''))
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
    })
    setPreview(rows)
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setResult(null)

    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g,'').toLowerCase())
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g,''))
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
    }).filter(r => Object.values(r).some(v => v))

    try {
      const res = await fetch('/api/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionarios: rows }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({ success: true, message: `${data.imported} funcionários importados com sucesso!` })
        setTimeout(() => router.push('/funcionarios'), 2000)
      } else {
        setResult({ success: false, message: data.error ?? 'Erro na importação' })
      }
    } catch {
      setResult({ success: false, message: 'Erro ao conectar com o servidor' })
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold font-display text-brand">Importar dados</h1>
        <p className="text-sm text-gray-500 mt-0.5">Importe funcionários ou efetivo a partir de planilhas CSV</p>
      </div>

      {/* Seletor de modo */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {([
          { key: 'funcionarios', icon: '👷', title: 'Importar Funcionários', desc: 'Planilha ativa Cesari — colunas: nome, matricula, cargo, re, cpf, pis, banco, agencia_conta, pix, hora, bota, uniforme, admissao, prazo1, prazo2' },
          { key: 'efetivo', icon: '📋', title: 'Importar Efetivo', desc: 'Planilha de efetivo diário — em breve disponível' },
        ] as const).map(({ key, icon, title, desc }) => (
          <button key={key} onClick={() => { setMode(key); setFile(null); setPreview([]) }}
            className={`text-left p-5 rounded-2xl border-2 transition-all ${mode === key ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'}`}>
            <div className="text-2xl mb-2">{icon}</div>
            <div className={`text-sm font-bold ${mode === key ? 'text-brand' : 'text-gray-800'}`}>{title}</div>
            <div className="text-xs text-gray-500 mt-1">{desc}</div>
          </button>
        ))}
      </div>

      {mode === 'funcionarios' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-bold font-display text-brand mb-4">Importar Funcionários via CSV</h2>

          {/* Instruções */}
          <div className="mb-5 p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm">
            <div className="font-semibold text-blue-800 mb-1">Como preparar o arquivo:</div>
            <ol className="text-blue-700 text-xs space-y-0.5 list-decimal list-inside">
              <li>Exporte a PLANILHA ATIVA do sistema atual para CSV</li>
              <li>Certifique-se que a 1ª linha contém os cabeçalhos</li>
              <li>Colunas necessárias: <strong>nome, matricula, cargo</strong></li>
              <li>Colunas opcionais: re, cpf, pis, banco, agencia_conta, pix, admissao, prazo1, prazo2, bota, uniforme</li>
            </ol>
          </div>

          {/* Upload */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand hover:bg-brand/5 transition-all mb-4">
            <div className="text-3xl mb-2">📎</div>
            <div className="text-sm font-semibold text-gray-700">{file ? file.name : 'Clique para selecionar arquivo CSV'}</div>
            <div className="text-xs text-gray-400 mt-1">Formato CSV, máx. 5MB</div>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden"/>
          </div>

          {result && (
            <div className={`mb-4 p-3 rounded-xl text-sm border ${result.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {result.success ? '✓' : '✗'} {result.message}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="mb-5">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Pré-visualização ({preview.length} de {file?.name})</div>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {Object.keys(preview[0]).slice(0,7).map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {Object.values(row).slice(0,7).map((v: any, j) => (
                          <td key={j} className="px-3 py-2 text-gray-700">{v || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleImport} disabled={!file || loading}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-40">
              {loading ? 'Importando...' : `Importar funcionários`}
            </button>
          </div>
        </div>
      )}

      {mode === 'efetivo' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">🚧</div>
          <div className="text-gray-600 font-semibold">Importador de efetivo</div>
          <div className="text-sm text-gray-400 mt-1">Em desenvolvimento — disponível em breve</div>
        </div>
      )}
    </div>
  )
}
