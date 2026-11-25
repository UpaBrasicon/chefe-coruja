// Aba "Pendências com médicos" da Internação do NIR (NIR3, modelo do RT de
// 25/11/2026): indicadores (abertas, médicos avisados, risco 72 h, resolvidas
// nas últimas 24 h), filtro de setor, Pendentes / Resolvidas e a tabela com
// leito, paciente, nº, pendência, responsável e setor, avisado há, situação e
// as ações. NI4 (revisão unslop, RT 25/11/2026): números numa faixa neutra
// (só o risco em vermelho), a mesma janela de 24 h no número e no filtro,
// "Marcar resolvida" na linha e Reenviar aviso / Abrir paciente no "…",
// tempos como "4 h 42 min".
// "Copiar resumo do plantão" leva leito, setor, nº e a pendência, SEM o nome
// do paciente (LGPD). RPC regulacao_pendencias_da_unidade (20270425000030).
import { ClipboardList, Copy } from 'lucide-react'
import * as React from 'react'

import { Chip, TituloCartao, Vazio } from '@/components/monitor/Pagina'
import { tomStatus, useAcoesPendencia } from '@/components/nir/dadosNir'
import { CodigoLeito } from '@/components/nir/Etiquetas'
import { MenuMais } from '@/components/plantao/MenuMais'
import { AvisoPlantao } from '@/components/regulacao/AvisoPlantao'
import { useMotivosPlantaoOrigem, usePlantaoOrigem } from '@/components/regulacao/usePlantaoOrigem'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { rotuloIdade } from '@/domain/idade'
import { dataHora, dataIso } from '@/lib/formato'
import { HORAS_RESOLVIDAS, STATUS_PENDENCIA, indicadoresPendencias, resumoDoPlantao, tempoDesde, type PendenciaUnidade } from '@/lib/nirPainel'
import type { PacienteRegulacao } from '@/lib/regulacaoPaciente'
import { cn } from '@/lib/utils'

