import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BedDouble, Building2, ClipboardList, DoorOpen, FlaskConical, PackageX, ShieldAlert, Users } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { formatarDuracao } from '@/domain/plantao'
import { FaixaParametros, Parametro, type Nivel } from '@/components/monitor/Parametros'
import { LIMITES_PADRAO } from '@/lib/limitesUnidade'
import type { Papel } from '@/types/database'

// Faixa de parâmetros dos papéis que a mantêm (P/index.html 32208–32218 e
// 33383–33430): farmacêutico e administrador, só na página
// inicial do papel. O plantonista não tem mais faixa (o cartão de turno da
// Central a substitui) e o gestor também não (as grandezas dele moram no
// painel). Cada célula lê o banco pela permissão do próprio usuário; o que o
// app ainda não mede não vira número (a tendência do protótipo, por exemplo,
// não entra: não há série guardada para calculá-la).

// A rede soma unidades com limites próprios (Unidade › Configurações); na
// soma vale o padrão do produto. Cada unidade, na lista do administrador,
// usa o seu.
const LIMITE_OCUPACAO = LIMITES_PADRAO.ocupacao_pct / 100

const minutosDesde = (iso: string, agora: Date) => Math.max(0, Math.floor((agora.getTime() - Date.parse(iso)) / 60_000))

async function horaServidor(): Promise<Date> {
  const { data, error } = await supabase.rpc('horario_servidor')
  if (error) throw error
  return new Date(data as string)
}

// ── farmacêutico ────────────────────────────────────────────────────────────
type ItemFila = { alta_vigilancia: boolean; diluicao_divergente: boolean; prescrito_em: string }
type Disp = { principio_ativo: string; situacao: string }

function FaixaFarmaceutico({ unidadeId }: { unidadeId: string }) {
  const navigate = useNavigate()
  const { data: d } = useQuery({
    queryKey: ['faixa-farmaceutico', unidadeId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [agora, fila, disp, faltas, semLib] = await Promise.all([
        horaServidor(),
        supabase.rpc('fila_validacao', { p_unidade: unidadeId }),
        supabase.rpc('disponibilidade', { p_unidade: unidadeId }),
        supabase.from('faltas_medicamento').select('id', { count: 'exact', head: true }).eq('unidade_id', unidadeId).neq('situacao', 'reposta'),
        supabase.rpc('administracoes_sem_liberacao', { p_unidade: unidadeId }),
      ])
      if (fila.error) throw fila.error
      if (disp.error) throw disp.error
      if (faltas.error) throw faltas.error
      if (semLib.error) throw semLib.error
      return {
        agora, fila: (fila.data ?? []) as ItemFila[], disp: (disp.data ?? []) as Disp[], faltasAbertas: faltas.count ?? 0,
        semLiberacao: Array.isArray(semLib.data) ? semLib.data.length : 0,
      }
    },
  })
  const fila = d?.fila ?? []
  const informados = (d?.disp ?? []).filter((x) => x.situacao !== 'nao_informado')
  const emFalta = informados.filter((x) => x.situacao === 'falta')
  const criticos = informados.filter((x) => x.situacao === 'critico')
  const abaixo = emFalta.length + criticos.length
  const divergentes = fila.filter((i) => i.diluicao_divergente).length
  const altaVig = fila.filter((i) => i.alta_vigilancia).length
  const maisAntigo = d && fila.length ? Math.max(...fila.map((i) => minutosDesde(i.prescrito_em, d.agora))) : null
  const nivelEstoque: Nivel = emFalta.length ? 'critico' : criticos.length ? 'atencao' : 'ok'
  return (
    <FaixaParametros rotulo="Parâmetros da farmácia">
      <Parametro
        grandeza="suprimento" icone={FlaskConical} rotulo="Abaixo do mínimo"
        valor={d ? abaixo : '—'} unidade={d ? `de ${informados.length} ${informados.length === 1 ? 'item informado' : 'itens informados'}` : undefined}
        estado={!d ? 'Carregando' : emFalta.length ? `${emFalta[0].principio_ativo} em falta` : criticos.length ? `${criticos[0].principio_ativo} no limite crítico` : informados.length ? 'Estoque informado acima dos limites' : 'Nenhum estoque informado ainda'}
        nivel={nivelEstoque} pct={informados.length ? abaixo / informados.length : undefined}
      />
      <Parametro
        grandeza="observacao" icone={ClipboardList} rotulo="Prescrições a conferir"
        valor={d ? fila.length : '—'} unidade="na fila"
        estado={!d ? 'Carregando' : !fila.length ? 'Nada para validar' : [
          divergentes && `${divergentes} fora do padrão de diluição`, altaVig && `${altaVig} de alta vigilância`,
          maisAntigo !== null && `mais antigo há ${formatarDuracao(maisAntigo)}`,
        ].filter(Boolean).join(' · ')}
        nivel={divergentes || altaVig ? 'atencao' : 'ok'}
      />
      {/* Fase 2: alta vigilância administrada sem a liberação da farmácia
          (com justificativa) entra no lugar do "item mais antigo", que passou
          para o estado da fila; a Central não repete estes números */}
      <Parametro
        grandeza="turno" icone={ShieldAlert} rotulo="Administradas sem liberação"
        valor={d ? d.semLiberacao : '—'} unidade="alta vigilância"
        estado={!d ? 'Carregando' : d.semLiberacao ? 'Conferir e liberar o item' : 'Nada para conferir'}
        nivel={d?.semLiberacao ? 'atencao' : 'ok'}
        onClick={() => navigate('/alta-vigilancia')} acao="Conferir alta vigilância"
      />
      <Parametro
        grandeza="leitos" icone={PackageX} rotulo="Faltas sinalizadas em aberto"
        valor={d ? d.faltasAbertas : '—'} unidade={d?.faltasAbertas === 1 ? 'falta' : 'faltas'}
        estado={!d ? 'Carregando' : d.faltasAbertas ? 'Registradas ou em cotação' : 'Nenhuma em aberto'}
        nivel={d?.faltasAbertas ? 'atencao' : 'ok'}
        onClick={() => navigate('/farmacia')} acao="Ver faltas"
      />
    </FaixaParametros>
  )
}

