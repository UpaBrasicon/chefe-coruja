import { ChevronDown } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { rotuloDocumento } from '@/components/documento/documentos'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CORES_RISCO, type CorRisco } from '@/domain/risco'
import { SITUACAO_EXAME, type SituacaoExame } from '@/lib/exames'
import { data, dataIso, diaMesHora, hora } from '@/lib/formato'
import { rotuloLocais, rotuloPontos } from '@/lib/contencao'
import { rotuloDesfechoFinal } from '@/lib/historico'
import {
  ancoraDoAno, idCabecalho, principais, resumoInternacao, rotuloLeito, textoItemPrescricao,
  type ClassificacaoBruta, type GrupoAtendimento, type LinhaAfericao, type RegistroLinha,
} from '@/lib/prontuarioLinhaTempo'
import { cn } from '@/lib/utils'

// Linha do tempo do Prontuário completo (direção A do RT, 06/11/2026): um
// cartão por atendimento, separado pela data, o mais recente no topo. Só
// leitura: nenhum botão aqui escreve; os botões só abrem e fecham o que já veio.
// A cor é a da enfermagem (PilulaRisco) e os sinais vitais saem crus.
//
// Polish (06/11/2026): títulos em h2 (data) e h3 (atendimento); o conteúdo
// fechado fica no DOM com hidden="until-found", para o Ctrl+F achar e abrir.

const ETAPA: Record<string, string> = {
  triagem: 'na classificação', atendimento: 'em atendimento', observacao: 'em observação', internacao: 'em internação',
}

const comoCor = (c: string | null | undefined): CorRisco | null => (CORES_RISCO.includes(c as CorRisco) ? (c as CorRisco) : null)

/** Hora quando é no dia do atendimento; senão, dia, mês e hora. */
function quando(em: string, dia: string | null) {
  return dia && dataIso(em) === dia ? hora(em) : diaMesHora(em)
}

/**
 * Fechado, mas encontrável pelo Ctrl+F: hidden="until-found". O React 19 trata
 * `hidden` como booleano (sairia hidden=""), então o atributo vai pelo DOM. Ao
 * achar, o navegador abre sozinho e avisa com "beforematch"; aí o estado acompanha.
 * Navegador sem until-found trata como hidden comum.
 */
function useAchavel<T extends HTMLElement>(fechado: boolean, abrir: () => void) {
  const ref = useRef<T>(null)
  const abrirRef = useRef(abrir)
  useLayoutEffect(() => { abrirRef.current = abrir })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (fechado) el.setAttribute('hidden', 'until-found')
    else el.removeAttribute('hidden')
  }, [fechado])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const achou = () => abrirRef.current()
    el.addEventListener('beforematch', achou)
    return () => el.removeEventListener('beforematch', achou)
  }, [])
  return ref
}

/** Separador de data (h2), sobre o fio tracejado da linha do tempo. O do ano recebe o foco da navegação por ano. */
export function SeparadorData({ children, id, primeiro = false }: { children: ReactNode; id?: string; primeiro?: boolean }) {
  return (
    // padrao-ok: separador de data da linha do tempo (pílula da maquete A); h2 pela hierarquia pedida pelo RT no polish
    <h2
      id={id}
      tabIndex={id ? -1 : undefined}
      className={cn(
        'relative z-10 mx-auto mb-2.5 w-max scroll-mt-24 rounded-capsula bg-fio px-3 py-0.5 text-rotulo font-normal text-tinta-apoio tabular md:scroll-mt-4',
        !primeiro && 'mt-secao',
      )}
    >
      {children}
    </h2>
  )
}

/** Separadores e cartões: um separador por dia; o primeiro dia de cada ano leva a âncora do ano. */
export function ListaAtendimentos({ grupos }: { grupos: GrupoAtendimento[] }) {
  return (
    <>
      {grupos.map((g, i) => {
        const anterior = grupos[i - 1]
        const novoDia = !anterior || anterior.dia !== g.dia
        const ancora = g.ano != null && anterior?.ano !== g.ano ? ancoraDoAno(g.ano) : undefined
        return (
          <div key={g.chave}>
            {novoDia && g.dia && (
              <SeparadorData id={ancora} primeiro={i === 0}>
                {data(g.atendimento!.chegada_em)}
                {g.situacao.emCurso && ' · em curso'}
              </SeparadorData>
            )}
            <CartaoAtendimento grupo={g} inicialAberto={i === 0} />
          </div>
        )
      })}
    </>
  )
}

