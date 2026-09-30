// Dispositivos, balanço hídrico e curativos (protótipo: "Curativos e
// dispositivos" e "Sinais vitais e BH"). Escrita pelas RPCs da migration
// 20261005000005; a soma do balanço é de src/clinico/enfermagem/balancoHidrico.ts.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'

import {
  INICIO_PADRAO, PERIODO_PADRAO, balancoDoDia, instanteDaParede, textoBalanco,
} from '@/clinico/enfermagem/balancoHidrico'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import {
  TIPOS_DISPOSITIVO, agoraLocal, dataBr, hojeSP, hora, quando, useExecutar, useRecarregarCuidados,
  type Contexto, type Cuidados, type Dispositivo, type LancamentoBh, type TipoDispositivo,
} from './dadosCuidados'
import { Aviso, Campo, Cartao, Nota, Registro } from './pecas'

const atendimento = (d: Cuidados) => ({ p_episodio: d.episodio_id ?? undefined, p_internacao: d.internacao_id ?? undefined })
const semPermissao = 'Registro da enfermagem de plantão com o paciente, com o atendimento aberto.'

// ── dispositivos ────────────────────────────────────────────────────────────
export function AbaDispositivos({ ctx, dados }: { ctx: Contexto; dados: Cuidados }) {
  const { erro, aviso, ocupado, executar } = useExecutar(useRecarregarCuidados(ctx))
  const [tipo, setTipo] = React.useState<TipoDispositivo | null>(null)
  const [f, setF] = React.useState({ local: '', calibre: '', inserido: hojeSP(), troca: '', obs: '' })
  const [retirando, setRetirando] = React.useState<string | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const hoje = hojeSP()

  async function registrar() {
    if (!tipo) return
    const feito = await executar(() => supabase.rpc('registrar_dispositivo', {
      p_paciente: ctx.pacienteId, p_tipo: tipo, p_local: f.local, p_calibre: f.calibre, p_inserido_em: f.inserido,
      p_troca_prevista: f.troca || undefined, p_observacao: f.obs, ...atendimento(dados),
    }), `${tipo} registrado.`)
    if (feito) { setTipo(null); setF({ local: '', calibre: '', inserido: hojeSP(), troca: '', obs: '' }) }
  }
  async function retirar(d: Dispositivo) {
    const feito = await executar(() => supabase.rpc('retirar_dispositivo', { p_dispositivo: d.id, p_motivo: motivo.trim() || undefined }),
      `${d.tipo} retirado. Continua no histórico.`)
    if (feito) { setRetirando(null); setMotivo('') }
  }

  return (
    <Cartao titulo="Dispositivos">
      {dados.pode_registrar ? (
        <>
          <div role="group" aria-label="Tipo de dispositivo" className="flex flex-wrap gap-1.5">
            {TIPOS_DISPOSITIVO.map((t) => <Chip key={t} ativo={tipo === t} onClick={() => setTipo(tipo === t ? null : t)}>{t}</Chip>)}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Campo rotulo="Local" id="disp-local" className="flex-[1_1_180px]">
              <Input id="disp-local" placeholder="MSE, jugular direita…" value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} />
            </Campo>
            <Campo rotulo="Calibre" id="disp-calibre" className="flex-[0_1_120px]">
              <Input id="disp-calibre" placeholder="20G, 14 Fr…" value={f.calibre} onChange={(e) => setF({ ...f, calibre: e.target.value })} />
            </Campo>
            <Campo rotulo="Inserção" id="disp-insercao" className="flex-[0_1_170px]">
              <Input id="disp-insercao" type="date" max={hoje} value={f.inserido} onChange={(e) => setF({ ...f, inserido: e.target.value })} />
            </Campo>
            <Campo rotulo="Troca prevista" id="disp-troca" className="flex-[0_1_170px]">
              <Input id="disp-troca" type="date" min={f.inserido} value={f.troca} onChange={(e) => setF({ ...f, troca: e.target.value })} />
            </Campo>
            <Campo rotulo="Observação" id="disp-obs" className="flex-[1_1_100%]">
              <Input id="disp-obs" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
            </Campo>
            <Button variant="outline" size="sm" disabled={!tipo || !f.inserido || ocupado} onClick={() => void registrar()}>Registrar</Button>
          </div>
          <Nota>A troca prevista é digitada: o sistema não calcula prazo de troca (sem protocolo com fonte cadastrado).</Nota>
        </>
      ) : <Nota>{semPermissao}</Nota>}
      <Aviso erro={erro} aviso={aviso} />
      {dados.dispositivos.map((d) => {
        const ativo = !d.retirado_em
        const vencida = ativo && d.troca_prevista && d.troca_prevista <= hoje
        return (
          <div key={d.id} className="flex flex-col gap-2">
            <Registro riscado={!ativo}
              meta={[
                `Desde ${dataBr(d.inserido_em)}${ativo ? ` (D${d.dia})` : ''}`,
                d.troca_prevista ? `troca prevista ${dataBr(d.troca_prevista)}` : null,
                `${d.autor ?? '—'} · ${quando(d.registrado_em)}`,
                d.observacao || null,
                !ativo ? `retirado por ${d.retirado_por ?? '—'} em ${quando(d.retirado_em)}${d.motivo_retirada ? ` (${d.motivo_retirada})` : ''}` : null,
              ].filter(Boolean).join(' · ')}
              acao={<>
                {vencida && <span className="rounded-capsula bg-observacao/15 px-2 py-0.5 text-rotulo font-semibold text-observacao">Troca prevista chegou</span>}
                {ativo && dados.pode_registrar && retirando !== d.id && (
                  <Button size="sm" variant="outline" onClick={() => { setRetirando(d.id); setMotivo('') }}>Retirar</Button>
                )}
              </>}>
              {[d.tipo, d.local, d.calibre].filter(Boolean).join(' · ')}
            </Registro>
            {retirando === d.id && (
              <div className="flex flex-wrap items-center gap-2 rounded-controle border border-fio bg-campo p-2.5">
                <Input aria-label="Motivo da retirada" className="flex-[1_1_220px]" placeholder="Motivo (opcional): fim do uso, flebite, obstrução…"
                  value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <Button size="sm" disabled={ocupado} onClick={() => void retirar(d)}>Confirmar retirada</Button>
                <Button size="sm" variant="ghost" onClick={() => setRetirando(null)}>Não</Button>
              </div>
            )}
          </div>
        )
      })}
      {dados.dispositivos.length === 0 && <Nota>Nenhum dispositivo registrado.</Nota>}
    </Cartao>
  )
}

