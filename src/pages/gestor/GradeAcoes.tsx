import { useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import * as React from 'react'

import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { Chip, Chips, Vazio } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useUnidade } from '@/contexts/UnidadeContext'
import { hora } from '@/lib/formato'
import { tempo } from '@/lib/portaAgora'
import { ETAPAS_GRADE, temAtraso, type EstadoEtapa, type Grade } from '@/lib/portaGrade'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Grade de ações do gestor (P1; desenho B, escolhido pelo RT em 27/10/2026, a
// partir da página de situação do Zendesk e do modelo do Symphony): uma linha
// por paciente da porta, uma coluna por etapa com a hora, e uma faixa fina em
// cima de cada célula na cor da situação. O banco (porta_grade) só marca atraso
// onde a unidade tem alvo, e registra o acesso na auditoria.

const COR_TEXTO: Record<EstadoEtapa, string> = {
  feito: 'text-tinta', pedido: 'text-conforme', atrasado: 'font-semibold text-critico', vazio: 'text-tinta-sussurro',
}
const COR_FAIXA: Record<EstadoEtapa, string> = { feito: 'bg-tinta-apoio', pedido: 'bg-conforme', atrasado: 'bg-critico', vazio: 'bg-trilha' }
const FILTROS = ['Todos', 'Com atraso'] as const

export function GradeAcoes() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [filtro, setFiltro] = React.useState<(typeof FILTROS)[number]>('Todos')

  const { data, isLoading, error } = useQuery({
    queryKey: ['porta-grade', unidadeId],
    enabled: !!unidadeId,
    // o mesmo ritmo da Porta: quem chega aparece logo; ao voltar para a aba, atualiza na hora
    refetchInterval: 15_000,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('porta_grade', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as Grade
    },
  })

  if (isLoading) return <div className="flex h-32 items-center justify-center"><Spinner /></div>
  if (!data) return error ? <p role="alert" className="text-apoio text-critico">Não foi possível carregar a grade de ações: {(error as Error).message}</p> : null

  const comAtraso = data.pacientes.filter(temAtraso)
  const lista = filtro === 'Com atraso' ? comAtraso : data.pacientes
  const permanencia = data.alvos.permanencia

  return (
    <div className="flex flex-col gap-3">
      {/* uma atualização que falha não apaga a grade: fica a última, com o aviso */}
      {error && (
        <p role="alert" className="text-apoio text-critico">
          Não foi possível atualizar a grade ({(error as Error).message}). Mostrando a das {hora(data.gerado_em)}.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-apoio">
        <span className="flex flex-wrap gap-4">
          <span><strong className="font-semibold text-tinta">Preto</strong> <span className="text-tinta-apoio">feito</span></span>
          <span><strong className="font-semibold text-conforme">Verde</strong> <span className="text-tinta-apoio">pedido</span></span>
          <span><strong className="font-semibold text-critico">Vermelho</strong> <span className="text-tinta-apoio">atrasado</span></span>
        </span>
        <span className="text-rotulo text-tinta-sussurro">
          No PS em vermelho: acima do alvo da cor antes do médico{permanencia ? `; acima de ${tempo(permanencia)} depois` : ''}
          {' · '}Alvos em Unidade › Configurações · Acesso registrado na auditoria
        </span>
      </div>
      <Chips rotulo="Filtrar pacientes">
        {FILTROS.map((f) => (
          <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)} contagem={f === 'Todos' ? data.pacientes.length : comAtraso.length}>
            {f}
          </Chip>
        ))}
      </Chips>
      {lista.length === 0 ? (
        <Vazio icone={ClipboardList} titulo={filtro === 'Todos' ? 'Ninguém na porta agora' : 'Nenhum paciente com atraso'} />
      ) : (
        <div className="overflow-x-auto rounded-container border border-fio bg-superficie">
          <Table variante="referencia" className="w-full min-w-[960px] text-apoio">
            <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
              <TableRow>
                <TableHead className="px-4 py-2 font-medium">Paciente</TableHead>
                <TableHead className="px-3 py-2 font-medium">No PS</TableHead>
                {ETAPAS_GRADE.map((e) => <TableHead key={e.chave} className="px-3 py-2 font-medium">{e.rotulo}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((l) => (
                <TableRow key={l.episodio_id} className="border-b border-trilha last:border-0">
                  <TableCell className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <PilulaRisco cor={l.cor} />
                      <span className="font-medium text-tinta">{l.nome}</span>
                    </span>
                  </TableCell>
                  <TableCell className={cn('px-3 py-2.5 tabular', l.no_ps_atrasado ? 'font-semibold text-critico' : 'text-tinta-apoio')}>
                    {tempo(l.no_ps_min)}{l.no_ps_atrasado && <span className="sr-only"> (atrasado)</span>}
                  </TableCell>
                  {ETAPAS_GRADE.map((e) => {
                    const c = e.celula(l)
                    return (
                      <TableCell key={e.chave} className="px-3 py-2.5 align-top">
                        <span className={cn('mb-1.5 block h-1.5 rounded-capsula', COR_FAIXA[c.estado])} aria-hidden />
                        <span className={cn('tabular whitespace-nowrap', COR_TEXTO[c.estado])}>{c.texto}</span>
                        {c.estado === 'atrasado' && <span className="sr-only"> (atrasado)</span>}
                        {c.estado === 'pedido' && <span className="sr-only"> (pedido)</span>}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