// ── administrador ───────────────────────────────────────────────────────────
type LinhaRede = { unidade_id: string; leitos: number | null; leitos_ocupados: number | null; porta_agora: number | null; internados_agora: number | null; profissionais_em_expediente: number | null }

function FaixaAdmin() {
  const { data: d } = useQuery({
    queryKey: ['faixa-admin'],
    refetchInterval: 120_000,
    queryFn: async () => {
      const [rede, faltas] = await Promise.all([
        supabase.rpc('painel_organizacao', { p_dias: 1 }),
        supabase.from('faltas_medicamento').select('unidade_id').neq('situacao', 'reposta').limit(1000),
      ])
      if (rede.error) throw rede.error
      return { rede: (rede.data ?? []) as LinhaRede[], unidadesComFalta: faltas.error ? null : new Set((faltas.data ?? []).map((f) => f.unidade_id)).size }
    },
  })
  const rede = d?.rede ?? []
  const soma = (k: keyof LinhaRede) => rede.reduce((n, u) => n + (typeof u[k] === 'number' ? (u[k] as number) : 0), 0)
  // A supressão de contagens pequenas (< 5, LGPD) deixa campos nulos: a soma diz "ao menos".
  const suprimidas = (k: keyof LinhaRede) => rede.some((u) => u[k] === null)
  // Ocupação só das unidades com as duas contagens publicadas (sem supressão).
  const contaveis = rede.filter((u) => u.leitos !== null && u.leitos_ocupados !== null)
  const leitos = contaveis.reduce((n, u) => n + (u.leitos ?? 0), 0)
  const ocupados = contaveis.reduce((n, u) => n + (u.leitos_ocupados ?? 0), 0)
  const ocup = leitos > 0 ? ocupados / leitos : undefined
  const nivelOcup: Nivel = ocup === undefined ? 'ok' : ocup >= 0.95 ? 'critico' : ocup >= LIMITE_OCUPACAO ? 'atencao' : 'ok'
  const cobertas = rede.filter((u) => (u.profissionais_em_expediente ?? 0) > 0).length
  return (
    <FaixaParametros rotulo="Parâmetros da rede">
      <Parametro
        grandeza="leitos" icone={BedDouble} rotulo="Ocupação da rede"
        valor={ocup === undefined ? '—' : Math.round(ocup * 100)} unidade={ocup === undefined ? undefined : '%'}
        estado={!d ? 'Carregando' : ocup === undefined ? (suprimidas('leitos_ocupados') ? 'Contagens abaixo de 5 omitidas (LGPD)' : 'Sem leitos cadastrados') : `${ocupados} de ${leitos} leitos${suprimidas('leitos_ocupados') ? ' · unidades pequenas fora da soma' : ''}`}
        nivel={nivelOcup} pct={ocup} limite={ocup === undefined ? undefined : LIMITE_OCUPACAO} limiteTexto={ocup === undefined ? undefined : `limite padrão ${LIMITES_PADRAO.ocupacao_pct}%`}
      />
      <Parametro
        grandeza="observacao" icone={DoorOpen} rotulo="Na porta agora"
        valor={d ? soma('porta_agora') : '—'} unidade="pacientes"
        estado={!d ? 'Carregando' : `Triagem, atendimento e observação${suprimidas('porta_agora') ? ' · menos de 5 omitidos por unidade' : ''}`}
        nivel="ok"
      />
      <Parametro
        grandeza="turno" icone={Users} rotulo="Em plantão na rede"
        valor={d ? soma('profissionais_em_expediente') : '—'} unidade="profissionais"
        estado={d ? `${cobertas} de ${rede.length} ${rede.length === 1 ? 'unidade coberta' : 'unidades cobertas'}` : 'Carregando'}
        nivel={d && rede.length && cobertas < rede.length ? 'atencao' : 'ok'}
      />
      <Parametro
        grandeza="suprimento" icone={Building2} rotulo="Unidades com falta"
        valor={d?.unidadesComFalta ?? '—'} unidade={d ? `de ${rede.length}` : undefined}
        estado={!d ? 'Carregando' : d.unidadesComFalta === null ? 'Sem acesso às faltas' : d.unidadesComFalta ? 'Falta de medicamento em aberto' : 'Nenhuma falta em aberto'}
        nivel={d?.unidadesComFalta ? 'atencao' : 'ok'}
        pct={d && rede.length && d.unidadesComFalta !== null ? d.unidadesComFalta / rede.length : undefined}
      />
    </FaixaParametros>
  )
}

// Telemedicina sem faixa (revisão do perfil, RT 24/11/2026): os Chamados têm a
// contagem nas abas e um selo só de situação no topo; a faixa antiga
// contradizia o selo e ficava em "Carregando".

export function FaixaDoPapel({ papel, unidadeId }: { papel: Papel | null; unidadeId?: string }) {
  if (papel === 'admin') return <FaixaAdmin />
  if (!unidadeId) return null
  if (papel === 'farmaceutico') return <FaixaFarmaceutico unidadeId={unidadeId} />
  return null
}
