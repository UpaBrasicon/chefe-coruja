import { Building2, Plus } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { TIPO_UNIDADE_LABEL } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Vazio } from '@/components/monitor/Pagina'
import { NumerosOrganizacao } from '@/pages/admin/NumerosOrganizacao'
import { JanelaUnidade } from '@/pages/admin/JanelaUnidade'

import { avaliarUnidade, haQuanto, lugar, selo, SELO_ESTADO, useChamadosTecnicos, useUnidadesCadastro, useUnidadesRede, type UnidadeCadastro, type UnidadeRede } from '@/lib/dadosAdmin'
import { Abas, Barra, cartao, Metricas } from '@/components/admin/ui'

// Rede (P/index.html 9979–10027): todas as unidades da organização, sem
// identidade de paciente. No protótipo a situação era "sincronizada / versão
// atrasada / sem sincronizar" (unidades com servidor próprio); aqui o app é um
// só serviço para a rede, então a situação sai do que o banco sabe de cada
// unidade: chamados técnicos abertos e a fila da RNDS.

type Filtro = 'todas' | 'pendencia' | 'em_dia'
const ROTULO_ESTADO = ['Em dia', 'Atenção', 'Crítico'] as const
const n = (v: number | null) => (v === null ? '< 5' : String(v))

export function RedeCompleta() {
  const unidades = useUnidadesRede()
  const chamados = useChamadosTecnicos()
  const [filtro, setFiltro] = React.useState<Filtro>('todas')
  // 5A, tarefa 1 (opção A do RT): nova unidade e edição numa janela
  const cadastro = useUnidadesCadastro()
  const [janela, setJanela] = React.useState<{ unidade: UnidadeCadastro | null } | null>(null)
  const editar = (id: string) => {
    const u = cadastro.data?.find((x) => x.id === id)
    if (u) setJanela({ unidade: u })
  }
  const inativas = (cadastro.data ?? []).filter((u) => !u.ativo)
  // o relógio da avaliação é o da última leitura do banco
  const agora = unidades.dataUpdatedAt
  const linhas = React.useMemo(
    () => (unidades.data ?? []).map((u) => ({ u, ...avaliarUnidade(u, agora) })),
    [unidades.data, agora],
  )
  const visiveis = linhas.filter((l) => filtro === 'todas' || (filtro === 'pendencia' ? l.estado > 0 : l.estado === 0))

  const lista = unidades.data ?? []
  const cidades = new Set(lista.map((u) => lugar(u)).filter(Boolean)).size
  const soma = (k: 'leitos' | 'leitos_ocupados') => (lista.some((u) => u[k] === null) ? null : lista.reduce((s, u) => s + (u[k] ?? 0), 0))
  const leitos = soma('leitos')
  const ocupados = soma('leitos_ocupados')
  const abertos = chamados.data ?? []
  const altas = abertos.filter((c) => c.severidade === 'alta').length

  return (
    <div className="flex flex-col">
      {unidades.error && <p className="mb-3 text-apoio text-critico">{(unidades.error as Error).message}</p>}
      <Metricas
        itens={[
          { rotulo: 'Unidades ativas', valor: unidades.data ? lista.length : '—', nota: cidades ? `em ${cidades} ${cidades === 1 ? 'cidade' : 'cidades'}` : 'sem município cadastrado' },
          { rotulo: 'Em plantão agora', valor: unidades.data ? lista.reduce((s, u) => s + u.em_plantao, 0) : '—', nota: 'check-in aberto' },
          {
            rotulo: 'Chamados abertos',
            valor: chamados.data ? abertos.length : '—',
            nota: altas ? `${altas} de severidade alta` : 'nenhum de severidade alta',
            tom: altas ? 'critico' : abertos.length ? 'atencao' : undefined,
          },
          {
            rotulo: 'Ocupação da rede',
            valor: leitos && ocupados !== null ? `${Math.round((ocupados / leitos) * 100)}%` : '—',
            nota: leitos !== null && ocupados !== null ? `${ocupados} de ${leitos} leitos` : 'contagem pequena suprimida',
          },
        ]}
      />

      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setJanela({ unidade: null })}><Plus className="size-4" aria-hidden />Nova unidade</Button>
      </div>

      <div className={cn(cartao, 'mb-3.5')}>
        <Abas
          rotulo="Filtrar unidades"
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { valor: 'todas', rotulo: 'Todas' },
            { valor: 'pendencia', rotulo: 'Com pendência', contagem: linhas.filter((l) => l.estado > 0).length || undefined },
            { valor: 'em_dia', rotulo: 'Em dia' },
          ]}
        />
        {unidades.isLoading && <div className="px-5 py-5"><Spinner /></div>}
        {visiveis.map(({ u, estado, motivos }) => (
          <LinhaUnidade key={u.unidade_id} u={u} estado={estado} motivos={motivos} agora={agora} onEditar={editar} />
        ))}
        {unidades.data && visiveis.length === 0 && (
          <p className="px-5 py-[34px] text-center text-corpo text-tinta-sussurro">
            {lista.length === 0 ? 'Nenhuma unidade ativa na sua organização.' : 'Nenhuma unidade nesse filtro.'}
          </p>
        )}
      </div>

      {inativas.length > 0 && (
        <div className={cn(cartao, 'mb-3.5')}>
          <p className="border-b border-trilha px-5 py-3 text-apoio font-medium text-grafite">Unidades inativas</p>
          {inativas.map((u) => (
            <div key={u.id} className="flex items-center gap-3.5 border-b border-trilha px-5 py-3 last:border-0">
              <span className="min-w-0 flex-1 text-corpo text-tinta-sussurro">{u.nome} · {TIPO_UNIDADE_LABEL[u.tipo]}</span>
              <Button size="xs" variant="outline" onClick={() => setJanela({ unidade: u })}>Editar</Button>
            </div>
          ))}
        </div>
      )}

      {unidades.data && lista.length === 0 && (
        <Vazio icone={Building2} titulo="Nenhuma unidade visível" texto="O administrador vê as unidades da organização em que tem vínculo de administrador." />
      )}

      <NumerosOrganizacao />
      <JanelaUnidade aberto={!!janela} unidade={janela?.unidade ?? null} onFechar={() => setJanela(null)} />
    </div>
  )
}

