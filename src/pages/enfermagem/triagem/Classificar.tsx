import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BookOpen, Check } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { ehPediatrico, idadeEm, rotuloIdade } from '@/domain/idade'
import { rotulosPrioridade } from '@/domain/prioridade'
import { CORES_RISCO, FONTE_CORES, NIVEL_RISCO, rotuloCor, textoAlvo, type CorRisco } from '@/domain/risco'
import { faltandoVitais, paraNumeros, VITAL_DOR } from '@/domain/vitais'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Chip } from '@/components/monitor/Pagina'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { CamposVitais } from '@/components/clinico/CamposVitais'
import { buscarFluxogramas, normalizar } from '@/clinico/triagem/buscaFluxograma'
import { ESCALAS_DOR, escalaPelaIdade, notaNumerica, registroDor, totalDor, type EscalaDor, type ItensDor } from '@/clinico/triagem/dor'
import { erroGestacao, GESTACAO_VAZIA, registroGestacao, type Gestacao } from '@/clinico/triagem/gestacao'
import { BlocoDor } from './Dor'
import { BlocoGestacao } from './Gestacao'
import { HistoricoClassificacoes } from './Historico'
import { ReferenciaSinal } from './ReferenciaSinal'
import { dataSP, ehFeminino, esperaMin, hora, nomeDe, type Fluxograma, type NaFila } from './comum'

// Classificação inicial pela enfermagem (porte do protótipo, Etapa 3).
// O protocolo da unidade aparece como REFERÊNCIA: o discriminador mostra a cor
// que tem no protocolo, mas a cor do paciente é a que o enfermeiro marca; o
// sistema nunca pré-seleciona nem troca (CLAUDE.md, ADR 0007).

type Publico = 'adulto' | 'pediatrico'
type ModoO2 = 'ar_ambiente' | 'o2_suplementar'

// botões de prioridade: contorno da cor; marcado, fundo da cor
const COR_BOTAO: Record<CorRisco, string> = {
  vermelho: 'border-mts-vermelho data-[on=true]:bg-mts-vermelho data-[on=true]:text-white',
  laranja: 'border-mts-laranja data-[on=true]:bg-mts-laranja data-[on=true]:text-white',
  amarelo: 'border-mts-amarelo data-[on=true]:bg-mts-amarelo data-[on=true]:text-mts-amarelo-texto',
  verde: 'border-mts-verde data-[on=true]:bg-mts-verde data-[on=true]:text-white',
  azul: 'border-mts-azul data-[on=true]:bg-mts-azul data-[on=true]:text-white',
}
const COR_CABECALHO: Record<CorRisco, string> = {
  vermelho: 'bg-mts-vermelho text-white',
  laranja: 'bg-mts-laranja text-white',
  amarelo: 'bg-mts-amarelo text-mts-amarelo-texto',
  verde: 'bg-mts-verde text-white',
  azul: 'bg-mts-azul text-white',
}
const AVDI = [['A', 'A · alerta'], ['V', 'V · responde à voz'], ['D', 'D · responde à dor'], ['I', 'I · irresponsivo']] as const

const Secao = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <section className={cn('flex flex-col gap-3.5 rounded-cartao border border-fio bg-superficie px-5 py-[18px] shadow-repouso', className)}>{children}</section>
)
const Rotulo = ({ children }: { children: React.ReactNode }) => <span className="text-apoio font-medium text-grafite">{children}</span>

