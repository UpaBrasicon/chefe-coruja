import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTrocasPendentes } from '../hooks/useTrocasPendentes'
import Header from '../components/Header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function formatarData(dataStr) {
  if (!dataStr) return ''
  const [, m, d] = dataStr.split('-')
  return `${parseInt(d, 10)} de ${MESES_PT[parseInt(m, 10) - 1]}`
}

function StatusBadge({ status }) {
  const estilos = {
    pendente:  { bg: '#FEF9C3', cor: '#854D0E', label: '⏳ Pendente' },
    aceita:    { bg: '#DCFCE7', cor: '#166534', label: '✅ Aceita' },
    recusada:  { bg: '#FEE2E2', cor: '#991B1B', label: '❌ Recusada' },
    cancelada: { bg: '#F1F5F9', cor: '#64748B', label: '🚫 Cancelada' },
  }
  const s = estilos[status] ?? estilos.cancelada
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.cor }}>
      {s.label}
    </span>
  )
}

function CardTroca({ troca, tipo, onAceitar, onRecusar, onCancelar, carregandoId }) {
  const plantao = troca.plantoes
  const setor = plantao?.setores
  const turno = plantao?.tipos_turno
  const outraMedico = tipo === 'recebida' ? troca.de_profissional : troca.para_profissional
  const ocupado = carregandoId === troca.id

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}
    >
      {/* Info do plantão */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold" style={{ color: 'var(--cor-texto)' }}>
            {formatarData(plantao?.data)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ background: setor?.cor ?? '#64748B' }}
            >
              {setor?.nome ?? '—'}
            </span>
            <span className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>
              {turno?.hora_inicio?.slice(0,5)}–{turno?.hora_fim?.slice(0,5)}
            </span>
          </div>
        </div>
        <StatusBadge status={troca.status} />
      </div>

      {/* Médico envolvido */}
      <p className="text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
        {tipo === 'recebida'
          ? <><strong style={{ color: 'var(--cor-texto)' }}>{outraMedico?.nome}</strong> quer te transferir este plantão</>
          : <>Pedido para <strong style={{ color: 'var(--cor-texto)' }}>{outraMedico?.nome}</strong></>
        }
      </p>

      {/* Mensagem */}
      {troca.mensagem && (
        <p
          className="text-sm italic px-3 py-2 rounded-lg"
          style={{ background: '#F8FAFC', color: 'var(--cor-texto-suave)', borderLeft: '3px solid var(--cor-borda)' }}
        >
          "{troca.mensagem}"
        </p>
      )}

      {/* Data do pedido */}
      <p className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>
        Solicitado em {new Date(troca.solicitado_em).toLocaleDateString('pt-BR')}
        {troca.respondido_em && ` · Respondido em ${new Date(troca.respondido_em).toLocaleDateString('pt-BR')}`}
      </p>

      {/* Ações */}
      {troca.status === 'pendente' && (
        <div className="flex gap-2 pt-1">
          {tipo === 'recebida' && (
            <>
              <Button
                size="sm"
                onClick={() => onAceitar(troca)}
                disabled={ocupado}
                style={{ background: 'var(--cor-sucesso)', color: '#fff' }}
              >
                {ocupado ? 'Processando...' : 'Aceitar'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRecusar(troca)}
                disabled={ocupado}
                style={{ borderColor: 'var(--cor-vago)', color: 'var(--cor-vago)' }}
              >
                Recusar
              </Button>
            </>
          )}
          {tipo === 'enviada' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCancelar(troca)}
              disabled={ocupado}
              style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}
            >
              {ocupado ? 'Cancelando...' : 'Cancelar pedido'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function MinhasTrocas() {
  const { profissional } = useAuth()
  const { refetch: refetchBadge } = useTrocasPendentes()
  const navigate = useNavigate()

  const [recebidas, setRecebidas] = useState([])
  const [enviadas, setEnviadas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [carregandoId, setCarregandoId] = useState(null)
  const [erro, setErro] = useState('')

  const SELECT_TROCAS = `
    id, status, mensagem, solicitado_em, respondido_em,
    plantoes(id, data, profissional_id,
      setores(nome, cor),
      tipos_turno(hora_inicio, hora_fim)
    ),
    de_profissional:profissionais!trocas_de_profissional_id_fkey(id, nome),
    para_profissional:profissionais!trocas_para_profissional_id_fkey(id, nome)
  `

  async function carregar() {
    if (!profissional?.id) return
    setCarregando(true)
    const [resRecebidas, resEnviadas] = await Promise.all([
      supabase.from('trocas').select(SELECT_TROCAS)
        .eq('para_profissional_id', profissional.id)
        .order('solicitado_em', { ascending: false }),
      supabase.from('trocas').select(SELECT_TROCAS)
        .eq('de_profissional_id', profissional.id)
        .order('solicitado_em', { ascending: false }),
    ])
    setRecebidas(resRecebidas.data ?? [])
    setEnviadas(resEnviadas.data ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [profissional?.id])

  async function handleAceitar(troca) {
    setErro('')
    setCarregandoId(troca.id)

    // 1. Atualiza status da troca
    const { error: erroTroca } = await supabase
      .from('trocas')
      .update({ status: 'aceita', respondido_em: new Date().toISOString() })
      .eq('id', troca.id)

    if (erroTroca) { setErro('Erro ao aceitar: ' + erroTroca.message); setCarregandoId(null); return }

    // 2. Transfere o plantão para quem aceitou (este usuário)
    const { error: erroPlantao } = await supabase
      .from('plantoes')
      .update({ profissional_id: profissional.id, status: 'confirmado' })
      .eq('id', troca.plantoes?.id)

    if (erroPlantao) {
      setErro('Troca registrada, mas não foi possível atualizar o plantão automaticamente. Avise o admin. (' + erroPlantao.message + ')')
    }

    setCarregandoId(null)
    await carregar()
    refetchBadge()
  }

  async function handleRecusar(troca) {
    setErro('')
    setCarregandoId(troca.id)
    const { error } = await supabase
      .from('trocas')
      .update({ status: 'recusada', respondido_em: new Date().toISOString() })
      .eq('id', troca.id)
    if (error) setErro('Erro ao recusar: ' + error.message)
    setCarregandoId(null)
    await carregar()
    refetchBadge()
  }

  async function handleCancelar(troca) {
    setErro('')
    setCarregandoId(troca.id)
    const { error } = await supabase
      .from('trocas')
      .update({ status: 'cancelada' })
      .eq('id', troca.id)
    if (error) setErro('Erro ao cancelar: ' + error.message)
    setCarregandoId(null)
    await carregar()
  }

  const pendenteCount = recebidas.filter(t => t.status === 'pendente').length

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #0c1445 0%, #0e2d6e 45%, #0e4d8a 100%)' }}>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/escala')} className="text-sm underline" style={{ color: 'var(--cor-texto-suave)' }}>
            ← Voltar para escala
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--cor-texto)' }}>Minhas Trocas</h1>
        </div>

        {erro && (
          <p className="mb-4 text-sm rounded-lg p-3" style={{ color: 'var(--cor-vago)', background: '#FEF2F2' }}>
            {erro}
          </p>
        )}

        {carregando ? (
          <div className="text-center py-16" style={{ color: 'var(--cor-texto-suave)' }}>
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-full object-cover mx-auto mb-2" />
            <p>Carregando...</p>
          </div>
        ) : (
          <Tabs defaultValue="recebidas">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="recebidas" className="flex-1">
                Recebidas
                {pendenteCount > 0 && (
                  <span
                    className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: 'var(--cor-vago)' }}
                  >
                    {pendenteCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="enviadas" className="flex-1">
                Enviadas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recebidas">
              {recebidas.length === 0 ? (
                <p className="text-center py-12" style={{ color: 'var(--cor-texto-suave)' }}>
                  Nenhum pedido recebido ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {recebidas.map(t => (
                    <CardTroca
                      key={t.id}
                      troca={t}
                      tipo="recebida"
                      onAceitar={handleAceitar}
                      onRecusar={handleRecusar}
                      onCancelar={handleCancelar}
                      carregandoId={carregandoId}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="enviadas">
              {enviadas.length === 0 ? (
                <p className="text-center py-12" style={{ color: 'var(--cor-texto-suave)' }}>
                  Nenhum pedido enviado ainda.
                </p>
              ) : (
                <div className="space-y-3">
                  {enviadas.map(t => (
                    <CardTroca
                      key={t.id}
                      troca={t}
                      tipo="enviada"
                      onAceitar={handleAceitar}
                      onRecusar={handleRecusar}
                      onCancelar={handleCancelar}
                      carregandoId={carregandoId}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}
