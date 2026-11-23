import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight, Baby, Bookmark, Calculator, ChartColumn, FlaskConical, HeartPulse, LayoutGrid, Search, Siren, Skull, Sparkles, User, X,
  type LucideIcon,
} from 'lucide-react'

import { ROTA_PCR, categoriasDoInicio, rotaDaBusca, type CategoriaInicio, type IconeCategoria, type LadoInicio } from '@/content/inicioCelular'
import { ROTA_SOBRE_MODULO } from '@/content/sobreModuloClinico'
import { useAuth } from '@/contexts/AuthContext'
import { definirModo, usePacienteCentral } from '@/lib/pacienteCentral'
import { cn } from '@/lib/utils'
import { TituloPagina } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'

// Início do celular do médico (item 6; mescla A + B do protótipo, escolhida
// pelo RT em 23/11/2026). Cartões grandes por tipo de conteúdo; o toque abre,
// logo abaixo da linha do cartão, a grade de duas colunas com as ferramentas
// do grupo. Adulto primeiro (CM2 = A): o peso e a idade saem do início e são
// pedidos dentro de cada guia ou ferramenta.

const ICONES: Record<IconeCategoria, LucideIcon> = {
  urgencias: Siren, doses: FlaskConical, calculadoras: Calculator, escores: ChartColumn, intoxicacao: Skull, todas: LayoutGrid,
}

// Classes por extenso para o Tailwind enxergá-las; só tokens do app.
const TOM: Record<IconeCategoria, { cartao: string; aberto: string; icone: string; nome: string; painel: string; sigla: string }> = {
  urgencias: { cartao: 'bg-critico/8', aberto: 'border-critico bg-critico/15', icone: 'bg-critico text-sobre-acao', nome: 'text-critico', painel: 'border-critico/25 bg-critico/5', sigla: 'bg-critico/10 text-critico' },
  doses: { cartao: 'bg-secao-farmacia/8', aberto: 'border-secao-farmacia bg-secao-farmacia/15', icone: 'bg-secao-farmacia text-sobre-acao', nome: 'text-secao-farmacia', painel: 'border-secao-farmacia/25 bg-secao-farmacia/5', sigla: 'bg-secao-farmacia/10 text-secao-farmacia' },
  calculadoras: { cartao: 'bg-secao-calculadoras/8', aberto: 'border-secao-calculadoras bg-secao-calculadoras/15', icone: 'bg-secao-calculadoras text-sobre-acao', nome: 'text-secao-calculadoras', painel: 'border-secao-calculadoras/25 bg-secao-calculadoras/5', sigla: 'bg-secao-calculadoras/10 text-secao-calculadoras' },
  escores: { cartao: 'bg-secao-neurologia/8', aberto: 'border-secao-neurologia bg-secao-neurologia/15', icone: 'bg-secao-neurologia text-sobre-acao', nome: 'text-secao-neurologia', painel: 'border-secao-neurologia/25 bg-secao-neurologia/5', sigla: 'bg-secao-neurologia/10 text-secao-neurologia' },
  intoxicacao: { cartao: 'bg-secao-toxicologia/8', aberto: 'border-secao-toxicologia bg-secao-toxicologia/15', icone: 'bg-secao-toxicologia text-sobre-acao', nome: 'text-secao-toxicologia', painel: 'border-secao-toxicologia/25 bg-secao-toxicologia/5', sigla: 'bg-secao-toxicologia/10 text-secao-toxicologia' },
  todas: { cartao: 'bg-acao/8', aberto: 'border-acao bg-acao/15', icone: 'bg-acao text-sobre-acao', nome: 'text-acao', painel: 'border-acao/25 bg-acao/5', sigla: 'bg-acao/10 text-acao' },
}

