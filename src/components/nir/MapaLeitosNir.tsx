// Aba "Mapa de leitos" da Internação do NIR (NIR4, modelo do RT de
// 25/11/2026), só leitura: por setor da unidade, os leitos reais com a
// situação, o paciente internado, os médicos de plantão no setor, a situação
// da regulação e o prazo ou a pendência. Indicadores: ocupação, livres, em
// regulação e sem regulação. RPC nir_mapa_leitos (20270425000030) com a lista
// regulacao_pacientes.
// NI5 (revisão unslop, RT 25/11/2026): o estado do leito fica na coluna Leito
// (Ocupado, Higienização, Livre, Bloqueado) e a coluna Paciente fica vazia sem
// paciente; a linha com paciente abre o painel (sem botão repetido); números
// neutros e iguais aos do painel, dizendo quantos internados estão sem leito.
import { BedDouble } from 'lucide-react'

import { TituloCartao, Vazio } from '@/components/monitor/Pagina'
import { CodigoLeito, EtiquetaIso } from '@/components/nir/Etiquetas'
import { FaixaNumeros } from '@/components/nir/PendenciasMedicos'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { rotuloIdade } from '@/domain/idade'
import { dataIso } from '@/lib/formato'
import {
  estadoDoLeito, indicadoresMapa, leitoOcupado, linhasDoMapa, pedidoPrincipal, pendenciasAbertas, sinalPrincipal,
  type MapaLeitos, type PendenciaUnidade,
} from '@/lib/nirPainel'
import { STATUS } from '@/lib/regulacao'
import type { PacienteRegulacao } from '@/lib/regulacaoPaciente'
import { cn } from '@/lib/utils'

const COR_SINAL = { critico: 'text-critico', atencao: 'text-atencao', info: 'text-suprimento', sucesso: 'text-conforme', neutro: '' } as const

export function MapaLeitosNir({ mapa, lista, pend, agora, abrirPaciente }: {
  mapa: MapaLeitos; lista: PacienteRegulacao[]; pend: PendenciaUnidade[]; agora: number; abrirPaciente: (pacienteId: string) => void
}) {
  const linhas = linhasDoMapa(mapa, lista)
  const ind = indicadoresMapa(linhas, lista)
  if (mapa.setores.length === 0) {
    return <Vazio icone={BedDouble} titulo="Nenhum leito cadastrado nesta unidade" texto="Os leitos vêm do cadastro de setores e leitos da unidade." />
  }
  const semLeito = ind.semLeito === 1 ? '1 internado sem leito' : `${ind.semLeito} internados sem leito`
  return (
    <div className="flex flex-col gap-4">
      <FaixaNumeros rotulo="Números dos leitos" itens={[
        { rotulo: 'Ocupação', valor: `${ind.ocupacao}%`, apoio: `${ind.ocupados} de ${ind.total} leitos ocupados` },
        { rotulo: 'Leitos livres', valor: ind.livres },
        { rotulo: 'Pacientes em regulação', valor: ind.emRegulacao, apoio: `${ind.comVaga} com vaga e destino` },
        { rotulo: 'Sem regulação', valor: ind.semRegulacao, apoio: ind.semLeito > 0 ? `inclui ${semLeito} (estão no painel)` : undefined },
      ]} />
      {mapa.setores.map((setor) => {
        const doSetor = linhas.filter((x) => x.setor.id === setor.id)
        const ocupados = doSetor.filter(leitoOcupado).length
        return (
          <section key={setor.id} aria-label={setor.nome} className="rounded-cartao border border-fio bg-superficie p-3">
            <TituloCartao extra={`${ocupados}/${doSetor.length} ocupados · Médico: ${setor.medicos.map((m) => m.nome).join(', ') || 'sem escala no setor'}`}>
              {setor.nome}
            </TituloCartao>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Leito</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Regulação</TableHead>
                  <TableHead>Prazo / pendência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doSetor.map(({ leito, paciente: l }) => {
                  const p = l ? pedidoPrincipal(l) : null
                  const iso = l ? mapa.internados.find((i) => i.paciente_id === l.paciente.id)?.isolamento : null
                  const sinal = l && p ? sinalPrincipal(l, pend, agora) : null
                  const abertas = l ? pendenciasAbertas(l, pend).length : 0
                  const ocupado = leitoOcupado({ leito, paciente: l })
                  const abrir = l ? () => abrirPaciente(l.paciente.id) : undefined
                  return (
                    <TableRow key={leito.id} onClick={abrir} className={cn(l && 'cursor-pointer hover:bg-campo')}>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <CodigoLeito livre={!ocupado}>{leito.identificador}</CodigoLeito>
                          <span className={cn('text-rotulo', ocupado ? 'text-tinta-apoio' : 'text-tinta-sussurro')}>{estadoDoLeito({ leito, paciente: l })}</span>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {l && (
                          // o nome é o botão da linha (teclado e leitor de tela); o clique na linha faz o mesmo
                          <button type="button" className="text-left font-medium text-tinta hover:text-acao hover:underline"
                            onClick={(e) => { e.stopPropagation(); abrirPaciente(l.paciente.id) }}>
                            {l.paciente.nome}
                          </button>
                        )}
                        {l?.paciente.nascimento && <span className="ml-1 text-rotulo text-tinta-sussurro">{rotuloIdade(l.paciente.nascimento, dataIso())}</span>}
                        {l && <span className="ml-1.5 inline-flex"><EtiquetaIso tipos={iso} /></span>}
                      </TableCell>
                      <TableCell>
                        {!l ? null
                          : p ? <Badge variant="info">{STATUS[p.status]} · nº {p.numero}</Badge> : <span className="text-rotulo text-tinta-sussurro">Sem regulação</span>}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {sinal && sinal.tom !== 'neutro' && <span className={COR_SINAL[sinal.tom]}>{sinal.texto}</span>}
                        {abertas > 0 && <span className="block text-rotulo text-tinta-sussurro">{abertas === 1 ? '1 pendência aberta' : `${abertas} pendências abertas`}</span>}
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
