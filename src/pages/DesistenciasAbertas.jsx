import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useDesistenciasAbertas } from '../hooks/useDesistenciasAbertas'
import Header from '../components/Header'
import { Button } from '../components/ui/button'

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function diasRestantes(dataStr) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  return Math.ceil((new Date(dataStr) - hoje) / 86400000)
}

function formatarData(dataStr) {
  if (!dataStr) return ''
  const [, m, d] = dataStr.split('-')
  return `${parseInt(d,10)} de ${MESES_PT[parseInt(m,10)-1]}`
}

export default function DesistenciasAbertas() {
  const { profissional } = useAuth()
  const { refetch: refetchBadge } = useDesistenciasAbertas()
  const navigate = useNavigate()
  const [desistencias, setDesistencias] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [candidatandoId, setCandidatandoId] = useState(null)
  const [mensagens, setMensagens] = useState({})

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('desistencias')
      .select(`
        id, responsavel_ate, motivo, avisado_em,
        plantoes(id, data, setores(nome, cor), tipos_turno(hora_inicio, hora_fim)),
        profissional:profissionais!desistencias_profissional_id_fkey(id, nome),
        candidaturas(id, profissional_id, status, ordem_fila)
      `)
      .eq('status', 'aguardando_candidato')
      .order('avisado_em', { ascending: false })

    if (error) setErro('Erro ao carregar: ' + error.message)
    else setDesistencias(data ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function handleCandidatar(desistencia) {
    setErro('')
    setCandidatandoId(desistencia.id)

    const jaCandidatou = (desistencia.candidaturas ?? []).some(
      c => c.profissional_id === profissional.id
    )
    if (jaCandidatou) {
      setMensagens(prev => ({ ...prev, [desistencia.id]: 'Você já se candidatou para esta vaga.' }))
      setCandidatandoId(null)
      return
    }

    const ordemFila = (desistencia.candidaturas ?? []).length + 1

    const { error } = await supabase.from('candidaturas').insert({
      desistencia_id: desistencia.id,
      profissional_id: profissional.id,
      candidatado_em: new Date().toISOString(),
      status: 'na_fila',
      ordem_fila: ordemFila,
    })

    if (error) {
      setMensagens(prev => ({ ...prev, [desistencia.id]: 'Erro: ' + error.message }))
    } else {
      setMensagens(prev => ({ ...prev, [desistencia.id]: '✅ Candidatura registrada! O admin será notificado.' }))
      await carregar()
      refetchBadge()
    }
    setCandidatandoId(null)
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #0c1445 0%, #0e2d6e 45%, #0e4d8a 100%)' }}>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/escala')} className="text-sm underline" style={{ color: 'var(--cor-texto-suave)' }}>
            ← Voltar para escala
          </button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--cor-texto)' }}>Vagas em aberto</h1>
        </div>

        <p className="text-sm mb-5" style={{ color: 'var(--cor-texto-suave)' }}>
          Plantões disponíveis por desistência. Candidate-se e aguarde a seleção do coordenador.
        </p>

        {erro && <p className="mb-4 text-sm rounded-lg p-3" style={{ color: 'var(--cor-vago)', background: '#FEF2F2' }}>{erro}</p>}

        {carregando ? (
          <div className="text-center py-16" style={{ color: 'var(--cor-texto-suave)' }}>
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-full object-cover mx-auto mb-2" /><p>Carregando...</p>
          </div>
        ) : desistencias.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--cor-texto-suave)' }}>
            <p className="text-3xl mb-3">✅</p>
            <p>Nenhuma vaga em aberto no momento.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {desistencias.map(d => {
              const plantao = d.plantoes
              const setor = plantao?.setores
              const turno = plantao?.tipos_turno
              const candidatos = d.candidaturas ?? []
              const jaCandidatou = candidatos.some(c => c.profissional_id === profissional?.id)
              // Vagas criadas pelo admin não têm "dono" — qualquer médico pode se candidatar
              const ehDono = d.motivo !== '__vaga_admin__' && d.profissional?.id === profissional?.id
              const diasResp = diasRestantes(d.responsavel_ate)
              const msg = mensagens[d.id]

              return (
                <div key={d.id} className="rounded-xl p-4 space-y-3"
                  style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>

                  {/* Cabeçalho do plantão */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--cor-texto)' }}>
                        {formatarData(plantao?.data)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                          style={{ background: setor?.cor ?? '#64748B' }}>
                          {setor?.nome ?? '—'}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>
                          {turno?.hora_inicio?.slice(0,5)}–{turno?.hora_fim?.slice(0,5)}
                        </span>
                      </div>
                    </div>
                    {/* Prazo de responsabilidade */}
                    <div className="text-right text-xs" style={{ color: diasResp <= 3 ? 'var(--cor-vago)' : 'var(--cor-texto-suave)' }}>
                      <p className="font-medium">{diasResp > 0 ? `Resp. por ${diasResp}d` : 'Vago agora'}</p>
                      <p>até {new Date(d.responsavel_ate).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>

                  {/* Origem da vaga */}
                  <p className="text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
                    {d.motivo === '__vaga_admin__'
                      ? <span style={{ color: 'var(--cor-primaria)', fontWeight: 500 }}>🏥 Vaga disponível — criada pelo coordenador</span>
                      : <>Desistência de <strong style={{ color: 'var(--cor-texto)' }}>{d.profissional?.nome}</strong></>
                    }
                  </p>

                  {/* Motivo */}
                  {d.motivo && (
                    <p className="text-xs italic px-3 py-2 rounded-lg"
                      style={{ background: '#F8FAFC', color: 'var(--cor-texto-suave)', borderLeft: '3px solid var(--cor-borda)' }}>
                      "{d.motivo}"
                    </p>
                  )}

                  {/* Candidatos */}
                  <p className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>
                    {candidatos.length === 0
                      ? 'Nenhum candidato ainda'
                      : `${candidatos.length} candidato${candidatos.length > 1 ? 's' : ''} na fila`}
                  </p>

                  {/* Mensagem de feedback */}
                  {msg && (
                    <p className="text-sm rounded-md p-2"
                      style={{ color: msg.startsWith('✅') ? 'var(--cor-sucesso)' : 'var(--cor-vago)',
                               background: msg.startsWith('✅') ? '#F0FDF4' : '#FEF2F2' }}>
                      {msg}
                    </p>
                  )}

                  {/* Ação */}
                  {!ehDono && (
                    jaCandidatou ? (
                      <p className="text-sm font-medium" style={{ color: 'var(--cor-primaria)' }}>
                        ✓ Você já está na fila
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleCandidatar(d)}
                        disabled={candidatandoId === d.id}
                        style={{ background: 'var(--cor-primaria)', color: '#fff' }}
                      >
                        {candidatandoId === d.id ? 'Registrando...' : 'Me candidatar'}
                      </Button>
                    )
                  )}
                  {ehDono && (
                    <p className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>Este é o seu plantão</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
