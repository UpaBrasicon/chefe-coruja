import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CalendarDays, ArrowLeftRight, Building2, ClipboardList, Wallet, ShieldCheck, ChevronRight, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTrocasPendentes } from '../hooks/useTrocasPendentes'
import { useDesistenciasAbertas } from '../hooks/useDesistenciasAbertas'
import { useAvisos } from '../contexts/AvisosContext'
import { useProximosPlantoes } from '../hooks/useProximosPlantoes'
import { supabase } from '../lib/supabase'
import { SkLine, Skeleton } from '../components/ui/skeleton'
import Layout from '../components/Layout'

/* ── Helpers de data ──────────────────────────────────────────────────────── */
const DIAS  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
const MESES_FULL = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const MESES_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function saudacao(nome) {
  const h = new Date().getHours()
  const parte = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${parte}, ${nome?.split(' ')[0] ?? ''}`
}

function dataHoje() {
  const d = new Date()
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES_FULL[d.getMonth()]} de ${d.getFullYear()}`
}

function formatarDataPlantao(iso) {
  const d = new Date(iso + 'T12:00:00')
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES_SHORT[d.getMonth()]}`
}

function diasAte(iso) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const alvo = new Date(iso + 'T00:00:00')
  const diff = Math.round((alvo - hoje) / 86400000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  return `em ${diff} dias`
}

function hora(h) { return h?.slice(0,5) ?? '' }

/* ── Stat pill ────────────────────────────────────────────────────────────── */
function StatPill({ icone, valor, label, cor, bg, onClick, loading }) {
  if (loading) return <Skeleton style={{ height: 72, borderRadius: 16, flex: 1, minWidth: 100 }} />
  return (
    <button
      onClick={onClick}
      className="flex-1 min-w-0 rounded-2xl px-4 py-3 text-left transition-all"
      style={{ background: bg, border: `1px solid ${cor}22`, minWidth: 100 }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)' }
    >
      <p className="text-xl font-bold" style={{ color: cor }}>{valor}</p>
      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: cor, opacity: 0.7 }}>
        <span>{icone}</span>{label}
      </p>
    </button>
  )
}

/* ── Card próximo plantão ─────────────────────────────────────────────────── */
function CardProximoPlantao({ plantao }) {
  const navigate = useNavigate()
  const setor = plantao.setores?.nome ?? '—'
  const turno = plantao.tipos_turno
  return (
    <button
      onClick={() => navigate('/escala')}
      className="w-full text-left rounded-2xl p-4 transition-all"
      style={{
        background: 'linear-gradient(135deg, #f0fdfa 0%, #e6fffa 100%)',
        border: '1.5px solid #99f6e4',
        boxShadow: '0 2px 12px rgba(13,148,136,0.08)',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 20px rgba(13,148,136,0.15)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(13,148,136,0.08)'}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2.5 shrink-0" style={{ background: '#ccfbf1' }}>
            <CalendarDays size={20} strokeWidth={1.8} style={{ color: '#0d9488' }} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#0d9488' }}>
              Próximo plantão
            </p>
            <p className="font-bold text-sm" style={{ color: '#134e4a' }}>
              {formatarDataPlantao(plantao.data)}
            </p>
            {turno && (
              <p className="text-xs mt-0.5" style={{ color: '#0f766e' }}>
                {turno.nome} · {setor} · {hora(turno.hora_inicio)}–{hora(turno.hora_fim)}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#0d9488', color: '#fff' }}>
            {diasAte(plantao.data)}
          </span>
        </div>
      </div>
    </button>
  )
}

/* ── Card módulo ──────────────────────────────────────────────────────────── */
function CardModulo({ icone: Icone, titulo, descricao, cor, bg, badge, emBreve, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={emBreve}
      className="group text-left w-full rounded-2xl p-5 transition-all duration-200"
      style={{
        background: 'var(--cor-superficie)',
        border: '1px solid var(--cor-borda)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        cursor: emBreve ? 'default' : 'pointer',
        opacity: emBreve ? 0.7 : 1,
      }}
      onMouseEnter={e => {
        if (!emBreve) {
          e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.10)'
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.borderColor = cor
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'var(--cor-borda)'
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-xl p-2.5 shrink-0" style={{ background: bg }}>
          <Icone size={22} strokeWidth={1.8} style={{ color: cor }} />
        </div>
        <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
          {badge > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#fef3c7', color: '#92400e' }}>{badge}</span>
          )}
          {emBreve
            ? <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: '#f1f5f9', color: '#94a3b8' }}>em breve</span>
            : <ChevronRight size={15} style={{ color: '#cbd5e1' }}
                className="group-hover:translate-x-0.5 transition-transform" />
          }
        </div>
      </div>
      <div className="mt-3">
        <p className="font-semibold text-sm" style={{ color: 'var(--cor-texto)' }}>{titulo}</p>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--cor-texto-suave)' }}>{descricao}</p>
      </div>
    </button>
  )
}

/* ── Página ───────────────────────────────────────────────────────────────── */
export default function Home() {
  const { profissional } = useAuth()
  const navigate   = useNavigate()
  const isAdmin    = profissional?.role === 'admin'

  const { count: trocasCount }              = useTrocasPendentes()
  const { count: vagasCount }               = useDesistenciasAbertas()
  const { naoLidas }                        = useAvisos()
  const { proximos, totalMes, loading: loadingPlantoes } = useProximosPlantoes()

  const [pendentesAdmin, setPendentesAdmin] = useState(0)
  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('profissionais')
      .select('id', { count: 'exact', head: true })
      .is('status_aprovacao', null)
      .then(({ count }) => setPendentesAdmin(count ?? 0))
  }, [isAdmin])

  const proximoPlantao = proximos[0] ?? null

  const cards = [
    { icone: CalendarDays, titulo: 'Escala',           descricao: 'Visualize a escala por unidade e setor.',                     rota: '/escala',                   cor: '#0d9488', bg: '#f0fdfa' },
    { icone: Building2,    titulo: 'Vagas em aberto',  descricao: 'Plantões vagos por desistência aguardando candidatos.',        rota: '/desistencias',             cor: '#d97706', bg: '#fffbeb', badge: vagasCount },
    { icone: ArrowLeftRight,titulo:'Trocas de plantão',descricao: 'Solicite ou responda pedidos de troca com colegas.',           rota: '/trocas',                   cor: '#3b82f6', bg: '#eff6ff', badge: trocasCount },
    { icone: ClipboardList, titulo: 'Plantão',         descricao: 'Prescrições, atestados, evoluções e documentos do plantão.',   rota: '/plantao',                  cor: '#7c3aed', bg: '#f5f3ff', emBreve: true },
    { icone: Wallet,        titulo: 'Financeiro',      descricao: 'Contracheques e planilha de custos da unidade.',               rota: '/financeiro/contracheque',  cor: '#16a34a', bg: '#f0fdf4', emBreve: true },
    ...(isAdmin ? [{ icone: ShieldCheck, titulo: 'Admin', descricao: 'Gerenciar médicos, desistências, trocas e escalas.', rota: '/admin', cor: '#0d9488', bg: '#f0fdfa', badge: pendentesAdmin }] : []),
  ]

  return (
    <Layout style={{ background: 'var(--cor-fundo)', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-7">

        {/* Saudação */}
        <div>
          <h1 className="font-bold" style={{ color: 'var(--cor-texto)', fontSize: 'clamp(1.3rem, 3vw, 1.75rem)' }}>
            {saudacao(profissional?.nome)}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cor-texto-suave)' }}>{dataHoje()}</p>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#c7cdd6' }} />
          <input
            type="text"
            placeholder="Buscar médicos, plantões, datas..."
            disabled
            className="w-full rounded-2xl pl-11 pr-5 py-3 text-sm"
            style={{ background: 'var(--cor-superficie)', border: '1.5px solid var(--cor-borda)', color: 'var(--cor-texto)', cursor: 'not-allowed', outline: 'none', opacity: 0.65 }}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded-full"
            style={{ background: '#f1f5f9', color: '#94a3b8', fontSize: '10px' }}>
            em breve
          </span>
        </div>

        {/* Stats */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--cor-texto-suave)' }}>
            Visão geral
          </p>
          <div className="flex gap-3 flex-wrap">
            <StatPill icone="📅" valor={totalMes}    label="plantões/mês"      cor="#0d9488" bg="#f0fdfa" loading={loadingPlantoes} onClick={() => navigate('/escala')} />
            <StatPill icone="🔄" valor={trocasCount} label="trocas pendentes"   cor={trocasCount > 0 ? '#dc2626' : '#64748b'} bg={trocasCount > 0 ? '#fef2f2' : '#f8fafc'} onClick={() => navigate('/trocas')} />
            <StatPill icone="🏥" valor={vagasCount}  label="vagas em aberto"    cor={vagasCount  > 0 ? '#d97706' : '#64748b'} bg={vagasCount  > 0 ? '#fffbeb' : '#f8fafc'} onClick={() => navigate('/desistencias')} />
            <StatPill icone="🔔" valor={naoLidas}    label="avisos não lidos"   cor={naoLidas    > 0 ? '#7c3aed' : '#64748b'} bg={naoLidas    > 0 ? '#f5f3ff' : '#f8fafc'} />
            {isAdmin && pendentesAdmin > 0 && (
              <StatPill icone="👤" valor={pendentesAdmin} label="aguard. aprovação" cor="#dc2626" bg="#fef2f2" onClick={() => navigate('/admin?aba=medicos')} />
            )}
          </div>
        </div>

        {/* Próximo plantão */}
        {loadingPlantoes ? (
          <div className="space-y-2">
            <SkLine w="30%" h={12} />
            <Skeleton style={{ height: 76, borderRadius: 16 }} />
          </div>
        ) : proximoPlantao ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--cor-texto-suave)' }}>
              Próximo plantão
            </p>
            <CardProximoPlantao plantao={proximoPlantao} />
            {proximos.length > 1 && (
              <p className="text-xs mt-2 text-right" style={{ color: 'var(--cor-texto-suave)' }}>
                +{proximos.length - 1} outro{proximos.length > 2 ? 's' : ''} em breve ·{' '}
                <button className="underline underline-offset-2" onClick={() => navigate('/escala')} style={{ color: 'var(--cor-primaria)' }}>
                  ver escala
                </button>
              </p>
            )}
          </div>
        ) : null}

        {/* Módulos */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--cor-texto-suave)' }}>
            Módulos
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {cards.map(card => (
              <CardModulo key={card.titulo} {...card} onClick={() => !card.emBreve && navigate(card.rota)} />
            ))}
          </div>
        </div>

      </div>
    </Layout>
  )
}
