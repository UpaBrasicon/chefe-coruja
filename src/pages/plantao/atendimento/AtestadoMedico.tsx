// Atestado no desenho do protótipo (Documentos do Atendimento.dc.html, bloco
// "ehAtest"; index.html atPartes/atPendencias/atAvisos): finalidade
// (afastamento, comparecimento, acompanhante), dias ou horário, CID só a
// pedido do paciente e a pré-visualização com a MESMA frase da folha. A
// identificação vem do cadastro, do login e da unidade (useIdentificacao):
// nenhum nome, CNS ou CNES é digitado aqui. A folha A4 (meia A4, 2 vias) é
// montada por src/lib/folhas.ts a partir do `conteudo` gravado.
import { useQueryClient } from '@tanstack/react-query'
import { Check, Minus, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { abrirImpressao } from '@/lib/prontuario'
import { cn } from '@/lib/utils'
import { useRascunhoServidor } from '@/hooks/useRascunhoServidor'
import { Button } from '@/components/ui/button'
import { BarraDocumento } from '@/components/documento/BarraDocumento'
import { invalidarDocumentos } from '@/components/documento/documentos'
import { cpfValido, useIdentificacao } from '@/components/documentos/identificacao'
import { SeletorPaciente, usePacienteDoDocumento } from '@/components/documentos/SeletorPaciente'
import { BuscaCid } from '@/components/documentos/busca'
import { Aviso, Campo, Pendencias, Pilulas, Texto } from '@/components/documentos/ui'
import { hojeSP } from '@/pages/recepcao/cadastroForm'
import { carregarEnvelope, useRascunho } from '../shared/rascunho'

const TIPOS = ['afastamento', 'comparecimento', 'acompanhante'] as const
type TipoAtestado = (typeof TIPOS)[number]
const ROTULO_TIPO: Record<TipoAtestado, string> = { afastamento: 'Afastamento', comparecimento: 'Comparecimento', acompanhante: 'Acompanhante' }

/** O formulário (rascunho deste aparelho, por paciente). */
type FormAtestado = {
  tipo: TipoAtestado
  dias: string
  /** aaaa-mm-dd; vazio = hoje */
  inicio: string
  hentrada: string
  hsaida: string
  acompanhante: string
  vinculo: string
  comCid: boolean
  cid: string
  cidOk: boolean
  obs: string
}

const VAZIO: FormAtestado = {
  tipo: 'afastamento', dias: '1', inicio: '', hentrada: '', hsaida: '', acompanhante: '', vinculo: '', comCid: false, cid: '', cidOk: false, obs: '',
}

const s = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

/** Aceita o rascunho de hoje, o do protótipo ('Afastamento') e o antigo (repouso, texto). */
function normalizar(p: Record<string, unknown> | null | undefined): FormAtestado {
  if (!p) return VAZIO
  const t = s(p.tipo).toLowerCase()
  const tipo: TipoAtestado = (TIPOS as readonly string[]).includes(t) ? (t as TipoAtestado) : 'afastamento'
  const cid = s(p.cid)
  return {
    tipo,
    dias: s(p.dias) || '1',
    inicio: s(p.inicio),
    hentrada: s(p.hentrada),
    hsaida: s(p.hsaida),
    acompanhante: s(p.acompanhante),
    vinculo: s(p.vinculo),
    comCid: typeof p.comCid === 'boolean' ? p.comCid : !!cid,
    cid,
    cidOk: typeof p.cidOk === 'boolean' ? p.cidOk : !!cid,
    obs: s(p.obs) || s(p.texto),
  }
}

function carregar(chave: string): FormAtestado {
  const c = carregarEnvelope<Record<string, unknown>>(chave)
  return c ? normalizar(c.dados) : VAZIO
}

/** Data do campo (aaaa-mm-dd) só vale se existir no calendário. */
function dataValida(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCDate() === +m[3] && d.getUTCMonth() === +m[2] - 1
}
const br = (iso: string) => iso.split('-').reverse().join('/')
function somaDias(iso: string, n: number) {
  const [a, m, d] = iso.split('-').map(Number)
  const x = new Date(Date.UTC(a, m - 1, d + n))
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`
}
function extenso(n: number) {
  const u = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  if (n < 20) return u[n] ?? String(n)
  if (n === 100) return 'cem'
  return d[Math.floor(n / 10)] + (n % 10 ? ` e ${u[n % 10]}` : '')
}

type Parte = { t: string; b: boolean }

/** A frase do atestado em partes (b = dado variável, negrito na folha). Igual ao atPartes do protótipo. */
function partes(f: FormAtestado, nome: string, cpf: string, feminino: boolean): Parte[] {
  const P: Parte[] = []
  const t = (x: string) => P.push({ t: x, b: false })
  const b = (x: string) => P.push({ t: x, b: true })
  const ini = f.inicio && dataValida(f.inicio) ? f.inicio : hojeSP()
  const n = nome || '____________________'
  const artigo = feminino ? 'a' : 'o'
  const de = f.hentrada || '__:__', ate = f.hsaida || '__:__'
  const quem = () => { t(`${artigo} Sr.(a) `); b(n); if (cpf) { t(', CPF '); b(cpf) } }
  if (f.tipo === 'comparecimento') {
    t('Declaro, para os devidos fins, que '); quem(); t(' compareceu a esta unidade de saúde em '); b(br(ini))
    t(', no período das '); b(de); t(' às '); b(ate); t(', para atendimento médico.')
    return P
  }
  if (f.tipo === 'acompanhante') {
    t('Atesto, para os devidos fins, que '); b(f.acompanhante.trim() || '____________________'); t(' compareceu a esta unidade de saúde em '); b(br(ini))
    t(', das '); b(de); t(' às '); b(ate); t(`, na condição de acompanhante ${feminino ? 'da' : 'do'} Sr.(a) `); b(n)
    if (cpf) { t(', CPF '); b(cpf) }
    if (f.vinculo.trim()) t(` (${f.vinculo.trim()})`)
    t('.')
    return P
  }
  const dias = Math.max(1, Number(f.dias) || 1)
  t('Atesto, para os devidos fins, que '); quem(); t(' esteve sob meus cuidados profissionais nesta data, necessitando de afastamento de suas atividades por ')
  b(`${dias} (${extenso(dias)}) ${dias === 1 ? 'dia' : 'dias'}`); t(', de '); b(br(ini)); t(' a '); b(br(somaDias(ini, dias - 1))); t(', inclusive.')
  return P
}

const CLASSE_BOTAO_PASSO = 'grid h-[38px] w-9 place-items-center rounded-controle border border-fio bg-superficie text-tinta-apoio transition-colors hover:border-marca hover:text-acao'

export function AtestadoMedico({ unidadeId, perfilId }: { unidadeId?: string; perfilId?: string }) {
  const qc = useQueryClient()
  const [pacienteId, escolherPaciente] = usePacienteDoDocumento('atestado', unidadeId, perfilId)
  const ident = useIdentificacao(pacienteId)
  const { dados: f, atualizar, salvoEm, limpar } = useRascunho<FormAtestado>(`atestado-form:${pacienteId ?? 'sem-paciente'}`, unidadeId, perfilId, carregar)
  // rascunho do banco aberto por "Copiar como novo" (o hook só o adota ao salvar de novo)
  const copiado = React.useRef<string | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  const pac = ident.pac
  const cpf = pac?.cpf ?? ''
  const ehHora = f.tipo !== 'afastamento'
  const cidFinal = f.comCid ? f.cid.trim() : ''

  // O que a folha lê (src/lib/folhas.ts, atestado). O bloco `paciente` antigo
  // segue junto para quem já lê os documentos de antes.
  const conteudo = JSON.stringify({
    paciente: { ...ident.pacienteAntigo(), cpf, prontuario: pac?.prontuario ?? '', cns: pac?.cns ?? '' },
    atestado: {
      tipo: f.tipo,
      dias: f.tipo === 'afastamento' ? f.dias : '',
      inicio: f.inicio,
      hentrada: ehHora ? f.hentrada : '',
      hsaida: ehHora ? f.hsaida : '',
      acompanhante: f.tipo === 'acompanhante' ? f.acompanhante.trim() : '',
      vinculo: f.tipo === 'acompanhante' ? f.vinculo.trim() : '',
      comCid: !!cidFinal,
      cid: cidFinal,
      obs: f.obs.trim(),
      texto: f.obs.trim(),
    },
  })
  // só espelha no banco com a identificação carregada: abrir o paciente não deixa rascunho
  const servidor = useRascunhoServidor(pac && ident.alergiasCarregadas ? pacienteId : null, 'atestado', conteudo)

  const pendencias: string[] = []
  if (!pacienteId) pendencias.push('Escolher ou cadastrar o paciente')
  if (cpf && !cpfValido(cpf)) pendencias.push('CPF do paciente inválido (corrigir no cadastro)')
  if (f.tipo === 'afastamento' && !(Number(f.dias) > 0)) pendencias.push('Dias de afastamento')
  if (f.inicio && !dataValida(f.inicio)) pendencias.push('Data de início inválida')
  if (f.inicio && dataValida(f.inicio) && f.inicio < hojeSP()) pendencias.push('Data de início anterior ao atendimento (atestado retroativo)')
  if (ehHora && (!f.hentrada || !f.hsaida)) pendencias.push('Horário de entrada e saída')
  if (ehHora && f.hentrada && f.hsaida && f.hsaida <= f.hentrada) pendencias.push('Hora de saída igual ou anterior à de entrada')
  if (f.tipo === 'acompanhante' && !f.acompanhante.trim()) pendencias.push('Nome do acompanhante')
  if (f.comCid && !f.cid.trim()) pendencias.push('CID-10 (o paciente autorizou o diagnóstico)')

  // não bloqueiam: só na tela
  const avisos: string[] = []
  if (pac && !cpf) avisos.push('CPF do paciente não cadastrado. A Res. CFM 2.381/2024 pede o CPF quando houver.')
  if (f.tipo === 'afastamento' && Number(f.dias) > 15) avisos.push('Afastamento acima de 15 dias: para trabalhador CLT, a partir do 16º dia o afastamento depende de perícia do INSS.')

  const frase = partes(f, ident.cab.nome, cpf, ident.cab.artigo === 'a paciente')
  const mudar = (p: Partial<FormAtestado>) => atualizar(p)
  const dias = Number(f.dias) || 1

  async function emitir() {
    if (!pacienteId || pendencias.length) return
    setErro(null)
    const impressao = await abrirImpressao({
      pacienteId, internacaoId: null, tipo: 'Atestado',
      documento: { tipo: 'atestado', conteudo }, rascunhoId: servidor.rascunhoId() ?? copiado.current,
    })
    invalidarDocumentos(qc)
    if (!impressao) return
    const janela = impressao.janela
    janela.focus()
    window.setTimeout(() => {
      janela.print()
      servidor.emitido(conteudo)
      copiado.current = null
      limpar() // LGPD: tira os dados do paciente do aparelho depois de emitir
    }, 300)
  }

  function copiar(texto: string, rascunhoId: string) {
    try {
      const d = JSON.parse(texto) as { atestado?: Record<string, unknown> }
      copiado.current = rascunhoId
      atualizar(normalizar(d.atestado))
    } catch {
      setErro('Não foi possível ler o documento copiado.')
    }
  }

  async function descartar() {
    const c = copiado.current
    copiado.current = null
    await servidor.descartar()
    if (c) await supabase.rpc('descartar_rascunho', { p_rascunho: c })
    limpar()
    invalidarDocumentos(qc)
  }

  return (
    <div className="flex flex-col gap-4">
      <BarraDocumento
        pacienteId={pacienteId}
        tipo="atestado"
        salvoEm={servidor.salvoEm}
        pendencias={pendencias}
        aoEmitir={() => void emitir()}
        aoNovo={() => { copiado.current = null; limpar() }}
        aoCopiar={copiar}
      />

      <SeletorPaciente pacienteId={pacienteId} onEscolher={escolherPaciente} pac={pac} unidadeId={unidadeId} perfilId={perfilId} />

      {erro && <Aviso tom="critico">{erro}</Aviso>}

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Atestado" className="flex flex-col gap-4 rounded-cartao border border-fio bg-superficie p-5 shadow-repouso">
          <div className="flex flex-col gap-[7px]">
            <span className="text-apoio font-medium text-grafite">Finalidade</span>
            <Pilulas opcoes={TIPOS} valor={f.tipo} rotulos={ROTULO_TIPO} rotuloAria="Finalidade do atestado" onChange={(tipo) => mudar({ tipo })} />
          </div>

          <div className="flex flex-wrap gap-3">
            {f.tipo === 'afastamento' && (
              <Campo id="at-dias" rotulo="Dias de afastamento" largura="mini">
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Menos um dia" className={CLASSE_BOTAO_PASSO} onClick={() => mudar({ dias: String(Math.max(1, dias - 1)) })}>
                    <Minus className="size-[15px]" />
                  </button>
                  <input id="at-dias" type="text" inputMode="numeric" value={f.dias}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); mudar({ dias: v ? String(Math.min(90, Number(v))) : '' }) }}
                    className="w-16 rounded-controle border border-fio bg-campo px-2.5 py-[9px] text-center text-corpo tabular-nums text-tinta outline-none focus-visible:border-marca" />
                  <button type="button" aria-label="Mais um dia" className={CLASSE_BOTAO_PASSO} onClick={() => mudar({ dias: String(Math.min(90, dias + 1)) })}>
                    <Plus className="size-[15px]" />
                  </button>
                </div>
              </Campo>
            )}
            <Texto id="at-inicio" rotulo="Data" tipo="date" largura="curto" valor={f.inicio} onChange={(inicio) => mudar({ inicio })} />
            {ehHora && (
              <>
                <Texto id="at-entrada" rotulo="Entrada" tipo="time" largura="curto" valor={f.hentrada} onChange={(hentrada) => mudar({ hentrada })} />
                <Texto id="at-saida" rotulo="Saída" tipo="time" largura="curto" valor={f.hsaida} onChange={(hsaida) => mudar({ hsaida })} />
              </>
            )}
          </div>

          {f.tipo === 'acompanhante' && (
            <div className="flex flex-wrap gap-3">
              <Texto id="at-acompanhante" rotulo="Nome do acompanhante" dica="Quem acompanhou o paciente" valor={f.acompanhante} onChange={(acompanhante) => mudar({ acompanhante })} />
              <Texto id="at-vinculo" rotulo="Vínculo" dica="Ex.: mãe, filho, cônjuge" largura="curto" valor={f.vinculo} onChange={(vinculo) => mudar({ vinculo })} />
            </div>
          )}

          <div className="flex flex-col gap-[9px]">
            <button type="button" role="checkbox" aria-checked={f.comCid} onClick={() => mudar({ comCid: !f.comCid })}
              className="flex w-full items-start gap-[11px] text-left">
              <span className={cn('grid size-[19px] shrink-0 place-items-center rounded-[6px] border text-white',
                f.comCid ? 'border-acao bg-acao' : 'border-fio-forte bg-campo')}>
                {f.comCid && <Check className="size-3" strokeWidth={3} aria-hidden />}
              </span>
              <span className="text-controle text-pretty text-tinta-apoio leading-normal">
                Incluir o CID no documento. Só marque a pedido do paciente — o diagnóstico no atestado depende de autorização expressa dele (Res. CFM 1.658/2002, art. 3º).
              </span>
            </button>
            {f.comCid && (
              <BuscaCid id="at-cid" rotulo="CID-10" valor={f.cid} confirmado={f.cidOk}
                onDigitar={(cid) => mudar({ cid, cidOk: false })} onEscolher={(c, n) => mudar({ cid: `${c} — ${n}`, cidOk: true })} />
            )}
          </div>

          <Texto id="at-obs" rotulo="Observação (opcional)" dica="Ex.: retorno ao trabalho após reavaliação" largura="cheio" valor={f.obs} onChange={(obs) => mudar({ obs })} />

          {pendencias.length > 0 && (
            <div className="rounded-container border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-3">
              <Pendencias itens={pendencias} titulo="Falta preencher" />
            </div>
          )}
        </section>

        <section aria-label="Pré-visualização do atestado" className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
          <div className="border-b border-trilha px-[18px] py-3.5 text-rotulo font-semibold tracking-[0.06em] text-tinta-sussurro uppercase">Pré-visualização</div>
          {avisos.length > 0 && (
            <div className="flex flex-col gap-2 px-[18px] pt-3.5">
              {avisos.map((a) => <Aviso key={a}>{a}</Aviso>)}
            </div>
          )}
          <p className="px-[18px] py-[18px] text-apoio text-pretty text-grafite leading-relaxed">
            {frase.map((p, i) => (p.b ? <strong key={i} className="font-semibold text-tinta">{p.t}</strong> : <React.Fragment key={i}>{p.t}</React.Fragment>))}
          </p>
          {cidFinal && (
            <p className="mx-[18px] mb-3 border-l-4 border-tinta/60 pl-2.5 text-rotulo text-pretty text-grafite">
              <strong className="font-semibold text-tinta">CID-10: {cidFinal}</strong> — incluído a pedido do(a) paciente, que autoriza expressamente sua divulgação (Res. CFM 1.658/2002, art. 3º).
            </p>
          )}
          {f.obs.trim() && <p className="mx-[18px] mb-3 text-rotulo whitespace-pre-wrap text-grafite">{f.obs.trim()}</p>}
          <div className="flex flex-col gap-1 px-[18px] pb-3.5">
            <span className="text-rotulo text-pretty text-tinta-sussurro">
              {pendencias.length ? 'Confira as pendências antes de emitir.' : 'A folha sai em meia A4, com 1ª via do paciente e 2ª via para o arquivo da unidade.'}
            </span>
            <span className="text-rotulo text-tinta-sussurro/80">
              {servidor.salvoEm
                ? `Rascunho salvo no servidor às ${servidor.salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : salvoEm ? `Rascunho salvo neste aparelho às ${salvoEm}` : 'O rascunho deste atestado fica salvo neste aparelho, por paciente.'}
            </span>
          </div>
          <div className="flex justify-end border-t border-trilha px-[18px] py-2.5">
            <Button size="sm" variant="ghost" onClick={() => void descartar()}><Trash2 /> Descartar rascunho</Button>
          </div>
        </section>
      </div>
    </div>
  )
}
