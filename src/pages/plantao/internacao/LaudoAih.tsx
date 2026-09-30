// Laudo para solicitação de AIH no desenho do protótipo (Documentos do
// Atendimento.dc.html, aihBlocos): blocos numerados; estabelecimento e
// paciente SÓ do cadastro, da unidade e do login (o que falta no cadastro é
// apontado, não digitado); justificativa com apoio de gravidade (NEWS2 e
// qSOFA do mesmo código do leito) e leitura de laudo anexado; CID-10 e
// SIGTAP das tabelas do banco, com a conferência de glosa; exemplo de
// referência (dengue grupo D, sem volume). A emissão é a numerada
// (abrirImpressao com o rascunho do servidor) e a folha sai do servidor.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ClipboardPlus, Gauge, Printer, Sparkles } from 'lucide-react'
import * as React from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import { abrirImpressao, folhaDoDocumentoEmitido } from '@/lib/prontuario'
import { useRascunhoServidor } from '@/hooks/useRascunhoServidor'
import { Button } from '@/components/ui/button'
import { BarraDocumento } from '@/components/documento/BarraDocumento'
import { diaHora, invalidarDocumentos } from '@/components/documento/documentos'
import { apoioNews2, CAMPOS_VITAIS_AIH, type VitaisAih } from '@/components/documentos/apoioNews2'
import { BuscaCid, BuscaProcedimento } from '@/components/documentos/busca'
import { AIH_EXEMPLO, CLINICAS_AIH, VINCULOS_PREVIDENCIA } from '@/components/documentos/catalogos'
import { cadastroFaltaAih, useIdentificacao } from '@/components/documentos/identificacao'
import { SeletorPaciente } from '@/components/documentos/SeletorPaciente'
import { AnexosLaudo, Aviso, Bloco, BotaoAnexar, Campo, Cartao, Leitura, Pilulas, Rodape, Texto } from '@/components/documentos/ui'
import { useLeituraLaudo } from '@/components/documentos/useLeituraLaudo'
import { carregarEnvelope, useRascunho } from '@/pages/plantao/shared/rascunho'
import { cn } from '@/lib/utils'

import {
  AIH_VAZIO, aihTemAlgo, CAUSAS_EXTERNAS, codigoCid, conteudoAih, formDoConteudoAih, pendenciasAih, type CausaExterna, type FormAih,
} from './documentosInternacao'

type Conferencia = { avisos: { campo: string; texto: string }[]; competencia: string | null; nota: string }

const carregar = (chave: string): FormAih => ({ ...AIH_VAZIO, ...(carregarEnvelope<Partial<FormAih>>(chave)?.dados ?? {}) })

