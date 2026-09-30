// ─────────────────────────────────────────────────────────────────────────────
// Os documentos de alta como o paciente lê (alta.html do protótipo).
//
// Quem lê acabou de sair do hospital, provavelmente no celular: o que ele
// precisa fazer primeiro vem primeiro (orientações e receita), o mais formal
// depois (resumo, exames). Bloco sem dado no banco não aparece.
//
// Um PDF por documento: "Baixar em PDF" abre o documento escolhido, marca o
// body e chama a impressão; as regras de impressão escondem todo o resto. A
// equipe (visão da equipe) imprime o pacote inteiro.
// ─────────────────────────────────────────────────────────────────────────────
import { AlertTriangle, ChevronRight, ClipboardList, Download, FileText, FlaskConical, Pill, Printer, ShieldCheck, Signpost, Stethoscope } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  assinatura, dia, diaCurto, hora, idade, legivel, lerAtestado, lerEncaminhamento, lerPedidoExames, lerReceita, lerSumario,
  separarOrientacoes, type ConteudoPacote, type DocumentoPacote,
} from '@/components/alta/lerPacote'

const NOME_DOC: Record<string, string> = {
  receita: 'Receita',
  atestado: 'Atestado',
  encaminhamento: 'Encaminhamento',
  pedido_exames: 'Pedido de exames',
  sumario_alta: 'Resumo da internação',
}
const LINK: Record<string, string> = {
  revogado: 'Este link foi revogado: o paciente não o abre mais.',
  bloqueado: 'Este link foi bloqueado por três códigos errados: o paciente não o abre mais.',
  expirado: 'Este link venceu: o paciente não o abre mais.',
}

// Só na impressão: com um documento pedido, os outros saem da folha.
const CSS_IMPRESSAO = `@media print {
  body { background: #fff !important; }
  body[data-pacote-doc] [data-doc]:not([data-alvo]) { display: none !important; }
}`

type Doc = { id: string; icone: React.ElementType; titulo: string; sub: string; forte?: boolean; corpo: React.ReactNode }

function Assina({ d, feminino, extra }: { d: DocumentoPacote; feminino?: boolean; extra?: string }) {
  const a = assinatura(d)
  if (!a) return null
  const quando = d.assinado_em
    ? `${feminino ? 'assinada' : 'assinado'} eletronicamente em ${dia(d.assinado_em)}, às ${hora(d.assinado_em)}`
    : `${feminino ? 'emitida' : 'emitido'} em ${dia(d.emitido_em)}, às ${hora(d.emitido_em)}`
  return (
    <div className="mt-4 border-t border-trilha pt-3 text-sm text-tinta-sussurro">
      <b className="block text-[15px] font-medium text-tinta">{a.nome}</b>
      {[a.crm, extra, quando].filter(Boolean).join(' · ')}
    </div>
  )
}

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-1.5 mt-4 text-[15px] font-semibold first:mt-1.5">{children}</h3>
)
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2.5 whitespace-pre-wrap text-pretty text-tinta-apoio last:mb-0">{children}</p>
)

