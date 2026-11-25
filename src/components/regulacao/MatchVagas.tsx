// ─────────────────────────────────────────────────────────────────────────────
// Match de vagas compatíveis no dossiê do regulador (RG3 e RG4 do modelo do
// RT, 25/11/2026). Unidades da rede com o tipo de leito pedido, o saldo geral /
// isolamento / pressão negativa e a compatibilidade com o isolamento do pedido
// (src/lib/regulacaoFila.ts). "Reservar vaga" não cria regra: abre a decisão
// de autorizar com a unidade escolhida; a reserva do leito segue o aceite do
// destino (tarefa 9, DestinoRegulacao). Migration 20270425000020.
// RC4 da revisão unslop (RT, 25/11/2026): uma coluna para cada saldo
// ("Livres", "Isolamento", "Pressão negativa", sem abreviar), a unidade numa
// linha (corta com reticências e mostra inteira ao focar) e zeros em cinza.
// ─────────────────────────────────────────────────────────────────────────────
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { textoIsolamento } from '@/lib/isolamentoPedido'
import { ISOLAMENTOS, TIPOS_LEITO } from '@/lib/regulacao'
import { matchVagas } from '@/lib/regulacaoFila'
import { cn } from '@/lib/utils'
import { useVagasCentral } from './useRegulacaoCentral'

export function MatchVagas({ centralId, pedido, podeReservar, aoReservar }: {
  centralId: string
  pedido: { tipo_leito: string | null; isolamento_tipo: string | null; isolamento_tipos?: string[] | null; origem_id: string; origem?: { latitude: number | null; longitude: number | null } | null }
  podeReservar: boolean
  aoReservar: (unidadeId: string) => void
}) {
  const vagas = useVagasCentral(centralId)
  const [verIncompativeis, setVerIncompativeis] = React.useState(false)
  const linhas = matchVagas(pedido, vagas.data?.unidades ?? [])
  const incompativeis = linhas.filter((l) => !l.compativel).length
  const visiveis = verIncompativeis ? linhas : linhas.filter((l) => l.compativel)
  const porDistancia = linhas.some((l) => l.compativel && l.km != null) && linhas.filter((l) => l.compativel).every((l) => l.km != null)
  return (
    <section aria-label="Vagas compatíveis" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-tinta">Vagas compatíveis</h3>
        {pedido.tipo_leito && <Badge variant="secondary">{TIPOS_LEITO[pedido.tipo_leito] ?? pedido.tipo_leito}</Badge>}
        <Badge variant={pedido.isolamento_tipo ? 'warning' : 'secondary'}>
          {pedido.isolamento_tipo ? `Isolamento: ${textoIsolamento(pedido) ?? ISOLAMENTOS[pedido.isolamento_tipo] ?? pedido.isolamento_tipo}` : 'Qualquer vaga livre'}
        </Badge>
        {incompativeis > 0 && (
          <Button size="xs" variant="outline" className="ml-auto" onClick={() => setVerIncompativeis((v) => !v)}>
            {verIncompativeis ? 'Ocultar' : 'Mostrar'} {incompativeis} incompatíve{incompativeis === 1 ? 'l' : 'is'}
          </Button>
        )}
      </div>
      {vagas.isLoading ? <EsqueletoLinhas linhas={3} rotulo="Carregando as vagas…" />
        : vagas.error ? <MensagemErro texto={(vagas.error as Error).message} />
        : visiveis.length === 0 ? (
          <p className="text-tinta-sussurro">
            {linhas.length === 0 ? 'Nenhuma unidade da rede oferta este tipo de leito no mapa de vagas.' : 'Nenhuma unidade com vaga compatível agora.'}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-controle border border-fio">
            <Table variante="referencia" className="w-full text-left text-apoio">
              <TableHeader className="bg-campo text-rotulo text-tinta-apoio">
                <TableRow>
                  <TableHead className="px-2 py-1.5 font-medium">Unidade</TableHead>
                  <TableHead className="px-2 py-1.5 text-right font-medium whitespace-nowrap" title="Leitos livres fora de isolamento">Livres</TableHead>
                  <TableHead className="px-2 py-1.5 text-right font-medium whitespace-nowrap" title="Livres de isolamento comum">Isolamento</TableHead>
                  <TableHead className="px-2 py-1.5 text-right font-medium whitespace-nowrap" title="Livres de isolamento com pressão negativa">Pressão negativa</TableHead>
                  <TableHead className="px-2 py-1.5 font-medium">Compatibilidade</TableHead>
                  <TableHead className="px-2 py-1.5 font-medium"><span className="sr-only">Ação</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-fio">
                {visiveis.map((l) => (
                  <TableRow key={l.unidade.id} className={l.compativel ? undefined : 'text-tinta-sussurro'}>
                    <TableCell className="max-w-56 px-2 py-1.5">
                      <span tabIndex={0} title={l.unidade.nome}
                        className="block truncate rounded-controle font-medium text-tinta outline-none focus-visible:whitespace-normal focus-visible:ring-2 focus-visible:ring-acao/40">{l.unidade.nome}</span>
                      <span className="block truncate text-rotulo text-tinta-sussurro">
                        {[l.unidade.municipio, l.unidade.cnes ? `CNES ${l.unidade.cnes}` : '', l.km != null ? `${Math.round(l.km)} km` : ''].filter(Boolean).join(' · ')}
                      </span>
                    </TableCell>
                    {[l.saldo.geral, l.saldo.isolamento, l.saldo.pressao_negativa].map((n, i) => (
                      <TableCell key={i} className={cn('px-2 py-1.5 text-right tabular-nums', n === 0 ? 'text-tinta-sussurro' : 'text-tinta')}>{n}</TableCell>
                    ))}
                    <TableCell className="px-2 py-1.5">{l.texto}</TableCell>
                    <TableCell className="px-2 py-1.5 text-right">
                      {l.compativel && podeReservar && (
                        <Button size="xs" variant="outline" onClick={() => aoReservar(l.unidade.id)}>Reservar vaga</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      <span className="text-rotulo text-tinta-sussurro">
        {porDistancia ? 'Por distância da origem (linha reta).' : 'Por saldo compatível; a distância aparece quando a origem e a unidade têm coordenadas.'}
        {' '}Reservar abre a autorização com a unidade; o destino aceita e reserva o leito.
      </span>
    </section>
  )
}