export function PendenciasMedicos({ unidadeId, pend, lista, agora, abrirPaciente, aoMudar }: {
  unidadeId: string; pend: PendenciaUnidade[]; lista: PacienteRegulacao[]; agora: number; abrirPaciente: (pacienteId: string) => void; aoMudar: () => void
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
  // Decisão do RT de 25/11/2026 (NIR por setor, migration 20270426000026): cada linha é de um paciente e o
  // plantão do NIR conta pelo setor dele. Uma pergunta por paciente distinto com pendência aberta, na mesma
  // chave de cache do dossiê; o motivo da página (pela unidade) vale para todas as linhas.
  const porPaciente = useMotivosPlantaoOrigem(unidadeId, plantao.motivo ? [] : doMedico.filter((x) => x.status !== 'resolvida').map((x) => x.paciente.id))
  const motivoDaLinha = (x: PendenciaUnidade) => plantao.motivo ?? porPaciente.get(x.paciente.id) ?? null
  // a frase do servidor para as linhas desligadas pelo setor (o aviso da unidade já está no topo da página)
  const avisosDeSetor = plantao.motivo ? [] : [...new Set(linhas.filter((x) => x.status !== 'resolvida').map((x) => porPaciente.get(x.paciente.id)).filter((m): m is string => !!m))]

  function copiarResumo() {
    const t = resumoDoPlantao(pend, dataHora(new Date()))
    if (!t) return setCopiado('Não há pendência aberta com médico para copiar.')
    navigator.clipboard.writeText(t).then(() => setCopiado('Resumo copiado, sem o nome dos pacientes.'), () => setCopiado('Não deu para copiar neste navegador.'))
  }

  return (
    <div className="flex flex-col gap-4">
      <FaixaNumeros rotulo="Números das pendências com médicos" itens={[
        { rotulo: 'Abertas com médicos', valor: ind.abertas },
        { rotulo: 'Médicos já avisados', valor: ind.avisados },
        { rotulo: 'Risco de cancelamento (72 h)', valor: ind.risco72h, critico: ind.risco72h > 0 },
        { rotulo: `Resolvidas nas últimas ${HORAS_RESOLVIDAS} h`, valor: ind.resolvidas },
      ]} />
      <section aria-label="Pendências com médicos" className="rounded-cartao border border-fio bg-superficie p-3">
        <TituloCartao>Pendências com médicos</TituloCartao>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <CampoSelecao aria-label="Setor" className="w-auto" value={setor} onChange={(e) => setSetor(e.target.value)}>
            <option value="">Todos os setores</option>
            {setores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </CampoSelecao>
          <div role="radiogroup" aria-label="Situação" className="flex gap-1.5">
            <Chip radio ativo={ver === 'pendentes'} contagem={ind.abertas} onClick={() => setVer('pendentes')}>Pendentes</Chip>
            <Chip radio ativo={ver === 'resolvidas'} contagem={ind.resolvidas} onClick={() => setVer('resolvidas')}>Resolvidas ({HORAS_RESOLVIDAS} h)</Chip>
          </div>
          <Button className="ml-auto" onClick={copiarResumo}><Copy /> Copiar resumo do plantão</Button>
        </div>
        {copiado && <p role="status" className="mb-2 text-rotulo text-tinta-sussurro">{copiado}</p>}
        {avisosDeSetor.map((m) => <AvisoPlantao key={m} texto={m} className="mb-2" />)}
        <AvisoPlantao texto={plantao.recusa} className="mb-2" />
        {erro && !plantao.recusa && <MensagemErro texto={erro.message} />}
        {linhas.length === 0 ? (
          <Vazio icone={ClipboardList} titulo={ver === 'pendentes' ? 'Nenhuma pendência aberta com médicos' : `Nenhuma pendência resolvida nas últimas ${HORAS_RESOLVIDAS} h`} />
        ) : (
          // NI4: a coluna Pendência fica com a largura; Responsável e Avisado encolhem; uma ação na linha e o resto no "…"
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leito</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Regulação</TableHead>
                <TableHead className="w-full min-w-64">Pendência</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Avisado</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right"><span className="sr-only">Ações</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((x) => {
                const aberta = x.status !== 'resolvida'
                const motivo = motivoDaLinha(x)
                return (
                  <TableRow key={x.id}>
                    <TableCell><CodigoLeito>{x.leito ?? '—'}</CodigoLeito></TableCell>
                    <TableCell>
                      <span className="font-medium text-tinta">{x.paciente.nome}</span>
                      {x.paciente.nascimento && <span className="ml-1 text-rotulo text-tinta-sussurro">{rotuloIdade(x.paciente.nascimento, dataIso())}</span>}
                    </TableCell>
                    <TableCell className="font-mono text-rotulo">nº {x.numero}</TableCell>
                    <TableCell className="min-w-64 whitespace-normal">
                      {x.titulo}
                      {x.urgencia === 'alta' && <Badge variant="destructive" className="ml-1.5">Urgente</Badge>}
                    </TableCell>
                    <TableCell className="max-w-40 text-rotulo whitespace-normal">
                      <span className="block text-tinta">{x.responsaveis.map((r) => r.nome).join(', ') || 'Médico de plantão'}</span>
                      <span className="text-tinta-sussurro">{x.setor?.nome ?? '—'}</span>
                    </TableCell>
                    <TableCell className="text-rotulo text-tinta-apoio">
                      {!aberta ? (x.resolvida_em ? `resolvida há ${tempoDesde(x.resolvida_em, agora)}` : 'resolvida') : x.avisado_em ? `há ${tempoDesde(x.avisado_em, agora)}` : 'não avisado'}
                      {x.avisos > 1 && <span className="block text-tinta-sussurro">{x.avisos} avisos</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tomStatus(x.status)}>{STATUS_PENDENCIA[x.status]}</Badge>
                      {!aberta && <span className="block text-rotulo text-tinta-sussurro">{x.resolvida_por ?? '—'}</span>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        {aberta && <Button size="xs" disabled={resolver.isPending || !!motivo} title={motivo ?? undefined} onClick={() => resolver.mutate(x.id)}>Marcar resolvida</Button>}
                        <MenuMais icone className="size-7" rotuloAcessivel={`Mais ações da pendência do leito ${x.leito ?? 'sem leito'}`} itens={[
                          ...(aberta ? [{ chave: 'reavisar', rotulo: 'Reenviar aviso', desabilitado: reavisar.isPending || !!motivo, onSelecionar: () => reavisar.mutate(x.id) }] : []),
                          { chave: 'abrir', rotulo: 'Abrir paciente', onSelecionar: () => abrirPaciente(x.paciente.id) },
                        ]} />
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}

export type NumeroFaixa = { rotulo: string; valor: React.ReactNode; apoio?: string; critico?: boolean }

/**
 * NI4/NI5 (revisão unslop, RT 25/11/2026): os números numa faixa só, em cor
 * neutra; só o que é risco (ex.: cancelamento > 0) fica vermelho.
 */
export function FaixaNumeros({ itens, rotulo }: { itens: NumeroFaixa[]; rotulo: string }) {
  return (
    <dl aria-label={rotulo} className="grid grid-cols-2 divide-fio rounded-cartao border border-fio bg-superficie lg:grid-cols-4 lg:divide-x">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex flex-col gap-0.5 px-3 py-2">
          <dt className="text-rotulo text-tinta-sussurro">{i.rotulo}</dt>
          <dd className={cn('text-numeral-compacto font-semibold tabular-nums', i.critico ? 'text-critico' : 'text-tinta')}>{i.valor}</dd>
          {i.apoio && <dd className="text-rotulo text-tinta-sussurro">{i.apoio}</dd>}
        </div>
      ))}
    </dl>
  )
}
