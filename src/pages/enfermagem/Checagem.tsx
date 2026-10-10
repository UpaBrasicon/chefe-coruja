// ─────────────────────────────────────────────────────────────────────────────
// Checagem de enfermagem (Fase 4.6).
//
// Itens ativos das prescrições dos pacientes do meu plantão. O enfermeiro
// apraza; a enfermagem checa cada administração — feito, não feito ou
// recusado (os dois últimos com motivo). Nada se apaga: corrigir é checar de
// novo, e vale o último registro. Medicamento de alta vigilância (Fase 2,
// tarefa 1, revista em 09/10/2026): o controle é a liberação da farmácia
// (validação do item); sem ela, o "feito" pede justificativa e o farmacêutico
// confere depois.
// Aprazamento assistido (Fase 2, tarefa 2): a posologia vira sugestão de
// horários pela grade da unidade; o enfermeiro aceita ou ajusta, e o ajuste
// fica registrado.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { resumoMudanca, type Alteracao } from '@/lib/alteracaoPrescricao'
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

type Linha = {
  paciente_id: string; paciente_nome: string; local: string | null; item_id: string; tipo: string; descricao: string
  dose: string | null; via: string | null; posologia: string | null; se_necessario: boolean; horarios: string[] | null
  diluicao_texto: string | null; vasoativo: boolean; ultima_situacao: string | null; ultima_em: string | null
  ultima_por: string | null; ultima_horario: string | null
  /** Última checagem de cada horário aprazado nas últimas 24 h (fila_checagem). */
  por_horario: Record<string, { situacao: string; em: string }> | null
}
const SITUACAO: Record<string, { rotulo: string; variante: 'success' | 'warning' | 'destructive' }> = {
  feito: { rotulo: 'feito', variante: 'success' },
  nao_feito: { rotulo: 'não feito', variante: 'warning' },
  recusado: { rotulo: 'recusado', variante: 'destructive' },
}
const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export default function Checagem() {
  const { papelAtivo } = useUnidade()
  const qc = useQueryClient()
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
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['fila-checagem'] })
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
      {erro && <p className="mb-3 rounded-lg border border-critico/30 bg-critico/[0.08] p-3 text-sm text-critico">{erro}</p>}
      {pacientes.size === 0 && !fila.isLoading && (
        <Vazio icone={ClipboardCheck} titulo="Nenhum item para checar" texto="Pacientes dos setores da sua escala com prescrição ativa aparecem aqui." />
      )}
      <div className="flex flex-col gap-4">
        {[...pacientes.entries()].map(([id, itens]) => (
          <Card key={id}>
            <CardHeader>
              <CardTitle className="text-base">{itens[0].paciente_nome} <span className="text-sm font-normal text-tinta-sussurro">· {itens[0].local ?? '—'}</span></CardTitle>
              {/* alergia de cada paciente junto dos itens a administrar (R4) */}
              <AlergiaNaTela pacienteId={id} />
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {itens.map((l) => <ItemChecagem key={l.item_id} l={l} liberacao={liberacao.data?.get(l.item_id)} apraz={apraz.data?.get(l.item_id)} alteracao={alteracoes.data?.get(l.item_id)} souEnfermeiro={papelAtivo === 'enfermeiro'} aoMudar={recarregar} aoErro={setErro} />)}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

function ItemChecagem({ l, liberacao, apraz, alteracao, souEnfermeiro, aoMudar, aoErro }: {
  l: Linha; liberacao: Liberacao | undefined; apraz: SugestaoItem | undefined; alteracao: Alteracao | undefined; souEnfermeiro: boolean
  aoMudar: () => void; aoErro: (m: string | null) => void
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
  const st = l.ultima_situacao ? SITUACAO[l.ultima_situacao] : null

  // item aprazado: a checagem é de um horário (o servidor também exige)
  const aprazado = !l.se_necessario && (l.horarios?.length ?? 0) > 0
  const faltaHorario = aprazado && !horario
  // dose única já feita: nada mais a conferir nem a checar
  const unicaFeita = doseUnicaFeita(l.posologia, l.se_necessario, l.ultima_situacao)
  const lib = estadoLiberacao(liberacao)
  // sem liberação da farmácia, o "feito" pede justificativa (o servidor também exige)
  const feitoPedeJustificativa = lib === 'aguardando' || lib === 'devolvido'

  async function checar(situacao: 'feito' | 'nao_feito' | 'recusado', m?: string) {
    if (faltaHorario) return aoErro(`${l.descricao}: escolha o horário aprazado que está sendo checado.`)
    const { error } = await supabase.rpc('checar', { p_item: l.item_id, p_situacao: situacao, p_horario: horario || undefined, p_motivo: m || undefined })
    if (error) return aoErro(error.message)
    aoErro(null); setPedindo(null); setMotivo(''); aoMudar()
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-fio px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium text-tinta">{l.descricao}</span>
        {l.tipo === 'medicamento' && <span>{l.dose} · {l.via} · {l.posologia}{l.se_necessario ? ' · se necessário' : ''}</span>}
        {l.vasoativo && <Badge variant="warning">vasoativo</Badge>}
        {liberacao && <Badge variant="destructive" title={liberacao.regra}><ShieldAlert className="size-3" /> alta vigilância · liberação da farmácia</Badge>}
        {st && <Badge variant={st.variante} className="ml-auto">{st.rotulo}{l.ultima_horario ? ` ${l.ultima_horario}` : ''}</Badge>}
      </div>
      {alteracao && (
        <p role="note" className="rounded-md border border-atencao/40 bg-atencao/[0.08] px-2.5 py-1.5 text-xs text-atencao">
          <strong>Prescrição alterada</strong> (versão {alteracao.versao}) por {alteracao.alterado_por ?? '—'}, {hora(alteracao.alterado_em)}:{' '}
          {resumoMudanca(alteracao.anterior, { dose: l.dose, via: l.via, posologia: l.posologia, se_necessario: l.se_necessario }) || 'observação'}
          {alteracao.motivo ? ` — “${alteracao.motivo}”` : ''}
        </p>
      )}
      {l.diluicao_texto && <p className="text-xs text-tinta-apoio">Diluição: {l.diluicao_texto}</p>}
      {aprazado && (
        <div className="flex flex-wrap gap-1.5" aria-label="Situação por horário (últimas 24 horas)">
          {l.horarios!.map((h) => {
            const s = l.por_horario?.[h]
            const sit = s ? SITUACAO[s.situacao] : null
            return (
              <Badge key={h} variant={sit?.variante ?? 'outline'} title={s ? `Checado ${hora(s.em)}` : 'Sem checagem nas últimas 24 horas'}>
                {h} · {sit?.rotulo ?? 'a checar'}
              </Badge>
            )
          })}
        </div>
      )}
      {podeAprazar && sugestao && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-tinta-apoio">
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
        <Input className="h-8 max-w-md text-xs" placeholder="Motivo do ajuste (opcional; fica registrado)" value={motivoAjuste}
          onChange={(e) => setMotivoAjuste(e.target.value)} />
      )}
      {apraz?.ultimo && (
        <p className="text-xs text-tinta-sussurro">
          Aprazado por {apraz.ultimo.por ?? '—'}, {hora(apraz.ultimo.em)}
          {apraz.ultimo.ajustado && apraz.ultimo.sugeridos ? ` · ajustado da sugestão (${apraz.ultimo.sugeridos.join(', ')})` : ''}
          {apraz.ultimo.motivo ? `: “${apraz.ultimo.motivo}”` : ''}
        </p>
      )}
      {liberacao && !unicaFeita && (
        <p className={`rounded-md border px-2.5 py-1.5 text-xs ${lib === 'liberado' ? 'border-conforme/30 bg-conforme/[0.06] text-conforme'
          : lib === 'devolvido' ? 'border-critico/30 bg-critico/[0.05] text-critico' : 'border-atencao/40 bg-atencao/[0.08] text-atencao'}`}>
          {lib === 'liberado' && <>Liberado pela farmácia: {liberacao.por ?? '—'}, {liberacao.em ? hora(liberacao.em) : '—'}.</>}
          {lib === 'devolvido' && <>Devolvido pela farmácia: {liberacao.motivo ?? 'sem motivo'}. Sem liberação, o “feito” pede justificativa.</>}
          {lib === 'aguardando' && <>Aguardando a liberação da farmácia. Sem farmacêutico de plantão, registre como feito com justificativa: o farmacêutico confere depois.</>}
        </p>
      )}
      {unicaFeita && <p className="text-xs text-conforme">Dose única (Agora) já registrada como feita. Nova dose precisa de nova prescrição.</p>}
      {l.ultima_em && <p className="text-xs text-tinta-sussurro">Última checagem: {hora(l.ultima_em)} · {l.ultima_por}</p>}
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
        ) : l.horarios?.length ? <span className="text-xs text-tinta-apoio">Aprazado: {l.horarios.join(', ')}</span> : null}
        {l.horarios?.length ? (
          <select className={`h-8 rounded-controle border bg-campo px-2 text-xs ${faltaHorario ? 'border-atencao' : 'border-fio'}`} value={horario} onChange={(e) => setHorario(e.target.value)}
            aria-label="Horário da checagem">
            <option value="">{aprazado ? 'qual horário? *' : 'horário…'}</option>
            {l.horarios.map((h) => <option key={h}>{h}</option>)}
          </select>
        ) : null}
        <Button size="xs" title={feitoPedeJustificativa ? 'Alta vigilância sem liberação da farmácia: pede justificativa' : undefined}
          onClick={() => (feitoPedeJustificativa ? setPedindo('feito') : void checar('feito'))}>Feito</Button>
        <Button size="xs" variant="outline" onClick={() => setPedindo('nao_feito')}>Não feito</Button>
        <Button size="xs" variant="outline" onClick={() => setPedindo('recusado')}>Recusado</Button>
      </div>}
      {pedindo && (
        <div className="flex gap-2">
          <Input className="h-8" value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder={pedindo === 'feito' ? 'Justificativa: por que administra sem a liberação da farmácia' : pedindo === 'recusado' ? 'Motivo da recusa' : 'Por que não foi feito'} />
          <Button size="xs" disabled={motivo.trim().length < (pedindo === 'feito' ? MINIMO_JUSTIFICATIVA : 5)} onClick={() => void checar(pedindo, motivo)}>
            {pedindo === 'feito' ? 'Registrar como feito' : 'Registrar'}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setPedindo(null)}>Voltar</Button>
        </div>
      )}
    </div>
  )
}
