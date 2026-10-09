// Sinais vitais, anotação/evolução de enfermagem e escalas do painel de
// cuidados. Nada novo no banco aqui: os sinais vão para public.observacao pela
// porta de sincronização (a mesma do leito); a anotação e a evolução pelas
// RPCs da evolução (registrar_evolucao, com o tipo); Braden e Morse (NIPS e
// FLACC na criança) por registrar_avaliacao.
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import * as React from 'react'

import {
  ESCALAS_AVALIACAO, escalasDoPublico, faixaDe, respondidas, totalAvaliacao,
  type EscalaAvaliacao, type Respostas, type Tom,
} from '@/clinico/crescimento/escalasAvaliacao'
import { textoFontes } from '@/clinico/ficha'
import { paraNumeros, textoVitais, type Publico } from '@/domain/vitais'
import { useAuth } from '@/contexts/AuthContext'
import { gravarRegistros, novoItem } from '@/lib/offline/sincronizar'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { CamposVitais } from '@/components/clinico/CamposVitais'
import { useAvaliacoes, type AvaliacaoRegistro } from '@/components/avaliacao/useAvaliacao'
import { useHistoricoEvolucoes, useRecarregarEvolucao } from '@/components/evolucao/dados'
import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

import { CartaoFugulin } from './CartaoFugulin'
import { msg, quando, useExecutar, useRecarregarCuidados, type Contexto, type Cuidados } from './dadosCuidados'
import { Aviso, Cartao, Nota, Registro } from './pecas'

// ── sinais vitais ───────────────────────────────────────────────────────────
export function AbaSinaisVitais({ ctx, dados, publico }: { ctx: Contexto; dados: Cuidados; publico: Publico | null }) {
  const { perfil } = useAuth()
  const recarregar = useRecarregarCuidados(ctx)
  const [v, setV] = React.useState<Record<string, string>>({})
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const conceitos = useQuery({
    queryKey: ['conceitos-vitais-enfermagem'],
    staleTime: 3_600_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('conceito').select('id, nome').is('unidade_id', null).eq('categoria', 'sinal_vital')
      if (error) throw error
      return new Map((data ?? []).map((c) => [c.nome, c.id]))
    },
  })
  const algo = Object.values(v).some((x) => x.trim() !== '')

  async function registrar() {
    setOcupado(true); setErro(null); setAviso(null)
    try {
      if (!perfil) throw new Error('Sem sessão.')
      const numeros = paraNumeros(v)
      const itens = Object.entries(numeros).map(([nome, n]) => {
        const id = conceitos.data?.get(nome)
        if (!id) throw new Error(`Conceito ${nome} não encontrado.`)
        return novoItem('observacao', { internacao_id: dados.internacao_id, paciente_id: ctx.pacienteId, conceito_id: id, valor_num: n, origem: 'manual' })
      })
      if (itens.length === 0) throw new Error('Preencha ao menos um sinal vital.')
      const r = await gravarRegistros(perfil.id, itens)
      if (r.recusados.length > 0) throw new Error(r.recusados[0].replace(/^SYNC_[A-Z_]+: /, ''))
      setV({})
      setAviso(r.naFila > 0 ? 'Sem conexão: os sinais ficaram na fila e sobem quando a rede voltar.' : 'Sinais vitais registrados.')
      recarregar()
    } catch (e) {
      setErro(msg(e))
    } finally { setOcupado(false) }
  }

  return (
    <Cartao titulo="Sinais vitais">
      {dados.pode_registrar ? (
        <>
          <CamposVitais publico={publico} valores={v} onChange={(k, x) => setV((s) => ({ ...s, [k]: x }))} prefixo="cuidados-sv" />
          <Nota>Deixe em branco o que não foi medido. O valor fica cru, sem marca de alterado.</Nota>
          <Aviso erro={erro} aviso={aviso} />
          <div className="flex justify-end">
            <Button disabled={!algo || ocupado || conceitos.isLoading} onClick={() => void registrar()}>
              {ocupado ? <Spinner /> : <Check />} Registrar sinais vitais
            </Button>
          </div>
        </>
      ) : (
        <Nota>Os sinais vitais são lançados pela enfermagem de plantão com o paciente, com o atendimento aberto.</Nota>
      )}
      {dados.sinais_vitais.map((s) => (
        <Registro key={`${s.aferido_em}-${s.autor}`} meta={`${s.autor ?? '—'} · ${quando(s.aferido_em)}`}>{textoVitais(s.valores)}</Registro>
      ))}
      {dados.sinais_vitais.length === 0 && <Nota>Nenhuma aferição nas últimas 48 h.</Nota>}
    </Cartao>
  )
}

