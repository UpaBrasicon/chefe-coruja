// Pedido de exames do leito. EX1 (revisão da Internação, RT 24/11/2026): uma
// busca só no topo, para todos os tipos; abaixo, os pedidos frequentes da
// unidade (a lista que o gestor marca), sem o citopatológico para quem não é
// do sexo feminino; o que já foi pedido aparece como texto cinza com a data,
// não como ficha escura. Os escolhidos vão para a cesta "N exames para pedir",
// com um botão "Pedir". O servidor continua com um pedido por grupo
// (pedir_exames_internacao): o botão faz um pedido de cada grupo da cesta.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { diaMes } from '@/lib/formato'
import {
  GRUPOS_EXAME, botoesDoGrupo, codigoExameNaTela, grupoDoCodigo,
  type ExameBuscado, type GrupoExame, type ListaExamesUnidade, type Urgencia,
} from '@/lib/exames'
import { exameCabeParaSexo, pedidoEm } from '@/lib/examesLeito'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OpcaoLista } from '@/components/ui/botao-linha'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Chip } from '@/components/monitor/Pagina'
import { useValorAdiado } from '@/hooks/useValorAdiado'

type Item = { rotulo: string; procedimento: string | null; grupo: GrupoExame }
type Pedido = { exame: string; procedimento: string | null; situacao: string; pedido_em: string | null }

const ROTULO_GRUPO = Object.fromEntries(GRUPOS_EXAME.map((g) => [g.id, g.rotulo])) as Record<GrupoExame, string>

