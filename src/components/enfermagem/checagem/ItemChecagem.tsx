// ─────────────────────────────────────────────────────────────────────────────
// Um item da checagem de enfermagem (Fase 4.6), comum à tela Checagem e à aba
// "Agora" da gaveta Cuidados (CK0, revisão do perfil Enfermeiro, RT
// 24/11/2026). As regras são as mesmas de antes e as do servidor: o enfermeiro
// apraza; a enfermagem checa cada administração (feito, não feito ou
// recusado, os dois últimos com motivo); nada se apaga, corrigir é checar de
// novo. Alta vigilância e controlado (Portaria 344): a liberação da farmácia
// antes de administrar; sem ela, o "feito" pede justificativa. Validade
// (lacuna 6, COFEN 689/2022, art. 4º): vencido não se administra. Atraso
// (lacuna 9, Portaria MS 2.095/2013): o "feito" atrasado pede o motivo e o
// enfermeiro dá ciência da dose atrasada.
//
// O que muda é a tela: CK2, o item vencido mostra só a faixa, "Pedir
// renovação" e "Não feito"; CK3, os horários viram fichas com o estado, e a
// ficha escolhe o horário da checagem; AV3, a ficha "Alta vigilância ·
// liberado" ou "aguardando farmácia" ao lado dos horários.
// ─────────────────────────────────────────────────────────────────────────────
import { ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { resumoMudanca } from '@/lib/alteracaoPrescricao'
import {
  atrasoDoFeito, duracaoTexto, estadoDoHorario, FONTE_ATRASO, janelaAtrasoMin, MINIMO_OUTRO, MOTIVOS_ATRASO, motivoAtrasoValido,
  rotuloMotivoAtraso,
} from '@/lib/atraso'
import { lerHorarios, mesmaLista } from '@/lib/aprazamento'
import { doseUnicaFeita, estadoLiberacao, MINIMO_JUSTIFICATIVA } from '@/lib/duplaChecagem'
import { estadoDaFicha, type EstadoFicha } from '@/lib/rondaChecagem'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { dataHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { Estado } from '@/components/porta/Estado'
import { SeloControlado } from '@/components/farmacia/SeloControlado'
import { controleDoCatalogo } from '@/domain/controlados'
import { SeloValidadeItem } from '@/components/prescricao/ValidadeItem'
import { diaHora, ehRenovacao, FONTE_VALIDADE, validadeDoItem } from '@/lib/validadePrescricao'

import type { ContextoItens, LinhaChecagem } from './dados'

const SITUACAO: Record<string, { rotulo: string; tom: 'verde' | 'ambar' | 'vermelho' }> = {
  feito: { rotulo: 'feito', tom: 'verde' },
  nao_feito: { rotulo: 'não feito', tom: 'ambar' },
  recusado: { rotulo: 'recusado', tom: 'vermelho' },
}
const hora = (iso: string) => dataHora(iso)

const FICHA: Record<EstadoFicha, { classe: string; sufixo: string }> = {
  feito: { classe: 'border-conforme/30 bg-alerta-conforme text-conforme', sufixo: 'feito' },
  atrasado: { classe: 'border-critico/30 bg-alerta-critico text-critico', sufixo: 'atrasado' },
  agora: { classe: 'border-atencao/40 bg-alerta-atencao text-atencao', sufixo: 'agora' },
  proximo: { classe: 'border-fio bg-superficie text-tinta', sufixo: 'próximo' },
  depois: { classe: 'border-fio bg-superficie text-tinta-sussurro', sufixo: '' },
}

export function ItemChecagem({ l, ctx, souEnfermeiro, agora, aoMudar, aoErro, paciente }: {
  l: LinhaChecagem; ctx: ContextoItens; souEnfermeiro: boolean; agora: number
  aoMudar: () => void; aoErro: (m: string | null) => void
  /** Na ronda por horário: o paciente do item (abre a gaveta dele). */
  paciente?: React.ReactNode
}) {
  const liberacao = ctx.liberacao?.get(l.item_id)
  const apraz = ctx.apraz?.get(l.item_id)
  const alteracao = ctx.alteracoes?.get(l.item_id)
  const atrasos = ctx.atrasos?.get(l.item_id) ?? []
  // o aprazamento é do enfermeiro pelo perfil em uso (o servidor também confere)
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
  // o editor do aprazamento abre sozinho quando o item ainda não tem horário
  const [editandoApraz, setEditandoApraz] = React.useState(!l.se_necessario && (l.horarios?.length ?? 0) === 0)
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
  async function aprazar() {
    if (digitados.invalidos.length) return aoErro(`${l.descricao}: horário inválido (${digitados.invalidos.join(', ')}).`)
    const { error } = await supabase.rpc('aprazar', {
      p_item: l.item_id, p_horarios: digitados.horarios, p_motivo: ajustando && motivoAjuste.trim() ? motivoAjuste.trim() : undefined,
    })
    if (error) return aoErro(error.message)
    aoErro(null); setMotivoAjuste(''); setEditandoApraz(false); aoMudar()
  }

  // AV3: a liberação da farmácia numa ficha, ao lado dos horários
  const fichaLiberacao = liberacao && !unicaFeita && (
    <span title={[liberacao.regra, lib === 'liberado' ? `Liberado por ${liberacao.por ?? '—'}${liberacao.em ? `, ${hora(liberacao.em)}` : ''}.` : '',
      lib === 'aguardando' ? 'Sem farmacêutico de plantão, registre como feito com justificativa: o farmacêutico confere depois.' : ''].filter(Boolean).join(' ')}
      className={cn('inline-flex items-center gap-1 rounded-capsula border px-2 py-0.5 text-rotulo',
        lib === 'liberado' ? 'border-conforme/30 bg-alerta-conforme text-conforme' : lib === 'devolvido' ? 'border-critico/30 bg-alerta-critico text-critico' : 'border-atencao/40 bg-alerta-atencao text-atencao')}>
      {altaVigilancia && <ShieldAlert className="size-3" aria-hidden />}
      {altaVigilancia ? 'Alta vigilância' : 'Farmácia'} · {lib === 'liberado' ? 'liberado' : lib === 'devolvido' ? 'devolvido pela farmácia' : 'aguardando farmácia'}
    </span>
  )

  // CK3: os horários como fichas, com o estado; a ficha escolhe o horário da checagem
  const fichasHorario = aprazado && l.horarios!.map((h) => {
    const e = estadoDaFicha(l, h, agora)
    const s = l.por_horario?.[h]
    const det = estadoDoHorario(l, h, s, agora)
    const titulo = det.tipo === 'omitido' ? `Passou de 12 h sem checagem: registrada como omissão. ${FONTE_ATRASO}`
      : det.tipo === 'atrasado' ? `Atrasado há ${duracaoTexto(det.minutos)} (tolerância de ${duracaoTexto(janelaAtrasoMin(l.horarios))}). ${FONTE_ATRASO}`
      : s ? `Checado ${hora(s.em)}: ${SITUACAO[s.situacao]?.rotulo ?? s.situacao}${s.atrasada ? `, com atraso de ${duracaoTexto(s.atraso_min ?? 0)}${s.motivo_atraso ? ` (${[rotuloMotivoAtraso(s.motivo_atraso), s.motivo_atraso_texto].filter(Boolean).join(': ')})` : ''}` : ''}`
      : 'Escolher este horário para a checagem'
    return (
      // padrao-ok: ficha de horário com estado e escolha; o Chip não tem os tons de estado
      <button key={h} type="button" aria-pressed={horario === h} title={titulo} onClick={() => setHorario(horario === h ? '' : h)}
        className={cn('rounded-capsula border px-2 py-0.5 text-rotulo tabular-nums transition-shadow', FICHA[e].classe, horario === h && 'ring-2 ring-acao ring-offset-1')}>
        {h}{FICHA[e].sufixo && ` · ${det.tipo === 'omitido' ? 'omitido' : FICHA[e].sufixo}`}
      </button>
    )
  })

  const motivoNaoFeito = pedindo && pedindo !== 'feito' && (
    <div className="flex flex-wrap gap-2">
      {vencido && fichasHorario && (
        <div className="flex w-full flex-wrap items-center gap-1.5" role="group" aria-label="Horário do não feito">
          <span className="text-rotulo text-tinta-sussurro">Horário:</span>{fichasHorario}
        </div>
      )}
      <Input className="h-8 min-w-[220px] flex-1" value={motivo} onChange={(e) => setMotivo(e.target.value)}
        placeholder={pedindo === 'recusado' ? 'Motivo da recusa' : 'Por que não foi feito'} />
      <Button size="xs" disabled={motivo.trim().length < 5} onClick={() => void checar(pedindo, motivo)}>Registrar</Button>
      <Button size="xs" variant="ghost" onClick={() => setPedindo(null)}>Voltar</Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio px-3 py-2">
      {paciente}
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium text-tinta">{l.descricao}</span>
        {l.tipo === 'medicamento' && <span className="text-tinta-apoio">{l.dose} · {l.via} · {l.posologia}{l.se_necessario ? ' · se necessário' : ''}</span>}
        {l.vasoativo && <Badge variant="warning">vasoativo</Badge>}
        {controle && <SeloControlado controle={controle} />}
        {/* a faixa da validade já diz o que o selo diria */}
        {!podePedir && <SeloValidadeItem item={l} agora={agora} />}
        {st && <span className="ml-auto"><Estado tom={st.tom}>{st.rotulo}{l.ultima_horario ? ` ${l.ultima_horario}` : ''}</Estado></span>}
      </div>

      {podePedir && l.valida_ate && (
        <div role="note" title={FONTE_VALIDADE}
          className={cn('flex flex-wrap items-center gap-2 rounded-controle border px-2.5 py-1.5 text-rotulo',
            vencido ? 'border-critico/30 bg-alerta-critico text-critico' : 'border-atencao/40 bg-alerta-atencao text-atencao')}>
          <span className="min-w-0 flex-1">
            {vencido
              ? <><strong>Prescrição vencida às {diaHora(l.valida_ate)}.</strong> Não administre: peça a renovação ao médico.</>
              : <>Prescrição vence às {diaHora(l.valida_ate)}.</>}
            {l.renovacao_pedida_em ? ` Renovação pedida às ${diaHora(l.renovacao_pedida_em)}.` : ''}
          </span>
          <Button size="xs" variant="outline" onClick={() => void pedirRenovacao()}>{l.renovacao_pedida_em ? 'Pedir de novo' : 'Pedir renovação'}</Button>
          {vencido && <Button size="xs" variant="outline" onClick={() => setPedindo('nao_feito')}>Não feito</Button>}
          {pedido && <span className="w-full">{pedido}</span>}
        </div>
      )}

      {vencido ? (
        // CK2: vencido mostra só a faixa, "Pedir renovação" e "Não feito"; a ciência do atraso segue com o enfermeiro
        <>
          {motivoNaoFeito}
          {atrasos.filter((d) => !d.ciente_em).map((d) => (
            <div key={d.id} role="note" title={FONTE_ATRASO} className="flex flex-wrap items-center gap-2 text-rotulo text-critico">
              <span>Dose das {d.horario} {d.omitida ? 'omitida' : 'atrasada'}: falta a ciência do enfermeiro.</span>
              {souEnfermeiro && <Button size="xs" variant="outline" onClick={() => void darCiencia(d.id)}>Dar ciência</Button>}
            </div>
          ))}
        </>
      ) : (
        <>
          {alteracao && ehRenovacao(alteracao.motivo) && (
            <p className="text-rotulo text-tinta-apoio">Prescrição renovada sem mudança por {alteracao.alterado_por ?? '—'}, {hora(alteracao.alterado_em)}.</p>
          )}
          {alteracao && !ehRenovacao(alteracao.motivo) && (
            <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-2.5 py-1.5 text-rotulo text-atencao">
              <strong>Prescrição alterada</strong> (versão {alteracao.versao}) por {alteracao.alterado_por ?? '—'}, {hora(alteracao.alterado_em)}:{' '}
              {resumoMudanca(alteracao.anterior, { dose: l.dose, via: l.via, posologia: l.posologia, se_necessario: l.se_necessario }) || 'observação'}
              {alteracao.motivo ? ` — "${alteracao.motivo}"` : ''}
            </p>
          )}
          {l.diluicao_texto && <p className="text-rotulo text-tinta-apoio">Diluição: {l.diluicao_texto}</p>}

          {(aprazado || fichaLiberacao) && !unicaFeita && (
            <div className="flex flex-wrap items-center gap-1.5" role={aprazado ? 'group' : undefined} aria-label={aprazado ? 'Horários aprazados' : undefined}>
              {fichasHorario}
              {fichaLiberacao}
            </div>
          )}
          {lib === 'devolvido' && !unicaFeita && <p className="text-rotulo text-critico">Devolvido pela farmácia: {liberacao?.motivo ?? 'sem motivo'}. Sem liberação, o "feito" pede justificativa.</p>}

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

          {podeAprazar && !unicaFeita && !l.se_necessario && (editandoApraz ? (
            <div className="flex flex-col gap-1.5 rounded-controle bg-campo px-2.5 py-2">
              {sugestao && (
                <div className="flex flex-wrap items-center gap-2 text-rotulo text-tinta-apoio">
                  <span>
                    Sugestão ({sugestao.intervalo_h}/{sugestao.intervalo_h} h, {sugestao.origem}): <span className="font-medium text-tinta">{sugestao.horarios.join(', ')}</span>
                    {sugestao.primeira && <> · prescrito às {sugestao.prescrito_as}, 1ª dose da grade às {sugestao.primeira}</>}
                  </span>
                  {!mesmaLista(digitados.horarios, sugestao.horarios) && (
                    <Button size="xs" variant="outline" onClick={() => setHorarios(sugestao.horarios.join(', '))}>Usar sugestão</Button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Input className="h-8 w-64 max-w-full text-rotulo" aria-label="Horários do aprazamento" placeholder="08:00, 14:00, 20:00" value={horarios} onChange={(e) => setHorarios(e.target.value)} />
                <Button size="xs" onClick={() => void aprazar()}>Aprazar</Button>
                {(l.horarios?.length ?? 0) > 0 && <Button size="xs" variant="ghost" onClick={() => setEditandoApraz(false)}>Cancelar</Button>}
              </div>
              {ajustando && (
                <Input className="h-8 max-w-md text-rotulo" placeholder="Motivo do ajuste (opcional; fica registrado)" value={motivoAjuste}
                  onChange={(e) => setMotivoAjuste(e.target.value)} />
              )}
            </div>
          ) : null)}
          {apraz?.ultimo && (
            <p className="text-rotulo text-tinta-sussurro">
              Aprazado por {apraz.ultimo.por ?? '—'}, {hora(apraz.ultimo.em)}
              {apraz.ultimo.ajustado && apraz.ultimo.sugeridos ? ` · ajustado da sugestão (${apraz.ultimo.sugeridos.join(', ')})` : ''}
              {apraz.ultimo.motivo ? `: "${apraz.ultimo.motivo}"` : ''}
            </p>
          )}
          {unicaFeita && <p className="text-rotulo text-conforme">Dose única (Agora) já registrada como feita. Nova dose precisa de nova prescrição.</p>}
          {l.ultima_em && !unicaFeita && <p className="text-rotulo text-tinta-sussurro">Última checagem: {hora(l.ultima_em)} · {l.ultima_por}</p>}

          {!unicaFeita && (
            <div className="flex flex-wrap items-center gap-2">
              {faltaHorario && <span className="text-rotulo text-tinta-sussurro">Escolha o horário acima.</span>}
              {!aprazado && (l.horarios?.length ?? 0) > 0 && (
                <CampoSelecao tamanho="compacto" className="text-rotulo" value={horario} onChange={(e) => setHorario(e.target.value)} aria-label="Horário da checagem">
                  <option value="">horário…</option>
                  {l.horarios!.map((h) => <option key={h}>{h}</option>)}
                </CampoSelecao>
              )}
              <Button size="xs" disabled={faltaHorario}
                title={feitoPedeJustificativa ? 'Sem liberação da farmácia: pede justificativa' : undefined}
                onClick={() => (feitoPedeJustificativa || feitoPedeMotivoAtraso ? setPedindo('feito') : void checar('feito'))}>Feito</Button>
              <Button size="xs" variant="outline" onClick={() => setPedindo('nao_feito')}>Não feito</Button>
              <Button size="xs" variant="outline" onClick={() => setPedindo('recusado')}>Recusado</Button>
              {podeAprazar && !l.se_necessario && !editandoApraz && (l.horarios?.length ?? 0) > 0 && (
                <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setEditandoApraz(true)}>Aprazar de novo</Button>
              )}
            </div>
          )}
          {motivoNaoFeito}
          {pedindo === 'feito' && (
            <div className="flex flex-wrap gap-2">
              {feitoPedeMotivoAtraso && (
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
              {feitoPedeJustificativa && (
                <Input className="h-8" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Justificativa: por que administra sem a liberação da farmácia" />
              )}
              <Button size="xs"
                disabled={(feitoPedeJustificativa && motivo.trim().length < MINIMO_JUSTIFICATIVA)
                  || (feitoPedeMotivoAtraso && !motivoAtrasoValido(motivoAtraso, textoAtraso))}
                onClick={() => void checar('feito', feitoPedeJustificativa ? motivo : undefined)}>
                Registrar como feito
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setPedindo(null)}>Voltar</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
