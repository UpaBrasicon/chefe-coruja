// Alta com impeditivos, cancelamento em 24 h e pacote de alta (Fase 3).
// Toda regra mora no servidor (dar_alta, cancelar_alta, gerar_pacote_alta).
import { AlertTriangle, DoorOpen, Link2, Printer } from 'lucide-react'
import * as React from 'react'

import { abrirImpressao } from '@/lib/prontuario'
import { escapeHtml } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { Secao } from './caixas'
import { type Acao, diaHora, type Internacao, type Pacote, rpc, TIPO_ALTA } from './comum'

// Frases-modelo do protótipo (ESTADO.md, pacote de alta). Nenhuma vem marcada:
// quem marca é o médico, conforme o caso.
const MODELOS_ORIENTACAO = [
  'Termine o antibiótico até o último comprimido, mesmo se já estiver se sentindo bem.',
  'Beba água ao longo do dia — dois litros, se não houver limite de líquidos.',
  'Ande dentro de casa várias vezes por dia. Ficar deitado atrasa a recuperação.',
  'Cansaço e tosse seca podem durar semanas. É esperado e vai diminuindo.',
  'Leve esta alta na consulta de retorno.',
  'Volte ao pronto-socorro se a febre passar de 38 °C, faltar ar em repouso, a dor no peito piorar ou aparecer sangue na tosse.',
  'Meça a pressão duas vezes por semana e anote os valores para o retorno.',
  'Não dirija nem levante peso nos primeiros sete dias.',
  'Mantenha a ferida seca e troque o curativo uma vez por dia.',
]

const paraInputLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function BlocoAlta({ i, impeditivos, acao, cidSugerido }: {
  i: Internacao; impeditivos: { tipo: string; descricao: string }[]; acao: Acao
  /** o diagnóstico primário vigente: vem preenchido, o médico confirma ou troca */
  cidSugerido?: string | null
}) {
  const [aberto, setAberto] = React.useState(false)
  const [tipo, setTipo] = React.useState('alta_melhorada')
  const [cid, setCid] = React.useState('')
  const [quando, setQuando] = React.useState('')
  const [justificativa, setJustificativa] = React.useState('')
  const [obs, setObs] = React.useState('')
  const [destino, setDestino] = React.useState('')
  const [numeroDo, setNumeroDo] = React.useState('')
  const [confirmar, setConfirmar] = React.useState(false)
  const [abertoEm] = React.useState(() => Date.now())
  const retroativa = !!quando && Date.parse(quando) < abertoEm - 30 * 60_000

  if (!aberto) {
    return (
      <Secao titulo="Alta">
        {impeditivos.length > 0 && (
          <ul className="flex flex-col gap-1 text-atencao">
            {impeditivos.map((x, k) => <li key={k} className="flex gap-1.5"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{x.descricao}</li>)}
          </ul>
        )}
        <Button size="xs" variant="outline" className="self-start" disabled={impeditivos.length > 0}
          onClick={() => { setQuando(paraInputLocal(new Date())); if (!cid && cidSugerido) setCid(cidSugerido); setAberto(true) }}>
          <DoorOpen /> Dar alta
        </Button>
      </Secao>
    )
  }
  const detalhes: Record<string, string> = {}
  if (tipo === 'transferencia_externa') detalhes.destino = destino
  if (tipo === 'obito') detalhes.numero_do = numeroDo
  return (
    <Secao titulo="Dados da alta">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>Motivo</Label>
          <Select items={Object.fromEntries(TIPO_ALTA)} value={tipo} onValueChange={(x) => setTipo(x ?? 'alta_melhorada')}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{TIPO_ALTA.map(([k, r]) => <SelectItem key={k} value={k}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="alta-cid">CID de alta{tipo === 'alta_evasao' ? ' · opcional na evasão' : ' *'}</Label>
          <Input id="alta-cid" value={cid} onChange={(e) => setCid(e.target.value.toUpperCase())} placeholder="Ex.: J18.9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="alta-quando">Data e hora</Label>
          <Input id="alta-quando" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
        </div>
        {tipo === 'transferencia_externa' && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="alta-destino">Destino *</Label>
            <Input id="alta-destino" value={destino} onChange={(e) => setDestino(e.target.value)} />
          </div>
        )}
        {tipo === 'obito' && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="alta-do">Nº da Declaração de Óbito *</Label>
            <Input id="alta-do" value={numeroDo} onChange={(e) => setNumeroDo(e.target.value)} />
          </div>
        )}
      </div>
      {retroativa && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="alta-just" className="text-atencao">Alta retroativa (mais de 30 minutos atrás): justifique *</Label>
          <Textarea id="alta-just" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Label htmlFor="alta-obs">Observações{tipo === 'alta_pedido' || tipo === 'alta_evasao' ? ' — descreva o ocorrido *' : ''}</Label>
        <Textarea id="alta-obs" value={obs} onChange={(e) => setObs(e.target.value)} />
      </div>
      {confirmar ? (
        <div className="flex flex-col gap-2 rounded-lg border border-atencao/30 bg-atencao/[0.06] p-3">
          <p>Deseja finalizar o atendimento? O paciente sai do censo, vira histórico do gestor e você perde o acesso (cancelar a alta é possível por 24 horas, com justificativa).</p>
          <div className="flex gap-2">
            <Button size="sm"
              onClick={() => acao(() => rpc('dar_alta', {
                p_internacao: i.id, p_tipo: tipo, p_cid: cid.trim() || null,
                p_quando: quando ? new Date(quando).toISOString() : null,
                p_justificativa: justificativa || null, p_observacoes: obs || null, p_detalhes: detalhes,
              }), 'Alta registrada.').then((r) => { if (r !== null) setAberto(false); setConfirmar(false) })}>
              Sim, dar alta
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmar(false)}>Não</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setConfirmar(true)} disabled={tipo !== 'alta_evasao' && cid.trim().length < 3}>Confirmar</Button>
          <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
        </div>
      )}
    </Secao>
  )
}

