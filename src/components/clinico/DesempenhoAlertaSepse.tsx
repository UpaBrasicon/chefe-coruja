// SP1, decisões S1–S6 = A do RT (18/11/2026): desempenho do alerta de sepse do
// adulto, por unidade e mês. Gestor e RT veem o agregado (sem paciente); só o
// RT abre a lista de casos para revisão, com motivo (fica no registro de acesso).
// Sepse = Sepsis-3 pelo método de Seymour 2016, calculada dos dados (migration
// 20270418000095). Não é estudo clínico: serve para melhorar o alerta.
import { useMutation, useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import * as React from 'react'

import { TituloSecao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { diaMesHora, numero } from '@/lib/formato'
import { fracao, rotuloMes, textoPublicavel, type Agregado, type Desempenho } from '@/lib/sepseDesempenho'
import { supabase } from '@/lib/supabase'

type CasoRevisao = {
  episodio_id: string
  paciente: string
  chegada_em: string
  faixa: string
  categoria: 'sepse_sem_alerta' | 'alerta_sem_sepse'
  suspeita_em: string | null
  sofa: Record<string, number | boolean> | null
  alerta_em: string | null
  alerta_nivel: string | null
  alerta_parcial: boolean | null
  alerta_origem: string | null
  dispensado: boolean
  motivo_dispensa: string | null
}

const MESES = 6

export function DesempenhoAlertaSepse({ unidadeId, unidadeNome, rt }: { unidadeId: string; unidadeNome: string; rt: boolean }) {
  const { data, isError } = useQuery({
    queryKey: ['desempenho-alerta-sepse', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('desempenho_alerta_sepse', { p_unidade: unidadeId, p_meses: MESES })
      if (error) throw error
      return data as unknown as Desempenho
    },
  })
  if (isError) return null
  const a = data?.adulto
  const periodo = data ? `${rotuloMes(data.desde.slice(0, 7))} até hoje` : ''
  const texto = a ? textoPublicavel(a, unidadeNome, periodo) : null
  return (
    <section aria-label="Desempenho do alerta de sepse" className="flex flex-col gap-3">
      <TituloSecao className="mb-0">Desempenho do alerta de sepse</TituloSecao>
      <p className="text-apoio text-tinta-apoio">
        Adultos, últimos {MESES} meses. Sepse pelo critério Sepsis-3 (Seymour 2016): antimicrobiano e cultura no mesmo período e SOFA de 2 ou mais,
        calculado dos dados do prontuário. Conta como detectada a sepse com alerta até 6 h depois do início. Não é estudo clínico.
      </p>
      {a && (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Numero rotulo="Sepses que o alerta pegou" valor={fracao(a.detectadas, a.sepses)} />
            <Numero rotulo="Alertas que eram sepse" valor={fracao(a.alertas_com_sepse, a.alertas)} />
            <Numero rotulo="Alertas por 100 atendimentos" valor={a.alertas_por_100 === null ? 'sem atendimentos' : `${numero(a.alertas_por_100)} (${a.alertas} em ${a.atendimentos})`} />
            <Numero rotulo="Antecedência mediana" valor={a.antecedencia_mediana_h === null ? 'sem casos' : `${numero(a.antecedencia_mediana_h)} h`} />
            <Numero rotulo="Alertas dispensados" valor={fracao(a.dispensados, a.alertas)} />
            <Numero rotulo="Suspeitas com plaquetas e creatinina" valor={fracao(a.suspeitas_com_laboratorio, a.suspeitas)} />
          </dl>
          <p className="text-apoio text-tinta-apoio">
            NEWS2 parcial: {fracao(a.parciais_com_sepse, a.alertas_parciais)} dos alertas eram sepse. NEWS2 completo: {fracao(a.completos_com_sepse, a.alertas_completos)}.
            Antimicrobiano sem cultura: {a.antimicrobiano_sem_cultura} atendimento(s). De 14 a 17 anos, à parte: {data.de_14_a_17.sepses} sepse(s)
            em {data.de_14_a_17.atendimentos} atendimento(s).
          </p>
          {texto ? (
            <p className="rounded-cartao border border-fio bg-superficie px-4 py-3 text-apoio text-tinta">Texto para divulgar: {texto}</p>
          ) : (
            <p className="text-apoio text-tinta-sussurro">Ainda não dá para divulgar: {a.motivo_nao_publicavel}.</p>
          )}
          {data.meses.length > 0 && <TabelaMeses meses={data.meses} />}
          {data.motivos_dispensa.length > 0 && (
            <p className="text-apoio text-tinta-apoio">
              Motivos de dispensa: {data.motivos_dispensa.map((m) => `${m.motivo} (${m.quantos})`).join('; ')}.
            </p>
          )}
        </>
      )}
      {rt && <ListaRevisao unidadeId={unidadeId} />}
    </section>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-cartao border border-fio bg-superficie px-4 py-3">
      <dt className="text-rotulo text-tinta-apoio">{rotulo}</dt>
      <dd className="text-corpo font-semibold text-tinta">{valor}</dd>
    </div>
  )
}

function TabelaMeses({ meses }: { meses: { mes: string; adulto: Agregado }[] }) {
  return (
    <Table>
      <TableCaption className="sr-only">Desempenho do alerta por mês</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Mês</TableHead>
          <TableHead>Atendimentos</TableHead>
          <TableHead>Sepses</TableHead>
          <TableHead>Pegou</TableHead>
          <TableHead>Alertas</TableHead>
          <TableHead>Eram sepse</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {meses.map((m) => (
          <TableRow key={m.mes}>
            <TableCell>{rotuloMes(m.mes)}</TableCell>
            <TableCell>{m.adulto.atendimentos}</TableCell>
            <TableCell>{m.adulto.sepses}</TableCell>
            <TableCell>{fracao(m.adulto.detectadas, m.adulto.sepses)}</TableCell>
            <TableCell>{m.adulto.alertas}</TableCell>
            <TableCell>{fracao(m.adulto.alertas_com_sepse, m.adulto.alertas)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ListaRevisao({ unidadeId }: { unidadeId: string }) {
  const [motivo, setMotivo] = React.useState('')
  const abrir = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('casos_revisao_alerta_sepse', { p_unidade: unidadeId, p_meses: MESES, p_motivo: motivo.trim() })
      if (error) throw error
      return (data ?? []) as unknown as CasoRevisao[]
    },
  })
  return (
    <div className="flex flex-col gap-2 border-t border-fio pt-3">
      <p className="text-apoio text-tinta-apoio">
        Lista de casos para revisão (sepse sem alerta e alerta sem sepse). Mostra o nome do paciente: o motivo fica no registro de acesso.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Motivo para abrir a lista de casos" className="max-w-md flex-1" placeholder="Motivo (ex.: revisão mensal do alerta)"
          value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <Button size="sm" variant="outline" disabled={motivo.trim().length < 10 || abrir.isPending} onClick={() => abrir.mutate()}>
          <Activity className="size-3.5" aria-hidden /> Abrir lista de casos
        </Button>
      </div>
      {abrir.isError && <p role="alert" className="text-rotulo text-critico">{(abrir.error as Error).message}</p>}
      {abrir.data && abrir.data.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhum caso para revisar no período.</p>}
      {abrir.data?.map((c) => (
        <div key={c.episodio_id} className="rounded-cartao border border-fio bg-superficie px-4 py-3 text-apoio text-tinta-apoio">
          <p className="text-corpo text-tinta">
            {c.categoria === 'sepse_sem_alerta' ? 'Sepse sem alerta a tempo' : 'Alerta sem sepse'} · {c.paciente} · chegada {diaMesHora(c.chegada_em)}
            {c.faixa === '14_17' ? ' · 14 a 17 anos' : ''}
          </p>
          <p>
            {c.suspeita_em ? `Suspeita de infecção ${diaMesHora(c.suspeita_em)}` : 'Sem suspeita de infecção pelo critério'}
            {c.sofa ? ` · SOFA ${c.sofa.total}` : ''}
            {c.alerta_em ? ` · alerta ${diaMesHora(c.alerta_em)} (${c.alerta_origem === 'porta' ? 'porta' : 'internação'}${c.alerta_parcial ? ', NEWS2 parcial' : ''})` : ' · sem alerta'}
            {c.dispensado ? ` · dispensado${c.motivo_dispensa ? `: ${c.motivo_dispensa}` : ''}` : ''}
          </p>
        </div>
      ))}
    </div>
  )
}