function saudacao(agora = new Date()) {
  const h = agora.getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

/** Ao abrir uma tela pelo início, o lado escolhido vira o paciente da Central desta aba. */
function useAbrir(lado: LadoInicio) {
  const p = usePacienteCentral()
  const navigate = useNavigate()
  return (rota: string) => {
    const modo = lado === 'crianca' ? 'pediatrico' : 'adulto'
    if (p.modo !== modo) definirModo(modo)
    navigate(rota)
  }
}

function ChaveDoLado({ lado }: { lado: LadoInicio }) {
  const botao = 'flex h-11 items-center justify-center gap-1.5 rounded-container text-controle transition-colors'
  return (
    <div role="group" aria-label="Paciente: adulto ou criança" className="grid grid-cols-2 gap-1 rounded-container bg-trilha p-1">
      <Button type="button" variant="ghost" aria-pressed={lado === 'adulto'} onClick={() => { if (lado !== 'adulto') definirModo('adulto') }}
        className={cn(botao, lado === 'adulto' ? 'bg-superficie font-semibold text-acao shadow-sm hover:bg-superficie hover:text-acao' : 'font-medium text-tinta-apoio')}>
        <User className="size-4.5" aria-hidden /> Adulto
      </Button>
      <Button type="button" variant="ghost" aria-pressed={lado === 'crianca'} onClick={() => { if (lado !== 'crianca') definirModo('pediatrico') }}
        className={cn(botao, lado === 'crianca' ? 'bg-superficie font-semibold text-pediatria shadow-sm hover:bg-superficie hover:text-pediatria' : 'font-medium text-tinta-apoio')}>
        <Baby className="size-4.5" aria-hidden /> Criança · até 13a 11m
      </Button>
    </div>
  )
}

// PCR em bloco inteiro acima dos cartões; Sepse e CAD ficam em Urgências e
// Calculadoras (RT, 23/11/2026, conferindo o lote 1 na homologação).
function IniciarPcr({ lado }: { lado: LadoInicio }) {
  const abrir = useAbrir(lado)
  return (
    <BotaoLinha onClick={() => abrir(ROTA_PCR[lado])}
      className="min-h-18 w-full flex-row items-center gap-3 rounded-cartao border-critico bg-critico p-4 text-sobre-acao hover:border-critico hover:bg-critico">
      <HeartPulse className="size-7 shrink-0" aria-hidden />
      <span className="flex flex-1 flex-col">
        <span className="text-secao font-bold">Iniciar PCR</span>
        <span className="text-apoio opacity-90">{lado === 'crianca' ? 'Guia da parada pelo peso ou pela fita' : 'Cronômetro da parada do adulto'}</span>
      </span>
      <ArrowUpRight className="size-5 shrink-0" aria-hidden />
    </BotaoLinha>
  )
}

function CartaoCategoria({ c, aberta, aoTocar, idPainel }: { c: CategoriaInicio; aberta: boolean; aoTocar: () => void; idPainel: string }) {
  const t = TOM[c.icone]
  const Icone = ICONES[c.icone]
  return (
    <BotaoLinha onClick={aoTocar} aria-expanded={c.itens.length ? aberta : undefined} aria-controls={c.itens.length ? idPainel : undefined}
      className={cn('min-h-31 justify-between gap-3.5 rounded-cartao border-2 p-3.5',
        aberta ? cn(t.aberto, 'hover:bg-superficie') : cn('border-transparent hover:border-transparent', t.cartao))}>
      <span className="flex w-full items-center justify-between">
        <span className={cn('flex size-10 items-center justify-center rounded-container', t.icone)}>
          <Icone className="size-5" aria-hidden />
        </span>
        {aberta ? <X className="size-4.5 text-tinta" aria-hidden /> : <ArrowUpRight className="size-4.5 text-tinta-apoio" aria-hidden />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={cn('text-secao leading-tight font-bold', t.nome)}>{c.nome}</span>
        <span className="text-rotulo leading-snug text-tinta-apoio">{c.exemplos}</span>
      </span>
    </BotaoLinha>
  )
}

function PainelCategoria({ c, id, lado, aoFechar }: { c: CategoriaInicio; id: string; lado: LadoInicio; aoFechar: () => void }) {
  const t = TOM[c.icone]
  const abrir = useAbrir(lado)
  return (
    <div id={id} role="region" aria-label={c.nome} className={cn('flex flex-col gap-2.5 rounded-cartao border p-3', t.painel)}>
      <div className="flex items-center justify-between">
        <span className="text-rotulo font-semibold tracking-wide text-tinta-apoio uppercase">{c.nome}</span>
        <Button type="button" variant="outline" size="sm" onClick={aoFechar}>Fechar</Button>
      </div>
      <ul className="grid grid-cols-2 gap-2.5">
        {c.itens.map((i) => (
          <li key={i.rota}>
            <BotaoLinha onClick={() => abrir(i.rota)} className="h-full min-h-22 w-full gap-2.5 p-3">
              <span className="flex w-full items-start justify-between gap-1.5">
                <span aria-hidden className={cn('inline-flex h-7 min-w-8 items-center justify-center rounded-container px-1.5 text-rotulo font-bold', t.sigla)}>{i.sigla}</span>
                <Bookmark className="size-4 text-tinta-sussurro" aria-hidden />
              </span>
              <span className="text-apoio leading-snug font-medium text-tinta">{i.nome}</span>
            </BotaoLinha>
          </li>
        ))}
        <li>
          <Link to="/plantonista?todas=1"
            className="flex h-full min-h-22 items-center justify-center rounded-container border border-dashed border-fio-forte p-3 text-center text-apoio font-semibold text-acao no-underline">
            Ver todas, com busca
          </Link>
        </li>
      </ul>
    </div>
  )
}

export function InicioCelular() {
  const { perfil } = useAuth()
  const p = usePacienteCentral()
  const navigate = useNavigate()
  const lado: LadoInicio = p.modo === 'pediatrico' ? 'crianca' : 'adulto'
  const categorias = categoriasDoInicio(lado)
  const [aberta, setAberta] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const base = useId()
  const primeiroNome = perfil?.nome_completo?.trim().split(/\s+/)[0]

  const linhas: CategoriaInicio[][] = []
  for (let i = 0; i < categorias.length; i += 2) linhas.push(categorias.slice(i, i + 2))

  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex flex-col gap-3">
        <TituloPagina titulo={`${saudacao()}${primeiroNome ? `, ${primeiroNome}` : ''}`} className="mb-0" />
        <ChaveDoLado lado={lado} />
      </div>

      <form role="search" onSubmit={(e) => { e.preventDefault(); navigate(rotaDaBusca(busca)) }}
        className="flex h-12 items-center gap-2.5 rounded-cartao border border-fio-forte bg-superficie pr-1.5 pl-3.5 focus-within:border-acao">
        <Search className="size-5 shrink-0 text-tinta-sussurro" aria-hidden />
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={800}
          aria-label="Buscar droga, conduta, escore ou perguntar à IA" placeholder="Droga, conduta ou escore" autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-corpo text-tinta outline-none placeholder:text-tinta-sussurro" />
        <Button type="submit" variant="ghost" size="sm" className="gap-1 bg-acao/10 text-acao">
          <Sparkles className="size-3.5" aria-hidden /> Buscar
        </Button>
      </form>


      <IniciarPcr lado={lado} />

      <section aria-label="Conteúdo" className="flex flex-col gap-3">
        {linhas.map((par) => {
          const aberto = par.find((c) => c.id === aberta && c.itens.length)
          return (
            <div key={par.map((c) => c.id).join('-')} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {par.map((c) => (
                  <CartaoCategoria key={c.id} c={c} aberta={aberta === c.id} idPainel={`${base}-${c.id}`}
                    aoTocar={() => (c.rota ? navigate(c.rota) : setAberta(aberta === c.id ? null : c.id))} />
                ))}
              </div>
              {aberto && <PainelCategoria c={aberto} id={`${base}-${aberto.id}`} lado={lado} aoFechar={() => setAberta(null)} />}
            </div>
          )
        })}
      </section>

      <Link to={ROTA_SOBRE_MODULO} className="self-start text-apoio text-acao underline-offset-4 hover:underline">Sobre o módulo clínico</Link>
    </div>
  )
}