function LinhaUnidade({ u, estado, motivos, agora, onEditar }: { u: UnidadeRede; estado: 0 | 1 | 2; motivos: string[]; agora: number; onEditar: (id: string) => void }) {
  const pct = u.taxa_ocupacao
  const tipo = TIPO_UNIDADE_LABEL[u.tipo as keyof typeof TIPO_UNIDADE_LABEL] ?? u.tipo
  const resumo = [tipo, lugar(u) || null, `${n(u.leitos_ocupados)} de ${n(u.leitos)} leitos`, `${u.em_plantao} em plantão`].filter(Boolean).join(' · ')
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3.5 last:border-0 hover:bg-campo">
      <div className="flex min-w-0 flex-[1_1_230px] flex-col gap-[3px]">
        <Button variant="link" className="h-auto justify-start p-0 text-corpo font-medium underline underline-offset-4" title="Editar a unidade" onClick={() => onEditar(u.unidade_id)}>{u.nome}</Button>
        <span className="text-apoio text-tinta-sussurro">{resumo}</span>
        {motivos.length > 0 && <span className={cn('text-apoio text-pretty', estado === 2 ? 'text-critico' : 'text-atencao')}>{motivos.join(' · ')}</span>}
      </div>
      <Barra pct={pct} tom={pct !== null && pct >= u.ocupacao_limite_pct ? 'atencao' : 'conforme'} className="w-[110px] shrink-0" />
      <span className="w-11 shrink-0 text-right text-apoio font-semibold tabular-nums text-tinta">{pct === null ? '—' : `${Math.round(pct)}%`}</span>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-apoio whitespace-nowrap text-tinta-sussurro" title="Pessoas com vínculo na unidade e sessão renovada nos últimos 30 minutos">
          {u.sessoes_ativas ? `${u.sessoes_ativas} ${u.sessoes_ativas === 1 ? 'conectada' : 'conectadas'}` : 'ninguém conectado'} · uso {haQuanto(u.ultimo_uso, agora)}
        </span>
        <span className={cn('text-apoio whitespace-nowrap', u.chamados_abertos ? 'text-atencao' : 'text-tinta-sussurro')}>
          {u.chamados_abertos ? `${u.chamados_abertos} ${u.chamados_abertos === 1 ? 'chamado' : 'chamados'}` : 'sem chamados'}
        </span>
        <span className={cn(selo, SELO_ESTADO[estado])}>{ROTULO_ESTADO[estado]}</span>
      </div>
    </div>
  )
}
