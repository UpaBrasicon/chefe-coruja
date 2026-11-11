// ─────────────────────────────────────────────────────────────────────────────
// Checagem de enfermagem (Fase 4.6).
//
// Itens ativos das prescrições dos pacientes do meu plantão. O enfermeiro
// apraza; a enfermagem checa cada administração — feito, não feito ou
// recusado (os dois últimos com motivo). Nada se apaga: corrigir é checar de
// novo, e vale o último registro. Medicamento de alta vigilância (Fase 2,
// tarefa 1, revista em 09/10/2026): o controle é a liberação da farmácia
// (validação do item); sem ela, o "feito" pede justificativa e o farmacêutico
// confere depois. O controlado da Portaria 344 (lacuna 3) segue o mesmo fluxo:
// selo "Controlado · B1" e liberação da farmácia antes de administrar.
// Validade (lacuna 6): o item vale 24 h desde a prescrição ou a renovação
// (Resolução COFEN 689/2022, art. 4º). Vencido, o "feito" fica fechado (o
// servidor também recusa) e a enfermagem pede a renovação ao médico de plantão.
// Aprazamento assistido (Fase 2, tarefa 2): a posologia vira sugestão de
// horários pela grade da unidade; o enfermeiro aceita ou ajusta, e o ajuste
// fica registrado.
// Atraso (lacuna 9): o horário que passou da tolerância (2 h, ou o intervalo
// do item se menor) aparece "atrasado há X"; o "feito" atrasado pede o motivo
// da lista (o servidor também exige) e o enfermeiro dá ciência da dose
// atrasada (Portaria MS 2.095/2013, Anexo 03, item IV).
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { resumoMudanca, type Alteracao } from '@/lib/alteracaoPrescricao'
import {
  atrasoDoFeito, duracaoTexto, estadoDoHorario, FONTE_ATRASO, janelaAtrasoMin, MINIMO_OUTRO, MOTIVOS_ATRASO, motivoAtrasoValido,
  rotuloMotivoAtraso, type ChecagemHorario,
} from '@/lib/atraso'
import { lerHorarios, mesmaLista, type SugestaoItem } from '@/lib/aprazamento'
import { doseUnicaFeita, estadoLiberacao, MINIMO_JUSTIFICATIVA, type Liberacao } from '@/lib/duplaChecagem'
import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { AlergiaNaTela } from './AlergiaNaTela'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { dataHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Estado } from '@/components/porta/Estado'
import { SeloControlado } from '@/components/farmacia/SeloControlado'
import { controleDoCatalogo } from '@/domain/controlados'
import { SeloValidadeItem } from '@/components/prescricao/ValidadeItem'
import { diaHora, ehRenovacao, FONTE_VALIDADE, validadeDoItem } from '@/lib/validadePrescricao'
import { useAgora } from '@/hooks/useAgora'

type Linha = {
  paciente_id: string; paciente_nome: string; local: string | null; item_id: string; tipo: string; descricao: string
  dose: string | null; via: string | null; posologia: string | null; se_necessario: boolean; horarios: string[] | null
  diluicao_texto: string | null; vasoativo: boolean; ultima_situacao: string | null; ultima_em: string | null
  ultima_por: string | null; ultima_horario: string | null
  /** Última checagem de cada horário aprazado nas últimas 24 h (fila_checagem), com o atraso gravado (lacuna 9). */
  por_horario: Record<string, ChecagemHorario> | null
  prescrito_em: string | null
  /** Lacuna 6: validade do item, estado do servidor e o pedido de renovação. */
  valida_ate: string | null; validade: string | null; renovacao_pedida_em: string | null
}
const SITUACAO: Record<string, { rotulo: string; tom: 'verde' | 'ambar' | 'vermelho' }> = {
  feito: { rotulo: 'feito', tom: 'verde' },
  nao_feito: { rotulo: 'não feito', tom: 'ambar' },
  recusado: { rotulo: 'recusado', tom: 'vermelho' },
}
const hora = (iso: string) => dataHora(iso)
/** Dose atrasada de um item (atrasos_de_dose, últimas 24 h). */
type DoseAtrasada = {
  id: string; item_id: string; horario: string; previsto_em: string; origem: 'janela' | 'checagem'
  ciente_em: string | null; ciente_por: string | null; feito_em: string | null; atraso_min: number | null
  motivo_atraso: string | null; motivo_atraso_texto: string | null; omitida: boolean
}