function Reclassificacao({ c, dia }: { c: ClassificacaoBruta; dia: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-capsula border border-fio py-0.5 pr-2.5 pl-1 text-rotulo text-tinta-apoio">
      <PilulaRisco cor={comoCor(c.cor)} className="min-w-0 px-2 py-0" />
      reclassificada · {quando(c.criado_em, dia)}
    </span>
  )
}

/** "em observação · Observação adulto · Leito 4" quando o atendimento segue na internação. */
function ondeEsta(g: GrupoAtendimento): string | null {
  if (!g.situacao.emCurso || !g.atendimento) return null
  const int = g.internacoes[g.internacoes.length - 1]
  if (int && ['admitido', 'em_observacao', 'internado'].includes(int.status)) {
    const tipo = int.status === 'internado' ? 'internado' : 'em observação'
    return [tipo, int.setor, rotuloLeito(int.leito)].filter(Boolean).join(' · ')
  }
  return ETAPA[g.atendimento.etapa] ?? null
}

export function CartaoAtendimento({ grupo: g, inicialAberto }: { grupo: GrupoAtendimento; inicialAberto: boolean }) {
  const [aberto, setAberto] = useState(inicialAberto)
  const [todos, setTodos] = useState(false)
  const corpo = useAchavel<HTMLDivElement>(!aberto, () => setAberto(true))
  const a = g.atendimento
  const avulso = !a
  const { mostrados, escondidos, tipos } = principais(g.registros)
  const visiveis = new Set(mostrados.map((r) => r.tipo + r.id))
  const titulo = avulso ? g.titulo : [g.unidade, g.setor].filter(Boolean).join(' · ') || 'Atendimento'
  const meta = avulso
    ? (g.tipo === 'fora_da_lista' ? 'O atendimento destes registros não aparece para você.' : 'Registros gravados sem atendimento.')
    : [
        `Chegada ${hora(a.chegada_em)}`,
        g.medico,
        g.cid ? `CID ${g.cid}` : null,
        ondeEsta(g),
        !g.situacao.emCurso ? resumoInternacao(g.internacoes) : null,
        !g.situacao.emCurso && a.encerrado_em ? `Encerrado ${quando(a.encerrado_em, g.dia)}` : null,
      ].filter(Boolean).join(' · ')
  const contagem = g.registros.length + (g.afericoes.length ? 1 : 0)

  return (
    <article
      aria-label={titulo ?? undefined}
      className="relative z-10 overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso"
    >
      <h3>
        <BotaoLinha
          id={a ? idCabecalho(g.chave) : undefined}
          variante="linha"
          aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)}
          // contorno de foco por dentro: o article corta o que passa da borda
          className={cn('flex-col gap-1 border-0 px-base py-proximo focus-visible:outline-offset-[-2px]', aberto ? 'rounded-t-cartao' : 'rounded-cartao')}
        >
          {/* a seta fica na primeira linha, à direita, mesmo quando as pílulas quebram */}
          <span className="flex w-full items-start gap-2">
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="text-controle font-semibold text-tinta">{titulo}</span>
              {g.classificacao && <PilulaRisco cor={comoCor(g.classificacao.cor)} />}
              {g.reclassificacoes.map((c) => <Reclassificacao key={c.id} c={c} dia={g.dia} />)}
              {!avulso && (
                <Badge variant={g.situacao.emCurso ? 'default' : 'secondary'}>{g.situacao.emCurso ? 'Em curso' : g.situacao.rotulo}</Badge>
              )}
            </span>
            <ChevronDown aria-hidden className={cn('mt-1 size-4 shrink-0 text-tinta-sussurro transition-transform duration-200', aberto && 'rotate-180')} />
          </span>
          <span className="text-apoio font-normal text-tinta-sussurro">
            {meta}
            {!aberto && contagem > 0 && ` · ${contagem} ${contagem === 1 ? 'registro' : 'registros'}`}
          </span>
        </BotaoLinha>
      </h3>

      {/* o elemento achável não tem caixa: fechado, não sobra padding nem fundo */}
      <div ref={corpo}>
        <div className="flex flex-col gap-justo px-base pb-base">
          {a?.queixa && <p className="text-apoio text-tinta-apoio"><span className="text-tinta-sussurro">Queixa: </span>{a.queixa}</p>}
          {g.registros.length === 0 && g.afericoes.length === 0 && (
            <p className="text-apoio text-tinta-sussurro">Nenhum registro neste atendimento.</p>
          )}
          {g.registros.length > 0 && (
            // o espaço entre registros mora dentro de cada um: o escondido não deixa vão
            <div className="-mt-justo flex flex-col">
              {g.registros.map((r) => (
                <LinhaRegistro key={r.tipo + r.id} r={r} dia={g.dia} oculto={!todos && !visiveis.has(r.tipo + r.id)} revelar={() => setTodos(true)} />
              ))}
            </div>
          )}
          {escondidos > 0 && (
            <Button variant="outline" size="xs" className="mx-auto mt-1 rounded-capsula px-3" aria-expanded={todos} onClick={() => setTodos((v) => !v)}>
              {todos ? 'Mostrar só os principais' : `+ ${escondidos} ${escondidos === 1 ? 'registro' : 'registros'} (${tipos.join(', ')})`}
            </Button>
          )}
          {g.afericoes.length > 0 && <TabelaSinais linhas={g.afericoes} dia={g.dia} />}
        </div>
      </div>
    </article>
  )
}

