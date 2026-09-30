// Ficha de admissão médica no desenho do protótipo (Documentos do
// Atendimento.dc.html, admBlocos): identificação do cadastro, procedência e
// acompanhante; subjetivo com comorbidades e medicações; objetivo com os
// sinais vitais crus (vêm da última classificação, o médico corrige por
// cima); hipótese diagnóstica (CID-10 do banco) e plano; sepse, setor e
// regulação; detalhes da admissão da unidade. Roteiro do subjetivo e do
// objetivo como lembrete.
//
// Registro: registrar_admissao grava o texto legível no prontuário e a ficha
// estruturada em admissao_fichas; a folha sai do servidor (folha_documento
// junta a ficha ao documento). Uma admissão por internação.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CheckCircle2, Printer, X } from 'lucide-react'
import * as React from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import { abrirProntuario, folhaDoDocumentoEmitido } from '@/lib/prontuario'
import type { Json } from '@/types/database'
import { Button } from '@/components/ui/button'
import { BarraDocumento } from '@/components/documento/BarraDocumento'
import { diaHora, hora, invalidarDocumentos, useDocumentosEpisodio } from '@/components/documento/documentos'
import { BuscaCid, BuscaLista } from '@/components/documentos/busca'
import { PROCEDENCIAS, ROTEIRO_OBJETIVO, ROTEIRO_SUBJETIVO } from '@/components/documentos/catalogos'
import { useIdentificacao } from '@/components/documentos/identificacao'
import { SeletorPaciente } from '@/components/documentos/SeletorPaciente'
import { useTriagemRecente, vitaisDaTriagem } from '@/components/documentos/triagem'
import { Bloco, Campo, Cartao, Chip, Leitura, Pilulas, Rodape, Texto } from '@/components/documentos/ui'
import { carregarEnvelope, useRascunho } from '@/pages/plantao/shared/rascunho'

import {
  ADM_VAZIO, admTemAlgo, fichaAdm, pendenciasAdm, textoAdm, type DetalheAdm, type FormAdm, type Sepse, type Spo2Cond,
} from './documentosInternacao'

type ConfigDetalhes = { esquemas: { id: string; nome: string; itens: string[]; ativo: boolean }[]; obrigatorios: string[] }

const carregar = (chave: string): FormAdm => ({ ...ADM_VAZIO, ...(carregarEnvelope<FormAdm>(chave)?.dados ?? {}) })

/** Botão "Ver exemplo" e a lista do roteiro, que pode ir escrita para o campo. */
function roteiroDe({ aberto, onAlternar, titulo, itens, onUsar }: {
  aberto: boolean; onAlternar: () => void; titulo: string; itens: string[]; onUsar: () => void
}) {
  return { botao: (
    <Button size="sm" variant="outline" className="rounded-capsula text-acao" aria-expanded={aberto} onClick={onAlternar}>
      <BookOpen /> {aberto ? 'Fechar exemplo' : 'Ver exemplo'}
    </Button>
  ), lista: aberto && (
    <div className="flex flex-col gap-1 rounded-controle border border-fio bg-campo px-3.5 py-3">
      <span className="text-rotulo font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">{titulo}</span>
      {itens.map((x, i) => <span key={x} className="text-apoio text-pretty text-tinta-apoio">{i + 1}. {x}</span>)}
      <Button size="sm" variant="outline" className="mt-1 self-start" onClick={onUsar}>Escrever o roteiro no campo</Button>
    </div>
  ) }
}

