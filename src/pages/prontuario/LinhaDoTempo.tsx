import { ChevronDown } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { rotuloDocumento } from '@/components/documento/documentos'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CORES_RISCO, type CorRisco } from '@/domain/risco'
import { SITUACAO_EXAME, type SituacaoExame } from '@/lib/exames'
import { data, dataIso, diaMesHora, hora } from '@/lib/formato'
import { rotuloDesfechoFinal } from '@/lib/historico'
import {
  ancoraDoAno, principais, type ClassificacaoBruta, type GrupoAtendimento, type LinhaAfericao, type RegistroLinha,
} from '@/lib/prontuarioLinhaTempo'
import { cn } from '@/lib/utils'

// Linha do tempo do Prontuário completo (direção A do RT, 06/11/2026): um
// cartão por atendimento, separado pela data, o mais recente no topo. Só
// leitura: nenhum botão aqui escreve; os botões só abrem e fecham o que já veio.
// A cor é a da enfermagem (PilulaRisco) e os sinais vitais saem crus.

const ETAPA: Record<string, string> = {
  triagem: 'na classificação', atendimento: 'em atendimento', observacao: 'em observação', internacao: 'em internação',
}

const comoCor = (c: string | null | undefined): CorRisco | null => (CORES_RISCO.includes(c as CorRisco) ? (c as CorRisco) : null)

/** Hora quando é no dia do atendimento; senão, dia, mês e hora. */
function quando(em: string, dia: string | null) {
  return dia && dataIso(em) === dia ? hora(em) : diaMesHora(em)
}

/** Separador de data, sobre o fio tracejado da linha do tempo. */
function SeparadorData({ children, id, primeiro = false }: { children: ReactNode; id?: string; primeiro?: boolean }) {
  return (
    <div id={id} className={cn('relative z-10 mx-auto mb-2.5 w-max scroll-mt-4 rounded-capsula bg-fio px-3 py-0.5 text-rotulo text-tinta-apoio tabular', !primeiro && 'mt-secao')}>
      {children}
    </div>
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

/** "Em observação, Observação adulto · leito 4" quando o atendimento segue na internação. */
function ondeEsta(g: GrupoAtendimento): string | null {
  if (!g.situacao.emCurso || !g.atendimento) return null
  const int = g.internacoes[g.internacoes.length - 1]
  if (int && ['admitido', 'em_observacao', 'internado'].includes(int.status)) {
    const tipo = int.status === 'internado' ? 'internado' : 'em observação'
    return [tipo, int.setor, int.leito ? `leito ${int.leito}` : null].filter(Boolean).join(' · ')
  }
  return ETAPA[g.atendimento.etapa] ?? null
}

export function CartaoAtendimento({ grupo: g, inicialAberto }: { grupo: GrupoAtendimento; inicialAberto: boolean }) {
  const [aberto, setAberto] = useState(inicialAberto)
  const [todos, setTodos] = useState(false)
  const a = g.atendimento
  const avulso = !a
  const { mostrados, escondidos, tipos } = principais(g.registros)
  const lista = todos ? g.registros : mostrados
  const titulo = avulso ? g.titulo : [g.unidade, g.setor].filter(Boolean).join(' · ') || 'Atendimento'
  const meta = avulso
    ? (g.tipo === 'fora_da_lista' ? 'O atendimento destes registros não aparece para você.' : 'Registros gravados sem atendimento.')
    : [
        `Chegada ${hora(a.chegada_em)}`,
        g.medico,
        g.cid ? `CID ${g.cid}` : null,
        ondeEsta(g),
        !g.situacao.emCurso && a.encerrado_em ? `Encerrado ${quando(a.encerrado_em, g.dia)}` : null,
      ].filter(Boolean).join(' · ')
  const contagem = g.registros.length + (g.afericoes.length ? 1 : 0)

  return (
    <article
      aria-label={titulo ?? undefined}
      className="relative z-10 overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso"
    >
      <BotaoLinha
        variante="linha"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex-col gap-1 border-0 px-base py-proximo"
      >
        <span className="flex w-full flex-wrap items-center gap-2">
          <span className="text-controle font-semibold text-tinta">{titulo}</span>
          {g.classificacao && <PilulaRisco cor={comoCor(g.classificacao.cor)} />}
          {g.reclassificacoes.map((c) => <Reclassificacao key={c.id} c={c} dia={g.dia} />)}
          {!avulso && (
            <Badge variant={g.situacao.emCurso ? 'default' : 'secondary'}>{g.situacao.emCurso ? 'Em curso' : g.situacao.rotulo}</Badge>
          )}
          <ChevronDown aria-hidden className={cn('ml-auto size-4 shrink-0 text-tinta-sussurro transition-transform duration-200', aberto && 'rotate-180')} />
        </span>
        <span className="text-apoio text-tinta-sussurro">
          {meta}
          {!aberto && contagem > 0 && ` · ${contagem} ${contagem === 1 ? 'registro' : 'registros'}`}
        </span>
      </BotaoLinha>

      {aberto && (
        <div className="flex flex-col gap-justo px-base pb-base">
          {a?.queixa && <p className="text-apoio text-tinta-apoio"><span className="text-tinta-sussurro">Queixa: </span>{a.queixa}</p>}
          {g.registros.length === 0 && g.afericoes.length === 0 && (
            <p className="text-apoio text-tinta-sussurro">Nenhum registro neste atendimento.</p>
          )}
          {lista.map((r) => <LinhaRegistro key={r.tipo + r.id} r={r} dia={g.dia} />)}
          {escondidos > 0 && (
            <Button variant="outline" size="xs" className="mx-auto mt-1 rounded-capsula px-3" aria-expanded={todos} onClick={() => setTodos((v) => !v)}>
              {todos ? 'Mostrar só os principais' : `+ ${escondidos} ${escondidos === 1 ? 'registro' : 'registros'} (${tipos.join(', ')})`}
            </Button>
          )}
          {g.afericoes.length > 0 && <TabelaSinais linhas={g.afericoes} dia={g.dia} />}
        </div>
      )}
    </article>
  )
}

/** Texto longo recolhido, com "Ler tudo" quando passa da altura. */
function Recolhivel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [aberto, setAberto] = useState(false)
  const [cabe, setCabe] = useState(true)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && !aberto) setCabe(el.scrollHeight <= el.clientHeight + 1)
  }, [aberto, children])
  return (
    <div>
      <div ref={ref} className={cn(!aberto && 'max-h-28 overflow-hidden')}>{children}</div>
      {(!cabe || aberto) && (
        <Button variant="link" size="xs" className="h-auto px-0" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          {aberto ? 'Recolher' : 'Ler tudo'}
        </Button>
      )}
    </div>
  )
}