/** Texto longo recolhido, com "Ler tudo" quando passa da altura. Mede de novo quando o cartão abre. */
function Recolhivel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [aberto, setAberto] = useState(false)
  const [cabe, setCabe] = useState(true)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || aberto) return
    const medir = () => { if (el.clientHeight > 0) setCabe(el.scrollHeight <= el.clientHeight + 1) }
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [aberto, children])
  return (
    <div>
      {/* cortado, o fim esmaece: a linha pela metade não parece o fim do texto */}
      <div ref={ref} className={cn(!aberto && 'max-h-36 overflow-hidden', !aberto && !cabe && '[mask-image:linear-gradient(to_bottom,#000_70%,transparent)]')}>{children}</div>
      {(!cabe || aberto) && (
        <Button variant="link" size="xs" className="h-auto px-0" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          {aberto ? 'Recolher' : 'Ler tudo'}
        </Button>
      )}
    </div>
  )
}

/** Texto clínico em tamanho de leitura (15 px), na medida do parágrafo. */
const TextoClinico = ({ children }: { children: string }) => (
  <pre className="max-w-prose font-sans text-corpo leading-relaxed whitespace-pre-wrap text-tinta">{children}</pre>
)

function Campo({ rotulo, texto }: { rotulo: string; texto: string | null }) {
  if (!texto?.trim()) return null
  return <p className="max-w-prose whitespace-pre-wrap"><span className="text-tinta-sussurro">{rotulo}: </span>{texto}</p>
}