const hojeBr = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export function LaudoAih({ pacienteId, internacaoId = null, leito = '', fixo = false, onEscolherPaciente }: {
  pacienteId: string | null | undefined
  internacaoId?: string | null
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
  const { dados: form, atualizar, limpar, salvoEm } = useRascunho<FormAih>(`aih:${pacienteId ?? 'sem-paciente'}`, unidadeId, perfil?.id, carregar)
  const set = atualizar
  const trocar = (novo: Partial<FormAih>) => atualizar({ ...AIH_VAZIO, ...novo })
  const [apoioAberto, setApoioAberto] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const copiado = React.useRef<string | null>(null)

  const cid = codigoCid(form.cid)
  const conferencia = useQuery({
    queryKey: ['conferir-aih', pacienteId, cid, codigoCid(form.cidSec), codigoCid(form.cidAssoc), form.procCod],
    // só com o CID escolhido da lista (ou o procedimento): não confere a cada letra
    enabled: !!pacienteId && ((form.cidOk && !!cid) || !!form.procCod),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('conferir_aih', {
        p_paciente: pacienteId!, p_cid_principal: cid, p_cid_secundario: codigoCid(form.cidSec) || undefined,
        p_cid_causa: codigoCid(form.cidAssoc) || undefined, p_procedimento: form.procCod || undefined,
      })
      if (error) throw error
      return data as unknown as Conferencia
    },
  })
  const avisos = conferencia.data?.avisos ?? []

  const emitidos = useQuery({
    queryKey: ['laudos-aih-plantao'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('meus_laudos_aih_do_plantao')
      if (error) throw error
      return data ?? []
    },
  })

  const falta = ident.pac ? cadastroFaltaAih(ident.pac) : []
  const pendencias = pendenciasAih({ form, pacienteId, cadastroFalta: falta, avisosSigtap: avisos.length })
  const temAlgo = aihTemAlgo(form)
  const conteudo = conteudoAih({
    form, pac: ident.pac, pacienteAntigo: ident.pacienteAntigo({ diagnostico: form.diagnostico }), unidade: ident.unidade, usuario: ident.usuario,
  })
  // o rascunho do servidor só existe quando o médico escreveu algo
  const servidor = useRascunhoServidor(pacienteId, 'laudo_aih', temAlgo ? conteudo : '')

  const leitura = useLeituraLaudo({
    nomePaciente: ident.cab.nome,
    anexos: form.anexos ?? [],
    texto: form.provas,
    aplicar: ({ anexos, texto }) => set(texto === undefined ? { anexos } : { anexos, provas: texto }),
  })

  const apoio = apoioNews2(form.vitais)
  const setVital = (k: keyof VitaisAih, v: string | boolean) => set({ vitais: { ...(form.vitais ?? {}), [k]: v } })

  async function emitir() {
    setErro(null)
    const impressao = await abrirImpressao({
      pacienteId, internacaoId, tipo: 'Laudo de internação (AIH)',
      documento: { tipo: 'laudo_aih', conteudo }, rascunhoId: servidor.rascunhoId() ?? copiado.current,
    })
    if (!impressao) return
    servidor.emitido(conteudo)
    copiado.current = null
    invalidarDocumentos(qc)
    void qc.invalidateQueries({ queryKey: ['laudos-aih-plantao'] })
    // emitido não se edita: o formulário volta em branco (Copiar como novo recupera)
    limpar()
    impressao.janela.focus()
    setTimeout(() => impressao.janela.print(), 300)
  }

  async function reimprimir(id: string) {
    const janela = window.open('', '_blank')
    if (!janela) return setErro('O navegador bloqueou a janela de impressão.')
    janela.document.write('<p style="font:15px system-ui,sans-serif;padding:24px;color:#475569">Registrando impressão…</p>')
    const r = await folhaDoDocumentoEmitido(id, 'Laudo de internação (AIH) · reimpressão')
    janela.document.open()
    janela.document.write('erro' in r ? `<p style="font:15px system-ui,sans-serif;padding:24px;color:#B91C1C">A folha não pôde ser montada${r.erro ? `: ${r.erro}` : ''}.</p>` : r.html)
    janela.document.close()
    if (!('erro' in r)) {
      janela.focus()
      setTimeout(() => janela.print(), 300)
    }
  }

  const pac = ident.pac
  const nasc = pac?.nascimento ? pac.nascimento.split('-').reverse().join('/') : ''
  const trabalho = form.causaTipo === 'trabalhoTipico' || form.causaTipo === 'trabalhoTrajeto'

  return (
    <div className="flex flex-col gap-4">
      <SeletorPaciente pacienteId={pacienteId} onEscolher={(id) => onEscolherPaciente?.(id)} pac={pac} unidadeId={unidadeId} perfilId={perfil?.id}
        fixo={fixo || !onEscolherPaciente} />

      {pacienteId && (
        <Cartao icone={<ClipboardPlus />} titulo="Laudo para solicitação de AIH" acoes={<>
          {temAlgo && <Button size="sm" variant="ghost" onClick={limpar}>Limpar</Button>}
          <Button size="sm" variant="outline" className="rounded-capsula text-acao"
            title="Preenche o laudo com um exemplo: 32 anos, dengue grupo D. Use só como referência dos pontos principais."
            onClick={() => trocar({ ...AIH_EXEMPLO, cidOk: true, anexos: form.anexos ?? [] })}>
            <Sparkles /> Ver exemplo
          </Button>
        </>}>
          {falta.length > 0 && (
            <Aviso>O cadastro deste paciente está incompleto para o laudo: {falta.join(', ')}. Use “Completar ou corrigir cadastro” acima.</Aviso>
          )}

          <Bloco num="1" titulo="Identificação do estabelecimento de saúde"
            nota="Solicitante é a unidade onde você está de plantão, com o CNES cadastrado pelo gestor. O executante só entra quando a vaga é aprovada pela regulação.">
            <Leitura rotulo="Estabelecimento solicitante" valor={ident.unidade.nome} />
            <Leitura rotulo="CNES" valor={ident.unidade.cnes} largura="curto" />
          </Bloco>

          <Bloco num="2" titulo="Identificação do paciente" nota="Tudo deste bloco vem do cadastro do paciente. Para corrigir, edite o cadastro.">
            <Leitura rotulo="Nome do paciente" valor={ident.cab.nome} largura="cheio" />
            <Leitura rotulo="Nº do prontuário" valor={pac?.prontuario} />
            <Leitura rotulo="Cartão Nacional de Saúde (CNS)" valor={pac?.cns} />
            <Leitura rotulo="Data de nascimento" valor={nasc} />
            <Leitura rotulo="Sexo" valor={pac?.sexo} largura="curto" />
            <Leitura rotulo="Raça/cor" valor={pac?.raca} largura="curto" />
            <Leitura rotulo="Nome da mãe" valor={pac?.mae} />
            <Leitura rotulo="Telefone de contato" valor={pac?.telefone} />
            <Leitura rotulo="Nome do responsável" valor={pac?.responsavel} />
            <Leitura rotulo="Telefone do responsável" valor={pac?.telResp} />
            <Leitura rotulo="Endereço" valor={pac?.endereco} largura="cheio" />
            <Leitura rotulo="Município" valor={pac?.municipio} />
            <Leitura rotulo="UF" valor={pac?.uf} largura="mini" />
          </Bloco>

          <Bloco num="3" titulo="Justificativa da internação" acao={
            <Button size="sm" variant="outline" className="rounded-capsula text-acao" aria-expanded={apoioAberto} onClick={() => setApoioAberto((v) => !v)}>
              <Gauge /> Gravidade: NEWS2 e qSOFA
            </Button>
          }>
            {apoioAberto && (
              <div className="flex basis-full flex-col gap-3 rounded-container border border-fio bg-campo px-4 py-3.5">
                {ident.pediatrico ? (
                  <p className="text-apoio text-tinta-sussurro">NEWS2 e qSOFA são escores de adulto e não valem na criança. Use a referência pediátrica da unidade.</p>
                ) : (
                  <>
                    <p className="max-w-[76ch] text-apoio text-pretty text-tinta-apoio">
                      Digite a aferição desta admissão. O cálculo é o mesmo NEWS2 que roda no leito. O escore mede gravidade e ritmo de monitorização;{' '}
                      <b className="font-semibold text-tinta">ele não define enfermaria ou UTI</b> — essa decisão é sua e do protocolo da unidade.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {CAMPOS_VITAIS_AIH.map(([k, rot, un]) => (
                        <Texto key={k} id={`aih-v-${k}`} rotulo={`${rot} (${un})`} largura="mini" tipo="number" inputMode="decimal"
                          valor={String(form.vitais?.[k] ?? '')} onChange={(v) => setVital(k, v)} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-4 text-apoio text-tinta-apoio">
                      <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-primary" checked={!!form.vitais?.o2}
                        onChange={(e) => setVital('o2', e.target.checked)} /> Em oxigênio suplementar</label>
                      <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-primary" checked={!!form.vitais?.cons}
                        onChange={(e) => setVital('cons', e.target.checked)} /> Consciência alterada</label>
                    </div>
                    {apoio && (
                      <div className="flex flex-col gap-1.5 rounded-controle border border-fio bg-superficie px-3.5 py-3">
                        <div className="flex flex-wrap items-baseline gap-2.5">
                          <span className="text-rotulo font-semibold tracking-[0.06em] text-tinta-sussurro uppercase">NEWS2</span>
                          <span className={cn('text-titulo font-semibold tabular-nums', ['text-conforme', 'text-atencao', 'text-critico'][apoio.bandaN])}>{apoio.total}</span>
                          <span className="text-corpo text-tinta">{apoio.banda}</span>
                          <span className={cn('text-apoio', apoio.qsofaAlerta ? 'font-medium text-critico' : 'text-tinta-apoio')}>qSOFA {apoio.qsofa}</span>
                        </div>
                        <span className="text-apoio text-tinta-apoio">{apoio.conduta}</span>
                        {apoio.parcial && <span className="text-rotulo text-tinta-sussurro">Escore parcial, sem: {apoio.faltando}.</span>}
                        <Button size="sm" variant="outline" className="self-start"
                          onClick={() => set({ condicoes: (form.condicoes.trim() ? `${form.condicoes.trim()}\n\n` : '') + apoio.resumo })}>
                          <ClipboardPlus /> Copiar para as condições
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <Texto id="aih-sinais" rotulo="Principais sinais e sintomas clínicos" longo linhas={5} valor={form.sinais} onChange={(v) => set({ sinais: v })} />
            <Texto id="aih-condicoes" rotulo="Condições que justificam a internação" longo linhas={5} valor={form.condicoes} onChange={(v) => set({ condicoes: v })} />
            <Texto id="aih-provas" rotulo="Principais resultados de provas diagnósticas (com data)" longo linhas={5} valor={form.provas}
              onChange={(v) => set({ provas: v })} extra={<BotaoAnexar htmlFor="aih-anexo" />} {...leitura.doCampo}>
              <AnexosLaudo id="aih-anexo" anexos={form.anexos ?? []} lendo={leitura.lendo} arrastando={leitura.arrastando}
                onArquivos={(fs) => void leitura.ler(fs)} onRemover={leitura.remover} onUsar={leitura.usar} />
            </Texto>
            <Texto id="aih-diag" rotulo="Diagnóstico inicial" longo linhas={2} valor={form.diagnostico} onChange={(v) => set({ diagnostico: v })} />
            <BuscaCid id="aih-cid" rotulo="CID-10 principal" valor={form.cid} confirmado={form.cidOk} dica="Digite o CID ou nome da doença"
              onDigitar={(v) => set({ cid: v, cidOk: false, procDesc: '', procCod: '' })}
              onEscolher={(codigo, nome) => set({ cid: codigo, cidOk: true, procDesc: '', procCod: '', diagnostico: form.diagnostico || nome })} />
            <Texto id="aih-cid2" rotulo="CID-10 secundário" largura="curto" valor={form.cidSec} onChange={(v) => set({ cidSec: v })} />
            <Texto id="aih-cid3" rotulo="CID-10 causas associadas" largura="curto" valor={form.cidAssoc} onChange={(v) => set({ cidAssoc: v })} />
          </Bloco>

          <Bloco num="4" titulo="Procedimento solicitado">
            <BuscaProcedimento key={`${cid}:${form.cidOk}`} id="aih-proc" rotulo="Descrição do procedimento" cid={cid} cidOk={form.cidOk}
              procDesc={form.procDesc} procCod={form.procCod}
              onDigitar={(v) => set({ procDesc: v, procCod: '', cienteSigtap: false })}
              onEscolher={(codigo, nome) => set({ procDesc: nome, procCod: codigo, cienteSigtap: false })} />
            {avisos.length > 0 && (
              <div className="flex basis-full flex-col gap-2 rounded-container border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-3">
                {avisos.map((a, k) => (
                  <span key={k} className="flex items-start gap-2 text-apoio text-pretty text-atencao">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Campo {a.campo}: {a.texto}
                  </span>
                ))}
                <label className="flex items-center gap-2 text-apoio font-medium text-atencao">
                  <input type="checkbox" className="size-4 accent-primary" checked={form.cienteSigtap} onChange={(e) => set({ cienteSigtap: e.target.checked })} />
                  Estou ciente e assumo a solicitação
                </label>
              </div>
            )}
            {conferencia.data && avisos.length === 0 && (
              <span className="flex basis-full items-center gap-1.5 text-apoio text-conforme"><CheckCircle2 className="size-3.5" aria-hidden /> Conferência do SIGTAP sem aviso de glosa.</span>
            )}
            <Campo rotulo="Clínica" largura="cheio">
              <Pilulas rotuloAria="Clínica" opcoes={CLINICAS_AIH} valor={form.clinica} onChange={(v) => set({ clinica: v })} />
            </Campo>
            <Campo rotulo="Caráter da internação">
              <Pilulas rotuloAria="Caráter da internação" opcoes={['Urgência', 'Eletivo']} valor={form.carater || 'Urgência'} onChange={(v) => set({ carater: v })} />
            </Campo>
            <Leitura rotulo="Nome do profissional solicitante" valor={ident.usuario.nome} />
            <Leitura rotulo="Registro no conselho" valor={ident.usuario.registro} largura="curto" />
            <Leitura rotulo="Data da solicitação" valor={hojeBr()} largura="curto" />
          </Bloco>

          <Bloco num="5" titulo="Causas externas (acidentes ou violências)" nota="Só quando a internação é por acidente. O vínculo com a previdência entra no acidente de trabalho.">
            <Campo rotulo="Tipo" largura="cheio">
              <Pilulas<CausaExterna> rotuloAria="Causa externa" opcoes={CAUSAS_EXTERNAS.map(([k]) => k)} rotulos={Object.fromEntries(CAUSAS_EXTERNAS)}
                valor={form.causaTipo} onChange={(v) => set({ causaTipo: v })} />
            </Campo>
            {trabalho && (
              <Campo rotulo="Vínculo com a previdência" largura="cheio">
                <Pilulas rotuloAria="Vínculo com a previdência" opcoes={VINCULOS_PREVIDENCIA} valor={form.vinculo} onChange={(v) => set({ vinculo: v })} />
              </Campo>
            )}
          </Bloco>

          <Bloco num="6" titulo="Autorização"
            nota="Preenchido pelo profissional autorizador: nome, código do órgão emissor, documento, data e nº da AIH. Não é campo do médico solicitante.">
            {null}
          </Bloco>
        </Cartao>
      )}

      {pacienteId && (
        <Rodape pendencias={pendencias} tituloPendencias="Falta para emitir" salvoEm={salvoEm} servidorSalvoEm={servidor.salvoEm}
          mensagem={pendencias.length ? 'Confira as pendências antes de emitir.' : 'Tudo conferido. A folha sai do servidor, numerada, e fica no prontuário.'}>
          {null}
        </Rodape>
      )}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}

      <BarraDocumento pacienteId={pacienteId} tipo="laudo_aih" salvoEm={servidor.salvoEm} pendencias={pendencias}
        aoEmitir={() => void emitir()}
        aoNovo={limpar}
        aoCopiar={(c, rascunhoId) => {
          const f = formDoConteudoAih(c)
          copiado.current = rascunhoId
          if (f) trocar({ ...f, anexos: [] })
        }} />

      {(emitidos.data ?? []).length > 0 && (
        <Cartao titulo="Laudos emitidos neste plantão" corpo={false}>
          {(emitidos.data ?? []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-3 last:border-0">
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                <span className="text-corpo text-tinta">{r.paciente}{r.setor ? <span className="text-tinta-sussurro"> · {r.setor}</span> : null}</span>
                <span className="text-apoio text-tinta-sussurro">
                  {[`nº ${r.numero}`, diaHora(r.emitido_em), r.cid, r.procedimento].filter(Boolean).join(' · ')}
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={() => void reimprimir(r.id)}><Printer /> Reimprimir</Button>
            </div>
          ))}
        </Cartao>
      )}
    </div>
  )
}