export function CancelarAlta({ i, acao }: { i: Internacao; acao: Acao }) {
  const [texto, setTexto] = React.useState('')
  return (
    <Secao titulo="Cancelar alta">
      <p className="text-tinta-sussurro">Alta de {diaHora(i.data_alta)} · {i.cid_alta ? `CID ${i.cid_alta}` : 'sem CID (evasão)'}. Cancelar devolve o paciente ao censo e revoga o link do pacote.</p>
      <Textarea placeholder="Justificativa (mínimo de 10 letras)" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <Button size="sm" variant="outline" className="self-start" disabled={texto.trim().length < 10}
        onClick={() => acao(() => rpc('cancelar_alta', { p_internacao: i.id, p_justificativa: texto }), 'Alta cancelada: o paciente voltou ao censo.')}>
        Cancelar alta
      </Button>
    </Secao>
  )
}

// ── pacote de alta ──────────────────────────────────────────────────────────
// "Volte ao pronto-socorro se…" vai num quadro próprio na página do paciente;
// os sinais são os da frase-modelo das orientações, um por linha. Nenhum vem
// marcado.
const MODELOS_SINAIS = [
  'a febre passar de 38 °C',
  'faltar ar em repouso',
  'a dor no peito piorar',
  'aparecer sangue na tosse',
]
const linhas = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

