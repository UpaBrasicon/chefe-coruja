import { useId, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight, Baby, Bookmark, ChevronRight, ClipboardList, History, Calculator, ChartColumn, FlaskConical, HeartPulse, LayoutGrid, Search, Siren, Skull, Sparkles, User, X,
  type LucideIcon,
} from 'lucide-react'

import { CHAVES_FERRAMENTAS, SECOES } from '@/content/registry'
import { ROTA_PCR, chaveDoItem, categoriasDoInicio, rotaDaBusca, type CategoriaInicio, type IconeCategoria, type LadoInicio } from '@/content/inicioCelular'
import { ROTA_SOBRE_MODULO } from '@/content/sobreModuloClinico'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { definirModo, usePacienteCentral } from '@/lib/pacienteCentral'
import { useFavoritos } from '@/lib/useFavoritos'
import { cn } from '@/lib/utils'
import { Abas, TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { SessaoAssinatura } from '@/components/assinatura/SessaoAssinatura'
import { CartaoTurno } from './CartaoTurno'
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
  urgencias: { cartao: 'border-critico/30 bg-critico/8 hover:border-critico/60', aberto: 'border-critico bg-critico/15', icone: 'bg-critico text-sobre-acao', nome: 'text-critico', painel: 'border-critico/25 bg-critico/5', sigla: 'bg-critico/10 text-critico' },
  doses: { cartao: 'border-secao-farmacia/30 bg-secao-farmacia/8 hover:border-secao-farmacia/60', aberto: 'border-secao-farmacia bg-secao-farmacia/15', icone: 'bg-secao-farmacia text-sobre-acao', nome: 'text-secao-farmacia', painel: 'border-secao-farmacia/25 bg-secao-farmacia/5', sigla: 'bg-secao-farmacia/10 text-secao-farmacia' },
  calculadoras: { cartao: 'border-secao-calculadoras/30 bg-secao-calculadoras/8 hover:border-secao-calculadoras/60', aberto: 'border-secao-calculadoras bg-secao-calculadoras/15', icone: 'bg-secao-calculadoras text-sobre-acao', nome: 'text-secao-calculadoras', painel: 'border-secao-calculadoras/25 bg-secao-calculadoras/5', sigla: 'bg-secao-calculadoras/10 text-secao-calculadoras' },
  escores: { cartao: 'border-secao-neurologia/30 bg-secao-neurologia/8 hover:border-secao-neurologia/60', aberto: 'border-secao-neurologia bg-secao-neurologia/15', icone: 'bg-secao-neurologia text-sobre-acao', nome: 'text-secao-neurologia', painel: 'border-secao-neurologia/25 bg-secao-neurologia/5', sigla: 'bg-secao-neurologia/10 text-secao-neurologia' },
  intoxicacao: { cartao: 'border-secao-toxicologia/30 bg-secao-toxicologia/8 hover:border-secao-toxicologia/60', aberto: 'border-secao-toxicologia bg-secao-toxicologia/15', icone: 'bg-secao-toxicologia text-sobre-acao', nome: 'text-secao-toxicologia', painel: 'border-secao-toxicologia/25 bg-secao-toxicologia/5', sigla: 'bg-secao-toxicologia/10 text-secao-toxicologia' },
  todas: { cartao: 'border-acao/30 bg-acao/8 hover:border-acao/60', aberto: 'border-acao bg-acao/15', icone: 'bg-acao text-sobre-acao', nome: 'text-acao', painel: 'border-acao/25 bg-acao/5', sigla: 'bg-acao/10 text-acao' },
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
        aberta ? cn(t.aberto, 'hover:bg-superficie') : t.cartao)}>
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
  const { favoritos, alternarFavorito } = useFavoritos(CHAVES_FERRAMENTAS)
  return (
    <div id={id} role="region" aria-label={c.nome} className={cn('flex flex-col gap-2.5 rounded-cartao border p-3', t.painel)}>
      <div className="flex items-center justify-between">
        <span className="text-rotulo font-semibold tracking-wide text-tinta-apoio uppercase">{c.nome}</span>
        <Button type="button" variant="outline" size="sm" onClick={aoFechar}>Fechar</Button>
      </div>
      <ul className="grid grid-cols-2 gap-2.5">
        {c.itens.map((i) => {
          const chave = chaveDoItem(i.rota)
          const favorito = !!chave && favoritos.includes(chave)
          return (
            <li key={i.rota} className="relative">
              <BotaoLinha onClick={() => abrir(i.rota)}
                className="h-full min-h-22 w-full gap-2.5 rounded-cartao border-fio-forte/45 p-3 pr-10 shadow-repouso hover:border-acao hover:bg-superficie hover:shadow-halo">
                <span aria-hidden className={cn('inline-flex h-7 min-w-8 items-center justify-center rounded-container px-1.5 text-rotulo font-bold', t.sigla)}>{i.sigla}</span>
                <span className="text-apoio leading-snug font-medium text-tinta">{i.nome}</span>
              </BotaoLinha>
              {chave && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => alternarFavorito(chave)} aria-pressed={favorito}
                  aria-label={favorito ? `Tirar ${i.nome} dos favoritos` : `Favoritar ${i.nome}`} className="absolute top-1.5 right-1.5">
                  <Bookmark className={cn('size-4.5', favorito ? 'fill-acao text-acao' : 'text-tinta-apoio')} />
                </Button>
              )}
            </li>
          )
        })}
        <li>
          <Link to="/plantonista?todas=1"
            className="flex h-full min-h-22 items-center justify-center rounded-cartao border border-dashed border-fio-forte p-3 text-center text-apoio font-semibold text-acao no-underline">
            Ver todas, com busca
          </Link>
        </li>
      </ul>
    </div>
  )
}