function LinhaRegistro({ r, dia, oculto, revelar }: { r: RegistroLinha; dia: string | null; oculto: boolean; revelar: () => void }) {
  const ref = useAchavel<HTMLDivElement>(oculto, revelar)
  let titulo: ReactNode
  let corpo: ReactNode = null
  switch (r.tipo) {
    case 'atendimento':
      titulo = 'Atendimento (SOAP)'
      corpo = (
        <Recolhivel>
          <div className="flex flex-col gap-1 text-corpo leading-relaxed text-tinta">
            <Campo rotulo="Subjetivo" texto={r.registro.subjetivo} />
            <Campo rotulo="Objetivo" texto={r.registro.objetivo} />
            <Campo rotulo="Avaliação" texto={r.registro.avaliacao} />
            <Campo rotulo="Plano" texto={r.registro.plano} />
            <Campo rotulo="CID" texto={r.registro.cid} />
          </div>
        </Recolhivel>
      )
      break
    case 'documento':
      titulo = (
        <>
          {rotuloDocumento(r.documento.tipo_documento)}
          {r.documento.versao > 1 && <Badge variant="secondary">versão {r.documento.versao}</Badge>}
          {r.documento.estado === 'cancelado' && <Badge variant="destructive">cancelado</Badge>}
        </>
      )
      corpo = <Recolhivel><TextoClinico>{r.documento.conteudo}</TextoClinico></Recolhivel>
      break
    case 'prescricao': {
      const itens = r.prescricao.itens
      titulo = (
        <>
          Prescrição · {itens.length} {itens.length === 1 ? 'item' : 'itens'}
          <Badge variant="secondary">{r.prescricao.status}</Badge>
        </>
      )
      // a lista inteira, sem "Ler tudo": cortar a prescrição esconde item
      corpo = itens.length > 0 && (
        <ul className="list-disc pl-5 text-apoio text-tinta">
          {itens.map((i) => (
            <li key={i.id} className={i.suspenso_em ? 'text-tinta-sussurro' : undefined}>
              <span className={i.suspenso_em ? 'line-through' : undefined}>{textoItemPrescricao(i)}</span>
              {i.suspenso_em && <span> · suspenso {quando(i.suspenso_em, dia)}</span>}
            </li>
          ))}
        </ul>
      )
      break
    }
    case 'exame': {
      const x = r.exame
      titulo = (
        <>
          Exame · {x.exame}
          <Badge variant="secondary">{SITUACAO_EXAME[x.situacao as SituacaoExame] ?? x.situacao}</Badge>
          {x.urgencia === 'urgente' && <Badge variant="outline">urgente</Badge>}
        </>
      )
      const res = r.resultado
      corpo = (res || x.resultado) && (
        <Recolhivel>
          <div className="flex flex-col gap-1 text-apoio text-tinta">
            {res?.texto && <TextoClinico>{res.texto}</TextoClinico>}
            {res && res.itens.length > 0 && (
              <ul className="flex flex-col gap-0.5 tabular">
                {res.itens.map((i, n) => (
                  <li key={n}>
                    {i.analito}: {i.valor ?? (i.valor_num != null ? String(i.valor_num).replace('.', ',') : '—')}
                    {i.unidade ? ` ${i.unidade}` : ''}
                    {i.referencia && <span className="text-tinta-sussurro"> (ref. {i.referencia})</span>}
                  </li>
                ))}
              </ul>
            )}
            {!res && x.resultado && <TextoClinico>{x.resultado}</TextoClinico>}
          </div>
        </Recolhivel>
      )
      break
    }
    case 'contencao': {
      // lacuna 4 (K8): a contenção no atendimento; o registro inteiro sai na folha
      const c = r.contencao
      titulo = (
        <>
          Contenção mecânica · {rotuloPontos(c.pontos)}
          {c.pediatrico && <Badge variant="info">paciente pediátrico</Badge>}
          {!c.retirada_em && <Badge variant="destructive">em curso</Badge>}
        </>
      )
      corpo = (
        <Recolhivel>
          <div className="flex flex-col gap-1 text-apoio text-tinta">
            <Campo rotulo="Locais" texto={rotuloLocais(c.locais)} />
            <Campo rotulo="Motivo" texto={c.motivo} />
            <Campo rotulo="Alternativas tentadas" texto={c.alternativas} />
            <p className="text-tinta-apoio">
              {[
                `${c.revisoes} ${c.revisoes === 1 ? 'revisão' : 'revisões'}`,
                c.prescrita_em ? `prescrita ${quando(c.prescrita_em, dia)}` : 'sem prescrição',
                c.retirada_em ? `retirada ${quando(c.retirada_em, dia)}${c.motivo_retirada ? `: ${c.motivo_retirada}` : ''}` : null,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </Recolhivel>
      )
      break
    }
    case 'intercorrencia': {
      const x = r.intercorrencia
      titulo = (
        <>
          Intercorrência · {x.tipo_rotulo}
          <Badge variant={x.gravidade === 'grave' ? 'destructive' : x.gravidade === 'moderada' ? 'warning' : 'outline'}>{x.gravidade}</Badge>
          {x.retifica_id && <Badge variant="secondary">retificação</Badge>}
        </>
      )
      corpo = (
        <Recolhivel>
          <div className="flex flex-col gap-1 text-apoio text-tinta">
            <p className="max-w-prose whitespace-pre-wrap">{x.descricao}</p>
            <Campo rotulo="Conduta" texto={x.conduta} />
          </div>
        </Recolhivel>
      )
      break
    }
    case 'internacao': {
      const i = r.internacao
      titulo = [i.tipo_internacao === 'observacao' ? 'Observação' : 'Internação', i.setor, rotuloLeito(i.leito)].filter(Boolean).join(' · ')
      corpo = (
        <p className="text-apoio text-tinta-apoio">
          {[
            `Entrada ${quando(i.data_admissao, dia)}`,
            i.data_alta ? `${rotuloDesfechoFinal(i.status)} ${quando(i.data_alta, dia)}` : null,
            i.cid_alta ? `CID da alta ${i.cid_alta}` : i.cid_principal ? `CID ${i.cid_principal}` : null,
          ].filter(Boolean).join(' · ')}
        </p>
      )
      break
    }
  }
  return (
    <div ref={ref}>
      <div className="mt-justo flex flex-col gap-1 rounded-controle bg-trilha px-3 py-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h4 className="inline-flex flex-wrap items-center gap-1.5 text-apoio font-medium text-tinta">{titulo}</h4>
          {r.autor && <span className="text-rotulo text-tinta-sussurro">{r.autor}</span>}
          <span className="ml-auto text-rotulo text-tinta-sussurro tabular">{quando(r.em, dia)}</span>
        </div>
        {corpo}
      </div>
    </div>
  )
}

const COLUNAS: [keyof Omit<LinhaAfericao, 'em' | 'outras'>, string, string][] = [
  ['pa', 'PA', 'mmHg'], ['fc', 'FC', 'bpm'], ['fr', 'FR', 'irpm'], ['temp', 'Temp', '°C'],
  ['spo2', 'SpO2', '%'], ['glicemia', 'Glicemia', 'mg/dL'], ['dor', 'Dor', ''],
]
const LINHAS_INICIAIS = 6
// Hora fica parada na rolagem horizontal do celular; o fundo acompanha a linha,
// e um fio à direita marca onde o resto passa por baixo
const HORA_FIXA = 'sticky left-0 z-[1] after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-fio'

/** Uma linha por aferição, colunas fixas, valores como foram gravados (sem marca de alterado). */
function TabelaSinais({ linhas, dia }: { linhas: LinhaAfericao[]; dia: string | null }) {
  const [todas, setTodas] = useState(false)
  const outras = linhas.some((l) => l.outras.length > 0)
  const vistas = todas ? linhas : linhas.slice(0, LINHAS_INICIAIS)
  return (
    <div className="mt-1.5">
      <h4 className="mb-1 text-apoio font-semibold text-tinta-apoio">Sinais vitais</h4>
      <div className="rounded-controle border border-fio">
        <Table className="text-apoio">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn('bg-campo px-3 py-1.5 align-top', HORA_FIXA)}>Hora</TableHead>
              {COLUNAS.map(([k, rotulo, unidade]) => (
                <TableHead key={k} className="px-3 py-1.5 align-top">
                  {rotulo}
                  {unidade && <span className="block text-rotulo font-normal">{unidade}</span>}
                </TableHead>
              ))}
              {outras && <TableHead className="px-3 py-1.5 align-top">Outras</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vistas.map((l) => (
              <TableRow key={l.em}>
                <TableCell className={cn('bg-superficie px-3 py-1.5 text-tinta-sussurro [tr:hover>&]:bg-campo', HORA_FIXA)}>{quando(l.em, dia)}</TableCell>
                {COLUNAS.map(([k]) => (
                  <TableCell key={k} className="px-3 py-1.5">{l[k] ?? <span className="text-tinta-sussurro" aria-label="não aferido">—</span>}</TableCell>
                ))}
                {outras && (
                  <TableCell className="px-3 py-1.5 whitespace-normal">{l.outras.map((o) => `${o.nome} ${o.valor}`).join(' · ')}</TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {linhas.length > LINHAS_INICIAIS && (
        <Button variant="link" size="xs" className="h-auto px-0" aria-expanded={todas} onClick={() => setTodas((v) => !v)}>
          {todas ? 'Mostrar só as últimas' : `Ver as ${linhas.length} aferições`}
        </Button>
      )}
    </div>
  )
}
