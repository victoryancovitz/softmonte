import { createClient } from '@/lib/supabase-server'
import ConfirmarForm from './ConfirmarForm'

interface PageProps {
  params: { token: string }
}

export default async function ConfirmarPage({ params }: PageProps) {
  const { token } = params
  const supabase = createClient()

  const { data: envio } = await supabase
    .from('whatsapp_envios')
    .select('id, funcionario_id, tipo_documento, token_expira_em, status, bloqueado_em, nome_destinatario, arquivo_url')
    .eq('token_confirmacao', token)
    .single()

  // Token não encontrado
  if (!envio) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">&#10060;</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h1>
          <p className="text-gray-600">
            Este link de confirmação não foi encontrado. Verifique se copiou o link corretamente.
          </p>
        </div>
      </div>
    )
  }

  // Já confirmado
  if (envio.status === 'confirmado') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">&#9989;</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Já confirmado</h1>
          <p className="text-gray-600">
            Este documento já foi confirmado anteriormente.
          </p>
        </div>
      </div>
    )
  }

  // Bloqueado
  if (envio.status === 'bloqueado' || envio.bloqueado_em) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">&#128274;</div>
          <h1 className="text-xl font-bold text-red-600 mb-2">Acesso bloqueado</h1>
          <p className="text-gray-600">
            Este link foi bloqueado por excesso de tentativas incorretas. Entre em contato com o RH.
          </p>
        </div>
      </div>
    )
  }

  // Expirado
  if (envio.token_expira_em && new Date(envio.token_expira_em) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">&#9203;</div>
          <h1 className="text-xl font-bold text-yellow-600 mb-2">Link expirado</h1>
          <p className="text-gray-600">
            Este link de confirmação expirou. Solicite um novo envio ao RH.
          </p>
        </div>
      </div>
    )
  }

  // Formulário de confirmação
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Confirmar recebimento</h1>
          <p className="text-gray-600 text-sm">
            Documento: <span className="font-semibold">{envio.tipo_documento}</span>
          </p>
          {envio.nome_destinatario && (
            <p className="text-gray-500 text-sm mt-1">
              Para: {envio.nome_destinatario}
            </p>
          )}
        </div>
        <ConfirmarForm token={token} />
      </div>
    </div>
  )
}