// ── anotação e evolução de enfermagem ───────────────────────────────────────
type TipoEnf = 'evolucao_enfermagem' | 'anotacao_enfermagem'
const ROTULO_ENF: Record<TipoEnf, string> = { evolucao_enfermagem: 'Evolução de enfermagem', anotacao_enfermagem: 'Anotação de enfermagem' }

export function AbaAnotacao({ ctx, dados }: { ctx: Contexto; dados: Cuidados }) {
  const internacao = dados.internacao_id
  if (!internacao) {
    return (
      <Cartao titulo="Anotação e evolução de enfermagem">
        <Nota>
          A anotação e a evolução de enfermagem são registradas na observação ou na internação. Paciente só triado, ainda sem leito:
          use a SAE e os demais registros desta tela.
        </Nota>
      </Cartao>
    )
  }
  return <AnotacaoDaInternacao ctx={ctx} dados={dados} internacaoId={internacao} />
}

function AnotacaoDaInternacao({ ctx, dados, internacaoId }: { ctx: Contexto; dados: Cuidados; internacaoId: string }) {
  // o enfermeiro evolui ou anota; o técnico anota (regra do banco,
  // private.pode_registrar_evolucao)
  const enfermeiro = dados.pode_sae
  const [tipo, setTipo] = React.useState<TipoEnf>(enfermeiro ? 'evolucao_enfermagem' : 'anotacao_enfermagem')
  const [texto, setTexto] = React.useState('')
  const hist = useHistoricoEvolucoes(internacaoId)
  const recarregarEvol = useRecarregarEvolucao(internacaoId, ctx.pacienteId)
  const { erro, aviso, ocupado, executar } = useExecutar(recarregarEvol)
  const tipoEfetivo: TipoEnf = enfermeiro ? tipo : 'anotacao_enfermagem'
  const lista = (hist.data ?? []).filter((x) => x.tipo === 'evolucao_enfermagem' || x.tipo === 'anotacao_enfermagem')

  async function registrar() {
    const feito = await executar(() => supabase.rpc('registrar_evolucao', { p_internacao: internacaoId, p_tipo: tipoEfetivo, p_conteudo: texto.trim() }),
      `${ROTULO_ENF[tipoEfetivo]} registrada.`)
    if (feito) setTexto('')
  }

  return (
    <Cartao titulo={ROTULO_ENF[tipoEfetivo]}>
      {dados.pode_registrar ? (
        <>
          {enfermeiro && (
            <div role="group" aria-label="Tipo de registro" className="flex flex-wrap gap-1.5">
              {(['evolucao_enfermagem', 'anotacao_enfermagem'] as const).map((t) => (
                <Chip key={t} ativo={tipo === t} onClick={() => setTipo(t)}>{ROTULO_ENF[t]}</Chip>
              ))}
            </div>
          )}
          <Textarea aria-label={ROTULO_ENF[tipoEfetivo]} rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
          {tipoEfetivo === 'evolucao_enfermagem' && (
            <Nota>Uma evolução por dia por profissional: a segunda do dia entra como complemento da primeira. Mudar o que já foi escrito é correção, no histórico.</Nota>
          )}
          <Aviso erro={erro} aviso={aviso} />
          <div className="flex justify-end">
            <Button disabled={texto.trim().length < 10 || ocupado} onClick={() => void registrar()}><Check /> Registrar</Button>
          </div>
        </>
      ) : (
        <Nota>A anotação é da enfermagem de plantão com o paciente; a evolução de enfermagem, do enfermeiro.</Nota>
      )}
      {hist.isLoading && <div className="flex justify-center py-3"><Spinner /></div>}
      {hist.error && <p className="text-apoio text-critico">{msg(hist.error)}</p>}
      {lista.slice(0, 12).map((x) => (
        <Registro key={x.id} riscado={x.estado === 'cancelado'}
          meta={`${ROTULO_ENF[x.tipo as TipoEnf]}${x.papel === 'complemento' ? ' (complemento)' : ''}${x.versao > 1 ? ' · corrigida' : ''} · ${x.autor ?? '—'} · ${quando(x.registrado_em)}`}>
          <span className="whitespace-pre-line">{x.texto}</span>
        </Registro>
      ))}
      {!hist.isLoading && lista.length === 0 && <Nota>Nenhuma anotação ou evolução de enfermagem nesta internação.</Nota>}
    </Cartao>
  )
}

