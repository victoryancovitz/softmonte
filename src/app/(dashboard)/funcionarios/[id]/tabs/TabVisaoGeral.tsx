import Link from 'next/link'

interface TabVisaoGeralProps {
  f: any
  alocacoes: any[] | null
  fmtD: (d: string | null | undefined) => string
}

export default function TabVisaoGeral({ f, alocacoes, fmtD }: TabVisaoGeralProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Dados pessoais</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['Matrícula', f.matricula],
              ['ID Ponto', f.id_ponto],
              ['CPF', f.cpf],
              ['RG', f.re],
              ['PIS', f.pis],
              ['Título Eleitor', f.titulo_eleitor],
              ['Data nascimento', f.data_nascimento ? fmtD(f.data_nascimento) : null],
              ['Naturalidade', f.naturalidade],
              ['Estado civil', f.estado_civil],
              ['Raça/Cor', f.raca_cor],
              ['Nome do pai', f.nome_pai],
              ['Nome da mãe', f.nome_mae],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-2 py-1 border-b border-gray-50 last:border-0">
                <dt className="text-[11px] text-gray-500">{k}</dt>
                <dd className="text-xs font-medium text-gray-800 text-right">{v as string}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contato & banco</h2>
            <Link href={`/funcionarios/${f.id}/editar`} className="text-[11px] text-brand hover:underline">Editar</Link>
          </div>
          {(() => {
            const items = [
              ['Telefone', f.telefone],
              ['Endereço', f.endereco],
              ['Cidade', f.cidade_endereco],
              ['CEP', f.cep],
              ['Banco', f.banco],
              ['Agência/Conta', f.agencia_conta],
              ['PIX', f.pix],
              ['VT Estrutura', f.vt_estrutura],
            ].filter(([, v]) => v)
            return items.length > 0 ? (
              <dl className="space-y-2 text-sm">
                {items.map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-2 py-1 border-b border-gray-50 last:border-0">
                    <dt className="text-[11px] text-gray-500">{k}</dt>
                    <dd className="text-xs font-medium text-gray-800 text-right">{v as string}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-gray-400 italic">Nenhum dado de contato ou bancario cadastrado. <Link href={`/funcionarios/${f.id}/editar`} className="text-brand hover:underline">Preencher agora</Link></p>
            )
          })()}
        </div>
      </div>

      {/* Alocações */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Obras e alocações</h2>
        {alocacoes && alocacoes.length > 0 ? (
          <div className="space-y-2">
            {alocacoes.map((a: any) => (
              <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg border ${a.ativo ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{a.obras?.nome}</div>
                  <div className="text-xs text-gray-500">{a.cargo_na_obra}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-gray-500">{fmtD(a.data_inicio)} {a.data_fim && `→ ${fmtD(a.data_fim)}`}</div>
                  {a.ativo ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">ATIVO</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">ENCERRADO</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-gray-400 italic">Nenhuma alocação registrada.</p>}
      </div>
    </div>
  )
}
