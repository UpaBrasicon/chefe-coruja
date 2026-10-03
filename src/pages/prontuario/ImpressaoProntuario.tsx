// Impressão de prontuário (protótipo index.html 2367–2398, pronVals ~30731;
// ESTADO.md etapa 13; manual 3.18 e 3.19; Bloco 5 item 5 para os anexos).
//
// Escolher o paciente (entre os que a pessoa pode atender: abrir o
// prontuário registra o acesso), marcar documentos emitidos e anexos,
// filtrar por palavra-chave, agrupar por data, informar QUEM AUTORIZOU e QUEM
// RECEBE (nome e documento). "Imprimir" registra a cópia no servidor
// (registrar_impressao_prontuario, protocolo PRO-…) e monta UMA janela com:
//   * a folha de cada documento que tem folha no servidor (edge function
//     `folha`, que também registra a impressão de cada documento);
//   * os demais (sem folha, cancelados) num bloco de texto com o estado;
//   * a Declaração de Recebimento no fim (anexos entram na lista; o arquivo
//     é entregue à parte).
// O histórico mostra as cópias do paciente: copiar marcação e cancelar
// (justificativa de 10+ letras). Anexo tem sigilo reforçado: o arquivo só
// abre com o prontuário aberto; cancelar anexo não apaga o arquivo.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, FileText, Paperclip, Printer, Search, X } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  type DocumentoEpisodio, diaHora, estadoDoDocumento, NOME_ESTADO, COR_ESTADO, rotuloDocumento, TIPOS_COM_FOLHA,
} from '@/components/documento/documentos'
import { TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { abrirProntuario, folhaDoDocumentoEmitido } from '@/lib/prontuario'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const MAX_ANEXO = 10 * 1024 * 1024
const MIN_CANCELAR = 10

type Anexo = {
  id: string; nome: string; tipo_mime: string; tamanho: number; caminho: string; criado_em: string
  autor_id: string; cancelado_em: string | null; motivo_cancelamento: string | null
}
type Impressao = {
  id: string; protocolo: string; impresso_em: string; impresso_por: string | null; meu: boolean
  documentos: string[]; anexos: string[]; itens: { tipo: 'documento' | 'anexo'; id: string; documento?: string; numero?: string; nome?: string }[]
  autorizador: string; observacao: string | null; recebedor_nome: string; recebedor_documento: string
  estado: 'impressa' | 'cancelada'; cancelada_em: string | null; cancelada_por: string | null; motivo_cancelamento: string | null
}
type PacienteCopia = {
  id: string; nome: string; nome_social: string | null; nome_mae: string | null; data_nascimento: string | null
  cpf: string | null; cns: string | null; prontuario: string | null
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const dataCivil = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
const nomeItem = (d: DocumentoEpisodio) => rotuloDocumento(d.tipo) + (d.numero ? ` nº ${d.numero}` : '') + (d.versao > 1 ? ` (versão ${d.versao})` : '')

/** Conteúdo do documento (JSON do formulário ou texto) em linhas "campo: valor". */
function linhasDoConteudo(conteudo: string | null): string[] {
  if (!conteudo) return []
  let v: unknown
  try { v = JSON.parse(conteudo) } catch { return conteudo.split('\n') }
  const saida: string[] = []
  const rot = (k: string) => k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
  const andar = (x: unknown, prefixo: string) => {
    if (x == null || x === '') return
    if (Array.isArray(x)) { x.forEach((y, i) => andar(y, `${prefixo} ${i + 1}`.trim())); return }
    if (typeof x === 'object') { for (const [k, y] of Object.entries(x)) andar(y, prefixo ? `${prefixo} › ${rot(k)}` : rot(k)); return }
    saida.push(prefixo ? `${prefixo}: ${String(x)}` : String(x))
  }
  andar(v, '')
  return saida
}

/** Bloco de texto para documento sem folha no servidor, ou cancelado. */
function blocoTexto(d: DocumentoEpisodio): string {
  const e = estadoDoDocumento(d)
  const selo = e === 'cancelado'
    ? `<div class="selo">CANCELADO em ${esc(diaHora(d.cancelado_em))} por ${esc(d.cancelado_por)} — “${esc(d.motivo_cancelamento)}”</div>`
    : e === 'retificado' ? '<div class="selo cinza">VERSÃO SUBSTITUÍDA POR RETIFICAÇÃO</div>' : ''
  return `<section class="doc"><h2>${esc(nomeItem(d))}</h2>
<p class="meta">Emitido em ${esc(diaHora(d.emitido_em ?? d.criado_em))} por ${esc(d.autor)} · estado: ${esc(NOME_ESTADO[e])}</p>${selo}
<div class="corpo">${linhasDoConteudo(d.conteudo).map((l) => `<p>${esc(l)}</p>`).join('')}</div></section>`
}

// O atestado e as outras folhas de duas vias ajustam a fonte para caber na
// via (script `caber` de lib/folhas). Dentro da sombra o script da folha não
// roda, então a cópia faz o mesmo ajuste daqui.
function caberVias(raiz: ParentNode) {
  for (const via of raiz.querySelectorAll<HTMLElement>('.via')) {
    via.style.fontSize = ''
    let fs = 11
    const alto = () => {
      const ultimo = via.lastElementChild
      return ultimo ? ultimo.getBoundingClientRect().bottom - via.getBoundingClientRect().top : 0
    }
    while (alto() > via.clientHeight + 1 && fs > 7.5) {
      fs -= 0.2
      via.style.fontSize = `${fs}pt`
    }
  }
}

// a numeração "Página X de Y" das folhas não vale dentro da sombra: a cópia
// numera as próprias páginas
const ESTILO_COPIA = `@page{size:A4 portrait;margin:12mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:8pt Arial,Helvetica,sans-serif;color:#555}}
body{margin:0;font:12px/1.45 system-ui,sans-serif;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.capa,.doc,.decl{page-break-after:always;break-after:page;padding:4mm 0}
.folha{page-break-after:always;break-after:page}
h1{font-size:18px;margin:0 0 6px}h2{font-size:15px;margin:0 0 4px}
.meta{color:#475569;margin:0 0 8px}.corpo p{margin:0 0 3px;white-space:pre-wrap}
.selo{border:1.5px solid #B91C1C;color:#B91C1C;font-weight:700;padding:4px 8px;margin:6px 0 10px}
.selo.cinza{border-color:#64748B;color:#475569}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #94a3b8;padding:4px 6px;text-align:left;vertical-align:top}
.assin{display:flex;gap:24px;margin-top:40px}.assin div{flex:1;border-top:1px solid #0f172a;padding-top:4px;text-align:center}
.rodape{margin-top:18px;color:#64748B;font-size:10px}`

export default function ImpressaoProntuario() {
  const { unidadeAtiva, papelAtivo } = useUnidade() as ReturnType<typeof useUnidade> & { papelAtivo?: string | null }
  const unidadeId = unidadeAtiva?.unidade_id
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const pacienteId = params.get('paciente')

  const [busPac, setBusPac] = React.useState('')
  const [busca, setBusca] = React.useState('')
  const [porData, setPorData] = React.useState(false)
  const [sel, setSel] = React.useState<Set<string>>(new Set())
  const [selA, setSelA] = React.useState<Set<string>>(new Set())
  const [aut, setAut] = React.useState('')
  const [obs, setObs] = React.useState('')
  const [recNome, setRecNome] = React.useState('')
  const [recDoc, setRecDoc] = React.useState('')
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [imprimindo, setImprimindo] = React.useState(false)
  const [enviando, setEnviando] = React.useState(false)
  const [vendo, setVendo] = React.useState<DocumentoEpisodio | null>(null)
  const [cancelando, setCancelando] = React.useState<{ tipo: 'impressao' | 'anexo'; id: string } | null>(null)
  const [cancTxt, setCancTxt] = React.useState('')

  const termo = busPac.trim()
  const pacientes = useQuery({
    queryKey: ['impressao-prontuario-pacientes', unidadeId, termo],
    enabled: !!unidadeId && termo.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('id, nome, prontuario, data_nascimento')
        .eq('unidade_id', unidadeId!).ilike('nome', `%${termo.replace(/[%_,()]/g, ' ')}%`).order('nome').limit(30)
      if (error) throw error
      return data ?? []
    },
  })

  const prontuario = useQuery({
    queryKey: ['impressao-prontuario-docs', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      await abrirProntuario(pacienteId!)
      const [pac, docs, anexos, hist] = await Promise.all([
        supabase.from('pacientes').select('id, nome, nome_social, nome_mae, data_nascimento, cpf, cns, prontuario').eq('id', pacienteId!).maybeSingle(),
        supabase.rpc('documentos_do_paciente', { p_paciente: pacienteId!, p_tudo: true, p_com_conteudo: true }),
        supabase.from('anexos_prontuario').select('id, nome, tipo_mime, tamanho, caminho, criado_em, autor_id, cancelado_em, motivo_cancelamento')
          .eq('paciente_id', pacienteId!).order('criado_em', { ascending: false }),
        supabase.rpc('impressoes_do_prontuario', { p_paciente: pacienteId! }),
      ])
      for (const r of [pac, docs, anexos, hist]) if (r.error) throw r.error
      if (!pac.data) throw new Error('Paciente fora do seu acesso.')
      const emitidos = ((docs.data ?? []) as unknown as DocumentoEpisodio[]).filter((d) => d.numero && d.estado !== 'rascunho')
      return {
        paciente: pac.data as PacienteCopia,
        documentos: emitidos,
        anexos: (anexos.data ?? []) as Anexo[],
        historico: (hist.data ?? []) as unknown as Impressao[],
      }
    },
  })

  const escolher = (id: string) => {
    setParams({ paciente: id })
    setSel(new Set()); setSelA(new Set()); setBusca(''); setAviso(null); setCancelando(null)
  }

  const docs = prontuario.data?.documentos ?? []
  const k = busca.trim().toLowerCase()
  const visiveis = docs.filter((d) => k.length < 3 || [nomeItem(d), d.autor ?? '', d.conteudo ?? ''].join(' ').toLowerCase().includes(k))
  const ordenados = porData ? [...visiveis].sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em)) : visiveis
  const grupos: [string, DocumentoEpisodio[]][] = porData
    ? [...ordenados.reduce((m, d) => m.set(dia(d.criado_em), [...(m.get(dia(d.criado_em)) ?? []), d]), new Map<string, DocumentoEpisodio[]>())]
    : [['', ordenados]]
  const anexos = prontuario.data?.anexos ?? []
  const selDocs = docs.filter((d) => sel.has(d.id))
  const selAnex = anexos.filter((a) => selA.has(a.id) && !a.cancelado_em)
  const pronto = !!pacienteId && selDocs.length + selAnex.length > 0 && aut.trim().length >= 3 && recNome.trim().length >= 3 && recDoc.trim().length >= 3
  const recarregar = () => void qc.invalidateQueries({ queryKey: ['impressao-prontuario-docs', pacienteId] })
  const ehGestor = papelAtivo === 'gestor'

  const alternar = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => setter((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  async function anexar(ev: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(ev.target.files ?? [])
    ev.target.value = ''
    if (!pacienteId || !prontuario.data) return
    const unidadeDoPaciente = unidadeId
    setAviso(null)
    setEnviando(true)
    try {
      for (const f of arquivos) {
        if (!(f.type === 'application/pdf' || f.type.startsWith('image/'))) { setAviso(`${f.name}: só PDF ou imagem.`); continue }
        if (f.size > MAX_ANEXO) { setAviso(`${f.name}: acima de 10 MB. Reduza o arquivo.`); continue }
        const caminho = `${unidadeDoPaciente}/${pacienteId}/prontuario/${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const up = await supabase.storage.from('atendimento').upload(caminho, f, { upsert: false, contentType: f.type })
        if (up.error) { setAviso(`${f.name}: ${up.error.message}`); continue }
        const r = await supabase.rpc('registrar_anexo_prontuario', {
          p_paciente: pacienteId, p_caminho: caminho, p_nome: f.name, p_tipo_mime: f.type, p_tamanho: f.size,
        })
        if (r.error) setAviso(`${f.name}: ${r.error.message}`)
      }
    } finally {
      setEnviando(false)
      recarregar()
    }
  }

  async function abrirAnexo(a: Anexo) {
    const janela = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('atendimento').createSignedUrl(a.caminho, 120)
    if (error || !data) {
      janela?.close()
      setAviso(`Não foi possível abrir ${a.nome}: ${error?.message ?? 'sem acesso'}`)
      return
    }
    if (janela) janela.location.href = data.signedUrl
  }

  async function confirmarCancelamento() {
    if (!cancelando || cancTxt.trim().length < MIN_CANCELAR) return
    const r = cancelando.tipo === 'impressao'
      ? await supabase.rpc('cancelar_impressao_prontuario', { p_impressao: cancelando.id, p_motivo: cancTxt.trim() })
      : await supabase.rpc('cancelar_anexo_prontuario', { p_anexo: cancelando.id, p_motivo: cancTxt.trim() })
    if (r.error) { setAviso(r.error.message); return }
    if (cancelando.tipo === 'anexo') setSelA((s) => { const n = new Set(s); n.delete(cancelando.id); return n })
    setCancelando(null)
    setCancTxt('')
    recarregar()
  }

  function copiarMarcacao(h: Impressao) {
    setSel(new Set(h.documentos.filter((id) => docs.some((d) => d.id === id))))
    setSelA(new Set(h.anexos.filter((id) => anexos.some((a) => a.id === id && !a.cancelado_em))))
    setAut(h.autorizador)
    setObs(h.observacao ?? '')
    setRecNome(h.recebedor_nome)
    setRecDoc(h.recebedor_documento)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function imprimir() {
    if (!pronto || !prontuario.data) return
    // a janela abre dentro do clique, senão o navegador bloqueia
    const janela = window.open('', '_blank')
    if (!janela) { setAviso('O navegador bloqueou a janela de impressão. Libere pop-ups para este endereço.'); return }
    janela.document.write('<p style="font:15px system-ui,sans-serif;padding:24px;color:#475569">Registrando a cópia do prontuário…</p>')
    setImprimindo(true)
    setAviso(null)
    try {
      const ordem = [...selDocs].sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em))
      const { data, error } = await supabase.rpc('registrar_impressao_prontuario', {
        p_paciente: pacienteId!, p_documentos: ordem.map((d) => d.id), p_anexos: selAnex.map((a) => a.id),
        p_autorizador: aut.trim(), p_observacao: obs.trim(), p_recebedor_nome: recNome.trim(), p_recebedor_documento: recDoc.trim(),
      })
      if (error || !data) {
        janela.document.body.innerHTML = `<p style="font:15px system-ui,sans-serif;padding:24px;color:#B91C1C">Não foi possível registrar a cópia: ${esc(error?.message)}. Nada foi impresso.</p>`
        return
      }
      const reg = data as unknown as { id: string; protocolo: string; impresso_em: string }
      const pac = prontuario.data.paciente
      const partes: { html: string; folha: boolean }[] = []
      for (const d of ordem) {
        const e = estadoDoDocumento(d)
        if (TIPOS_COM_FOLHA.has(d.tipo) && (e === 'emitido' || e === 'assinado' || e === 'retificado')) {
          const f = await folhaDoDocumentoEmitido(d.id, `Cópia do prontuário ${reg.protocolo}`)
          if ('html' in f) { partes.push({ html: f.html, folha: true }); continue }
        }
        partes.push({ html: blocoTexto(d), folha: false })
      }
      const itens = [...ordem.map((d) => nomeItem(d) + (estadoDoDocumento(d) === 'cancelado' ? ' — CANCELADO' : '')), ...selAnex.map((a) => `Anexo · ${a.nome}`)]
      const quando = new Date(reg.impresso_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      const capa = `<section class="capa"><h1>Cópia de prontuário · ${esc(reg.protocolo)}</h1>
<p class="meta">${esc(pac.nome)}${pac.prontuario ? ` · prontuário ${esc(pac.prontuario)}` : ''} · ${esc(unidadeAtiva?.unidade?.nome ?? '')}</p>
<p>${itens.length} ${itens.length === 1 ? 'item' : 'itens'} · impressa em ${esc(quando)} por ${esc(perfil?.nome_completo ?? '')}</p>
<ol>${itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ol></section>`
      const decl = `<section class="decl"><h1>Declaração de recebimento</h1>
<p>Declaro ter recebido cópia dos documentos do prontuário abaixo, do paciente identificado, entregue pelo serviço em ${esc(quando)}.</p>
<table><tbody>
<tr><th>Paciente</th><td>${esc(pac.nome_social ? `${pac.nome_social} (${pac.nome})` : pac.nome)}</td></tr>
<tr><th>Nome da mãe</th><td>${esc(pac.nome_mae ?? '—')}</td></tr>
<tr><th>Nascimento</th><td>${esc(dataCivil(pac.data_nascimento))}</td></tr>
<tr><th>CPF / CNS</th><td>${esc(pac.cpf ?? '—')} / ${esc(pac.cns ?? '—')}</td></tr>
<tr><th>Prontuário</th><td>${esc(pac.prontuario ?? '—')}</td></tr>
<tr><th>Documentos e anexos</th><td>${itens.map((i) => esc(i)).join('<br>')}${selAnex.length ? '<br><em>Os anexos são entregues à parte.</em>' : ''}</td></tr>
<tr><th>Autorizado por</th><td>${esc(aut.trim())}</td></tr>
${obs.trim() ? `<tr><th>Observação</th><td>${esc(obs.trim())}</td></tr>` : ''}
<tr><th>Recebido por</th><td>${esc(recNome.trim())} · documento ${esc(recDoc.trim())}</td></tr>
</tbody></table>
<div class="assin"><div>${esc(recNome.trim())}<br>Quem recebe</div><div>${esc(perfil?.nome_completo ?? '')}<br>Quem entrega</div></div>
<p class="rodape">Cópia ${esc(reg.protocolo)} registrada no Chefe Coruja em ${esc(quando)}. O registro de impressão fica no prontuário do paciente.</p></section>`

      const doc = janela.document
      doc.open()
      doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Prontuário · ${esc(reg.protocolo)}</title><style>${ESTILO_COPIA}</style></head><body>${capa}<div id="docs"></div>${decl}</body></html>`)
      doc.close()
      // cada folha fica isolada numa sombra (o CSS de uma não vaza para outra);
      // rodapé fixo da folha vira rodapé do fim da folha
      const alvo = doc.getElementById('docs')!
      const sombras: ShadowRoot[] = []
      for (const p of partes) {
        const host = doc.createElement('div')
        if (!p.folha) { host.innerHTML = p.html; alvo.appendChild(host); continue }
        const lido = new DOMParser().parseFromString(p.html, 'text/html')
        // a marca RASCUNHO/CANCELADO da folha mora na classe do <body>: passa
        // para o host e o seletor vira :host(...); a marca fica presa à folha
        // (absolute), sem se repetir nas outras páginas da cópia
        host.className = ['folha', ...lido.body.classList].join(' ')
        const estilos = [...lido.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')
          .replace(/body\.(rascunho|cancelado)/g, ':host(.$1)')
        const sombra = host.attachShadow({ mode: 'open' })
        sombra.innerHTML =
          `<style>${estilos}\n[style*="position:fixed"],[style*="position: fixed"]{position:static!important;margin-top:4mm}` +
          `#folha{position:relative}#folha::after{position:absolute!important}</style>${lido.body.innerHTML}`
        alvo.appendChild(host)
        sombras.push(sombra)
      }
      const ajustar = () => sombras.forEach(caberVias)
      ajustar()
      janela.addEventListener('beforeprint', ajustar)
      setSel(new Set()); setSelA(new Set())
      janela.focus()
      setTimeout(() => janela.print(), 700)
    } finally {
      setImprimindo(false)
      recarregar()
    }
  }

  const cabecalhoCaixa = 'flex flex-col gap-2.5 rounded-cartao border border-fio bg-superficie px-5 py-4 shadow-repouso'
  const marca = (on: boolean) => cn('grid size-5 shrink-0 place-items-center rounded-micro border text-[12px] font-bold text-white',
    on ? 'border-acao bg-acao' : 'border-fio-forte bg-superficie')

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <Trilha niveis={[{ rotulo: 'Plantão', to: '/plantao' }, { rotulo: 'Internação', to: '/plantao/internacao' }, { rotulo: 'Impressão de prontuário' }]} />
      <TituloPagina icone={Printer} titulo="Impressão de prontuário"
        descricao="Cópia do prontuário com autorização e declaração de recebimento. Tudo fica registrado." />

      <div className={cabecalhoCaixa}>
        <h3 className="text-corpo font-semibold text-tinta">Paciente</h3>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
          <Input value={busPac} onChange={(e) => setBusPac(e.target.value)} placeholder="Pesquisar paciente pelo nome" className="pl-9" aria-label="Pesquisar paciente" />
        </div>
        {termo.length >= 2 && (
          <div className="flex flex-wrap gap-1.5">
            {pacientes.isLoading && <Spinner />}
            {(pacientes.data ?? []).map((p) => (
              <button key={p.id} type="button" onClick={() => escolher(p.id)}
                className={cn('rounded-capsula border px-[13px] py-1.5 text-apoio',
                  pacienteId === p.id ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao')}>
                {p.nome}{p.prontuario ? ` · ${p.prontuario}` : ''}{p.data_nascimento ? ` · ${dataCivil(p.data_nascimento)}` : ''}
              </button>
            ))}
            {pacientes.data?.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum paciente com esse nome no seu acesso.</span>}
          </div>
        )}
      </div>

      {pacienteId && prontuario.isLoading && <div className="flex h-32 items-center justify-center"><Spinner /></div>}
      {prontuario.error && <p role="alert" className="rounded-controle bg-alerta-critico p-3 text-apoio text-critico">{(prontuario.error as Error).message}</p>}
      {aviso && <p role="alert" className="rounded-controle bg-alerta-critico p-3 text-apoio text-critico">{aviso}</p>}

      {prontuario.data && (
        <>
          <div className={cabecalhoCaixa}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-corpo font-semibold text-tinta">Documentos clínicos · {prontuario.data.paciente.nome}</h3>
              <Button size="sm" variant={porData ? 'default' : 'outline'} aria-pressed={porData} onClick={() => setPorData((v) => !v)}>Agrupar por data</Button>
              <Button size="sm" variant="outline" onClick={() => setSel(new Set(visiveis.map((d) => d.id)))}>Marcar todos</Button>
              {sel.size > 0 && <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Desmarcar</Button>}
            </div>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Palavra-chave (ao menos 3 letras)" aria-label="Palavra-chave" />
            {k && k.length < 3 && <span className="text-apoio text-atencao">Digite ao menos três letras para filtrar.</span>}
            {grupos.map(([g, lista]) => (
              <div key={g || 'todos'} className="flex flex-col">
                {g && <div className="pt-2 pb-1 text-rotulo font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">{g}</div>}
                {lista.map((d) => {
                  const e = estadoDoDocumento(d)
                  return (
                    <div key={d.id} className="flex flex-wrap items-center gap-2.5 border-b border-trilha py-1.5">
                      <button type="button" role="checkbox" aria-checked={sel.has(d.id)} aria-label={`Marcar ${nomeItem(d)}`}
                        onClick={() => alternar(setSel, d.id)} className={marca(sel.has(d.id))}>{sel.has(d.id) ? '✓' : ''}</button>
                      <span className={cn('min-w-0 flex-[1_1_200px] text-corpo', e === 'cancelado' ? 'text-tinta-sussurro line-through' : 'text-tinta')}>
                        {nomeItem(d)} <span className="text-apoio text-tinta-sussurro">· {d.autor ?? '—'}</span>
                      </span>
                      {e !== 'emitido' && <Badge variant={COR_ESTADO[e]}>{NOME_ESTADO[e]}</Badge>}
                      <span className="text-rotulo text-tinta-sussurro tabular-nums">{diaHora(d.emitido_em ?? d.criado_em)}</span>
                      <Button size="sm" variant="outline" onClick={() => setVendo(d)}>Visualizar</Button>
                    </div>
                  )
                })}
              </div>
            ))}
            {visiveis.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum documento emitido para este paciente com esse filtro.</span>}
          </div>

          <div className={cabecalhoCaixa}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="flex items-center gap-2 text-corpo font-semibold text-tinta"><Paperclip className="size-4 text-marca" aria-hidden />Anexos do prontuário</h3>
              <label className={cn('ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-controle-sm border border-fio bg-superficie px-2.5 py-1.5 text-apoio text-tinta-apoio hover:border-acao hover:text-acao',
                enviando && 'pointer-events-none opacity-50')}>
                {enviando ? <Spinner /> : <Paperclip className="size-3.5" aria-hidden />} Anexar PDF ou imagem
                <input type="file" multiple accept="application/pdf,image/*" onChange={(e) => void anexar(e)} className="hidden" />
              </label>
            </div>
            {anexos.map((a) => (
              <div key={a.id} className="flex flex-col gap-1 border-b border-trilha py-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button type="button" role="checkbox" aria-checked={selA.has(a.id)} aria-label={`Marcar ${a.nome}`} disabled={!!a.cancelado_em}
                    onClick={() => alternar(setSelA, a.id)} className={cn(marca(selA.has(a.id)), a.cancelado_em && 'opacity-40')}>{selA.has(a.id) ? '✓' : ''}</button>
                  <span className={cn('min-w-0 flex-[1_1_200px] text-corpo [overflow-wrap:anywhere]', a.cancelado_em ? 'text-tinta-sussurro line-through' : 'text-tinta')}>
                    {a.nome} <span className="text-apoio text-tinta-sussurro">· {Math.max(1, Math.round(a.tamanho / 1024))} KB · {diaHora(a.criado_em)}</span>
                  </span>
                  <Button size="sm" variant="outline" onClick={() => void abrirAnexo(a)}><ExternalLink /> Abrir</Button>
                  {!a.cancelado_em && (a.autor_id === perfil?.id || ehGestor) && (
                    <Button size="sm" variant="destructive" onClick={() => { setCancelando({ tipo: 'anexo', id: a.id }); setCancTxt('') }}><X /> Cancelar</Button>
                  )}
                </div>
                {a.cancelado_em && <span className="text-rotulo text-critico">Cancelado em {diaHora(a.cancelado_em)} · “{a.motivo_cancelamento}”. O arquivo não é apagado.</span>}
                {cancelando?.tipo === 'anexo' && cancelando.id === a.id && (
                  <Cancelamento txt={cancTxt} setTxt={setCancTxt} onDesistir={() => setCancelando(null)} onConfirmar={() => void confirmarCancelamento()} />
                )}
              </div>
            ))}
            {anexos.length === 0 && (
              <span className="text-apoio text-tinta-sussurro">Nenhum anexo. Anexos entram na declaração de recebimento; o arquivo é entregue à parte. Só abre com o prontuário aberto (sigilo reforçado).</span>
            )}
          </div>

          <div className={cabecalhoCaixa}>
            <div className="flex flex-wrap gap-2.5">
              <Campo rotulo="Autorizador (obrigatório)" valor={aut} set={setAut} dica="Quem autorizou a cópia" classe="flex-[1_1_240px]" />
              <Campo rotulo="Observação" valor={obs} set={setObs} dica="Ex.: solicitação do paciente, ofício nº" classe="flex-[2_1_280px]" />
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Campo rotulo="Quem recebe (obrigatório)" valor={recNome} set={setRecNome} dica="Nome de quem recebe a cópia" classe="flex-[2_1_280px]" />
              <Campo rotulo="Documento de quem recebe (obrigatório)" valor={recDoc} set={setRecDoc} dica="RG, CPF ou outro" classe="flex-[1_1_200px]" />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-apoio text-tinta-apoio">
                {selDocs.length} {selDocs.length === 1 ? 'documento' : 'documentos'} e {selAnex.length} {selAnex.length === 1 ? 'anexo' : 'anexos'} selecionados
              </span>
              <Button className="ml-auto" disabled={!pronto || imprimindo} onClick={() => void imprimir()}>
                {imprimindo ? <Spinner /> : <Printer />} Imprimir prontuário
              </Button>
            </div>
          </div>

          <div className={cabecalhoCaixa}>
            <h3 className="text-corpo font-semibold text-tinta">Impressões deste paciente</h3>
            {prontuario.data.historico.map((h) => {
              const cancelada = h.estado === 'cancelada'
              const nomes = h.itens.map((i) => i.tipo === 'anexo' ? `Anexo · ${i.nome}` : `${rotuloDocumento(i.documento ?? '')}${i.numero ? ` nº ${i.numero}` : ''}`)
              return (
                <div key={h.id} title={cancelada ? `Cancelada por ${h.cancelada_por ?? '—'} em ${diaHora(h.cancelada_em)}` : undefined}
                  className="flex flex-col gap-0.5 border-b border-trilha py-2 last:border-0">
                  <span className={cn('text-corpo font-medium', cancelada ? 'text-tinta-sussurro line-through' : 'text-tinta')}>
                    {h.protocolo} · {diaHora(h.impresso_em)} · {h.impresso_por ?? '—'}
                  </span>
                  <span className="text-apoio text-tinta-apoio">{nomes.join(' · ')}</span>
                  <span className="text-rotulo text-tinta-sussurro">
                    Autorizador: {h.autorizador} · Recebeu: {h.recebedor_nome} ({h.recebedor_documento}){h.observacao ? ` · ${h.observacao}` : ''}
                    {cancelada ? ` · CANCELADA: ${h.motivo_cancelamento}` : ''}
                  </span>
                  {!cancelada && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Button size="sm" variant="outline" onClick={() => copiarMarcacao(h)}>Copiar marcação</Button>
                      {(h.meu || ehGestor) && (
                        <Button size="sm" variant="destructive" onClick={() => { setCancelando({ tipo: 'impressao', id: h.id }); setCancTxt('') }}>Cancelar impressão</Button>
                      )}
                    </div>
                  )}
                  {cancelando?.tipo === 'impressao' && cancelando.id === h.id && (
                    <Cancelamento txt={cancTxt} setTxt={setCancTxt} onDesistir={() => setCancelando(null)} onConfirmar={() => void confirmarCancelamento()} />
                  )}
                </div>
              )
            })}
            {prontuario.data.historico.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhuma impressão registrada.</span>}
          </div>
        </>
      )}

      <Dialog open={!!vendo} onOpenChange={(v) => !v && setVendo(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="size-4" aria-hidden />{vendo ? nomeItem(vendo) : ''}</DialogTitle>
            <DialogDescription>
              {vendo ? `Emitido em ${diaHora(vendo.emitido_em ?? vendo.criado_em)} por ${vendo.autor ?? '—'} · ${NOME_ESTADO[estadoDoDocumento(vendo)]}` : ''}
              {vendo?.cancelado_em ? ` · cancelado: “${vendo.motivo_cancelamento}”` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1 text-apoio text-tinta">
            {linhasDoConteudo(vendo?.conteudo ?? null).map((l, i) => <p key={i} className="whitespace-pre-wrap">{l}</p>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Campo({ rotulo, valor, set, dica, classe }: { rotulo: string; valor: string; set: (v: string) => void; dica: string; classe?: string }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1 text-apoio font-medium text-grafite', classe)}>
      {rotulo}
      <Input value={valor} onChange={(e) => set(e.target.value)} placeholder={dica} />
    </label>
  )
}

function Cancelamento({ txt, setTxt, onDesistir, onConfirmar }: { txt: string; setTxt: (v: string) => void; onDesistir: () => void; onConfirmar: () => void }) {
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <Input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={`Justificativa (mínimo ${MIN_CANCELAR} caracteres)`} aria-label="Justificativa do cancelamento" autoFocus />
      <div className="flex gap-1.5">
        <Button size="sm" variant="ghost" onClick={onDesistir}>Desistir</Button>
        <Button size="sm" disabled={txt.trim().length < MIN_CANCELAR} className="bg-critico hover:bg-critico/90" onClick={onConfirmar}>Confirmar cancelamento</Button>
      </div>
    </div>
  )
}
