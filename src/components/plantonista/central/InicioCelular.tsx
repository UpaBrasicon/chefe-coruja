import { useId, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Baby, Bookmark, ChevronRight, ClipboardList, History, HeartPulse, Search, User, type LucideIcon } from 'lucide-react'

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

// Polimento de 23/11/2026 (unslop, aprovado pelo RT): superfícies neutras com
// borda fina; a cor do grupo fica só na etiqueta da sigla, como a faixa de uma
// etiqueta de ampola. O "Iniciar PCR" é o único bloco de cor forte.
// Classes por extenso para o Tailwind enxergá-las; só tokens do app.
const FAIXA: Record<IconeCategoria, string> = {
  urgencias: 'bg-critico', doses: 'bg-secao-farmacia', calculadoras: 'bg-secao-calculadoras',
  escores: 'bg-secao-neurologia', intoxicacao: 'bg-secao-toxicologia', todas: 'bg-acao',
}

/** A sigla como etiqueta de ampola: fundo branco, borda fina e a faixa na cor do grupo. */
function Etiqueta({ texto, icone, pequena }: { texto: string; icone: IconeCategoria; pequena?: boolean }) {
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-stretch overflow-hidden rounded-controle border border-fio-forte bg-superficie font-mono font-medium text-tinta tabular-nums',
      pequena ? 'h-6 text-rotulo' : 'h-7 text-apoio')}>
      <span className={cn('w-1', FAIXA[icone])} />
      <span className={cn('flex items-center', pequena ? 'px-1.5' : 'px-2')}>{texto}</span>
    </span>
  )
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
        className={cn(botao, lado === 'adulto' ? 'bg-superficie font-medium text-acao ring-1 ring-fio hover:bg-superficie hover:text-acao' : 'font-normal text-tinta-apoio')}>
        <User className="size-4.5" aria-hidden /> Adulto
      </Button>
      <Button type="button" variant="ghost" aria-pressed={lado === 'crianca'} onClick={() => { if (lado !== 'crianca') definirModo('pediatrico') }}
        className={cn(botao, lado === 'crianca' ? 'bg-superficie font-medium text-pediatria ring-1 ring-fio hover:bg-superficie hover:text-pediatria' : 'font-normal text-tinta-apoio')}>
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
      className="min-h-16 w-full flex-row items-center gap-3 rounded-cartao border-critico bg-critico px-4 py-3 text-sobre-acao hover:border-critico hover:bg-critico active:scale-[0.99]">
      <HeartPulse className="size-6 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-secao font-semibold">Iniciar PCR</span>
        <span className="text-apoio opacity-90">{lado === 'crianca' ? 'Guia da parada pelo peso ou pela fita' : 'Cronômetro da parada do adulto'}</span>
      </span>
    </BotaoLinha>
  )
}

function CartaoCategoria({ c, aberta, aoTocar, idPainel, largo }: { c: CategoriaInicio; aberta: boolean; aoTocar: () => void; idPainel: string; largo?: boolean }) {
  return (
    <BotaoLinha onClick={aoTocar} aria-expanded={aberta} aria-controls={idPainel}
      className={cn('gap-3 rounded-cartao p-4 hover:bg-superficie active:bg-trilha',
        largo ? 'min-h-18 flex-row items-center' : 'min-h-28',
        aberta ? 'border-acao bg-trilha hover:border-acao hover:bg-trilha' : 'border-fio hover:border-fio-forte')}>
      <Etiqueta texto={c.sigla} icone={c.icone} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-corpo leading-tight font-medium text-tinta">{c.nome}</span>
        <span className="text-apoio leading-snug text-tinta-apoio">{c.exemplos}</span>
      </span>
    </BotaoLinha>
  )
}

