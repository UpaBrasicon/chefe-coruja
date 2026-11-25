// Anexar exames do leito (modelo do RT de 25/11/2026). O laudo vai para o
// resultado do exame pelo caminho que já existe: o arquivo sobe na área
// privada `exames` e vira a versão do resultado (registrar_resultado_exame;
// para vários exames do mesmo setor, registrar_laudo_grupo).
//
// - PDF ou imagem (JPG, PNG, WEBP), até 10 MB, vários de uma vez (decisão do
//   RT de 25/11/2026). Um arquivo pode valer para vários exames pendentes.
// - O médico pode marcar "alterado", com autor e hora (25/11/2026). O crítico
//   continua só do laboratório: aqui não há como marcar crítico.
// - Exame externo, sem pedido no app, não entra (pergunta ao RT).
// - EX4 da revisão unslop (25/11/2026): o caminho principal é soltar o arquivo
//   no topo e dizer "Para quais exames?" (busca com seleção múltipla); o botão
//   da linha só aparece ao passar o mouse ou com a linha em foco.
import { FileText, Paperclip, Trash2 } from 'lucide-react'
import * as React from 'react'

import type { PedidoLeito } from '@/components/internacao/exames/dados'
import { pendente } from '@/components/internacao/exames/dados'
import { EtiquetaSetor } from '@/components/internacao/documentos/PedidoExamesLeito'
import { TituloCartao, VazioLinha } from '@/components/monitor/Pagina'
import { AreaDeAnexo } from '@/components/ui/area-de-anexo'
import { BuscaMultipla } from '@/components/ui/busca-multipla'
import { Button } from '@/components/ui/button'
import { CaixaMarcar } from '@/components/ui/caixa-marcar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { abrirEmJanela } from '@/lib/abrirEmJanela'
import { tamanhoLegivel } from '@/lib/anexo'
import { caminhoLaudo, erroLaudo, LAUDO_ACEITA, LAUDO_MAX_BYTES, laudoEhImagem, SITUACAO_EXAME, type SituacaoExame } from '@/lib/exames'
import { envioPorSetor, ROTULO_SETOR, type ResultadoLido } from '@/lib/examesAba'
import { dataHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

type Preparado = { chave: string; arquivo: File; exames: string[]; alterado: boolean }

/** Sobe o arquivo e grava o resultado dos exames: um envio por setor; no setor com dois ou mais, o laudo do grupo. */
async function anexar(arquivo: File, exames: PedidoLeito[]): Promise<void> {
  for (const s of envioPorSetor(exames)) {
    const lotes = s.grupo && s.ids.length >= 2 ? [s.ids] : s.ids.map((id) => [id])
    for (const ids of lotes) {
      const caminho = caminhoLaudo(ids[0], arquivo.name, Date.now())
      const up = await supabase.storage.from('exames').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
      if (up.error) throw up.error
      const { error } = ids.length > 1
        ? await supabase.rpc('registrar_laudo_grupo', { p_exames: ids, p_pdf_caminho: caminho, p_pdf_nome: arquivo.name })
        : await supabase.rpc('registrar_resultado_exame', { p_exame: ids[0], p_pdf_caminho: caminho, p_pdf_nome: arquivo.name })
      if (error) throw error
    }
  }
}

export function AnexarExamesLeito({ pedidos, resultados, medico, recarregar }: {
  pedidos: PedidoLeito[]; resultados: ResultadoLido[]; medico: boolean; recarregar: () => void
}) {
  const comResultado = new Set(resultados.map((r) => r.exame_id))
  const aguardando = pedidos.filter((p) => pendente(p) && !comResultado.has(p.id))
  const [preparados, setPreparados] = React.useState<Preparado[]>([])
  const [salvando, setSalvando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const seletor = React.useRef<HTMLInputElement>(null)
  const alvo = React.useRef<string | null>(null)

  const preparar = (arquivos: File[], exames: string[] = []) => {
    setAviso(null)
    setPreparados((xs) => [...xs, ...arquivos.map((arquivo, k) => ({ chave: `${Date.now()}-${k}-${arquivo.name}`, arquivo, exames, alterado: false }))])
  }
  const mudar = (chave: string, d: Partial<Preparado>) => setPreparados((xs) => xs.map((p) => (p.chave === chave ? { ...p, ...d } : p)))
  const tirar = (chave: string) => setPreparados((xs) => xs.filter((p) => p.chave !== chave))

  // "Anexar arquivo" da linha: o seletor do sistema, já com o exame ligado
  const escolherPara = (id: string) => { alvo.current = id; seletor.current?.click() }
  const escolheu = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = [...(e.target.files ?? [])]
    e.target.value = ''
    const problemas = arquivos.map((f) => erroLaudo(f, true)).filter(Boolean)
    if (problemas.length) return setErro(problemas.join(' '))
    setErro(null)
    preparar(arquivos, alvo.current ? [alvo.current] : [])
  }

  const salvar = async () => {
    setErro(null)
    const sem = preparados.find((p) => p.exames.length === 0)
    if (sem) return setErro(`Ligue ${sem.arquivo.name} a pelo menos um exame aguardando.`)
    setSalvando(true)
    let feitos = 0
    try {
      for (const p of preparados) {
        const exames = aguardando.filter((x) => p.exames.includes(x.id))
        await anexar(p.arquivo, exames)
        // "alterado" é do médico, com autor e hora no servidor; crítico, só do laboratório
        if (medico && p.alterado) {
          for (const x of exames) {
            const { error } = await supabase.rpc('marcar_resultado_alterado', { p_exame: x.id, p_alterado: true })
            if (error) throw error
          }
        }
        feitos++
        setPreparados((xs) => xs.filter((y) => y.chave !== p.chave))
      }
      setAviso(`${feitos} ${feitos === 1 ? 'arquivo anexado' : 'arquivos anexados'}.`)
    } catch (e) {
      setErro(`${feitos ? `${feitos} anexado(s). ` : ''}${(e as Error).message}`)
    } finally {
      setSalvando(false)
      recarregar()
    }
  }

  // o mesmo arquivo em vários exames (laudo do grupo) vira uma linha
  const anexos = Object.values(resultados.filter((r) => r.tem_arquivo).reduce<Record<string, ResultadoLido[]>>((acc, r) => {
    const k = `${r.arquivo_nome}|${Math.floor(Date.parse(r.liberado_em) / 60_000)}`
    ;(acc[k] ??= []).push(r)
    return acc
  }, {}))
  const opcoes = aguardando.map((x) => ({ id: x.id, nome: `${x.exame} · ${x.grupo ? ROTULO_SETOR[x.grupo] : 'LAB'}` }))

  return (
    <div className="flex flex-col gap-4">
      <input ref={seletor} type="file" multiple accept={LAUDO_ACEITA} className="hidden" onChange={escolheu} aria-hidden tabIndex={-1} />
      <AreaDeAnexo id="anexar-laudos" multiple accept={LAUDO_ACEITA} maxBytes={LAUDO_MAX_BYTES} validar={(f) => erroLaudo(f, true)}
        titulo="Arraste e solte laudos ou imagens de exames" descricao="PDF, JPG, PNG ou WEBP, até 10 MB cada; um ou vários de uma vez"
        disabled={salvando} onArquivos={(fs) => preparar(fs)} icone={Paperclip} />

      {preparados.length > 0 && (
        <section aria-labelledby="anexos-prontos" className="flex flex-col gap-3 rounded-cartao border border-acao/30 bg-superficie p-4">
          <TituloCartao id="anexos-prontos" className="mb-0"
            extra={<Button size="xs" variant="link" className="min-h-0 px-0" disabled={salvando} onClick={() => setPreparados([])}>Descartar todos</Button>}>
            Arquivos prontos para anexar ({preparados.length})
          </TituloCartao>
          {preparados.map((p) => (
            <div key={p.chave} className="flex flex-col gap-2 rounded-controle border border-fio p-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 shrink-0 text-tinta-sussurro" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-apoio font-medium text-tinta">{p.arquivo.name}</span>
                <span className="shrink-0 text-rotulo text-tinta-sussurro tabular-nums">{laudoEhImagem(p.arquivo.name) ? 'imagem' : 'PDF'} · {tamanhoLegivel(p.arquivo.size)}</span>
                <Button size="icon-xs" variant="ghost" aria-label={`Tirar ${p.arquivo.name}`} disabled={salvando} onClick={() => tirar(p.chave)}><Trash2 aria-hidden /></Button>
              </div>
              <label htmlFor={`anexo-exames-${p.chave}`} className="text-rotulo font-semibold text-tinta-sussurro">
                Para quais exames?{p.exames.length > 0 ? ` ${p.exames.length} ${p.exames.length === 1 ? 'escolhido' : 'escolhidos'}` : ''}
              </label>
              {aguardando.length === 0
                ? <VazioLinha>Nenhum exame aguardando laudo nesta internação.</VazioLinha>
                : <BuscaMultipla id={`anexo-exames-${p.chave}`} opcoes={opcoes} selecionados={p.exames} onChange={(ids) => mudar(p.chave, { exames: ids })}
                    placeholder="Buscar exame aguardando" vazio="Nenhum exame aguardando com esse nome." />}
              {medico && (
                <CaixaMarcar marcado={p.alterado} onChange={(v) => mudar(p.chave, { alterado: v })} desabilitado={salvando}>
                  <span className="text-apoio text-tinta">Resultado alterado</span>
                  <span className="text-rotulo text-tinta-sussurro">Fica com seu nome e a hora. Não é o crítico: o crítico vem só do laboratório.</span>
                </CaixaMarcar>
              )}
            </div>
          ))}
          <div className="flex justify-end">
            <Button disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Anexando…' : `Salvar ${preparados.length === 1 ? 'anexo' : 'anexos'}`}</Button>
          </div>
        </section>
      )}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
      {aviso && <p role="status" className="text-apoio text-conforme">{aviso}</p>}

      <section aria-labelledby="aguardando-laudo" className="flex flex-col gap-2 rounded-cartao border border-fio bg-superficie p-4">
        <TituloCartao id="aguardando-laudo" className="mb-0" extra={`${aguardando.length} ${aguardando.length === 1 ? 'pendente' : 'pendentes'}`}>Aguardando laudo / arquivo</TituloCartao>
        {aguardando.length === 0 ? <VazioLinha>Nenhum exame aguardando laudo nesta internação.</VazioLinha> : (
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow><TableHead>Exame</TableHead><TableHead>Setor</TableHead><TableHead>Solicitado em</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ação</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {/* EX4: a situação em cor neutra; "Anexar arquivo" só ao passar o mouse ou com a linha em foco
                  (em tela de toque, sempre à vista) */}
              {aguardando.map((x) => (
                <TableRow key={x.id} className="group">
                  <TableCell className="font-medium text-tinta">{x.exame}</TableCell>
                  <TableCell><EtiquetaSetor grupo={x.grupo} /></TableCell>
                  <TableCell className="whitespace-nowrap text-apoio text-tinta-apoio">{dataHora(x.pedido_em)}</TableCell>
                  <TableCell className="text-apoio text-tinta-apoio">{SITUACAO_EXAME[x.situacao as SituacaoExame] ?? x.situacao}</TableCell>
                  <TableCell className="text-right">
                    <Button size="xs" variant="outline" disabled={salvando} onClick={() => escolherPara(x.id)} aria-label={`Anexar arquivo a ${x.exame}`}
                      className="[@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100">
                      <Paperclip aria-hidden /> Anexar arquivo
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="laudos-anexados" className="flex flex-col gap-2 rounded-cartao border border-fio bg-superficie p-4">
        <TituloCartao id="laudos-anexados" className="mb-0" extra={`${anexos.length} ${anexos.length === 1 ? 'documento' : 'documentos'}`}>Laudos e arquivos anexados</TituloCartao>
        {anexos.length === 0 ? <VazioLinha>Nenhum laudo ou arquivo anexado nesta internação.</VazioLinha> : (
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow><TableHead>Documento</TableHead><TableHead>Exames</TableHead><TableHead>Data / hora</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {anexos.map((rs) => <LinhaAnexo key={rs[0].resultado_id} rs={rs} medico={medico} recarregar={recarregar} />)}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}

function LinhaAnexo({ rs, medico, recarregar }: { rs: ResultadoLido[]; medico: boolean; recarregar: () => void }) {
  const r = rs[0]
  const [erro, setErro] = React.useState<string | null>(null)
  const [mudando, setMudando] = React.useState(false)
  const alterado = rs.some((x) => x.alterado_em)
  // a aba abre no clique (abrirEmJanela): o bloqueador de pop-up barra a que abre depois
  const visualizar = () => {
    setErro(null)
    void abrirEmJanela(async () => {
      const { data, error } = await supabase.rpc('exame_laudo_abrir', { p_resultado: r.resultado_id })
      if (error) throw error
      const url = await supabase.storage.from('exames').createSignedUrl((data as unknown as { caminho: string }).caminho, 60)
      if (url.error) throw url.error
      return url.data.signedUrl
    }).catch((e: Error) => setErro(e.message))
  }
  const marcar = async (v: boolean) => {
    setMudando(true); setErro(null)
    for (const x of rs) {
      const { error } = await supabase.rpc('marcar_resultado_alterado', { p_exame: x.exame_id, p_alterado: v })
      if (error) { setErro(error.message); break }
    }
    setMudando(false)
    recarregar()
  }
  const marcadoPor = rs.find((x) => x.alterado_em)
  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2">
          <FileText className="size-4 shrink-0 text-tinta-sussurro" aria-hidden />
          <span className="min-w-0 truncate text-apoio font-medium text-tinta">{r.arquivo_nome ?? 'laudo'}</span>
        </span>
        <span className="block text-rotulo text-tinta-sussurro">{r.origem === 'manual' ? `anexado${r.registrado_por ? ` por ${r.registrado_por}` : ''}` : r.origem === 'imagem' ? 'do serviço de imagem' : 'do laboratório'}</span>
      </TableCell>
      <TableCell className="text-apoio text-tinta">{rs.map((x) => x.exame).join(', ')}</TableCell>
      <TableCell className="whitespace-nowrap text-apoio text-tinta-apoio">{dataHora(r.liberado_em)}</TableCell>
      <TableCell className="text-apoio">
        {rs.some((x) => x.critico) && <span className="block font-semibold text-critico">crítico (laboratório)</span>}
        {alterado
          ? <span className="block font-semibold text-atencao" title={marcadoPor?.alterado_em ? `Marcado em ${dataHora(marcadoPor.alterado_em)}` : undefined}>
              alterado{marcadoPor?.alterado_por ? ` · ${marcadoPor.alterado_por}` : ''}
            </span>
          : <span className="block text-tinta-apoio">anexado</span>}
        {erro && <span role="alert" className="block text-rotulo text-critico">{erro}</span>}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <span className="inline-flex gap-1">
          <Button size="xs" variant="outline" onClick={visualizar}>Visualizar</Button>
          {medico && (
            <Button size="xs" variant="outline" disabled={mudando} onClick={() => void marcar(!alterado)}>{alterado ? 'Tirar alterado' : 'Marcar alterado'}</Button>
          )}
        </span>
      </TableCell>
    </TableRow>
  )
}
