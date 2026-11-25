// Aba "Pendências com médicos" da Internação do NIR (NIR3, modelo do RT de
// 25/11/2026): indicadores (abertas, médicos avisados, risco 72 h, resolvidas
// no turno), filtro de setor, Pendentes / Resolvidas e a tabela com leito,
// paciente, nº, pendência, responsável e setor, avisado há, situação e as
// ações (reenviar aviso, marcar resolvida, abrir o paciente no painel).
// "Copiar resumo do plantão" leva leito, setor, nº e a pendência, SEM o nome
// do paciente (LGPD). RPC regulacao_pendencias_da_unidade (20270425000030).
import { ClipboardList, Copy } from 'lucide-react'
import * as React from 'react'

import { Chip, TituloCartao, Vazio } from '@/components/monitor/Pagina'
import { tomStatus, useAcoesPendencia } from '@/components/nir/dadosNir'
import { CodigoLeito } from '@/components/nir/Etiquetas'
import { AvisoPlantao } from '@/components/regulacao/AvisoPlantao'
import { usePlantaoOrigem } from '@/components/regulacao/usePlantaoOrigem'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { rotuloIdade } from '@/domain/idade'
import { dataHora, dataIso, tempoDecorrido } from '@/lib/formato'
import { HORAS_TURNO, STATUS_PENDENCIA, indicadoresPendencias, resumoDoPlantao, type PendenciaUnidade } from '@/lib/nirPainel'
import type { PacienteRegulacao } from '@/lib/regulacaoPaciente'
import { cn } from '@/lib/utils'