const TextoClinico = ({ children }: { children: string }) => (
  <pre className="max-w-prose font-sans text-apoio whitespace-pre-wrap text-tinta">{children}</pre>
)

function Campo({ rotulo, texto }: { rotulo: string; texto: string | null }) {
  if (!texto?.trim()) return null
  return <p className="max-w-prose whitespace-pre-wrap"><span className="text-tinta-sussurro">{rotulo}: </span>{texto}</p>
}

function LinhaRegistro({ r, dia }: { r: RegistroLinha; dia: string | null }) {
  let titulo: ReactNode
  let corpo: ReactNode = null
  switch (r.tipo) {
    case 'atendimento':
      titulo = 'Atendimento (SOAP)'
      corpo = (
        <Recolhivel>
          <div className="flex flex-col gap-1 text-apoio text-tinta">
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
      corpo = itens.length > 0 && (
        <Recolhivel>
          <ul className="list-disc pl-5 text-apoio text-tinta">
            {itens.map((i) => (
              <li key={i.id} className={i.suspenso_em ? 'text-tinta-sussurro line-through' : ''}>
                {[i.descricao, i.dose, i.via, i.posologia].filter(Boolean).join(' · ')}
              </li>
            ))}
          </ul>
        </Recolhivel>
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
    case 'internacao': {
      const i = r.internacao
      titulo = [i.tipo_internacao === 'observacao' ? 'Observação' : 'Internação', i.setor, i.leito ? `leito ${i.leito}` : null].filter(Boolean).join(' · ')
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
    <section className="flex flex-col gap-1 rounded-controle bg-trilha px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="inline-flex flex-wrap items-center gap-1.5 text-apoio font-medium text-tinta">{titulo}</span>
        {r.autor && <span className="text-rotulo text-tinta-sussurro">{r.autor}</span>}
        <span className="ml-auto text-rotulo text-tinta-sussurro tabular">{quando(r.em, dia)}</span>
      </div>
      {corpo}
    </section>
  )
}

const COLUNAS: [keyof Omit<LinhaAfericao, 'em' | 'outras'>, string, string][] = [
  ['pa', 'PA', 'mmHg'], ['fc', 'FC', 'bpm'], ['fr', 'FR', 'irpm'], ['temp', 'Temp', '°C'],
  ['spo2', 'SpO2', '%'], ['glicemia', 'Glicemia', 'mg/dL'], ['dor', 'Dor', ''],
]
const LINHAS_INICIAIS = 6

/** Uma linha por aferição, colunas fixas, valores como foram gravados (sem marca de alterado). */
function TabelaSinais({ linhas, dia }: { linhas: LinhaAfericao[]; dia: string | null }) {
  const [todas, setTodas] = useState(false)
  const outras = linhas.some((l) => l.outras.length > 0)
  const vistas = todas ? linhas : linhas.slice(0, LINHAS_INICIAIS)
  return (
    <div className="mt-1.5">
      <p className="mb-1 text-apoio font-semibold text-tinta-apoio">Sinais vitais</p>
      <div className="rounded-controle border border-fio">
        <Table className="text-apoio">
          <TableHeader>
            <TableRow>
              <TableHead className="px-3 py-1.5">Hora</TableHead>
              {COLUNAS.map(([k, rotulo, unidade]) => (
                <TableHead key={k} className="px-3 py-1.5">{unidade ? <abbr title={unidade} className="no-underline">{rotulo}</abbr> : rotulo}</TableHead>
              ))}
              {outras && <TableHead className="px-3 py-1.5">Outras</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vistas.map((l) => (
              <TableRow key={l.em}>
                <TableCell className="px-3 py-1.5 text-tinta-sussurro">{quando(l.em, dia)}</TableCell>
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