export function Classificar({ ep, onFim }: { ep: NaFila; onFim: (aviso: string | null) => void }) {
  const { unidadeAtiva } = useUnidade()
  const queryClient = useQueryClient()
  const hoje = dataSP()
  const nasc = ep.paciente?.data_nascimento ?? null
  const diaChegada = dataSP(ep.chegada_em)
  // pediatria até 13a 11m 29d, pela data de chegada (CLAUDE.md)
  const pubIdade: Publico | null = nasc ? (ehPediatrico(nasc, diaChegada) ? 'pediatrico' : 'adulto') : null
  const anos = nasc ? idadeEm(nasc, diaChegada)?.anos ?? null : null
  const [pubManual, setPubManual] = React.useState<Publico | null>(null)
  const publico: Publico | null = pubManual ?? pubIdade
  const grupoTrocado = pubIdade !== null && publico !== pubIdade

  // os fluxogramas como valem NA UNIDADE: o gestor revisa cada um em
  // Protocolos (mantido ou alterado com a fonte da unidade; migration
  // 20261007000002), e classificar_risco confere contra a mesma lista
  const { data: protocoloUnidade } = useQuery({
    queryKey: ['protocolo-fluxogramas', unidadeAtiva?.unidade_id],
    enabled: !!unidadeAtiva?.unidade_id,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('protocolo_classificacao_da_unidade', { p_unidade: unidadeAtiva!.unidade_id })
      if (error) throw error
      return data as unknown as { protocolo: { id: string; fonte: string } | null; fluxogramas: (Fluxograma & { protocolo_id: string; ordem: number })[] }
    },
  })
  const fluxos = React.useMemo(
    () => [...(protocoloUnidade?.fluxogramas ?? [])].sort((a, b) => a.ordem - b.ordem),
    [protocoloUnidade],
  )
  const protocolos = protocoloUnidade?.protocolo ? [protocoloUnidade.protocolo] : []

  const [queixa, setQueixa] = React.useState(ep.queixa)
  const [cor, setCor] = React.useState<CorRisco | null>(null)
  const [busca, setBusca] = React.useState('')
  const [listaAberta, setListaAberta] = React.useState(false)
  const [fluxoId, setFluxoId] = React.useState<string | null>(null)
  const [disc, setDisc] = React.useState('')
  const [sugAberta, setSugAberta] = React.useState(false)
  const [vitais, setVitais] = React.useState<Record<string, string>>({})
  const [aval, setAval] = React.useState({ avdi: '', glasgow: '', tempo_sintomas: '', comorbidades: '', medicacoes: '' })
  const pelaIdade = escalaPelaIdade(nasc, hoje)
  const [escalaEscolhida, setEscalaEscolhida] = React.useState<EscalaDor | null>(null)
  const escala: EscalaDor = publico !== 'pediatrico' ? 'numerica' : escalaEscolhida ?? pelaIdade
  const [itensDor, setItensDor] = React.useState<ItensDor>({})
  const [modoO2, setModoO2] = React.useState<ModoO2>('ar_ambiente')
  const [litros, setLitros] = React.useState('')
  const [gest, setGest] = React.useState<Gestacao>(GESTACAO_VAZIA)
  const [tentou, setTentou] = React.useState(false)

  const doGrupo = (fluxos ?? []).filter((f) => f.publico === publico)
  const fluxo = doGrupo.find((f) => f.id === fluxoId) ?? null
  const fonteProtocolo = protocolos?.find((p) => p.id === (fluxo ?? doGrupo[0])?.protocolo_id)?.fonte ?? protocolos?.[0]?.fonte
  const encontrados = buscarFluxogramas(doGrupo, busca).slice(0, 12)
  const discsDoFluxo = fluxo ? CORES_RISCO.flatMap((c) => (fluxo.discriminadores[c] ?? []).map(([t]) => ({ texto: t, cor: c }))) : []
  const discDaLista = discsDoFluxo.find((d) => d.texto === disc.trim()) ?? null
  const discLivre = !!fluxo && disc.trim() !== '' && !discDaLista
  const sugestoes = disc.trim() && !discDaLista ? discsDoFluxo.filter((d) => normalizar(d.texto).includes(normalizar(disc.trim()))).slice(0, 8) : []

  const trocarGrupo = (p: Publico) => {
    setPubManual(p === pubIdade ? null : p)
    setFluxoId(null)
    setDisc('')
    setBusca('')
    setEscalaEscolhida(null)
    setItensDor({})
  }

  // a dor das escalas comportamentais é a soma dos itens
  const total = escala === 'numerica' ? null : totalDor(escala, itensDor)
  const vitaisEfetivos = escala === 'numerica' ? vitais : { ...vitais, [VITAL_DOR]: total === null ? '' : String(total) }

  const feminino = ehFeminino(ep)
  const semGlasgow = !aval.glasgow.trim()
  const semGlicemia = !(vitais['glicemia-capilar'] ?? '').trim()
  const lembrete = fluxo && /dispn|respirat/i.test(fluxo.nome) && (semGlasgow || semGlicemia)
    ? `Queixa respiratória: registre ${[semGlasgow ? 'Glasgow' : '', semGlicemia ? 'glicemia capilar' : ''].filter(Boolean).join(' e ')}. É lembrete, não impede salvar.`
    : ''

  function erro(): string {
    if (!cor) return 'Escolha a prioridade.'
    if (!queixa.trim()) return 'Informe a queixa principal.'
    if (!publico) return 'Sem data de nascimento: escolha adulto ou pediatria.'
    if (!fluxo || !disc.trim()) return 'Escolha o fluxograma e o discriminador do protocolo.'
    if (discLivre && disc.trim().length < 3) return 'Escreva o discriminador (mínimo de 3 letras).'
    const falta = faltandoVitais(vitaisEfetivos, publico)
    if (falta.length) {
      const def = ESCALAS_DOR[escala]
      return `Sinais vitais novos são obrigatórios. Falta: ${falta.map((v) => (v.k === VITAL_DOR && def.itens.length ? `dor (marque os ${def.itens.length} itens da ${def.nome})` : v.rotulo)).join(', ')}.`
    }
    if (escala === 'numerica' && notaNumerica(vitais[VITAL_DOR] ?? '') === null) return 'Dor pela escala numérica: número inteiro de 0 a 10.'
    try {
      paraNumeros(vitaisEfetivos)
    } catch (e) {
      return (e as Error).message
    }
    if (aval.glasgow.trim() && !(/^\d{1,2}$/.test(aval.glasgow.trim()) && +aval.glasgow >= 3 && +aval.glasgow <= 15)) return 'Glasgow vai de 3 a 15.'
    if (modoO2 === 'o2_suplementar' && litros.trim() && !(Number(litros.replace(',', '.')) > 0)) return 'Fluxo de O₂ deve ser um número maior que zero.'
    if (feminino) {
      const eg = erroGestacao(gest, hoje)
      if (eg) return eg
    }
    return ''
  }
  const erroAtual = erro()

  const salvar = useMutation({
    mutationFn: async () => {
      const sinais = paraNumeros(vitaisEfetivos)
      const l = litros.trim() ? Number(litros.replace(',', '.')) : null
      const { error } = await supabase.rpc('classificar_risco', {
        p_episodio: ep.id,
        p_cor: cor!,
        p_sinais: sinais,
        p_fluxograma: fluxo!.id,
        p_discriminador: disc.trim(),
        p_avaliacao: Object.fromEntries(Object.entries(aval).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, k === 'glasgow' ? Number(v) : v.trim()])),
        p_publico: publico!,
        p_queixa: queixa.trim(),
        p_grupo_trocado: grupoTrocado,
        p_discriminador_livre: discLivre,
        p_dor: registroDor(escala, itensDor, sinais[VITAL_DOR]),
        p_oxigenio: modoO2 === 'o2_suplementar' && l !== null ? { modo: modoO2, litros_min: l } : { modo: modoO2 },
        p_gestacao: feminino ? registroGestacao(gest) ?? undefined : undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['triagem-fila'] })
      onFim(`${nomeDe(ep)} ${feminino ? 'classificada e enviada' : 'classificado e enviado'} para a fila do atendimento médico.`)
    },
  })

  const registrar = () => {
    setTentou(true)
    if (!erroAtual) salvar.mutate()
  }

  const prios = rotulosPrioridade(ep.prioridades_legais)

  return (
    <div className="flex flex-col gap-3.5">
      {/* situação */}
      <Secao>
        <div className="flex flex-wrap items-center gap-3.5">
          <PilulaRisco cor={null} className="min-w-[90px] py-2 text-controle" />
          <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
            <span className="text-corpo font-semibold text-tinta">Aguardando classificação da enfermagem</span>
            <span className="text-apoio text-tinta-sussurro">
              Na fila há {esperaMin(ep.chegada_em)} min (ficha às {hora(ep.chegada_em)}). O médico só reclassifica.
            </span>
            {prios.length > 0 && <span className="text-apoio text-tinta-apoio">Prioridade legal: {prios.join(', ')}</span>}
          </div>
        </div>
        <p className="text-rotulo text-pretty text-tinta-sussurro">
          {FONTE_CORES}. Fluxograma e discriminador: {fonteProtocolo ?? 'protocolo de classificação de risco da unidade'}. A classificação é da enfermagem; o médico reclassifica.
        </p>
      </Secao>

      <Secao>
        <h2 className="text-corpo font-semibold text-tinta">Classificação inicial · enfermagem</h2>

        {/* prioridade: nunca pré-selecionada */}
        <div className="flex flex-col gap-2">
          <Rotulo>Prioridade *</Rotulo>
          <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label="Prioridade">
            {CORES_RISCO.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={cor === c}
                data-on={cor === c}
                onClick={() => setCor(c)}
                className={cn('rounded-capsula border-2 bg-superficie px-[13px] py-1.5 text-apoio whitespace-nowrap text-grafite data-[on=true]:font-semibold', COR_BOTAO[c])}
              >
                {rotuloCor(c)} · {NIVEL_RISCO[c]}
              </button>
            ))}
          </div>
        </div>

        {/* queixa e contexto */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="t-queixa">Queixa principal *</Label>
          <Input id="t-queixa" value={queixa} onChange={(e) => setQueixa(e.target.value)} />
          {queixa.trim() !== ep.queixa.trim() && <span className="text-rotulo text-tinta-sussurro">Na recepção: {ep.queixa}</span>}
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
            <Label htmlFor="t-com">Comorbidades</Label>
            <Input id="t-com" placeholder="Hipertensão, diabetes…" value={aval.comorbidades} onChange={(e) => setAval((a) => ({ ...a, comorbidades: e.target.value }))} />
          </div>
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
            <Label htmlFor="t-med">Medicações em uso contínuo</Label>
            <Input id="t-med" placeholder="Losartana…" value={aval.medicacoes} onChange={(e) => setAval((a) => ({ ...a, medicacoes: e.target.value }))} />
          </div>
        </div>

        {/* grupo e fluxograma */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Rotulo>Fluxograma</Rotulo>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Grupo do protocolo">
              <Chip ativo={publico === 'adulto'} onClick={() => trocarGrupo('adulto')}>Adulto</Chip>
              <Chip ativo={publico === 'pediatrico'} onClick={() => trocarGrupo('pediatrico')}>Pediatria</Chip>
            </div>
            <span className={cn('text-rotulo text-pretty', grupoTrocado ? 'font-medium text-atencao' : 'text-tinta-sussurro')}>
              {pubIdade === null
                ? 'Idade não registrada: escolha o grupo.'
                : grupoTrocado
                  ? `Grupo trocado à mão: o paciente tem ${anos} ano${anos === 1 ? '' : 's'}.`
                  : pubIdade === 'pediatrico'
                    ? `Pediatria até 13 anos, 11 meses e 29 dias · ${rotuloIdade(nasc!, diaChegada)}.`
                    : ''}
            </span>
          </div>
          {publico && (
            <div className="relative">
              <Input
                aria-label="Pesquisar fluxograma"
                placeholder="Pesquisar fluxograma pela queixa: dor no peito, febre, queda…"
                value={busca}
                onFocus={() => setListaAberta(true)}
                onBlur={() => setTimeout(() => setListaAberta(false), 150)}
                onChange={(e) => { setBusca(e.target.value); setListaAberta(true) }}
              />
              {listaAberta && (!fluxo || normalizar(busca) !== normalizar(fluxo.nome)) && (
                <div role="listbox" className="absolute top-[calc(100%+4px)] right-0 left-0 z-20 max-h-[340px] overflow-y-auto rounded-container border border-fio bg-superficie shadow-popover">
                  {encontrados.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="option"
                      aria-selected={f.id === fluxoId}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { if (f.id !== fluxoId) setDisc(''); setFluxoId(f.id); setBusca(f.nome); setListaAberta(false) }}
                      className="flex w-full flex-col items-start gap-0.5 border-b border-trilha px-3.5 py-[9px] text-left last:border-b-0 hover:bg-campo"
                    >
                      <span className="text-controle font-medium text-tinta">{f.nome}</span>
                      {f.inclui && <span className="text-rotulo text-pretty text-tinta-sussurro">Inclui: {f.inclui}</span>}
                    </button>
                  ))}
                  {encontrados.length === 0 && <div className="px-3.5 py-[11px] text-apoio text-tinta-sussurro">Nenhum fluxograma com esse termo.</div>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* discriminador */}
        {fluxo && (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <Rotulo>Discriminador · {fluxo.nome}</Rotulo>
              {fluxo.inclui && <span className="text-rotulo text-pretty text-tinta-sussurro">Inclui: {fluxo.inclui}</span>}
            </div>
            <div className="overflow-hidden rounded-container border border-fio">
              {CORES_RISCO.filter((c) => fluxo.discriminadores[c]?.length).map((c) => (
                <div key={c}>
                  <div className={cn('px-3.5 py-[7px] text-rotulo font-semibold tracking-[0.02em]', COR_CABECALHO[c])}>
                    {rotuloCor(c)} · {NIVEL_RISCO[c]} · {textoAlvo(c)}
                  </div>
                  {fluxo.discriminadores[c]!.map(([texto, exp]) => {
                    const on = disc.trim() === texto
                    return (
                      <button
                        key={texto}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setDisc(texto)}
                        className={cn('flex w-full items-start gap-[11px] border-b border-trilha px-3.5 py-2.5 text-left last:border-b-0', on ? 'bg-marca/10' : 'bg-superficie hover:bg-campo')}
                      >
                        <span className={cn('mt-px grid size-[18px] shrink-0 place-items-center rounded-micro border', on ? 'border-acao bg-acao text-white' : 'border-fio-forte bg-superficie text-transparent')}>
                          <Check className="size-3" aria-hidden />
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-controle font-medium text-tinta">{texto}</span>
                          {exp && <span className="text-apoio leading-[1.45] text-pretty text-tinta-apoio">{exp.charAt(0).toUpperCase() + exp.slice(1)}</span>}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="relative flex flex-col gap-1.5">
              <Label htmlFor="t-disc">Discriminador registrado *</Label>
              <Input
                id="t-disc"
                placeholder="Da lista acima ou escrito pelo enfermeiro"
                value={disc}
                onFocus={() => setSugAberta(true)}
                onBlur={() => setTimeout(() => setSugAberta(false), 150)}
                onChange={(e) => { setDisc(e.target.value); setSugAberta(true) }}
              />
              {sugAberta && sugestoes.length > 0 && (
                <div role="listbox" className="absolute top-full right-0 left-0 z-30 mt-1 max-h-[280px] overflow-y-auto rounded-controle border border-fio bg-superficie shadow-popover">
                  {sugestoes.map((s) => (
                    <button key={s.texto} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setDisc(s.texto); setSugAberta(false) }}
                      className="flex w-full items-baseline gap-2.5 border-b border-trilha px-3 py-2 text-left last:border-b-0 hover:bg-campo">
                      <span className="text-controle text-tinta">{s.texto}</span>
                      <span className="text-rotulo text-tinta-sussurro">{rotuloCor(s.cor)}</span>
                    </button>
                  ))}
                </div>
              )}
              {discLivre && (
                <span className="text-rotulo text-pretty text-tinta-sussurro">
                  Escrito pelo enfermeiro: fica registrado como discriminador livre, sem cor de referência do protocolo.
                </span>
              )}
            </div>
            {discDaLista && (
              <div className="flex items-start gap-2 rounded-controle bg-campo px-3 py-[9px] text-apoio text-pretty text-tinta-apoio">
                <BookOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  Referência do protocolo para “{discDaLista.texto}”: {rotuloCor(discDaLista.cor)} · {NIVEL_RISCO[discDaLista.cor]}. A prioridade é decisão do enfermeiro.
                </span>
              </div>
            )}
          </div>
        )}
        <span className="text-rotulo text-pretty text-tinta-sussurro">
          Protocolo de apoio: {fonteProtocolo ?? 'protocolo de classificação de risco da unidade'}. O sistema não define a cor; a prioridade marcada é a do enfermeiro.
        </span>

        {/* sinais vitais */}
        <div className="flex flex-col gap-2">
          <Rotulo>
            {publico === 'pediatrico'
              ? 'Sinais vitais novos · obrigatórios, exceto glicemia, peso e PA (pediatria)'
              : 'Sinais vitais novos · obrigatórios, exceto glicemia e peso'}
          </Rotulo>
          <CamposVitais
            publico={publico}
            valores={vitaisEfetivos}
            prefixo="tri"
            onChange={(k, v) => setVitais((s) => ({ ...s, [k]: v }))}
            aoLadoDoRotulo={(k) => <ReferenciaSinal publico={publico} vital={k} />}
            somenteLeitura={escala === 'numerica' ? [] : [VITAL_DOR]}
            rotulo={(k, padrao) => (k === VITAL_DOR && escala !== 'numerica' ? `Dor (${ESCALAS_DOR[escala].nome} 0–${ESCALAS_DOR[escala].max})` : padrao)}
            dica={(k) => (k === VITAL_DOR && escala !== 'numerica' ? 'pelos itens abaixo' : undefined)}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <BlocoDor
              publico={publico}
              escala={escala}
              pelaIdade={publico === 'pediatrico' ? pelaIdade : 'numerica'}
              itens={itensDor}
              nota={vitais[VITAL_DOR] ?? ''}
              onEscala={(e) => { setEscalaEscolhida(e); setItensDor({}); if (e === 'numerica') setVitais((s) => ({ ...s, [VITAL_DOR]: '' })) }}
              onItem={(id, v) => setItensDor((m) => ({ ...m, [id]: v }))}
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="t-gcs">Glasgow · opcional</Label>
              <Input id="t-gcs" inputMode="numeric" placeholder="3 a 15" value={aval.glasgow} onChange={(e) => setAval((a) => ({ ...a, glasgow: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="t-tempo">Tempo dos sintomas</Label>
              <Input id="t-tempo" value={aval.tempo_sintomas} onChange={(e) => setAval((a) => ({ ...a, tempo_sintomas: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-rotulo text-tinta-apoio">AVDI</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="AVDI">
              {AVDI.map(([k, l]) => (
                <Chip key={k} ativo={aval.avdi === k} onClick={() => setAval((a) => ({ ...a, avdi: a.avdi === k ? '' : k }))}>{l}</Chip>
              ))}
            </div>
          </div>
        </div>

        {/* SpO₂: onde foi medida */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-rotulo text-tinta-apoio">SpO₂ medida em</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="SpO₂ medida em">
                <Chip ativo={modoO2 === 'ar_ambiente'} onClick={() => { setModoO2('ar_ambiente'); setLitros('') }}>Ar ambiente</Chip>
                <Chip ativo={modoO2 === 'o2_suplementar'} onClick={() => setModoO2('o2_suplementar')}>O₂ suplementar</Chip>
              </div>
            </div>
            {modoO2 === 'o2_suplementar' && (
              <div className="flex w-[120px] flex-col gap-1">
                <Label htmlFor="t-o2">O₂ (L/min)</Label>
                <Input id="t-o2" inputMode="decimal" placeholder="2" value={litros} onChange={(e) => setLitros(e.target.value)} />
              </div>
            )}
          </div>
          {lembrete && (
            <div className="flex items-start gap-2 rounded-controle border border-[#FDE68A] bg-[#FFFBEB] px-3 py-[9px] text-apoio text-pretty text-atencao" role="note">
              <AlertTriangle className="mt-0.5 size-[15px] shrink-0" aria-hidden />
              <span>{lembrete}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="min-w-0 flex-[1_1_240px] text-apoio text-pretty text-critico" role="alert">
            {tentou && erroAtual ? erroAtual : salvar.error ? (salvar.error as Error).message : ''}
          </span>
          <Button variant="outline" onClick={() => onFim(null)}>Cancelar</Button>
          <Button onClick={registrar} disabled={salvar.isPending}>
            {salvar.isPending ? <Spinner className="size-4" /> : <Check />} Registrar classificação
          </Button>
        </div>
      </Secao>

      {feminino && <BlocoGestacao g={gest} hoje={hoje} onChange={(p) => setGest((g) => ({ ...g, ...p }))} />}

      <HistoricoClassificacoes episodioId={ep.id} />
    </div>
  )
}