function PainelCategoria({ c, id, lado, aoFechar }: { c: CategoriaInicio; id: string; lado: LadoInicio; aoFechar: () => void }) {
  const abrir = useAbrir(lado)
  const { favoritos, alternarFavorito } = useFavoritos(CHAVES_FERRAMENTAS)
  return (
    <div id={id} role="region" aria-label={c.nome} className="flex flex-col gap-2 rounded-cartao border border-fio bg-superficie p-3">
      <div className="flex items-center justify-between">
        <span className="text-apoio font-medium text-tinta-apoio">{c.nome}</span>
        <Button type="button" variant="outline" size="sm" onClick={aoFechar}>Fechar</Button>
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {c.itens.map((i) => {
          const chave = chaveDoItem(i.rota)
          const favorito = !!chave && favoritos.includes(chave)
          return (
            <li key={i.rota} className="relative">
              <BotaoLinha onClick={() => abrir(i.rota)}
                className="h-full min-h-21 w-full gap-2 rounded-container border-fio bg-campo p-3 pr-10 hover:border-fio-forte hover:bg-campo active:bg-trilha">
                <Etiqueta texto={i.sigla} icone={c.icone} pequena />
                <span className="text-controle leading-snug font-medium text-tinta">{i.nome}</span>
              </BotaoLinha>
              {chave && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => alternarFavorito(chave)} aria-pressed={favorito}
                  aria-label={favorito ? `Tirar ${i.nome} dos favoritos` : `Favoritar ${i.nome}`} className="absolute top-1.5 right-1.5">
                  <Bookmark className={cn('size-4', favorito ? 'fill-acao text-acao' : 'text-tinta-sussurro')} strokeWidth={1.75} />
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <Link to="/plantonista?todas=1" className="self-start py-1 text-apoio font-medium text-acao no-underline hover:underline">Ver todas, com busca</Link>
    </div>
  )
}

// Nome e endereço de cada ferramenta pela chave de favorito (secao/slug).
const FERRAMENTA_POR_CHAVE = new Map<string, { nome: string; rota: string }>(SECOES.flatMap((sec) => sec.tools.map((t) => [`${sec.slug}/${t.slug}`, { nome: t.label, rota: `/plantonista/${sec.slug}/${t.slug}` }] as const)))

function LinhaAtalho({ nome, rota, favorito, vezes, icone: Icone }: { nome: string; rota: string; favorito?: boolean; vezes?: number; icone?: LucideIcon }) {
  return (
    <li>
      <Link to={rota}
        className="flex min-h-12 items-center gap-2.5 rounded-cartao border border-fio bg-superficie px-4 py-2.5 text-tinta no-underline hover:border-fio-forte active:bg-trilha">
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
  const { unidadeAtiva } = useUnidade()
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
  // ritmo da grade (polimento): Urgências na linha inteira, os outros grupos em pares,
  // e "Todas as ferramentas" como uma linha simples no fim
  const grupos = categorias.filter((c) => c.itens.length)
  const todas = categorias.find((c) => !c.itens.length && c.rota)
  const linhas: CategoriaInicio[][] = [grupos.slice(0, 1)]
  for (let i = 1; i < grupos.length; i += 2) linhas.push(grupos.slice(i, i + 2))

  return (
    // pb-20: o fim da lista passa acima do botão de Mensagens
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex flex-col gap-3">
        <TituloPagina titulo="Central do Médico" descricao={unidadeAtiva?.unidade.nome} className="mb-0" />
        <ChaveDoLado lado={lado} />
      </div>

      <form role="search" onSubmit={(e) => { e.preventDefault(); navigate(rotaDaBusca(busca)) }}
        className="flex h-12 items-center gap-2 rounded-cartao border border-fio-forte bg-superficie pr-1 pl-3 focus-within:border-acao">
        <Search className="size-4.5 shrink-0 text-tinta-sussurro" strokeWidth={1.75} aria-hidden />
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={800}
          aria-label="Buscar droga, conduta, escore ou perguntar à IA" placeholder="Droga, conduta ou escore" autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-corpo text-tinta outline-none placeholder:text-tinta-sussurro" />
        <Button type="submit" variant="outline" size="sm" className="border-0 font-medium text-acao">Buscar</Button>
      </form>

      <IniciarPcr lado={lado} />

      {/* abas sublinhadas (polimento): texto escuro na aba ativa, contraste pleno */}
      <Abas<AbaInicio> rotulo="Início" valor={aba} onChange={trocarAba}
        className="mb-0 flex-nowrap gap-1 border-b border-fio [&>button]:-mb-px [&>button]:min-h-11 [&>button]:rounded-none [&>button]:border-0 [&>button]:border-b-2 [&>button]:border-transparent [&>button]:bg-transparent [&>button]:px-3 [&>button]:text-corpo [&>button]:text-tinta-apoio [&>button[aria-selected=true]]:border-acao [&>button[aria-selected=true]]:bg-transparent [&>button[aria-selected=true]]:font-medium [&>button[aria-selected=true]]:text-tinta"
        abas={[['conteudo', 'Conteúdo'], ['plantao', 'Meu plantão']]} />

      {aba === 'plantao' ? <MeuPlantao /> : (
      <section aria-label="Conteúdo" className="flex flex-col gap-3">
        {linhas.map((par) => {
          const aberto = par.find((c) => c.id === aberta)
          return (
            <div key={par.map((c) => c.id).join('-')} className="flex flex-col gap-3">
              <div className={cn('grid gap-3', par.length > 1 && 'grid-cols-2')}>
                {par.map((c) => (
                  <CartaoCategoria key={c.id} c={c} largo={par.length === 1} aberta={aberta === c.id} idPainel={`${base}-${c.id}`}
                    aoTocar={() => setAberta(aberta === c.id ? null : c.id)} />
                ))}
              </div>
              {aberto && <PainelCategoria c={aberto} id={`${base}-${aberto.id}`} lado={lado} aoFechar={() => setAberta(null)} />}
            </div>
          )
        })}
        {todas?.rota && (
          <Link to={todas.rota}
            className="flex min-h-12 items-center justify-between rounded-cartao border border-fio bg-superficie px-4 text-corpo text-tinta no-underline hover:border-fio-forte active:bg-trilha">
            Todas as ferramentas, com busca
            <ChevronRight className="size-4 text-tinta-sussurro" strokeWidth={1.75} aria-hidden />
          </Link>
        )}
      </section>
      )}

      <Link to={ROTA_SOBRE_MODULO} className="self-start text-apoio text-acao underline-offset-4 hover:underline">Sobre o módulo clínico</Link>
    </div>
  )
}
