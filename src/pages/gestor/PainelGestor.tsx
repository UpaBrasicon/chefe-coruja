import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BedDouble, DoorOpen, FileLock2, Gauge, Printer, UserCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { TituloPagina } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'

// Painel do gestor (fase 6): retrato da unidade agora, numa chamada só
// (painel_gestor). Cada número leva à tela que resolve.

type SetorPainel = {
  setor_id: string
  setor: string
  tipo: string
  pacientes: number
  leitos: number
  leitos_ocupados: number
  leitos_livres: number
  escalados_agora: number
}
type Painel = {
  gerado_em: string
  ocupacao: SetorPainel[]
  porta: { triagem: number; atendimento: number; observacao: number; internacao: number; encerrados_24h: number; chegadas_24h: number; espera_mais_antiga_min: number | null }
  presenca: { em_expediente: number; checkin_fora_do_raio: number }
  escalados_sem_checkin: number
  pedidos_acesso_pendentes: number
  acessos_prontuario_24h: number
  impressoes_24h: number
}

function Numero({ rotulo, valor, icone: Icone, para, alerta }: { rotulo: string; valor: number | string; icone: typeof Gauge; para?: string; alerta?: boolean }) {
  const corpo = (
    <div className={`flex h-full flex-col gap-1 rounded-lg border p-3 ${alerta ? 'border-atencao/40 bg-atencao/[0.06]' : ''} ${para ? 'hover:border-acao' : ''}`}>
      <div className="flex items-center gap-1.5 text-xs text-tinta-sussurro"><Icone className="size-3.5" />{rotulo}</div>
      <div className="text-numeral-ok leading-none font-semibold tabular">{valor}</div>
    </div>
  )
  return para ? <Link to={para}>{corpo}</Link> : corpo
}

export default function PainelGestor() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id

  const { data, isLoading, error } = useQuery({
    queryKey: ['painel-gestor', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_gestor', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as Painel
    },
  })

  if (error) return <p className="text-sm text-critico">Falha ao carregar o painel: {(error as Error).message}</p>
  if (isLoading || !data) return <div className="flex h-40 items-center justify-center"><Spinner /></div>

  const semEscala = data.ocupacao.filter((s) => s.escalados_agora === 0 && (s.pacientes > 0 || s.tipo === 'emergencia'))
  const porta = data.porta.triagem + data.porta.atendimento
  const espera = data.porta.espera_mais_antiga_min

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4">
      <TituloPagina
        icone={Gauge}
        titulo="Painel da unidade"
        descricao={`${unidadeAtiva?.unidade?.nome ?? 'Unidade'} · atualizado ${new Date(data.gerado_em).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'short' })}, a cada minuto`}
      />

      {(semEscala.length > 0 || data.pedidos_acesso_pendentes > 0 || data.escalados_sem_checkin > 0) && (
        <Card className="border-atencao/40">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4 text-atencao" />Pede atenção</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {semEscala.map((s) => (
                <li key={s.setor_id}>
                  <Link className="text-acao hover:underline" to="/escala">{s.setor}</Link> sem ninguém escalado agora
                  {s.pacientes > 0 ? ` e com ${s.pacientes} paciente${s.pacientes === 1 ? '' : 's'}` : ''}.
                </li>
              ))}
              {data.escalados_sem_checkin > 0 && (
                <li><Link className="text-acao hover:underline" to="/escala?aba=presencas">{data.escalados_sem_checkin} escalado{data.escalados_sem_checkin === 1 ? '' : 's'}</Link> no plantão em curso sem check-in há mais de 15 minutos.</li>
              )}
              {data.pedidos_acesso_pendentes > 0 && (
                <li><Link className="text-acao hover:underline" to="/auditoria">{data.pedidos_acesso_pendentes} pedido{data.pedidos_acesso_pendentes === 1 ? '' : 's'} de acesso a prontuário</Link> aguardando sua decisão.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero rotulo="Na porta agora" valor={porta} icone={DoorOpen} para="/atendimento" />
        <Numero rotulo="Espera mais antiga" valor={espera == null ? '—' : espera >= 60 ? `${Math.floor(espera / 60)} h ${espera % 60} min` : `${espera} min`} icone={DoorOpen} alerta={espera != null && espera > 120} />
        <Numero rotulo="Em observação" valor={data.porta.observacao} icone={BedDouble} para="/observacao" />
        <Numero rotulo="Em internação" valor={data.porta.internacao} icone={BedDouble} para="/internacao" />
        <Numero rotulo="Chegadas em 24 h" valor={data.porta.chegadas_24h} icone={DoorOpen} />
        <Numero rotulo="Encerrados em 24 h" valor={data.porta.encerrados_24h} icone={DoorOpen} />
        <Numero rotulo="Em expediente" valor={data.presenca.em_expediente} icone={UserCheck} para="/escala?aba=presencas" />
        <Numero rotulo="Check-in fora do raio" valor={data.presenca.checkin_fora_do_raio} icone={UserCheck} para="/escala?aba=presencas" alerta={data.presenca.checkin_fora_do_raio > 0} />
        <Numero rotulo="Pedidos de acesso" valor={data.pedidos_acesso_pendentes} icone={FileLock2} para="/auditoria" alerta={data.pedidos_acesso_pendentes > 0} />
        <Numero rotulo="Prontuários abertos em 24 h" valor={data.acessos_prontuario_24h} icone={FileLock2} para="/auditoria?aba=acessos" />
        <Numero rotulo="Impressões em 24 h" valor={data.impressoes_24h} icone={Printer} para="/auditoria?aba=acessos" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Setores agora</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-tinta-sussurro">
              <tr><th className="py-1.5 font-medium">Setor</th><th className="font-medium">Pacientes</th><th className="font-medium">Leitos ocupados</th><th className="font-medium">Leitos livres</th><th className="font-medium">Escalados agora</th></tr>
            </thead>
            <tbody>
              {data.ocupacao.map((s) => (
                <tr key={s.setor_id} className="border-t">
                  <td className="py-2">{s.setor} <span className="text-xs text-tinta-sussurro">· {s.tipo}</span></td>
                  <td className="tabular">{s.pacientes}</td>
                  <td className="tabular">{s.leitos ? `${s.leitos_ocupados} de ${s.leitos}` : '—'}</td>
                  <td className="tabular">{s.leitos ? s.leitos_livres : '—'}</td>
                  <td>{s.escalados_agora > 0 ? <span className="tabular">{s.escalados_agora}</span> : <Badge variant={s.pacientes > 0 ? 'warning' : 'secondary'}>ninguém</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