export function FichaAdmissao({ pacienteId, internacaoId, leito = '', fixo = false, onEscolherPaciente }: {
  pacienteId: string | null | undefined
  internacaoId: string | null | undefined
  leito?: string
  /** dentro do leito: o paciente não troca */
  fixo?: boolean
  onEscolherPaciente?: (id: string | null) => void
}) {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const ident = useIdentificacao(pacienteId, leito)
  const { dados: form, atualizar: set, limpar, salvoEm } = useRascunho<FormAdm>(`adm:${pacienteId ?? 'sem-paciente'}`, unidadeId, perfil?.id, carregar)
  const [roteiro, setRoteiro] = React.useState<'subjetivo' | 'objetivo' | null>(null)
  const [esquemaSel, setEsquemaSel] = React.useState('')
  const [registrando, setRegistrando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  // a triagem e a ficha só voltam com o prontuário aberto (consulta registrada)
  const aberto = useQuery({
    queryKey: ['abrir-prontuario-documento', pacienteId, internacaoId ?? null],
    enabled: !!pacienteId,
    staleTime: 60_000,
    queryFn: async () => { await abrirProntuario(pacienteId!, internacaoId); return true },
  })
  const triagem = useTriagemRecente(aberto.data ? pacienteId : null)
  const docs = useDocumentosEpisodio(pacienteId)

  const internacao = useQuery({
    queryKey: ['admissao-setor', internacaoId],
    enabled: !!internacaoId,
    queryFn: async () => {
      const { data, error } = await supabase.from('internacoes').select('setor_atual_id').eq('id', internacaoId!).maybeSingle()
      if (error) throw error
      const setorId = data?.setor_atual_id ?? null
      if (!setorId) return { setorId: null, setor: '' }
      const s = await supabase.from('setores').select('nome').eq('id', setorId).maybeSingle()
      return { setorId, setor: s.data?.nome ?? '' }
    },
  })
  const setor = internacao.data?.setor ?? ''

  const config = useQuery({
    queryKey: ['admissao-detalhes-config', unidadeId],
    enabled: !!unidadeId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admissao_detalhes_config', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as ConfigDetalhes
    },
  })
  const esquemas = (config.data?.esquemas ?? []).filter((e) => e.ativo)
  const detalhesObrigatorio = !!internacao.data?.setorId && esquemas.length > 0 && (config.data?.obrigatorios ?? []).includes(internacao.data.setorId)

  const lista = docs.data ?? []
  const registrada = internacaoId ? lista.find((d) => d.tipo === 'admissao_anamnese' && d.internacao_id === internacaoId) ?? null : null
  const ficha = useQuery({
    queryKey: ['admissao-ficha', internacaoId],
    enabled: !!registrada && !!aberto.data,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admissao_ficha', { p_internacao: internacaoId! })
      if (error) throw error
      return (data ?? null) as Record<string, unknown> | null
    },
  })
  const laudo = lista.find((d) => d.tipo === 'laudo_aih' && !!d.numero && (d.estado === 'ativo' || d.estado === 'assinado'))
  const regulacao = laudo ? `Solicitada · laudo de AIH nº ${laudo.numero} às ${hora(laudo.emitido_em ?? laudo.criado_em)}` : 'Não solicitada'

  // a ficha começa com o que a triagem registrou; o que o médico escreveu vale por cima
  const tri = vitaisDaTriagem(triagem.data)
  const daTriagem: FormAdm = Object.fromEntries(Object.entries(tri).filter(([, v]) => v !== undefined && v !== '')) as FormAdm
  const a: FormAdm = { ...daTriagem, ...(Object.fromEntries(Object.entries(form).filter(([, v]) => v !== undefined)) as FormAdm) }
  const v = (k: keyof FormAdm) => (typeof a[k] === 'string' ? (a[k] as string) : '')

  const pendencias = pendenciasAdm({ a, pacienteId, internacaoId, jaRegistrada: !!registrada, detalhesObrigatorio, setor })

  async function registrar() {
    if (!internacaoId || !pacienteId || pendencias.length) return
    setErro(null)
    const janela = window.open('', '_blank')
    if (!janela) return setErro('O navegador bloqueou a janela de impressão. Libere pop-ups e tente de novo.')
    const escrever = (html: string) => { janela.document.open(); janela.document.write(html); janela.document.close() }
    const falha = (m: string) => { escrever(`<p style="font:15px system-ui,sans-serif;padding:24px;color:#B91C1C">${m}</p>`); setErro(m) }
    escrever('<p style="font:15px system-ui,sans-serif;padding:24px;color:#475569">Registrando a admissão…</p>')
    setRegistrando(true)
    try {
      const f = fichaAdm({ a, setor, regulacao, pacienteAntigo: ident.pacienteAntigo({ diagnostico: v('cid') }), pac: ident.pac, agora: new Date() })
      const { data, error } = await supabase.rpc('registrar_admissao', { p_internacao: internacaoId, p_conteudo: textoAdm(f), p_ficha: f as unknown as Json })
      if (error) return falha(`Não foi possível registrar a admissão: ${error.message}. Nada foi impresso.`)
      limpar()
      invalidarDocumentos(qc)
      void qc.invalidateQueries({ queryKey: ['documentos-clinicos', pacienteId] })
      void qc.invalidateQueries({ queryKey: ['admissao-ficha', internacaoId] })
      const r = await folhaDoDocumentoEmitido(data as string, 'Ficha de admissão médica')
      if ('erro' in r) return falha(`A admissão foi registrada, mas a folha não pôde ser montada${r.erro ? `: ${r.erro}` : ''}. Reimprima por aqui.`)
      escrever(r.html)
      janela.focus()
      setTimeout(() => janela.print(), 300)
    } finally {
      setRegistrando(false)
    }
  }

  async function reimprimir(id: string) {
    const janela = window.open('', '_blank')
    if (!janela) return setErro('O navegador bloqueou a janela de impressão.')
    janela.document.write('<p style="font:15px system-ui,sans-serif;padding:24px;color:#475569">Registrando impressão…</p>')
    const r = await folhaDoDocumentoEmitido(id, 'Ficha de admissão médica · reimpressão')
    janela.document.open()
    janela.document.write('erro' in r ? `<p style="font:15px system-ui,sans-serif;padding:24px;color:#B91C1C">A folha não pôde ser montada${r.erro ? `: ${r.erro}` : ''}.</p>` : r.html)
    janela.document.close()
    if (!('erro' in r)) {
      janela.focus()
      setTimeout(() => janela.print(), 300)
    }
  }

  const escreverRoteiro = (k: 'subjetivo' | 'objetivo', itens: string[]) => {
    const atual = v(k).trim()
    const texto = itens.map((x, i) => `${i + 1}. ${x}:`).join('\n')
    set({ [k]: atual ? `${atual}\n\n${texto}` : texto })
    setRoteiro(null)
  }
  const rotSub = roteiroDe({ aberto: roteiro === 'subjetivo', onAlternar: () => setRoteiro(roteiro === 'subjetivo' ? null : 'subjetivo'),
    titulo: 'O que o subjetivo precisa ter', itens: ROTEIRO_SUBJETIVO, onUsar: () => escreverRoteiro('subjetivo', ROTEIRO_SUBJETIVO) })
  const rotObj = roteiroDe({ aberto: roteiro === 'objetivo', onAlternar: () => setRoteiro(roteiro === 'objetivo' ? null : 'objetivo'),
    titulo: 'O que o objetivo precisa ter', itens: ROTEIRO_OBJETIVO, onUsar: () => escreverRoteiro('objetivo', ROTEIRO_OBJETIVO) })

  const pac = ident.pac
  const nasc = [pac?.nascimento ? pac.nascimento.split('-').reverse().join('/') : '', pac?.idade].filter(Boolean).join(' · ')
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
  const detalhes = a.detalhes ?? []
  const esq = esquemas.find((e) => e.nome === esquemaSel)
  const alternarDetalhe = (d: DetalheAdm) => {
    const ja = detalhes.some((x) => x.esquema === d.esquema && x.item === d.item)
    set({ detalhes: ja ? detalhes.filter((x) => !(x.esquema === d.esquema && x.item === d.item)) : [...detalhes, d] })
  }
  const vital = (k: keyof FormAdm, rotulo: string, dica?: string) => (
    <Texto id={`adm-${k}`} rotulo={rotulo} largura="mini" dica={dica} inputMode={k === 'pa' ? 'text' : 'decimal'} valor={v(k)} onChange={(x) => set({ [k]: x })} />
  )
  const fr = ficha.data
  const txt = (k: string) => (fr && typeof fr[k] === 'string' ? (fr[k] as string) : '')

  return (
    <div className="flex flex-col gap-4">
      <SeletorPaciente pacienteId={pacienteId} onEscolher={(id) => onEscolherPaciente?.(id)} pac={pac} unidadeId={unidadeId} perfilId={perfil?.id}
        fixo={fixo || !onEscolherPaciente} />

      {pacienteId && registrada && (
        <Cartao icone={<CheckCircle2 />} titulo="Admissão registrada" acoes={
          <Button size="sm" variant="outline" onClick={() => void reimprimir(registrada.id)}><Printer /> Reimprimir</Button>
        }>
          <p className="text-apoio text-tinta-sussurro">
            Registrada em {diaHora(registrada.criado_em)} por {registrada.autor ?? '—'}. Uma admissão por internação; ela fica no prontuário e sai na folha como foi registrada.
          </p>
          {fr ? (
            <div className="flex flex-wrap gap-3">
              <Leitura rotulo="Procedência" valor={txt('procedencia')} />
              <Leitura rotulo="Acompanhante" valor={txt('acompanhante') || 'Desacompanhado'} />
              <Leitura rotulo="Hipótese diagnóstica" valor={txt('cid')} largura="cheio" />
              <Leitura rotulo="Subjetivo" valor={txt('subjetivo')} largura="cheio" />
              <Leitura rotulo="Objetivo" valor={txt('objetivo')} largura="cheio" />
              <Leitura rotulo="Avaliação inicial e plano de tratamento" valor={txt('plano')} largura="cheio" />
            </div>
          ) : registrada.conteudo ? (
            <p className="text-corpo whitespace-pre-wrap text-tinta">{registrada.conteudo}</p>
          ) : null}
        </Cartao>
      )}

      {pacienteId && !registrada && (
        <Cartao icone={<BookOpen />} titulo={<>Ficha de admissão médica <span className="ml-1.5 text-apoio font-normal text-tinta-sussurro">Anamnese, exame físico e plano inicial</span></>}
          acoes={admTemAlgo(form) ? <Button size="sm" variant="ghost" onClick={limpar}>Limpar</Button> : undefined}>
          <Bloco titulo="Identificação" nota="Nome, nascimento, prontuário e CNS vêm do cadastro. O setor é o da internação.">
            <Leitura rotulo="Paciente" valor={ident.cab.nome} largura="cheio" />
            <Leitura rotulo="Nascimento / idade" valor={nasc} />
            <Leitura rotulo="Prontuário" valor={pac?.prontuario} />
            <Leitura rotulo="Setor de destino" valor={setor} />
            <Leitura rotulo="Data / hora da admissão" valor={agora} />
            <BuscaLista id="adm-procedencia" rotulo="Procedência" largura="medio" opcoes={PROCEDENCIAS} valor={v('procedencia')}
              dica="Clique para ver as procedências ou digite" onDigitar={(x) => set({ procedencia: x })} onEscolher={(x) => set({ procedencia: x })} />
            <Texto id="adm-acompanhante" rotulo="Acompanhante" dica="Quem veio com o paciente e o vínculo" valor={v('acompanhante')}
              onChange={(x) => set({ acompanhante: x })} />
          </Bloco>

          <Bloco titulo="Subjetivo" nota="O que o paciente e o acompanhante contam: queixa, história, antecedentes, medicações, alergias e hábitos.">
            <Texto id="adm-comorb" rotulo="Comorbidades" dica="Vem da triagem; complete se preciso" valor={v('comorb')} onChange={(x) => set({ comorb: x })} />
            <Texto id="adm-meds" rotulo="Medicações em uso contínuo" dica="Vem da triagem; complete se preciso" valor={v('meds')} onChange={(x) => set({ meds: x })} />
            <Texto id="adm-subjetivo" rotulo="Subjetivo" longo linhas={9} dica="Escreva corrido. Em dúvida do que entra, abra o exemplo ao lado."
              valor={v('subjetivo')} onChange={(x) => set({ subjetivo: x })} extra={rotSub.botao}>
              {rotSub.lista}
            </Texto>
          </Bloco>

          <Bloco titulo="Objetivo" nota={<>Exame físico e o que foi medido. Os sinais vitais vêm da triagem; corrija se aferiu de novo.
            {triagem.data ? ` Classificação de ${diaHora(triagem.data.criado_em)}.` : aberto.data && triagem.isSuccess ? ' Sem classificação de risco registrada.' : ''}</>}>
            <Texto id="adm-objetivo" rotulo="Objetivo" longo linhas={9} dica="Estado geral e exame por sistemas. Em dúvida, abra o exemplo ao lado."
              valor={v('objetivo')} onChange={(x) => set({ objetivo: x })} extra={rotObj.botao}>
              {rotObj.lista}
            </Texto>
            {vital('pa', 'PA (mmHg)', '120/80')}
            {vital('fc', 'FC (bpm)')}
            {vital('fr', 'FR (irpm)')}
            {vital('tax', 'Tax (°C)')}
            {vital('spo2', 'SpO₂ (%)')}
            {vital('hgt', 'HGT (mg/dL)')}
            {vital('peso', 'Peso (kg)')}
            {vital('glasgow', 'Glasgow')}
            <Campo rotulo="SpO₂ medida em" largura="medio">
              <Pilulas<Exclude<Spo2Cond, ''>> rotuloAria="SpO₂ medida em" opcoes={['ar', 'o2']} rotulos={{ ar: 'Ar ambiente', o2: 'Oxigênio suplementar' }}
                valor={a.spo2Cond ?? ''} onChange={(x) => set({ spo2Cond: a.spo2Cond === x ? '' : x })} />
            </Campo>
            {a.spo2Cond === 'o2' && vital('o2L', 'O₂ (L/min)')}
          </Bloco>

          <Bloco titulo="Avaliação inicial e plano de tratamento">
            <BuscaCid id="adm-cid" rotulo="Hipótese diagnóstica" valor={v('cid')} confirmado={!!a.cidOk}
              onDigitar={(x) => set({ cid: x, cidOk: false })} onEscolher={(c, n) => set({ cid: `${c} — ${n}`, cidOk: true })} />
            <Texto id="adm-plano" rotulo="Avaliação inicial e plano de tratamento" longo linhas={6}
              dica="Dieta, hidratação, medicações, exames, monitorização, previsão e reavaliação" valor={v('plano')} onChange={(x) => set({ plano: x })} />
            <Campo rotulo="Protocolo de sepse" largura="medio" ajuda="Marque o que foi decidido. A decisão é sua e do protocolo da unidade.">
              <Pilulas<Exclude<Sepse, ''>> rotuloAria="Protocolo de sepse" opcoes={['acionado', 'nao_acionado']} rotulos={{ acionado: 'Acionado', nao_acionado: 'Não acionado' }}
                valor={a.sepse ?? ''} onChange={(x) => set({ sepse: a.sepse === x ? '' : x })} />
            </Campo>
            <Leitura rotulo="Regulação de leito" valor={regulacao} />
          </Bloco>

          {esquemas.length > 0 && (
            <Bloco titulo="Detalhes da admissão" nota={detalhesObrigatorio
              ? `Obrigatório no setor ${setor}. Serve só para estatística da unidade; não gera solicitação.`
              : 'Opcional. Serve só para estatística da unidade; não gera solicitação.'}>
              <div className="flex basis-full flex-wrap gap-[7px]">
                {esquemas.map((e) => <Chip key={e.id} ativo={esquemaSel === e.nome} onClick={() => setEsquemaSel(esquemaSel === e.nome ? '' : e.nome)}>{e.nome}</Chip>)}
              </div>
              {esq && (
                <div className="flex basis-full flex-wrap gap-[7px]">
                  {esq.itens.map((it) => (
                    <Chip key={it} tom="suave" ativo={detalhes.some((d) => d.esquema === esq.nome && d.item === it)}
                      onClick={() => alternarDetalhe({ esquema: esq.nome, item: it })}>{it}</Chip>
                  ))}
                </div>
              )}
              <div className="flex basis-full flex-wrap gap-[7px]">
                {detalhes.length === 0 ? <span className="text-apoio text-tinta-sussurro">Nenhum detalhe marcado.</span> : detalhes.map((d) => (
                  <span key={`${d.esquema}:${d.item}`} className="flex items-center gap-1.5 rounded-capsula bg-trilha px-3 py-1 text-apoio text-tinta">
                    {d.esquema} · {d.item}
                    <button type="button" aria-label={`Remover ${d.item}`} onClick={() => alternarDetalhe(d)} className="hover:text-critico"><X className="size-3.5" /></button>
                  </span>
                ))}
              </div>
            </Bloco>
          )}
        </Cartao>
      )}

      {pacienteId && !registrada && (
        <Rodape pendencias={pendencias} tituloPendencias="Falta preencher" salvoEm={salvoEm}
          mensagem={pendencias.length ? 'Confira as pendências antes de registrar.' : 'A folha sai em A4, com identificação, anamnese, exame físico e plano.'}>
          {null}
        </Rodape>
      )}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}

      {/* a admissão é registrada sem número (registrar_evolucao): registrada, o cartão acima faz o papel da barra */}
      {!registrada && (
        <BarraDocumento pacienteId={pacienteId} tipo="admissao_anamnese" rotulo="Ficha de admissão médica"
          pendencias={registrando ? ['Registrando…'] : pendencias} aoEmitir={() => void registrar()} />
      )}
    </div>
  )
}