// ── balanço hídrico ─────────────────────────────────────────────────────────
export function AbaBalanco({ ctx, dados }: { ctx: Contexto; dados: Cuidados }) {
  const { erro, aviso, ocupado, executar } = useExecutar(useRecarregarCuidados(ctx))
  const [tipo, setTipo] = React.useState<'entrada' | 'saida'>('entrada')
  const [f, setF] = React.useState({ desc: '', vol: '', quando: '' })
  const [dias, setDias] = React.useState(0)
  const [inicioHora, setInicioHora] = React.useState(INICIO_PADRAO)
  const [periodo, setPeriodo] = React.useState(PERIODO_PADRAO)
  const [cancelando, setCancelando] = React.useState<string | null>(null)
  const [motivo, setMotivo] = React.useState('')

  const dia = balancoDoDia(dados.balanco, { agora: new Date(), inicioHora, horasPeriodo: periodo, dias })
  const volume = Number(f.vol.replace(',', '.'))
  const volOk = f.vol.trim() !== '' && Number.isFinite(volume) && volume > 0 && volume <= 10000

  async function lancar() {
    let aferido: string | undefined
    try { aferido = f.quando ? instanteDaParede(f.quando).toISOString() : undefined } catch { aferido = undefined }
    const feito = await executar(() => supabase.rpc('lancar_balanco', {
      p_paciente: ctx.pacienteId, p_tipo: tipo, p_descricao: f.desc, p_volume_ml: volume, p_aferido_em: aferido, ...atendimento(dados),
    }), `${tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${f.vol} mL lançada.`)
    if (feito) setF({ desc: '', vol: '', quando: '' })
  }
  async function cancelar(l: LancamentoBh) {
    const feito = await executar(() => supabase.rpc('cancelar_balanco', { p_lancamento: l.id, p_motivo: motivo }),
      'Lançamento cancelado. Continua no histórico.')
    if (feito) { setCancelando(null); setMotivo('') }
  }

  const tomSaldo = (n: number) => (n < 0 ? 'text-observacao' : 'text-acao')
  return (
    <div className="flex flex-col gap-3">
      <Cartao titulo="Balanço hídrico"
        extra={<span className={cn('text-controle font-semibold tabular-nums', tomSaldo(dia.balanco))}>Balanço 24 h {textoBalanco(dia.balanco)}</span>}>
        {dados.pode_registrar ? (
          <div className="flex flex-wrap items-end gap-2">
            <div role="group" aria-label="Entrada ou saída" className="flex gap-1.5">
              <Chip ativo={tipo === 'entrada'} onClick={() => setTipo('entrada')}>Entrada</Chip>
              <Chip ativo={tipo === 'saida'} onClick={() => setTipo('saida')}>Saída</Chip>
            </div>
            <Campo rotulo="Descrição" id="bh-desc" className="flex-[1_1_200px]">
              <Input id="bh-desc" placeholder="Soro, dieta, diurese, dreno…" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
            </Campo>
            <Campo rotulo="Volume (mL)" id="bh-vol" className="flex-[0_1_120px]">
              <Input id="bh-vol" inputMode="decimal" value={f.vol} onChange={(e) => setF({ ...f, vol: e.target.value })} />
            </Campo>
            <Campo rotulo="Hora (vazio = agora)" id="bh-hora" className="flex-[0_1_210px]">
              <Input id="bh-hora" type="datetime-local" max={agoraLocal()} value={f.quando} onChange={(e) => setF({ ...f, quando: e.target.value })} />
            </Campo>
            <Button variant="outline" size="sm" disabled={!volOk || f.desc.trim().length < 2 || ocupado} onClick={() => void lancar()}>Lançar</Button>
          </div>
        ) : <Nota>{semPermissao}</Nota>}
        <Aviso erro={erro} aviso={aviso} />

        <div className="flex flex-wrap items-center gap-2 border-t border-trilha pt-2.5">
          <Button size="icon-sm" variant="ghost" aria-label="Dia anterior" disabled={dias <= -1} onClick={() => setDias(dias - 1)}><ChevronLeft /></Button>
          <span className="text-apoio font-medium text-grafite tabular-nums">
            {quando(dia.inicio.toISOString())} → {quando(dia.fim.toISOString())}
          </span>
          <Button size="icon-sm" variant="ghost" aria-label="Dia seguinte" disabled={dias >= 0} onClick={() => setDias(dias + 1)}><ChevronRight /></Button>
          <span className="ml-auto flex flex-wrap items-center gap-1.5 text-rotulo text-tinta-sussurro">
            <label htmlFor="bh-inicio">Início do dia</label>
            <select id="bh-inicio" className="rounded-controle-sm border border-fio bg-campo px-1.5 py-0.5 text-rotulo text-tinta"
              value={inicioHora} onChange={(e) => setInicioHora(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
            <label htmlFor="bh-periodo">Período</label>
            <select id="bh-periodo" className="rounded-controle-sm border border-fio bg-campo px-1.5 py-0.5 text-rotulo text-tinta"
              value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))}>
              {[6, 12, 24].map((h) => <option key={h} value={h}>{h} h</option>)}
            </select>
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-4 gap-y-1 text-apoio tabular-nums">
          <span className="text-rotulo text-tinta-sussurro">Período</span>
          <span className="text-right text-rotulo text-tinta-sussurro">Entradas</span>
          <span className="text-right text-rotulo text-tinta-sussurro">Saídas</span>
          <span className="text-right text-rotulo text-tinta-sussurro">Balanço</span>
          {dia.periodos.map((p) => (
            <React.Fragment key={p.inicio.toISOString()}>
              <span className="text-tinta">{hora(p.inicio)}–{hora(p.fim)}</span>
              <span className="text-right text-tinta">{p.entradas.toLocaleString('pt-BR')} mL</span>
              <span className="text-right text-tinta">{p.saidas.toLocaleString('pt-BR')} mL</span>
              <span className={cn('text-right font-medium', p.lancamentos ? tomSaldo(p.balanco) : 'text-tinta-sussurro')}>{textoBalanco(p.balanco)}</span>
            </React.Fragment>
          ))}
          <span className="border-t border-trilha pt-1 font-semibold text-tinta">24 h</span>
          <span className="border-t border-trilha pt-1 text-right font-semibold text-tinta">{dia.entradas.toLocaleString('pt-BR')} mL</span>
          <span className="border-t border-trilha pt-1 text-right font-semibold text-tinta">{dia.saidas.toLocaleString('pt-BR')} mL</span>
          <span className={cn('border-t border-trilha pt-1 text-right font-semibold', tomSaldo(dia.balanco))}>{textoBalanco(dia.balanco)}</span>
        </div>
        <Nota>Balanço = entradas − saídas dos lançamentos do período (cancelados não somam). Sem perdas insensíveis. Início do dia e período são da rotina da unidade.</Nota>
      </Cartao>

      <Cartao titulo="Lançamentos das últimas 48 h">
        {dados.balanco.map((l) => {
          const cancelado = !!l.cancelado_em
          return (
            <div key={l.id} className="flex flex-col gap-2">
              <Registro riscado={cancelado}
                meta={`${l.autor ?? '—'} · ${quando(l.aferido_em)}${cancelado ? ` · cancelado por ${l.cancelado_por ?? '—'} em ${quando(l.cancelado_em)} (${l.motivo_cancelamento})` : ''}`}
                acao={!cancelado && dados.pode_registrar && cancelando !== l.id
                  ? <Button size="xs" variant="outline" onClick={() => { setCancelando(l.id); setMotivo('') }}>Cancelar</Button> : undefined}>
                {l.tipo === 'entrada' ? 'Entrada' : 'Saída'} · {l.descricao} · {Number(l.volume_ml).toLocaleString('pt-BR')} mL
              </Registro>
              {cancelando === l.id && (
                <div className="flex flex-col gap-2 rounded-controle border border-critico/30 bg-alerta-critico p-2.5">
                  <span className="text-apoio text-critico">Cancelar este lançamento? Continua no histórico; diga por quê.</span>
                  <Input aria-label="Motivo do cancelamento" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="destructive" disabled={motivo.trim().length < 10 || ocupado} onClick={() => void cancelar(l)}>Confirmar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setCancelando(null)}>Não</Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {dados.balanco.length === 0 && <Nota>Nenhum lançamento nas últimas 48 h.</Nota>}
      </Cartao>
    </div>
  )
}

// ── curativos ───────────────────────────────────────────────────────────────
export function AbaCurativos({ ctx, dados }: { ctx: Contexto; dados: Cuidados }) {
  const { erro, aviso, ocupado, executar } = useExecutar(useRecarregarCuidados(ctx))
  const [f, setF] = React.useState({ local: '', tipo: '', aspecto: '', troca: '', obs: '' })
  const hoje = hojeSP()

  async function registrar() {
    const feito = await executar(() => supabase.rpc('registrar_curativo', {
      p_paciente: ctx.pacienteId, p_local: f.local, p_tipo: f.tipo, p_aspecto: f.aspecto, p_proxima_troca: f.troca || undefined,
      p_observacao: f.obs, ...atendimento(dados),
    }), 'Curativo registrado.')
    if (feito) setF({ local: '', tipo: '', aspecto: '', troca: '', obs: '' })
  }

  return (
    <Cartao titulo="Curativos">
      {dados.pode_registrar ? (
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Local" id="cur-local" className="flex-[1_1_180px]">
            <Input id="cur-local" placeholder="Região sacral, incisão abdominal…" value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} />
          </Campo>
          <Campo rotulo="Tipo (cobertura)" id="cur-tipo" className="flex-[1_1_180px]">
            <Input id="cur-tipo" placeholder="Gaze e SF 0,9%, hidrocoloide…" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} />
          </Campo>
          <Campo rotulo="Próxima troca" id="cur-troca" className="flex-[0_1_170px]">
            <Input id="cur-troca" type="date" min={hoje} value={f.troca} onChange={(e) => setF({ ...f, troca: e.target.value })} />
          </Campo>
          <Campo rotulo="Aspecto" id="cur-aspecto" className="flex-[1_1_100%]">
            <Input id="cur-aspecto" placeholder="Leito, bordas, exsudato, odor" value={f.aspecto} onChange={(e) => setF({ ...f, aspecto: e.target.value })} />
          </Campo>
          <Campo rotulo="Observação" id="cur-obs" className="flex-[1_1_100%]">
            <Input id="cur-obs" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
          </Campo>
          <Button variant="outline" size="sm" disabled={f.local.trim().length < 2 || f.tipo.trim().length < 2 || ocupado} onClick={() => void registrar()}>
            Registrar
          </Button>
        </div>
      ) : <Nota>{semPermissao}</Nota>}
      <Aviso erro={erro} aviso={aviso} />
      {dados.curativos.map((c) => (
        <Registro key={c.id}
          meta={[`${c.autor ?? '—'} · ${quando(c.registrado_em)}`, c.proxima_troca ? `próxima troca ${dataBr(c.proxima_troca)}` : null, c.observacao || null]
            .filter(Boolean).join(' · ')}>
          {c.local} · {c.tipo}{c.aspecto ? ` · ${c.aspecto}` : ''}
        </Registro>
      ))}
      {dados.curativos.length === 0 && <Nota>Nenhum curativo registrado.</Nota>}
    </Cartao>
  )
}
