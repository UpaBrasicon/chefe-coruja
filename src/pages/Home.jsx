import { useNavigate } from 'react-router-dom'
import { Search, CalendarDays, ArrowLeftRight, Building2, ClipboardList, Wallet, ShieldCheck, ChevronRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTrocasPendentes } from '../hooks/useTrocasPendentes'
import { useDesistenciasAbertas } from '../hooks/useDesistenciasAbertas'
import Layout from '../components/Layout'

const DIAS_SEMANA = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function saudacao(nome) {
  const h = new Date().getHours()
  const parte = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiro = nome?.split(' ')[0] ?? ''
  return `${parte}, ${primeiro}`
}

function dataFormatada() {
  const d = new Date()
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

function Card({ icone: Icone, titulo, descricao, rota, cor, bg, badge, emBreve, onClick }) {
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
        opacity: emBreve ? 0.72 : 1,
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
        {/* Ícone */}
        <div className="rounded-xl p-2.5 shrink-0" style={{ background: bg }}>
          <Icone size={24} strokeWidth={1.8} style={{ color: cor }} />
        </div>

        {/* Badge / em breve */}
        <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
          {badge > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#fef3c7', color: '#92400e' }}>
              {badge}
            </span>
          )}
          {emBreve && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#f1f5f9', color: '#94a3b8' }}>
              em breve
            </span>
          )}
          {!emBreve && (
            <ChevronRight size={16} style={{ color: '#cbd5e1' }}
              className="group-hover:translate-x-0.5 transition-transform" />
          )}
        </div>
      </div>

      <div className="mt-3">
        <p className="font-semibold text-sm" style={{ color: 'var(--cor-texto)' }}>
          {titulo}
        </p>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--cor-texto-suave)' }}>
          {descricao}
        </p>
      </div>
    </button>
  )
}

export default function Home() {
  const { profissional } = useAuth()
  const { count: trocasCount } = useTrocasPendentes()
  const { count: vagasCount } = useDesistenciasAbertas()
  const navigate = useNavigate()
  const isAdmin = profissional?.role === 'admin'

  const cards = [
    {
      icone: CalendarDays,
      titulo: 'Escala',
      descricao: 'Visualize a escala de plantões por unidade e setor.',
      rota: '/escala',
      cor: '#0d9488',
      bg: '#f0fdfa',
    },
    {
      icone: Building2,
      titulo: 'Vagas em aberto',
      descricao: 'Plantões vagos por desistência aguardando candidatos.',
      rota: '/desistencias',
      cor: '#d97706',
      bg: '#fffbeb',
      badge: vagasCount,
    },
    {
      icone: ArrowLeftRight,
      titulo: 'Trocas de plantão',
      descricao: 'Solicite ou responda pedidos de troca com colegas.',
      rota: '/trocas',
      cor: '#3b82f6',
      bg: '#eff6ff',
      badge: trocasCount,
    },
    {
      icone: ClipboardList,
      titulo: 'Plantão',
      descricao: 'Prescrições, atestados, evoluções e documentos do plantão.',
      rota: '/plantao',
      cor: '#7c3aed',
      bg: '#f5f3ff',
      emBreve: true,
    },
    {
      icone: Wallet,
      titulo: 'Financeiro',
      descricao: 'Contracheques e planilha de custos da unidade.',
      rota: '/financeiro/contracheque',
      cor: '#16a34a',
      bg: '#f0fdf4',
      emBreve: true,
    },
    ...(isAdmin ? [{
      icone: ShieldCheck,
      titulo: 'Admin',
      descricao: 'Gerenciar médicos, desistências, trocas e escalas.',
      rota: '/admin',
      cor: '#0d9488',
      bg: '#f0fdfa',
    }] : []),
  ]

  return (
    <Layout style={{ background: 'var(--cor-fundo)', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-5 py-8">

        {/* Saudação */}
        <div className="mb-7">
          <h1 className="font-bold" style={{ color: 'var(--cor-texto)', fontSize: 'clamp(1.3rem, 3vw, 1.75rem)' }}>
            {saudacao(profissional?.nome)}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cor-texto-suave)' }}>
            {dataFormatada()}
          </p>
        </div>

        {/* Busca */}
        <div className="relative mb-8">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: '#94a3b8' }}
          />
          <input
            type="text"
            placeholder="Buscar médicos, plantões, datas... (em breve)"
            disabled
            className="w-full rounded-2xl pl-11 pr-5 py-3.5 text-sm"
            style={{
              background: 'var(--cor-superficie)',
              border: '1.5px solid var(--cor-borda)',
              color: 'var(--cor-texto)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              cursor: 'not-allowed',
              outline: 'none',
            }}
          />
        </div>

        {/* Label seção */}
        <p className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: 'var(--cor-texto-suave)' }}>
          Módulos
        </p>

        {/* Cards */}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {cards.map(card => (
            <Card
              key={card.titulo}
              {...card}
              onClick={() => !card.emBreve && navigate(card.rota)}
            />
          ))}
        </div>

      </div>
    </Layout>
  )
}