export default function Checagem() {
  const { papelAtivo } = useUnidade()
  const qc = useQueryClient()
  const agora = useAgora()
  const [erro, setErro] = React.useState<string | null>(null)
  const fila = useQuery({
    queryKey: ['fila-checagem'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_checagem')
      if (error) throw error
      return (data ?? []) as Linha[]
    },
  })
  const ids = (fila.data ?? []).map((l) => l.item_id)
  // alta vigilância: quais itens exigem liberação da farmácia e quem liberou
  const liberacao = useQuery({
    queryKey: ['liberacao-farmacia', ids.join(',')],
    enabled: ids.length > 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('liberacao_farmacia', { p_itens: ids })
      if (error) throw error
      return new Map(((data ?? []) as unknown as Liberacao[]).map((e) => [e.item_id, e]))
    },
  })
  // sugestão de horários pela grade da unidade e o último aprazamento de cada item
  const apraz = useQuery({
    queryKey: ['sugestoes-aprazamento', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('sugestoes_aprazamento', { p_itens: ids })
      if (error) throw error
      return new Map(((data ?? []) as unknown as SugestaoItem[]).map((e) => [e.item_id, e]))
    },
  })
  // item alterado pelo médico (Fase 2, tarefa 6): o que mudou e o motivo
  const alteracoes = useQuery({
    queryKey: ['alteracoes-itens', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('alteracoes_de_itens', { p_itens: ids })
      if (error) throw error
      return new Map(((data ?? []) as unknown as Alteracao[]).map((e) => [e.item_id, e]))
    },
  })
  // lacuna 9: doses atrasadas das últimas 24 h, com a ciência do enfermeiro
  const atrasos = useQuery({
    queryKey: ['atrasos-de-dose', ids.join(',')],
    enabled: ids.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('atrasos_de_dose', { p_itens: ids })
      if (error) throw error
      const m = new Map<string, DoseAtrasada[]>()
      for (const d of (data ?? []) as unknown as DoseAtrasada[]) m.set(d.item_id, [...(m.get(d.item_id) ?? []), d])
      return m
    },
  })
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['fila-checagem'] })
    void qc.invalidateQueries({ queryKey: ['atrasos-de-dose'] })
    void qc.invalidateQueries({ queryKey: ['liberacao-farmacia'] })
    void qc.invalidateQueries({ queryKey: ['sugestoes-aprazamento'] })
    void qc.invalidateQueries({ queryKey: ['alteracoes-itens'] })
  }
  const pacientes = new Map<string, Linha[]>()
  for (const l of fila.data ?? []) pacientes.set(l.paciente_id, [...(pacientes.get(l.paciente_id) ?? []), l])

  return (
    <>
      <TituloPagina icone={ClipboardCheck} titulo="Checagem"
        descricao="Itens prescritos dos pacientes do seu plantão. Não feito e recusado pedem motivo; corrigir é checar de novo." />
      <MensagemErro texto={erro} className="mb-3" />
      {pacientes.size === 0 && !fila.isLoading && (
        <Vazio icone={ClipboardCheck} titulo="Nenhum item para checar" texto="Pacientes dos setores da sua escala com prescrição ativa aparecem aqui." />
      )}
      <div className="flex flex-col gap-4">
        {[...pacientes.entries()].map(([id, itens]) => (
          <Card key={id}>
            <CardHeader>
              <CardTitle className="text-corpo">{itens[0].paciente_nome} <span className="text-apoio font-normal text-tinta-sussurro">· {itens[0].local ?? '—'}</span></CardTitle>
              {/* alergia de cada paciente junto dos itens a administrar (R4) */}
              <AlergiaNaTela pacienteId={id} />
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-apoio">
              {itens.map((l) => <ItemChecagem key={l.item_id} l={l} liberacao={liberacao.data?.get(l.item_id)} apraz={apraz.data?.get(l.item_id)} alteracao={alteracoes.data?.get(l.item_id)} atrasos={atrasos.data?.get(l.item_id) ?? []} souEnfermeiro={papelAtivo === 'enfermeiro'} agora={agora} aoMudar={recarregar} aoErro={setErro} />)}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

function ItemChecagem({ l, liberacao, apraz, alteracao, atrasos, souEnfermeiro, agora, aoMudar, aoErro }: {
  l: Linha; liberacao: Liberacao | undefined; apraz: SugestaoItem | undefined; alteracao: Alteracao | undefined; atrasos: DoseAtrasada[]
  souEnfermeiro: boolean; agora: number; aoMudar: () => void; aoErro: (m: string | null) => void
}) {
  const podeAprazar = souEnfermeiro
  const [horarios, setHorarios] = React.useState((l.horarios ?? []).join(', '))
  const [horario, setHorario] = React.useState('')
  const [motivoAjuste, setMotivoAjuste] = React.useState('')
  const sugestao = apraz?.sugestao ?? null
  const digitados = lerHorarios(horarios)
  const ajustando = !!sugestao && digitados.horarios.length > 0 && !mesmaLista(digitados.horarios, sugestao.horarios)
  const [pedindo, setPedindo] = React.useState<'feito' | 'nao_feito' | 'recusado' | null>(null)
  const [motivo, setMotivo] = React.useState('')
  // lacuna 9: o "feito" depois da tolerância pede o motivo do atraso
  const [motivoAtraso, setMotivoAtraso] = React.useState('')
  const [textoAtraso, setTextoAtraso] = React.useState('')
  const [atrasoDoServidor, setAtrasoDoServidor] = React.useState(false)
  const st = l.ultima_situacao ? SITUACAO[l.ultima_situacao] : null

  // item aprazado: a checagem é de um horário (o servidor também exige)
  const aprazado = !l.se_necessario && (l.horarios?.length ?? 0) > 0
  const faltaHorario = aprazado && !horario
  // dose única já feita: nada mais a conferir nem a checar
  const unicaFeita = doseUnicaFeita(l.posologia, l.se_necessario, l.ultima_situacao)
  const lib = estadoLiberacao(liberacao)
  // sem liberação da farmácia, o "feito" pede justificativa (o servidor também exige)
  const feitoPedeJustificativa = lib === 'aguardando' || lib === 'devolvido'
  const atrasoFeito = horario ? atrasoDoFeito(l, horario, agora) : null
  const feitoPedeMotivoAtraso = atrasoFeito !== null || atrasoDoServidor
  const controle = controleDoCatalogo({ lista: liberacao?.controlado, receita: liberacao?.controlado_receita })
  const altaVigilancia = !!liberacao && liberacao.alta_vigilancia !== false
  // lacuna 6: vencido não se administra (COFEN 689/2022); a 2 h do fim já dá para pedir a renovação
  const validade = validadeDoItem(l, agora)
  const vencido = validade === 'vencido'
  const podePedir = l.tipo !== 'contencao' && (vencido || validade === 'vence_logo')
  const [pedido, setPedido] = React.useState<string | null>(null)
  async function pedirRenovacao() {
    const { data, error } = await supabase.rpc('pedir_renovacao', { p_item: l.item_id })
    if (error) return aoErro(error.message)
    const r = data as unknown as { avisados: number; pedida_em: string }
    aoErro(null)
    setPedido(r.avisados > 0 ? `Pedido enviado ao médico de plantão (${r.avisados === 1 ? '1 aviso' : `${r.avisados} avisos`}).`
      : 'Pedido registrado. O médico de plantão já tinha o aviso, ou não há médico escalado no setor agora: avise pessoalmente.')
    aoMudar()
  }

  async function checar(situacao: 'feito' | 'nao_feito' | 'recusado', m?: string) {
    if (faltaHorario) return aoErro(`${l.descricao}: escolha o horário aprazado que está sendo checado.`)
    const comAtraso = situacao === 'feito' && feitoPedeMotivoAtraso && !!motivoAtraso
    const { error } = await supabase.rpc('checar', {
      p_item: l.item_id, p_situacao: situacao, p_horario: horario || undefined, p_motivo: m || undefined,
      p_motivo_atraso: comAtraso ? motivoAtraso : undefined, p_motivo_atraso_texto: comAtraso && textoAtraso.trim() ? textoAtraso.trim() : undefined,
    })
    if (error) {
      // o relógio da tela pode estar atrás do servidor: abre o motivo do atraso
      if (situacao === 'feito' && error.message.startsWith('Dose atrasada')) { setAtrasoDoServidor(true); setPedindo('feito') }
      return aoErro(error.message)
    }
    aoErro(null); setPedindo(null); setMotivo(''); setMotivoAtraso(''); setTextoAtraso(''); setAtrasoDoServidor(false); aoMudar()
  }
  async function darCiencia(id: string) {
    const { error } = await supabase.rpc('dar_ciencia_atraso', { p_dose_atrasada: id })
    if (error) return aoErro(error.message)
    aoErro(null); aoMudar()
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-controle border border-fio px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium text-tinta">{l.descricao}</span>
        {l.tipo === 'medicamento' && <span>{l.dose} · {l.via} · {l.posologia}{l.se_necessario ? ' · se necessário' : ''}</span>}
        {l.vasoativo && <Badge variant="warning">vasoativo</Badge>}
        {altaVigilancia && <Badge variant="destructive" title={liberacao?.regra}><ShieldAlert className="size-3" /> alta vigilância · liberação da farmácia</Badge>}
        {controle && <SeloControlado controle={controle} />}
        <SeloValidadeItem item={l} agora={agora} />
        {st && <span className="ml-auto"><Estado tom={st.tom}>{st.rotulo}{l.ultima_horario ? ` ${l.ultima_horario}` : ''}</Estado></span>}
      </div>
      {alteracao && ehRenovacao(alteracao.motivo) && (
        <p className="text-rotulo text-tinta-apoio">Prescrição renovada sem mudança por {alteracao.alterado_por ?? '—'}, {hora(alteracao.alterado_em)}.</p>
      )}
      {podePedir && l.valida_ate && (
        <div role="note" title={FONTE_VALIDADE}
          className={cn('flex flex-wrap items-center gap-2 rounded-controle border px-2.5 py-1.5 text-rotulo',
            vencido ? 'border-critico/30 bg-alerta-critico text-critico' : 'border-atencao/40 bg-alerta-atencao text-atencao')}>
          <span>
            {vencido
              ? <><strong>Prescrição vencida às {diaHora(l.valida_ate)}.</strong> Não administre: peça a renovação ao médico.</>
              : <>Prescrição vence às {diaHora(l.valida_ate)}.</>}
            {l.renovacao_pedida_em ? ` Renovação pedida às ${diaHora(l.renovacao_pedida_em)}.` : ''}
          </span>
          <Button size="xs" variant="outline" onClick={() => void pedirRenovacao()}>{l.renovacao_pedida_em ? 'Pedir de novo' : 'Pedir renovação'}</Button>
          {pedido && <span className="w-full">{pedido}</span>}
        </div>
      )}
      {alteracao && !ehRenovacao(alteracao.motivo) && (
        <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-2.5 py-1.5 text-rotulo text-atencao">
          <strong>Prescrição alterada</strong> (versão {alteracao.versao}) por {alteracao.alterado_por ?? '—'}, {hora(alteracao.alterado_em)}:{' '}
          {resumoMudanca(alteracao.anterior, { dose: l.dose, via: l.via, posologia: l.posologia, se_necessario: l.se_necessario }) || 'observação'}
          {alteracao.motivo ? ` — “${alteracao.motivo}”` : ''}
        </p>
      )}
      {l.diluicao_texto && <p className="text-rotulo text-tinta-apoio">Diluição: {l.diluicao_texto}</p>}
      {aprazado && (
        <div className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Situação por horário (últimas 24 horas)">
          {l.horarios!.map((h) => {
            const s = l.por_horario?.[h]
            const sit = s ? SITUACAO[s.situacao] : null
            // lacuna 9: atraso do horário pela regra do servidor (tolerância e 12 h)
            const e = estadoDoHorario(l, h, s, agora)
            if (e.tipo === 'atrasado' || e.tipo === 'omitido') {
              return (
                <span key={h} title={`${e.tipo === 'omitido' ? 'Passou de 12 h sem checagem: registrada como omissão.' : `Tolerância de ${duracaoTexto(janelaAtrasoMin(l.horarios))}.`} ${FONTE_ATRASO}`}>
                  <Estado tom="vermelho">{h} · {e.tipo === 'omitido' ? `omitido, sem checagem há ${duracaoTexto(e.minutos)}` : `atrasado há ${duracaoTexto(e.minutos)}`}</Estado>
                </span>
              )
            }
            const comAtraso = s?.situacao === 'feito' && !!s.atrasada
            const motivoDoAtraso = comAtraso ? [rotuloMotivoAtraso(s.motivo_atraso), s.motivo_atraso_texto].filter(Boolean).join(': ') : ''
            return (
              <span key={h} title={s ? `Checado ${hora(s.em)}${comAtraso ? `, com atraso de ${duracaoTexto(s.atraso_min ?? 0)}${motivoDoAtraso ? ` (${motivoDoAtraso})` : ''}` : ''}` : 'Sem checagem nas últimas 24 horas'}>
                <Estado tom={comAtraso ? 'ambar' : sit?.tom ?? 'cinza'}>
                  {h} · {sit?.rotulo ?? 'a checar'}{comAtraso ? ` com atraso de ${duracaoTexto(s.atraso_min ?? 0)}` : ''}
                </Estado>
              </span>
            )
          })}
        </div>
      )}
      {atrasos.map((d) => (
        <div key={d.id} role="note" title={FONTE_ATRASO}
          className={cn('flex flex-wrap items-center gap-2 rounded-controle border px-2.5 py-1.5 text-rotulo',
            d.ciente_em ? 'border-fio text-tinta-apoio' : 'border-critico/30 bg-alerta-critico text-critico')}>
          <span>
            <strong>Dose das {d.horario} {d.omitida ? 'omitida' : 'atrasada'}</strong>
            {d.feito_em
              ? <>: feita às {hora(d.feito_em)}, {duracaoTexto(d.atraso_min ?? 0)} depois{d.motivo_atraso ? ` (${[rotuloMotivoAtraso(d.motivo_atraso), d.motivo_atraso_texto].filter(Boolean).join(': ')})` : ''}.</>
              : d.omitida ? <>: passou de 12 h sem checagem.</> : <>: sem checagem depois da tolerância.</>}
            {d.ciente_em ? ` Ciência de ${d.ciente_por ?? '—'}, ${hora(d.ciente_em)}.` : ' Falta a ciência do enfermeiro.'}
          </span>
          {!d.ciente_em && souEnfermeiro && <Button size="xs" variant="outline" onClick={() => void darCiencia(d.id)}>Dar ciência</Button>}
        </div>
      ))}
      {podeAprazar && sugestao && (
        <div className="flex flex-wrap items-center gap-2 text-rotulo text-tinta-apoio">
          <span>
            Sugestão ({sugestao.intervalo_h}/{sugestao.intervalo_h} h, {sugestao.origem}): <span className="font-medium text-tinta">{sugestao.horarios.join(', ')}</span>
            {sugestao.primeira && <> · prescrito às {sugestao.prescrito_as}, 1ª dose da grade às {sugestao.primeira}</>}
          </span>
          {!mesmaLista(l.horarios, sugestao.horarios) && (
            <Button size="xs" variant="ghost" onClick={() => setHorarios(sugestao.horarios.join(', '))}>Usar sugestão</Button>
          )}
        </div>
      )}
      {podeAprazar && ajustando && (
        <Input className="h-8 max-w-md text-rotulo" placeholder="Motivo do ajuste (opcional; fica registrado)" value={motivoAjuste}
          onChange={(e) => setMotivoAjuste(e.target.value)} />
      )}
      {apraz?.ultimo && (
        <p className="text-rotulo text-tinta-sussurro">
          Aprazado por {apraz.ultimo.por ?? '—'}, {hora(apraz.ultimo.em)}
          {apraz.ultimo.ajustado && apraz.ultimo.sugeridos ? ` · ajustado da sugestão (${apraz.ultimo.sugeridos.join(', ')})` : ''}
          {apraz.ultimo.motivo ? `: “${apraz.ultimo.motivo}”` : ''}
        </p>
      )}
      {liberacao && !unicaFeita && (
        <p className={`rounded-controle border px-2.5 py-1.5 text-rotulo ${lib === 'liberado' ? 'border-conforme/30 bg-alerta-conforme text-conforme'
          : lib === 'devolvido' ? 'border-critico/30 bg-alerta-critico text-critico' : 'border-atencao/40 bg-alerta-atencao text-atencao'}`}>
          {lib === 'liberado' && <>Liberado pela farmácia: {liberacao.por ?? '—'}, {liberacao.em ? hora(liberacao.em) : '—'}.</>}
          {lib === 'devolvido' && <>Devolvido pela farmácia: {liberacao.motivo ?? 'sem motivo'}. Sem liberação, o “feito” pede justificativa.</>}
          {lib === 'aguardando' && <>Aguardando a liberação da farmácia. Sem farmacêutico de plantão, registre como feito com justificativa: o farmacêutico confere depois.</>}
        </p>
      )}
      {unicaFeita && <p className="text-rotulo text-conforme">Dose única (Agora) já registrada como feita. Nova dose precisa de nova prescrição.</p>}
      {l.ultima_em && <p className="text-rotulo text-tinta-sussurro">Última checagem: {hora(l.ultima_em)} · {l.ultima_por}</p>}
      {!unicaFeita && <div className="flex flex-wrap items-center gap-2">
        {podeAprazar ? (
          <>
            <Input className="h-8 w-44" placeholder="Horários: 08:00, 20:00" value={horarios} onChange={(e) => setHorarios(e.target.value)} />
            <Button size="xs" variant="outline" onClick={async () => {
              if (digitados.invalidos.length) return aoErro(`${l.descricao}: horário inválido (${digitados.invalidos.join(', ')}).`)
              const { error } = await supabase.rpc('aprazar', {
                p_item: l.item_id, p_horarios: digitados.horarios, p_motivo: ajustando && motivoAjuste.trim() ? motivoAjuste.trim() : undefined,
              })
              if (error) return aoErro(error.message)
              aoErro(null); setMotivoAjuste(''); aoMudar()
            }}>Aprazar</Button>
          </>
        ) : l.horarios?.length ? <span className="text-rotulo text-tinta-apoio">Aprazado: {l.horarios.join(', ')}</span> : null}
        {l.horarios?.length ? (
          <CampoSelecao tamanho="compacto" className={cn('text-rotulo', faltaHorario && 'border-atencao')} value={horario} onChange={(e) => setHorario(e.target.value)}
            aria-label="Horário da checagem">
            <option value="">{aprazado ? 'qual horário? *' : 'horário…'}</option>
            {l.horarios.map((h) => <option key={h}>{h}</option>)}
          </CampoSelecao>
        ) : null}
        <Button size="xs" disabled={vencido}
          title={vencido ? 'Prescrição vencida: peça a renovação ao médico' : feitoPedeJustificativa ? 'Sem liberação da farmácia: pede justificativa' : undefined}
          onClick={() => (feitoPedeJustificativa || feitoPedeMotivoAtraso ? setPedindo('feito') : void checar('feito'))}>Feito</Button>
        <Button size="xs" variant="outline" onClick={() => setPedindo('nao_feito')}>Não feito</Button>
        <Button size="xs" variant="outline" onClick={() => setPedindo('recusado')}>Recusado</Button>
      </div>}
      {pedindo && (
        <div className="flex flex-wrap gap-2">
          {pedindo === 'feito' && feitoPedeMotivoAtraso && (
            <>
              <span className="w-full text-rotulo text-critico" title={FONTE_ATRASO}>
                Dose atrasada{atrasoFeito !== null ? `: ${duracaoTexto(atrasoFeito)} depois do horário das ${horario}` : ''} (tolerância
                de {duracaoTexto(janelaAtrasoMin(l.horarios))}). Escolha o motivo do atraso.
              </span>
              <CampoSelecao tamanho="compacto" className="text-rotulo" value={motivoAtraso} onChange={(e) => setMotivoAtraso(e.target.value)}
                aria-label="Motivo do atraso">
                <option value="">motivo do atraso *</option>
                {MOTIVOS_ATRASO.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
              </CampoSelecao>
              {motivoAtraso && (
                <Input className="h-8 max-w-md" value={textoAtraso} onChange={(e) => setTextoAtraso(e.target.value)}
                  placeholder={motivoAtraso === 'outro' ? `Descreva o motivo (mínimo de ${MINIMO_OUTRO} letras)` : 'Complemento (opcional)'} />
              )}
            </>
          )}
          {(pedindo !== 'feito' || feitoPedeJustificativa) && (
            <Input className="h-8" value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder={pedindo === 'feito' ? 'Justificativa: por que administra sem a liberação da farmácia' : pedindo === 'recusado' ? 'Motivo da recusa' : 'Por que não foi feito'} />
          )}
          <Button size="xs"
            disabled={((pedindo !== 'feito' || feitoPedeJustificativa) && motivo.trim().length < (pedindo === 'feito' ? MINIMO_JUSTIFICATIVA : 5))
              || (pedindo === 'feito' && feitoPedeMotivoAtraso && !motivoAtrasoValido(motivoAtraso, textoAtraso))}
            onClick={() => void checar(pedindo, pedindo === 'feito' && !feitoPedeJustificativa ? undefined : motivo)}>
            {pedindo === 'feito' ? 'Registrar como feito' : 'Registrar'}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setPedindo(null)}>Voltar</Button>
        </div>
      )}
    </div>
  )
}
