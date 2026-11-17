import * as React from 'react'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import {
  Baby, Brain, Bug, Calculator, ChevronRight, Droplet, HandHeart, Heart, HeartPulse, Moon, Syringe, Thermometer,
  TriangleAlert, User, Waves, Wind, type LucideIcon,
} from 'lucide-react'

import { GUIA_ADULTO, GUIA_CRIANCA, ROTA_TODAS_FERRAMENTAS, type IconeGuia } from '@/content/guiaRapido'
import { TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import type { UnidadeIdade } from '@/domain/pacienteCentral'
import { alterarPaciente, definirModo, usePacienteCentral } from '@/lib/pacienteCentral'
import { cn } from '@/lib/utils'

// Guia rápido (F4, celular e tablet; pedido do RT de 17/11/2026, M1–M6 = A,
// protótipo aprovado). No alto, a chave criança ↔ adulto e o peso e a idade,
// que vão para as ferramentas pela Central do paciente desta aba (trocar o
// lado zera tudo, como antes). Depois, "Calculadoras e escores" e os cartões
// por situação do plantão, cada um abrindo uma conduta que já existe.

const ICONES: Record<IconeGuia, LucideIcon> = {
  parada: HeartPulse, seringa: Syringe, 'via-aerea': Wind, pulmao: Waves, gota: Droplet, termometro: Thermometer,
  coracao: Heart, cerebro: Brain, lua: Moon, alerta: TriangleAlert, inseto: Bug, maos: HandHeart, bebe: Baby,
}
const UNIDADES: UnidadeIdade[] = ['anos', 'meses', 'dias']

function Chave() {
  const p = usePacienteCentral()
  const crianca = p.modo === 'pediatrico'
  const adulto = p.modo === 'adulto'
  const lado = 'relative z-10 flex h-full flex-1 items-center justify-center gap-2 rounded-capsula text-corpo font-bold transition-colors'
  return (
    <div role="group" aria-label="Paciente: criança ou adulto"
      className="relative flex h-16 w-full items-stretch gap-1 rounded-capsula border-2 border-tinta bg-trilha p-1">
      {p.modo && (
        <span aria-hidden className={cn('absolute top-1 bottom-1 w-[calc(50%-6px)] rounded-capsula transition-[left] duration-200',
          crianca ? 'left-1 bg-pediatria' : 'left-[calc(50%+2px)] bg-acao')} />
      )}
      <Button type="button" variant="ghost" aria-pressed={crianca} onClick={() => { if (!crianca) definirModo('pediatrico') }}
        className={cn(lado, crianca ? 'text-sobre-acao hover:text-sobre-acao' : 'text-tinta-apoio')}>
        <Baby className="size-6" aria-hidden /> Criança
      </Button>
      <Button type="button" variant="ghost" aria-pressed={adulto} onClick={() => { if (!adulto) definirModo('adulto') }}
        className={cn(lado, adulto ? 'text-sobre-acao hover:text-sobre-acao' : 'text-tinta-apoio')}>
        <User className="size-6" aria-hidden /> Adulto
      </Button>
    </div>
  )
}

function CampoGrande({ id, rotulo, valor, unidade, aoMudar, modo }: {
  id: string; rotulo: string; valor: string; unidade: React.ReactNode; aoMudar: (v: string) => void; modo: 'decimal' | 'numeric'
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-corpo font-bold text-tinta">{rotulo}</label>
      <div className="flex h-15 items-center gap-1.5 rounded-container border-2 border-tinta bg-superficie px-3.5">
        <Input id={id} inputMode={modo} value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder="—"
          // padrao-ok: número grande no celular (pedido do RT), sem borda própria dentro da caixa
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-[24px] font-bold shadow-none focus-visible:shadow-none" />
        {typeof unidade === 'string' ? <span className="text-controle font-semibold text-tinta-apoio">{unidade}</span> : unidade}
      </div>
    </div>
  )
}

export function GuiaRapido() {
  const p = usePacienteCentral()
  const idPeso = useId()
  const idIdade = useId()
  const crianca = p.modo === 'pediatrico'
  const cartoes = crianca ? GUIA_CRIANCA : GUIA_ADULTO
  return (
    <div className="flex flex-col gap-4">
      <TituloPagina titulo="Guia rápido" className="mb-0" />
      <Chave />
      {p.modo ? (
        <div className="grid grid-cols-2 gap-2.5">
          <CampoGrande id={idPeso} rotulo="Peso" unidade="kg" modo="decimal" valor={p.peso}
            aoMudar={(v) => alterarPaciente({ peso: v })} />
          {/* criança: a unidade da idade é escolhida dentro da caixa (pedido do RT, 17/11/2026) */}
          <CampoGrande id={idIdade} rotulo="Idade" modo="numeric" valor={p.idade}
            aoMudar={(v) => alterarPaciente({ idade: v })}
            unidade={crianca ? (
              <CampoSelecao aria-label="Unidade da idade" value={p.unidadeIdade}
                onChange={(e) => alterarPaciente({ unidadeIdade: e.target.value as UnidadeIdade })}
                className="h-11 shrink-0 rounded-container border-2 border-tinta bg-superficie px-2.5 text-controle font-bold">
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </CampoSelecao>
            ) : 'anos'} />
        </div>
      ) : (
        <p className="text-controle text-tinta-apoio">Toque em Criança ou Adulto para começar. Trocar o lado apaga peso e idade.</p>
      )}
      <Link to={ROTA_TODAS_FERRAMENTAS}
        className="flex min-h-18 items-center gap-3.5 rounded-cartao bg-acao px-4 py-3.5 text-sobre-acao no-underline hover:bg-acao-pressionada hover:text-sobre-acao">
        <span className="flex size-11 items-center justify-center rounded-container bg-superficie/15">
          <Calculator className="size-6" aria-hidden />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-corpo font-bold">Calculadoras e escores</span>
          <span className="text-controle opacity-90">Todos, por grupo, com busca</span>
        </span>
        <ChevronRight className="size-5" aria-hidden />
      </Link>
      <TituloSecao className="mt-1 mb-0">
        {crianca ? 'Guia rápido · criança até 13 anos e 11 meses' : 'Guia rápido · adulto'}
      </TituloSecao>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {cartoes.map((c) => {
          const Icone = ICONES[c.icone]
          return (
            <li key={c.rota}>
              <Link to={c.rota}
                className="flex min-h-27 flex-col justify-between gap-3.5 rounded-cartao border border-fio-forte bg-superficie p-3.5 text-tinta no-underline hover:border-acao">
                <span className={cn('flex size-10 items-center justify-center rounded-container', crianca ? 'bg-pediatria/10 text-pediatria' : 'bg-alerta-marca text-acao')}>
                  <Icone className="size-5.5" aria-hidden />
                </span>
                <span className="text-corpo leading-tight font-semibold">{c.nome}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