export function PendenciasMedicos({ pend, lista, agora, abrirPaciente, aoMudar }: {
  pend: PendenciaUnidade[]; lista: PacienteRegulacao[]; agora: number; abrirPaciente: (pacienteId: string) => void; aoMudar: () => void
}) {
  const [setor, setSetor] = React.useState('')
  const [ver, setVer] = React.useState<'pendentes' | 'resolvidas'>('pendentes')
  const [copiado, setCopiado] = React.useState<string | null>(null)
  const { reavisar, resolver, erro } = useAcoesPendencia(aoMudar)
  // B-07 (RT, 25/11/2026): fora do plantão o NIR não reenvia nem resolve; a recusa do servidor vira aviso
  const plantao = usePlantaoOrigem(reavisar.error, resolver.error)
  const doMedico = pend.filter((x) => x.dono === 'medico')
  const ind = indicadoresPendencias(pend, lista, agora)
  const setores = [...new Map(doMedico.filter((x) => x.setor).map((x) => [x.setor!.id, x.setor!.nome])).entries()]
  const linhas = doMedico.filter((x) => (!setor || x.setor?.id === setor) && (ver === 'pendentes' ? x.status !== 'resolvida' : x.status === 'resolvida'))

  function copiarResumo() {
    const t = resumoDoPlantao(pend, dataHora(new Date()))
    if (!t) return setCopiado('Não há pendência aberta com médico para copiar.')
    navigator.clipboard.writeText(t).then(() => setCopiado('Resumo copiado, sem o nome dos pacientes.'), () => setCopiado('Não deu para copiar neste navegador.'))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Pendências abertas com médicos" valor={ind.abertas} tom={ind.abertas > 0 ? 'atencao' : undefined} />
        <Indicador rotulo="Médicos já avisados" valor={ind.avisados} />
        <Indicador rotulo="Risco de cancelamento (72 h)" valor={ind.risco72h} tom={ind.risco72h > 0 ? 'critico' : undefined} />
        <Indicador rotulo={`Resolvidas nas últimas ${HORAS_TURNO} h`} valor={ind.resolvidasTurno} tom="conforme" />
      </div>
      <section aria-label="Pendências com médicos" className="rounded-cartao border border-fio bg-superficie p-3">
        <TituloCartao>Pendências com médicos</TituloCartao>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <CampoSelecao aria-label="Setor" className="w-auto" value={setor} onChange={(e) => setSetor(e.target.value)}>
            <option value="">Todos os setores</option>
            {setores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </CampoSelecao>
          <div role="radiogroup" aria-label="Situação" className="flex gap-1.5">
            <Chip radio ativo={ver === 'pendentes'} contagem={ind.abertas} onClick={() => setVer('pendentes')}>Pendentes</Chip>
            <Chip radio ativo={ver === 'resolvidas'} onClick={() => setVer('resolvidas')}>Resolvidas (24 h)</Chip>
          </div>
          <Button className="ml-auto" onClick={copiarResumo}><Copy /> Copiar resumo do plantão</Button>
        </div>
        {copiado && <p role="status" className="mb-2 text-rotulo text-tinta-sussurro">{copiado}</p>}
        <AvisoPlantao texto={plantao.recusa} className="mb-2" />
        {erro && !plantao.recusa && <MensagemErro texto={erro.message} />}
        {linhas.length === 0 ? (
          <Vazio icone={ClipboardList} titulo={ver === 'pendentes' ? 'Nenhuma pendência aberta com médicos' : 'Nenhuma pendência resolvida nas últimas 24 h'} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leito</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Regulação</TableHead>
                <TableHead>Pendência</TableHead>
                <TableHead>Responsável / setor</TableHead>
                <TableHead>Avisado</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((x) => (
                <TableRow key={x.id}>
                  <TableCell><CodigoLeito>{x.leito ?? '—'}</CodigoLeito></TableCell>
                  <TableCell>
                    <span className="font-medium text-tinta">{x.paciente.nome}</span>
                    {x.paciente.nascimento && <span className="ml-1 text-rotulo text-tinta-sussurro">{rotuloIdade(x.paciente.nascimento, dataIso())}</span>}
                  </TableCell>
                  <TableCell>nº {x.numero}</TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {x.titulo}
                    {x.urgencia === 'alta' && <Badge variant="destructive" className="ml-1.5">Urgente</Badge>}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="block">{x.responsaveis.map((r) => r.nome).join(', ') || 'Médico de plantão'}</span>
                    <span className="text-rotulo text-tinta-sussurro">{x.setor?.nome ?? '—'}</span>
                  </TableCell>
                  <TableCell className="text-tinta-apoio">
                    {x.status === 'resolvida' ? `resolvida ${x.resolvida_em ? tempoDecorrido(x.resolvida_em) : ''}` : x.avisado_em ? tempoDecorrido(x.avisado_em) : 'não avisado'}
                    {x.avisos > 1 && <span className="block text-rotulo text-tinta-sussurro">{x.avisos} avisos</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tomStatus(x.status)}>{STATUS_PENDENCIA[x.status]}</Badge>
                    {x.status === 'resolvida' && <span className="block text-rotulo text-tinta-sussurro">{x.resolvida_por ?? '—'}</span>}
                  </TableCell>
                  <TableCell className={cn('text-right whitespace-nowrap')}>
                    <span className="inline-flex flex-wrap justify-end gap-1.5">
                      {x.status !== 'resolvida' && (
                        <>
                          <Button size="xs" variant="outline" disabled={reavisar.isPending || !!plantao.motivo} title={plantao.motivo ?? undefined} onClick={() => reavisar.mutate(x.id)}>Reenviar aviso</Button>
                          <Button size="xs" disabled={resolver.isPending || !!plantao.motivo} title={plantao.motivo ?? undefined} onClick={() => resolver.mutate(x.id)}>Marcar resolvida</Button>
                        </>
                      )}
                      <Button size="xs" variant="outline" onClick={() => abrirPaciente(x.paciente.id)}>Abrir paciente</Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}

export function Indicador({ rotulo, valor, apoio, tom }: { rotulo: string; valor: React.ReactNode; apoio?: string; tom?: 'atencao' | 'critico' | 'conforme' }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-cartao border border-fio bg-superficie px-3 py-2">
      <span className="text-rotulo text-tinta-sussurro">{rotulo}</span>
      <span className={cn('text-numeral-compacto font-semibold tabular-nums', tom === 'atencao' ? 'text-atencao' : tom === 'critico' ? 'text-critico' : tom === 'conforme' ? 'text-conforme' : 'text-tinta')}>{valor}</span>
      {apoio && <span className="text-rotulo text-tinta-sussurro">{apoio}</span>}
    </div>
  )
}