function montarDocumentos(p: ConteudoPacote): { docs: Doc[]; diagnostico: string } {
  const docs: Doc[] = []
  const porTipo = (t: string) => p.documentos.filter((d) => d.tipo === t)
  const usados = new Set<DocumentoPacote>()
  let diagnostico = ''

  // orientações + volte ao pronto-socorro
  const { passos, sinais } = separarOrientacoes(p)
  if (passos.length || sinais.length) {
    const m = p.medico ? assinatura({ autor: p.medico.nome, crm: p.medico.crm, uf_crm: p.medico.uf_crm }) : null
    docs.push({
      id: 'orientacoes', icone: ClipboardList, titulo: 'Orientações de alta', sub: 'O que fazer em casa nos próximos dias',
      corpo: (
        <>
          {passos.length > 0 && (
            <ol className="mt-1 list-decimal pl-[22px]">
              {passos.map((o, k) => <li key={k} className="mb-2 text-pretty text-tinta-apoio">{o}</li>)}
            </ol>
          )}
          {sinais.length > 0 && (
            <div className="mt-3.5 rounded-xl border border-critico/20 bg-critico/5 px-[15px] py-[13px]">
              <b className="flex items-center gap-2 text-[15px] font-semibold text-critico"><AlertTriangle className="size-[17px]" />Volte ao pronto-socorro se</b>
              <ul className="mt-2 list-disc pl-5">
                {sinais.map((s, k) => <li key={k} className="mb-1 text-critico">{s}</li>)}
              </ul>
            </div>
          )}
          {m && (
            <div className="mt-4 border-t border-trilha pt-3 text-sm text-tinta-sussurro">
              <b className="block text-[15px] font-medium text-tinta">{m.nome}</b>
              {[m.crm, p.gerado_em ? `entregue em ${dia(p.gerado_em)}, às ${hora(p.gerado_em)}` : ''].filter(Boolean).join(' · ')}
            </div>
          )}
        </>
      ),
    })
  }

  // receitas
  porTipo('receita').forEach((d, k) => {
    const r = lerReceita(d.conteudo)
    if (!r) return
    usados.add(d)
    const n = r.itens.length
    docs.push({
      id: `receita-${k}`, icone: Pill, titulo: 'Receita', forte: true,
      sub: [n ? `${n} ${n === 1 ? 'medicamento' : 'medicamentos'}` : '', d.numero ? `nº ${d.numero}` : ''].filter(Boolean).join(' · '),
      corpo: (
        <>
          {n > 0 && (
            <ul className="mt-1 flex flex-col gap-2.5">
              {r.itens.map((i, j) => (
                <li key={j} className="rounded-xl border border-fio px-3.5 py-3 print:border-fio-forte">
                  <b className="block font-semibold">{i.nome}</b>
                  {i.uso && <span className="mt-0.5 block text-[15px] text-tinta-apoio">{i.uso}</span>}
                  {i.explicacao && <em className="mt-1.5 block text-sm not-italic text-acao">{i.explicacao}</em>}
                </li>
              ))}
            </ul>
          )}
          {r.obs && <div className="mt-3"><P>{r.obs}</P></div>}
          <Assina d={d} feminino />
        </>
      ),
    })
  })

  // atestados
  porTipo('atestado').forEach((d, k) => {
    const a = lerAtestado(d.conteudo)
    if (!a) return
    usados.add(d)
    docs.push({
      id: `atestado-${k}`, icone: ShieldCheck, titulo: 'Atestado', sub: a.titulo,
      corpo: (
        <>
          <P>{a.texto}</P>
          {a.obs && <P>Observações: {a.obs}</P>}
          <Assina d={d} />
        </>
      ),
    })
  })

  // retorno e encaminhamento
  const det = p.retorno_detalhes ?? {}
  const encs = porTipo('encaminhamento').map((d) => ({ d, e: lerEncaminhamento(d.conteudo) })).filter((x) => x.e)
  const ondeQuando = [det.onde, det.quando].filter(Boolean).join(', ')
  if (ondeQuando || p.retorno || det.exame_controle || det.levar || encs.length) {
    encs.forEach((x) => usados.add(x.d))
    const levar = det.levar ? (/^lev/i.test(det.levar) ? det.levar : `Leve ${det.levar}`) : ''
    docs.push({
      id: 'retorno', icone: Signpost, titulo: encs.length ? 'Retorno e encaminhamento' : 'Retorno',
      sub: [det.quando ? `Consulta ${det.quando}` : ondeQuando || p.retorno ? 'Onde e quando voltar' : '',
            det.exame_controle ? 'exame de controle' : '', encs.length ? 'encaminhamento' : ''].filter(Boolean).join(' · '),
      corpo: (
        <>
          {(ondeQuando || p.retorno) && (
            <>
              <H3>Consulta de retorno</H3>
              {ondeQuando && <P>{ondeQuando}.</P>}
              {p.retorno && <P>{p.retorno}</P>}
            </>
          )}
          {det.exame_controle && (<><H3>Exame de controle</H3><P>{det.exame_controle}</P></>)}
          {levar && (<><H3>O que levar</H3><P>{levar}</P></>)}
          {encs.map(({ d, e }, j) => (
            <div key={j}>
              <H3>Encaminhamento{e!.especialidade ? ` para ${e!.especialidade}` : ''}</H3>
              {e!.prioridade && <P>Prioridade: {e!.prioridade}</P>}
              {e!.resumo && <P>{e!.resumo}</P>}
              <Assina d={d} />
            </div>
          ))}
        </>
      ),
    })
  }

  // pedidos de exames
  porTipo('pedido_exames').forEach((d, k) => {
    const linhas = lerPedidoExames(d.conteudo)
    if (!linhas) return
    usados.add(d)
    docs.push({
      id: `pedido-${k}`, icone: FileText, titulo: 'Pedido de exames',
      sub: `${linhas.length} ${linhas.length === 1 ? 'exame' : 'exames'} a fazer`,
      corpo: (
        <>
          <ul className="mt-1 list-disc pl-5">
            {linhas.map((l, j) => <li key={j} className="mb-1 text-tinta-apoio">{l}</li>)}
          </ul>
          <Assina d={d} />
        </>
      ),
    })
  })

  // resumo da internação
  porTipo('sumario_alta').forEach((d, k) => {
    const s = lerSumario(d.conteudo)
    if (!s) return
    usados.add(d)
    diagnostico ||= s.diagnostico
    if (!s.partes.length) return
    docs.push({
      id: `resumo-${k}`, icone: Stethoscope, titulo: 'Resumo da internação', sub: 'O que foi feito no hospital',
      corpo: (
        <>
          {s.partes.map((x, j) => (
            <React.Fragment key={j}>
              {x.titulo && <H3>{x.titulo}</H3>}
              <P>{x.texto}</P>
            </React.Fragment>
          ))}
          <Assina d={d} extra={p.setor ?? undefined} />
        </>
      ),
    })
  })

  // exames com resultado
  const exames = p.exames ?? []
  if (exames.length) {
    docs.push({
      id: 'exames', icone: FlaskConical, titulo: 'Exames do período', sub: 'Resultados registrados na internação',
      corpo: (
        <>
          <table className="mt-1 w-full border-collapse text-[15px]">
            <thead>
              <tr>
                {['Exame', 'Resultado', 'Quando'].map((c) => (
                  <th key={c} className="pb-2 pr-2.5 text-left text-[13px] font-semibold tracking-[0.04em] text-tinta-sussurro uppercase">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exames.map((x, j) => (
                <tr key={j}>
                  <td className="border-t border-trilha py-2 pr-2.5 text-tinta">{x.exame}</td>
                  <td className="border-t border-trilha py-2 pr-2.5 text-tinta-apoio tabular-nums">{x.resultado}</td>
                  <td className="border-t border-trilha py-2 pr-2.5 whitespace-nowrap text-tinta-apoio tabular-nums">{diaCurto(x.quando)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3.5 text-pretty text-tinta-apoio">Os resultados completos ficam no seu prontuário na unidade.</p>
        </>
      ),
    })
  }

  // o que não tem forma conhecida: rótulo e valor, como antes
  p.documentos.filter((d) => !usados.has(d)).forEach((d, k) => {
    const linhas = legivel(d.conteudo)
    if (!linhas.length) return
    docs.push({
      id: `outro-${k}`, icone: FileText, titulo: NOME_DOC[d.tipo] ?? d.tipo,
      sub: [d.numero ? `nº ${d.numero}` : '', dia(d.emitido_em)].filter(Boolean).join(' · '),
      corpo: (
        <>
          <dl className="flex flex-col gap-1 text-[15px]">
            {linhas.map((l, j) => (
              <div key={j}>
                {l.rotulo && <dt className="inline font-medium">{l.rotulo}: </dt>}
                <dd className="inline whitespace-pre-wrap text-tinta-apoio">{l.valor}</dd>
              </div>
            ))}
          </dl>
          <Assina d={d} />
        </>
      ),
    })
  })

  return { docs, diagnostico: diagnostico || p.diagnostico_cid || '' }
}

export function DocumentosAlta({ p, equipe = false }: { p: ConteudoPacote; equipe?: boolean }) {
  const raiz = React.useRef<HTMLDivElement>(null)
  const { docs, diagnostico } = React.useMemo(() => montarDocumentos(p), [p])

  // Um <details> fechado não imprime o conteúdo: os pedidos abrem antes e
  // voltam ao estado em que o leitor os deixou depois.
  function imprimir(id: string | null) {
    const todos = Array.from(raiz.current?.querySelectorAll<HTMLDetailsElement>('details[data-doc]') ?? [])
    const alvos = id ? todos.filter((d) => d.dataset.doc === id) : todos
    const antes = todos.map((d) => d.open)
    alvos.forEach((d) => { d.open = true; d.dataset.alvo = '' })
    if (id) document.body.dataset.pacoteDoc = id
    let feito = false
    const limpar = () => {
      if (feito) return
      feito = true
      todos.forEach((d, k) => { d.open = antes[k]; delete d.dataset.alvo })
      delete document.body.dataset.pacoteDoc
      window.removeEventListener('afterprint', limpar)
    }
    window.addEventListener('afterprint', limpar)
    window.print()
    if (!('onafterprint' in window)) setTimeout(limpar, 1500)
  }

  const nome = p.nome || p.primeiro_nome
  const linha = [idade(p.idade_anos, p.idade_meses), diagnostico].filter(Boolean).join(' · ')
  const local = [p.setor, p.leito ? `leito ${p.leito}` : ''].filter(Boolean)

  return (
    <div ref={raiz}>
      <style>{CSS_IMPRESSAO}</style>
      <main className="mx-auto max-w-[620px] px-5 pb-14 pt-[18px] print:max-w-none print:p-0">
        {equipe && (
          <div className="mb-4 flex flex-wrap items-start gap-2.5 rounded-[14px] border border-marca/20 bg-alerta-marca px-[15px] py-[13px] text-sm text-acao-pressionada print:hidden">
            <ShieldCheck className="mt-[3px] size-[17px] shrink-0 text-acao" />
            <span className="min-w-0 flex-[1_1_260px] text-pretty">
              <b>Visão da equipe.</b> O paciente só chega aqui depois de digitar o código impresso na orientação de alta.
              Imprima o pacote para entregar em mão a quem não tem celular.
              {p.situacao_link && LINK[p.situacao_link] && <> {LINK[p.situacao_link]}</>}
            </span>
            <Button size="lg" className="min-h-11 px-4 text-[15px]" onClick={() => imprimir(null)}>
              <Printer className="size-4" />Imprimir o pacote inteiro
            </Button>
            {window.history.length > 1 && (
              <Button variant="outline" size="lg" className="min-h-11 px-4 text-[15px]" onClick={() => window.history.back()}>
                Voltar ao leito
              </Button>
            )}
          </div>
        )}

        <div className="mb-3 hidden text-[11pt] text-tinta-apoio print:block">
          {p.unidade} · documento emitido eletronicamente pelo Chefe Coruja{p.gerado_em ? ` em ${dia(p.gerado_em)}` : ''}.
        </div>

        <section className="mb-[18px] rounded-2xl border border-fio bg-superficie px-[18px] py-4 print:mb-[14pt] print:rounded-none print:border-0 print:border-b print:border-fio-forte print:px-0 print:pt-0">
          <span className="block text-[19px] font-semibold tracking-[-0.02em]">{nome}</span>
          {linha && <span className="mt-0.5 block text-[15px] text-tinta-apoio">{linha}</span>}
          {(p.internado_em || p.alta_em || local.length > 0) && (
            <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1 border-t border-trilha pt-3 text-[15px] text-tinta-apoio">
              {p.internado_em && <span>Internado em <b className="font-medium text-tinta">{dia(p.internado_em)}</b></span>}
              {p.alta_em && <span>Alta em <b className="font-medium text-tinta">{dia(p.alta_em)}</b></span>}
              {local.length > 0 && <span>{local.join(' · ')}</span>}
            </div>
          )}
        </section>

        {docs.map((d, k) => (
          <details key={d.id} data-doc={d.id} open={k === 0}
            className="group mb-3 overflow-hidden rounded-2xl border border-fio bg-superficie print:m-0 print:break-inside-avoid print:rounded-none print:border-0">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-[18px] py-[15px] max-[420px]:gap-2.5 max-[420px]:px-[15px] print:px-0 print:pb-2 print:pt-0 [&::-webkit-details-marker]:hidden">
              <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-alerta-marca text-acao print:hidden">
                <d.icone className="size-[19px]" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[17px] font-semibold tracking-[-0.01em]">{d.titulo}</b>
                {d.sub && <span className="block text-sm text-tinta-sussurro">{d.sub}</span>}
              </span>
              <ChevronRight className="size-[18px] shrink-0 text-tinta-sussurro transition-transform duration-200 group-open:rotate-90 print:hidden" />
            </summary>
            <div className="px-[18px] pb-[18px] pt-0.5 max-[420px]:px-[15px] print:p-0">
              {d.corpo}
              <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                <Button variant={d.forte ? 'default' : 'outline'} size="lg" className="min-h-11 px-4 text-[15px] max-[420px]:flex-auto"
                  onClick={() => imprimir(d.id)}>
                  <Download className="size-4" />Baixar em PDF
                </Button>
              </div>
            </div>
          </details>
        ))}
        {docs.length === 0 && (
          <p className="rounded-2xl border border-fio bg-superficie px-[18px] py-4 text-tinta-apoio">
            Este pacote não tem documentos. Os papéis entregues na alta continuam valendo.
          </p>
        )}
      </main>

      <footer className="mx-auto max-w-[620px] px-5 pb-[60px] print:hidden">
        <div className="rounded-2xl border border-fio bg-superficie px-[18px] py-4 text-[15px] text-tinta-apoio">
          <span>Este link vale até <b className="font-medium text-tinta">{dia(p.expira_em)}</b>, 30 dias depois de gerado. Depois disso, peça um novo na unidade.</span>
          <div className="mt-3 flex gap-2.5 border-t border-trilha pt-3 text-acao-pressionada">
            <ShieldCheck className="mt-[3px] size-[17px] shrink-0" />
            <span>Cada abertura pede o código impresso na sua orientação de alta. Quem tiver só o link não vê os documentos sem esse código.</span>
          </div>
          <p className="mt-3.5 text-sm text-tinta-sussurro">
            Os documentos com valor legal são as vias entregues na alta. Esta página é uma cópia para consulta.
          </p>
        </div>
      </footer>
    </div>
  )
}