// Nome e endereço de cada ferramenta pela chave de favorito (secao/slug).
const FERRAMENTA_POR_CHAVE = new Map<string, { nome: string; rota: string }>(SECOES.flatMap((sec) => sec.tools.map((t) => [`${sec.slug}/${t.slug}`, { nome: t.label, rota: `/plantonista/${sec.slug}/${t.slug}` }] as const)))

function LinhaAtalho({ nome, rota, favorito, vezes, icone: Icone }: { nome: string; rota: string; favorito?: boolean; vezes?: number; icone?: LucideIcon }) {
  return (
    <li>
      <Link to={rota}
        className="flex min-h-13 items-center gap-2.5 rounded-cartao border border-fio-forte/45 bg-superficie px-3.5 py-2.5 text-tinta no-underline shadow-repouso hover:border-acao">
        {Icone ? <Icone className="size-4 shrink-0 text-acao" aria-hidden /> : favorito ? <Bookmark className="size-4 shrink-0 fill-acao text-acao" aria-hidden /> : <History className="size-4 shrink-0 text-tinta-apoio" aria-hidden />}
        <span className="min-w-0 flex-1 text-controle font-medium">{nome}</span>
        {!!vezes && <span className="text-rotulo tabular-nums text-tinta-sussurro" title={`Aberta ${vezes} ${vezes === 1 ? 'vez' : 'vezes'} por você`}>{vezes}×</span>}
        <ChevronRight className="size-4 shrink-0 text-tinta-apoio" aria-hidden />
      </Link>
    </li>
  )
}

// Aba "Meu plantão" (CM4 = A): só o que já existe — o cartão do turno (com o
// próximo plantão), a sessão de assinatura, os favoritos e os mais usados.
function MeuPlantao() {
  const { perfil } = useAuth()
  const { unidadeAtiva } = useUnidade()
  const { favoritos, usos } = useFavoritos(CHAVES_FERRAMENTAS)
  const favs = favoritos.flatMap((c) => { const x = FERRAMENTA_POR_CHAVE.get(c); return x ? [{ chave: c, ...x }] : [] })
  const maisUsados = Object.entries(usos)
    .filter(([c, n]) => n > 0 && !favoritos.includes(c))
    .sort((a, b) => b[1] - a[1])
    .flatMap(([c, n]) => { const x = FERRAMENTA_POR_CHAVE.get(c); return x ? [{ chave: c, vezes: n, ...x }] : [] })
    .slice(0, 5)
  return (
    <div className="flex flex-col gap-4">
      <CartaoTurno unidadeId={unidadeAtiva?.unidade_id} perfilId={perfil?.id} ubs={unidadeAtiva?.unidade.tipo === 'ubs'} />
      {/* pedido 8 (PS1 a PS3 = A): os pacientes do plantão com as pendências; a UBS não tem leito */}
      {unidadeAtiva?.unidade.tipo !== 'ubs' && (
        <ul aria-label="Passômetro"><LinhaAtalho nome="Passômetro: meus pacientes e pendências" rota="/passometro" icone={ClipboardList} /></ul>
      )}
      <SessaoAssinatura />
      <section aria-label="Favoritos" className="flex flex-col gap-2">
        <TituloSecao className="mb-0">Favoritos</TituloSecao>
        {favs.length ? (
          <ul className="flex flex-col gap-2">{favs.map((x) => <LinhaAtalho key={x.chave} nome={x.nome} rota={x.rota} favorito vezes={usos[x.chave]} />)}</ul>
        ) : (
          <p className="text-apoio text-tinta-apoio">Toque na bandeirinha de uma ferramenta, em Conteúdo, para ela aparecer aqui.</p>
        )}
      </section>
      {maisUsados.length > 0 && (
        <section aria-label="Mais usados por você" className="flex flex-col gap-2">
          <TituloSecao className="mb-0">Mais usados por você</TituloSecao>
          <ul className="flex flex-col gap-2">{maisUsados.map((x) => <LinhaAtalho key={x.chave} nome={x.nome} rota={x.rota} vezes={x.vezes} />)}</ul>
        </section>
      )}
    </div>
  )
}

type AbaInicio = 'conteudo' | 'plantao'

export function InicioCelular() {
  const { perfil } = useAuth()
  const p = usePacienteCentral()
  const navigate = useNavigate()
  const lado: LadoInicio = p.modo === 'pediatrico' ? 'crianca' : 'adulto'
  const categorias = categoriasDoInicio(lado)
  const [aberta, setAberta] = useState<string | null>(null)
  // a aba fica no endereço (?aba=plantao): voltar de uma ferramenta devolve à mesma aba
  const [params, setParams] = useSearchParams()
  const aba: AbaInicio = params.get('aba') === 'plantao' ? 'plantao' : 'conteudo'
  const trocarAba = (k: AbaInicio) => setParams((p) => { const n = new URLSearchParams(p); if (k === 'plantao') n.set('aba', 'plantao'); else n.delete('aba'); return n }, { replace: true })
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

      <Abas<AbaInicio> rotulo="Início" valor={aba} onChange={trocarAba} className="mb-0 [&>button]:min-h-11 [&>button]:px-4 [&>button]:text-controle"
        abas={[['conteudo', 'Conteúdo'], ['plantao', 'Meu plantão']]} />

      {aba === 'plantao' ? <MeuPlantao /> : (
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
      )}

      <Link to={ROTA_SOBRE_MODULO} className="self-start text-apoio text-acao underline-offset-4 hover:underline">Sobre o módulo clínico</Link>
    </div>
  )
}
