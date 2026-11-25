// Aba "Mapa de leitos" da Internação do NIR (NIR4, modelo do RT de
// 25/11/2026), só leitura: por setor da unidade, os leitos reais com a
// situação, o paciente internado, os médicos de plantão no setor, a situação
// da regulação, o prazo ou a pendência e "Abrir no painel". Indicadores:
// ocupação, livres, em regulação e sem regulação. RPC nir_mapa_leitos
// (20270425000030) com a lista regulacao_pacientes.
import { BedDouble } from 'lucide-react'

import { TituloCartao, Vazio } from '@/components/monitor/Pagina'
import { Indicador } from '@/components/nir/PendenciasMedicos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { rotuloIdade } from '@/domain/idade'
import { dataIso } from '@/lib/formato'
import {
  ROTULO_LEITO, indicadoresMapa, leitoOcupado, linhasDoMapa, pedidoPrincipal, pendenciasAbertas, rotuloIsolamento, sinalPrincipal,
  type MapaLeitos, type PendenciaUnidade,
} from '@/lib/nirPainel'
import { STATUS } from '@/lib/regulacao'
import type { PacienteRegulacao } from '@/lib/regulacaoPaciente'

export function MapaLeitosNir({ mapa, lista, pend, agora, abrirPaciente }: {
  mapa: MapaLeitos; lista: PacienteRegulacao[]; pend: PendenciaUnidade[]; agora: number; abrirPaciente: (pacienteId: string) => void
}) {
  const linhas = linhasDoMapa(mapa, lista)
  const ind = indicadoresMapa(linhas)
  if (mapa.setores.length === 0) {
    return <Vazio icone={BedDouble} titulo="Nenhum leito cadastrado nesta unidade" texto="Os leitos vêm do cadastro de setores e leitos da unidade." />
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Ocupação" valor={`${ind.ocupacao}%`} apoio={`${ind.ocupados} de ${ind.total} leitos ocupados`} />
        <Indicador rotulo="Leitos livres" valor={ind.livres} tom="conforme" apoio="prontos para receber" />
        <Indicador rotulo="Pacientes em regulação" valor={ind.emRegulacao} apoio={`${ind.comVaga} com vaga e destino`} />
        <Indicador rotulo="Sem regulação" valor={ind.semRegulacao} apoio="em observação ou conduta na unidade" />
      </div>
      {mapa.setores.map((setor) => {
        const doSetor = linhas.filter((x) => x.setor.id === setor.id)
        const ocupados = doSetor.filter(leitoOcupado).length
        return (
          <section key={setor.id} aria-label={setor.nome} className="rounded-cartao border border-fio bg-superficie p-4">
            <TituloCartao extra={`${ocupados}/${doSetor.length} ocupados · Médico: ${setor.medicos.map((m) => m.nome).join(', ') || 'sem escala no setor agora'}`}>
              {setor.nome}
            </TituloCartao>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Leito</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Regulação</TableHead>
                  <TableHead>Prazo / pendência</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doSetor.map(({ leito, paciente: l }) => {
                  const p = l ? pedidoPrincipal(l) : null
                  const iso = l ? rotuloIsolamento(mapa.internados.find((i) => i.paciente_id === l.paciente.id)?.isolamento) : null
                  const sinal = l && p ? sinalPrincipal(l, pend, agora) : null
                  const abertas = l ? pendenciasAbertas(l, pend).length : 0
                  return (
                    <TableRow key={leito.id}>
                      <TableCell className={leitoOcupado({ leito, paciente: l }) ? 'font-semibold text-acao' : 'font-semibold text-conforme'}>{leito.identificador}</TableCell>
                      <TableCell className="whitespace-normal">
                        {l ? (
                          <>
                            <span className="font-medium text-tinta">{l.paciente.nome}</span>
                            {l.paciente.nascimento && <span className="ml-1 text-rotulo text-tinta-sussurro">{rotuloIdade(l.paciente.nascimento, dataIso())}</span>}
                            {iso && <Badge variant="warning" className="ml-1.5">{iso}</Badge>}
                          </>
                        ) : leito.paciente_id ? <span className="text-tinta-apoio">Ocupado</span>
                          : <Badge variant={leito.status === 'livre' ? 'success' : 'secondary'}>{ROTULO_LEITO[leito.status] ?? leito.status}</Badge>}
                      </TableCell>
                      <TableCell>
                        {!l ? <span className="text-tinta-sussurro">—</span>
                          : p ? <Badge variant="info">{STATUS[p.status]} · nº {p.numero}</Badge> : <Badge variant="secondary">Sem regulação</Badge>}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {sinal && sinal.tom !== 'neutro' ? <span className={{ critico: 'text-critico', atencao: 'text-atencao', info: 'text-suprimento', sucesso: 'text-conforme', neutro: '' }[sinal.tom]}>{sinal.texto}</span>
                          : <span className="text-tinta-sussurro">—</span>}
                        {abertas > 0 && <span className="block text-rotulo text-tinta-sussurro">{abertas === 1 ? '1 pendência aberta' : `${abertas} pendências abertas`}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {l ? <Button size="xs" variant="outline" onClick={() => abrirPaciente(l.paciente.id)}>Abrir no painel</Button> : <span className="text-tinta-sussurro">—</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </section>
        )
      })}
    </div>
  )
}