export function PedidoExamesLeito({ internacaoId, pacienteId }: { internacaoId: string; pacienteId?: string }) {
  const qc = useQueryClient()
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const lista = useQuery({
    queryKey: ['exames-unidade', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('exames_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as ListaExamesUnidade
    },
  })
  const pedidos = useQuery({
    queryKey: ['exames-da-internacao', internacaoId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exames_pedidos').select('exame, procedimento, situacao, pedido_em').eq('internacao_id', internacaoId)
      if (error) throw error
      return (data ?? []) as Pedido[]
    },
  })
  // mesma chave e colunas do cabeçalho do paciente: uma leitura só
  const paciente = useQuery({
    queryKey: ['cabecalho-paciente', pacienteId],
    enabled: !!pacienteId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('nome, nome_social, data_nascimento, sexo').eq('id', pacienteId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const sexo = paciente.data?.sexo ?? null

  const [cesta, setCesta] = React.useState<Item[]>([])
  const [termo, setTermo] = React.useState('')
  const [urgencia, setUrgencia] = React.useState<Urgencia>('rotina')
  const [observacao, setObservacao] = React.useState('')
  const [pedindo, setPedindo] = React.useState(false)
  const [aviso, setAviso] = React.useState<{ erro: boolean; texto: string } | null>(null)
  const t = useValorAdiado(termo.trim())
  const busca = useQuery({
    queryKey: ['buscar-exames', unidadeId, t],
    enabled: !!unidadeId && t.length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_exames', { p_unidade: unidadeId!, p_termo: t })
      if (error) throw error
      return (data ?? []) as unknown as ExameBuscado[]
    },
  })
  const achados: Item[] = (busca.data ?? []).flatMap((x) => {
    const grupo = grupoDoCodigo(x.procedimento)
    return grupo && exameCabeParaSexo(grupo, sexo) ? [{ rotulo: x.nome, procedimento: x.procedimento as string | null, grupo }] : []
  })
  const frequentes: Item[] = GRUPOS_EXAME.filter((g) => exameCabeParaSexo(g.id, sexo))
    .flatMap((g) => botoesDoGrupo(lista.data?.exames, g.id).map((b) => ({ ...b, grupo: g.id })))

  const igual = (a: Item, b: Item) => (a.procedimento ? a.procedimento === b.procedimento : a.rotulo.toLowerCase() === b.rotulo.toLowerCase())
  const naCesta = (b: Item) => cesta.some((m) => igual(m, b))
  const alternar = (b: Item) => setCesta((xs) => (xs.some((m) => igual(m, b)) ? xs.filter((m) => !igual(m, b)) : [...xs, b]))
  const trocarGrupo = (b: Item, grupo: GrupoExame) => setCesta((xs) => xs.map((m) => (igual(m, b) ? { ...m, grupo } : m)))

  async function pedir() {
    setPedindo(true)
    const grupos = [...new Set(cesta.map((m) => m.grupo))]
    const feitos: string[] = []
    const falhas: string[] = []
    for (const g of grupos) {
      const itens = cesta.filter((m) => m.grupo === g)
      const { error } = await supabase.rpc('pedir_exames_internacao', {
        p_internacao: internacaoId, p_grupo: g, p_urgencia: urgencia, p_observacao: observacao.trim() || undefined,
        p_itens: itens.map((m) => (m.procedimento ? { procedimento: m.procedimento } : { nome: m.rotulo })),
      })
      if (error) falhas.push(`${ROTULO_GRUPO[g]}: ${error.message}`)
      else feitos.push(...itens.map((m) => m.rotulo))
    }
    setPedindo(false)
    setCesta((xs) => xs.filter((m) => !feitos.includes(m.rotulo)))
    if (feitos.length) { setObservacao(''); setUrgencia('rotina') }
    setAviso(falhas.length
      ? { erro: true, texto: `${feitos.length ? `Pedidos: ${feitos.join(', ')}. ` : ''}Não foi: ${falhas.join('; ')}` }
      : { erro: false, texto: `Pedido feito: ${feitos.length} exame${feitos.length === 1 ? '' : 's'}. Fica aguardando até o resultado.` })
    // a lista do leito e os impeditivos de alta leem os exames pedidos
    for (const k of [['exames-da-internacao', internacaoId], ['exames-pedidos'], ['impeditivos']]) void qc.invalidateQueries({ queryKey: k })
  }

  const ja = (b: Item) => pedidoEm(b, pedidos.data ?? [])

  return (
    <section aria-label="Pedir exames" className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie p-4">
      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
          <Input className="pl-9" aria-label="Buscar exame" placeholder="Pedir exame: buscar por nome (laboratório, imagem, ECG)"
            value={termo} onChange={(e) => setTermo(e.target.value)} />
        </div>
        {t.length >= 3 && (
          <div role="listbox" aria-label="Exames achados" className="flex max-h-56 flex-col overflow-y-auto rounded-controle border border-fio">
            {achados.map((x) => {
              const quando = ja(x)
              return (
                <OpcaoLista key={x.procedimento ?? x.rotulo} onClick={() => { if (!naCesta(x)) alternar(x); setTermo('') }}
                  className="flex-wrap items-baseline gap-2">
                  <span className="text-tinta">{x.rotulo}</span>
                  <span className="text-rotulo text-tinta-sussurro">{ROTULO_GRUPO[x.grupo]} · {x.procedimento ? codigoExameNaTela(x.procedimento) : 'sem código'}</span>
                  {quando !== null && <span className="text-rotulo text-tinta-sussurro">· pedido {quando ? diaMes(quando) : 'nesta internação'}</span>}
                </OpcaoLista>
              )
            })}
            {busca.isSuccess && achados.length === 0 && <span className="px-3 py-2 text-rotulo text-tinta-sussurro">Nada no catálogo com esse nome.</span>}
            <OpcaoLista onClick={() => { alternar({ rotulo: t, procedimento: null, grupo: 'laboratorio' }); setTermo('') }} className="border-t border-trilha">
              <span className="text-tinta-apoio">Pedir “{t}” em texto livre</span>
              <span className="text-rotulo text-tinta-sussurro"> · sem código: não vai ao serviço integrado</span>
            </OpcaoLista>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-rotulo font-semibold text-tinta-sussurro">Pedidos frequentes da unidade</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {frequentes.map((b) => {
            const quando = ja(b)
            return quando !== null && !naCesta(b) ? (
              <span key={b.grupo + b.rotulo} className="px-1 text-apoio text-tinta-sussurro" title="Já pedido nesta internação">
                {b.rotulo} · pedido {quando ? diaMes(quando) : ''}
              </span>
            ) : (
              <Chip key={b.grupo + b.rotulo} ativo={naCesta(b)} desabilitado={pedindo} onClick={() => alternar(b)}
                titulo={b.procedimento ? `Pôr ${b.rotulo} na cesta` : `Pôr ${b.rotulo} na cesta (sem código)`}>
                {b.rotulo}
              </Chip>
            )
          })}
        </div>
      </div>

      {cesta.length > 0 && (
        <div className="flex flex-col gap-2 rounded-controle border border-fio bg-campo px-3 py-3">
          <span className="text-controle font-semibold text-tinta">{cesta.length} {cesta.length === 1 ? 'exame para pedir' : 'exames para pedir'}</span>
          <div className="flex flex-wrap gap-1.5">
            {cesta.map((m) => (
              <span key={m.rotulo + (m.procedimento ?? '')} className="inline-flex items-center gap-1 rounded-controle border border-fio bg-superficie px-2 py-0.5 text-rotulo text-tinta">
                {m.rotulo}
                {m.procedimento ? <span className="text-tinta-sussurro"> · {ROTULO_GRUPO[m.grupo]}</span> : (
                  // texto livre: o grupo é escolhido aqui (laboratório, imagem ou ECG)
                  <CampoSelecao tamanho="compacto" aria-label={`Grupo de ${m.rotulo}`} value={m.grupo} onChange={(e) => trocarGrupo(m, e.target.value as GrupoExame)}
                    className="text-rotulo">
                    {GRUPOS_EXAME.filter((g) => exameCabeParaSexo(g.id, sexo)).map((g) => <option key={g.id} value={g.id}>{g.rotulo}</option>)}
                  </CampoSelecao>
                )}
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Tirar ${m.rotulo}`} onClick={() => alternar(m)}>
                  <X aria-hidden />
                </Button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['rotina', 'urgente'] as const).map((u) => (
              <Chip key={u} ativo={urgencia === u} onClick={() => setUrgencia(u)} tom={u === 'urgente' ? 'critico' : 'acao'}>{u === 'rotina' ? 'Rotina' : 'Urgente'}</Chip>
            ))}
            <Input className="h-8 min-w-0 flex-1" aria-label="Observação do pedido" placeholder="Observação (opcional)" maxLength={300}
              value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          <Button size="sm" className="self-start" disabled={pedindo} onClick={() => void pedir()}>
            Pedir {cesta.length} exame{cesta.length === 1 ? '' : 's'}
          </Button>
        </div>
      )}
      {aviso && (
        <p role={aviso.erro ? 'alert' : 'status'} className={`text-apoio ${aviso.erro ? 'text-critico' : 'text-conforme'}`}>{aviso.texto}</p>
      )}
    </section>
  )
}