// ── escalas (Braden e Morse; NIPS e FLACC na criança) ───────────────────────
const COR_TOM: Record<Tom, string> = { conforme: 'text-conforme', atencao: 'text-observacao', alerta: 'text-mts-laranja', critico: 'text-critico' }

export function AbaEscalas({ ctx, dados, publico }: { ctx: Contexto; dados: Cuidados; publico: Publico | null }) {
  const q = useAvaliacoes(ctx.pacienteId)
  const escalas = escalasDoPublico(publico)
  return (
    <div className="flex flex-col gap-3">
      {publico === null && (
        <Nota>Sem data de nascimento no cadastro: as escalas dependem da idade (Braden e Morse no adulto; NIPS e FLACC na criança).</Nota>
      )}
      {publico === 'pediatrico' && (
        <Nota>Braden e Morse são escalas do adulto: na criança não se usam. Aqui ficam as de dor da pediatria.</Nota>
      )}
      {escalas.map((e) => (
        <CartaoEscala key={e} escala={e} ctx={ctx} dados={dados}
          ultima={(q.data ?? []).find((a) => a.escala === e && !a.cancelada_em) ?? null} />
      ))}
      {q.error && <p className="text-apoio text-critico">{msg(q.error)}</p>}
      {/* Fase 2, tarefa 5: Fugulin (12 áreas), enfermeiro, uma vez por dia, na internação; só adulto */}
      {dados.internacao_id && publico !== 'pediatrico' && <CartaoFugulin internacaoId={dados.internacao_id} />}
      {publico === 'pediatrico' && (
        <Nota>Fugulin é instrumento do adulto: na criança não se usa. O instrumento pediátrico (Dini, Fugulin et al., 2011) ainda não está no produto.</Nota>
      )}
      <Nota>O histórico completo e o cancelamento das outras escalas ficam na aba Avaliação e crescimento.</Nota>
    </div>
  )
}

function CartaoEscala({ escala, ctx, dados, ultima }: { escala: EscalaAvaliacao; ctx: Contexto; dados: Cuidados; ultima: AvaliacaoRegistro | null }) {
  const def = ESCALAS_AVALIACAO[escala]
  const [resp, setResp] = React.useState<Respostas>({})
  const recarregar = useRecarregarCuidados(ctx)
  const { erro, aviso, ocupado, executar } = useExecutar(recarregar)
  const total = totalAvaliacao(escala, resp)
  const fx = total !== null ? faixaDe(escala, total) : null

  async function registrar() {
    if (total === null) return
    const feito = await executar(() => supabase.rpc('registrar_avaliacao', {
      p_paciente: ctx.pacienteId, p_escala: escala, p_respostas: resp,
      p_episodio: dados.episodio_id ?? undefined, p_internacao: dados.internacao_id ?? undefined,
    }), `${def.nome}: resultado ${total} registrado.`)
    if (feito) setResp({})
  }

  return (
    <Cartao titulo={def.nome}
      extra={<span className={cn('text-apoio font-semibold', fx ? COR_TOM[fx.tom] : 'text-tinta-sussurro')}>
        {total !== null && fx ? `${total} · ${fx.rotulo}` : `${respondidas(escala, resp)} de ${def.itens.length} respondidas`}
      </span>}>
      {dados.pode_registrar && def.itens.map((it) => (
        <div key={it.id} className="flex flex-col gap-1.5">
          <span className="text-apoio font-medium text-grafite">{it.rotulo}</span>
          <div className="flex flex-wrap gap-1.5">
            {it.opcoes.map((o) => (
              <Chip key={o.valor} ativo={resp[it.id] === o.valor} onClick={() => setResp({ ...resp, [it.id]: o.valor })}>{o.rotulo} · {o.valor}</Chip>
            ))}
          </div>
        </div>
      ))}
      <Aviso erro={erro} aviso={aviso} />
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="min-w-0 flex-[1_1_260px] text-rotulo text-pretty text-tinta-sussurro">{textoFontes(def.ficha)}</span>
        <span className="text-apoio text-tinta-apoio">
          {ultima ? `Último: ${ultima.total} · ${ultima.interpretacao} · ${ultima.autor ?? '—'} · ${quando(ultima.registrado_em)}` : 'Sem registro'}
        </span>
        {dados.pode_registrar && <Button size="sm" disabled={total === null || ocupado} onClick={() => void registrar()}>Registrar</Button>}
      </div>
    </Cartao>
  )
}