export function BlocoPacote({ i, pacienteId, pacienteNome, lista, podeGerar, acao }: {
  i: Internacao; pacienteId: string; pacienteNome: string; lista: Pacote[]; podeGerar: boolean; acao: Acao
}) {
  const [aberto, setAberto] = React.useState(false)
  const [marcadas, setMarcadas] = React.useState<number[]>([]) // nenhuma orientação vem marcada: quem escolhe é o médico
  const [extra, setExtra] = React.useState('')
  const [sinais, setSinais] = React.useState<number[]>([])
  const [sinaisExtra, setSinaisExtra] = React.useState('')
  const [ret, setRet] = React.useState({ onde: '', quando: '', exame_controle: '', levar: '' })
  const ativo = lista.find((p) => p.situacao === 'ativo')
  const ultimo = ativo ?? lista[0]

  async function gerarEImprimir() {
    // a janela abre dentro do clique; o servidor gera e registra depois
    const pImp = abrirImpressao({ pacienteId, internacaoId: i.id, tipo: 'Orientação de alta (pacote)' })
    const orientacoes = [...marcadas.sort((a, b) => a - b).map((k) => MODELOS_ORIENTACAO[k]), ...linhas(extra)]
    const listaSinais = [...sinais.sort((a, b) => a - b).map((k) => MODELOS_SINAIS[k]), ...linhas(sinaisExtra)]
    const retorno = [ret.onde.trim(), ret.quando.trim()].filter(Boolean).join(', ')
    const r = (await acao(() => rpc('gerar_pacote_alta', {
      p_internacao: i.id, p_orientacoes: orientacoes, p_retorno: null,
      p_sinais_retorno: listaSinais, p_retorno_detalhes: ret,
    }), 'Pacote gerado. Entregue a folha impressa: o código não aparece de novo.')) as
      | { token: string; codigo: string; expira_em: string }
      | null
    const imp = await pImp
    if (!imp) return
    if (!r) {
      imp.janela.document.write('<p style="font:15px system-ui;padding:24px;color:#B91C1C">O pacote não foi gerado. Nada foi impresso.</p>')
      imp.janela.document.close()
      return
    }
    const link = `${window.location.origin}/alta/${r.token}`
    imp.janela.document.write(`<html><head><title>Orientação de alta</title><style>
      body{font:12pt/1.5 system-ui,sans-serif;margin:18mm;color:#0f172a}h1{font-size:16pt;margin:0 0 8px}
      li{margin:4px 0}.cx{border:1.5px solid #0f172a;padding:10px 14px;margin-top:16px}.cod{font:700 22pt ui-monospace,monospace;letter-spacing:6px}
    </style></head><body>
      <h1>Orientações de alta</h1>
      <p><strong>Paciente:</strong> ${escapeHtml(pacienteNome)}</p>
      <ol>${orientacoes.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ol>
      ${listaSinais.length ? `<p><strong>Volte ao pronto-socorro se:</strong></p><ul>${listaSinais.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}
      ${retorno ? `<p><strong>Retorno:</strong> ${escapeHtml(retorno)}</p>` : ''}
      ${ret.exame_controle.trim() ? `<p><strong>Exame de controle:</strong> ${escapeHtml(ret.exame_controle.trim())}</p>` : ''}
      ${ret.levar.trim() ? `<p><strong>Levar no retorno:</strong> ${escapeHtml(ret.levar.trim())}</p>` : ''}
      <div class="cx">
        <p>Seus documentos da alta (receita, atestado, encaminhamento e estas orientações) também ficam no celular, por 30 dias:</p>
        <p><strong>${escapeHtml(link)}</strong></p>
        <p>Código de acesso (pedido a cada abertura):</p><p class="cod">${r.codigo}</p>
        <p style="font-size:9pt;color:#475569">Guarde esta folha. Três códigos errados bloqueiam o link; peça outro na unidade.</p>
      </div>
      ${imp.rodape}</body></html>`)
    imp.janela.document.close()
    imp.janela.focus()
    setTimeout(() => imp.janela.print(), 300)
    setAberto(false)
  }

  return (
    <Secao titulo="Pacote de alta">
      {ativo ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success"><Link2 className="mr-1 inline size-3" />link ativo</Badge>
          <span className="text-tinta-sussurro">gerado {diaHora(ativo.criado_em)} · vale até {diaHora(ativo.expira_em)}</span>
          <Button size="xs" variant="ghost" onClick={() => acao(() => rpc('revogar_pacote_alta', { p_pacote: ativo.id }), 'Link revogado.')}>Revogar</Button>
        </div>
      ) : (
        <p className="text-tinta-sussurro">
          {lista[0] ? `Último link: ${lista[0].situacao}.` : 'Sem link.'} O código sai impresso na orientação de alta (SMS e WhatsApp ainda não configurados).
        </p>
      )}
      {ultimo && (
        // mesma aba: a sessão de quem não marcou "manter conectado" mora no
        // sessionStorage, que uma aba nova não herda
        <Button size="xs" variant="outline" className="self-start" onClick={() => window.location.assign(`/alta/equipe?pacote=${ultimo.id}`)}>
          <Printer /> Ver como o paciente vê e imprimir o pacote
        </Button>
      )}
      {podeGerar && !aberto && (
        <Button size="xs" variant="outline" className="self-start" onClick={() => setAberto(true)}>
          <Printer /> {ativo ? 'Gerar novo e imprimir (revoga o atual)' : 'Montar e imprimir'}
        </Button>
      )}
      {podeGerar && aberto && (
        <div className="flex flex-col gap-2">
          {MODELOS_ORIENTACAO.map((o, k) => /^Volte ao pronto-socorro/i.test(o) ? null : (
            <label key={k} className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={marcadas.includes(k)}
                onChange={(e) => setMarcadas(e.target.checked ? [...marcadas, k] : marcadas.filter((x) => x !== k))} />
              <span>{o}</span>
            </label>
          ))}
          <Textarea placeholder="Outras orientações (uma por linha)" value={extra} onChange={(e) => setExtra(e.target.value)} />
          <p className="font-medium text-critico">Volte ao pronto-socorro se…</p>
          {MODELOS_SINAIS.map((s, k) => (
            <label key={k} className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={sinais.includes(k)}
                onChange={(e) => setSinais(e.target.checked ? [...sinais, k] : sinais.filter((x) => x !== k))} />
              <span>{s}</span>
            </label>
          ))}
          <Textarea placeholder="Outros sinais para voltar (um por linha)" value={sinaisExtra} onChange={(e) => setSinaisExtra(e.target.value)} />
          <p className="font-medium">Retorno</p>
          <Input placeholder="Onde (ex.: UBS Vila Nova)" value={ret.onde} onChange={(e) => setRet({ ...ret, onde: e.target.value })} />
          <Input placeholder="Quando (ex.: 31/08 às 9h)" value={ret.quando} onChange={(e) => setRet({ ...ret, quando: e.target.value })} />
          <Input placeholder="Exame de controle (opcional)" value={ret.exame_controle} onChange={(e) => setRet({ ...ret, exame_controle: e.target.value })} />
          <Input placeholder="O que levar (ex.: esta alta e as caixas dos remédios)" value={ret.levar} onChange={(e) => setRet({ ...ret, levar: e.target.value })} />
          <p className="text-xs text-tinta-sussurro">Receita, atestado, encaminhamento, pedido de exames, sumário de alta e exames com resultado do episódio entram no pacote automaticamente.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void gerarEImprimir()}><Printer /> Gerar e imprimir</Button>
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </Secao>
  )
}
