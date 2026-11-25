// Censo em gráfico (revisão do gestor, RT 24/11/2026, Indicadores M2):
// internados por dia, empilhados por setor, dos censos gravados. O vazio
// explica que o censo é gravado por dia e como gerar o de hoje.
import { GraficoBarras, type PontoBarra } from '@/components/monitor/GraficoBarras'

type Linha = { data: string; setor_id: string; setor_nome: string; internados: number }

const diaMes = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function GraficoCenso({ censo }: { censo: Linha[] }) {
  const setores = [...new Map(censo.map((c) => [c.setor_id, c.setor_nome])).entries()]
  const dias = [...new Set(censo.map((c) => c.data))].sort()
  const dados: PontoBarra[] = dias.map((d) => {
    const ponto: PontoBarra = { rotulo: diaMes(d) }
    for (const [id] of setores) ponto[id] = censo.find((c) => c.data === d && c.setor_id === id)?.internados ?? 0
    return ponto
  })
  return (
    <GraficoBarras
      rotulo="Internados por dia, por setor, nos últimos censos gravados"
      dados={dados}
      series={setores.map(([id, nome]) => ({ chave: id, nome }))}
      empilhado
      vazio={'Nenhum internado nos censos gravados. O censo é gravado uma vez por dia; use "Gerar censo de hoje" para gravar o de agora.'}
    />
  )
}
