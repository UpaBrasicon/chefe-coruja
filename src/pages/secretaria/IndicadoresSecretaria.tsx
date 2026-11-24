import { useQuery } from '@tanstack/react-query'
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'

import { TituloPagina } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PAPEL_LABEL, TIPO_UNIDADE_LABEL } from '@/lib/constants'
import { dataIso } from '@/lib/formato'
import {
  cobertura, contagem, papeisComGente, porcento, totalDaSecretaria, type IndicadorUnidade, type Indicadores,
} from '@/lib/secretariaCompleta'
import { supabase } from '@/lib/supabase'
import type { Papel, TipoUnidade } from '@/types/database'

// Indicadores do perfil Gestor da secretaria (pedido do RT, 24/11/2026): as
// unidades da secretaria lado a lado no mês. Só agregado (secretaria_indicadores,
// migration 20270421000024): contagem de paciente de 1 a 4 aparece como "< 5".

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const tipo = (t: string) => TIPO_UNIDADE_LABEL[t as TipoUnidade] ?? t

export default function IndicadoresSecretaria() {
  const [mes, setMes] = React.useState(() => dataIso().slice(0, 7))
  const [ano, mesNum] = mes.split('-').map(Number)
  const mudarMes = (n: number) => {
    const d = new Date(ano, mesNum - 1 + n, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const dados = useQuery({
    queryKey: ['secretaria-indicadores', mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('secretaria_indicadores', { p_ano: ano, p_mes: mesNum })
      if (error) throw error
      return data as unknown as Indicadores
    },
  })
  const unidades = dados.data?.unidades ?? []
  const total = totalDaSecretaria(unidades)
  const varias = unidades.length > 1

  return (
    <div className="flex flex-col gap-4">
      <TituloPagina
        icone={BarChart3}
        titulo="Indicadores da secretaria"
        descricao="As unidades da secretaria lado a lado: leitos, pessoas, escala e movimento do mês. Só números agregados, sem identificar paciente."
        className="mb-0"
        acoes={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft /></Button>
            <span className="min-w-[132px] text-center text-apoio font-semibold text-tinta">{MESES[mesNum - 1]} de {ano}</span>
            <Button variant="outline" size="icon-sm" aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight /></Button>
          </div>
        }
      />

      {dados.isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
      {dados.error && <MensagemErro erro={dados.error} acao="carregar os indicadores" />}
      {dados.data && unidades.length === 0 && (
        <p className="text-apoio text-tinta-sussurro">A secretaria ainda não tem unidade ativa.</p>
      )}

      {unidades.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-corpo">Leitos e movimento</CardTitle>
              <CardDescription>
                Leitos agora; plantões, atendimentos e internações no mês escolhido. Contagens de 1 a 4 aparecem como "&lt; 5" e a ocupação some junto.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[920px] text-apoio">
                <TableHeader className="text-left text-rotulo text-tinta-sussurro">
                  <TableRow>
                    <TableHead className="py-1.5 font-medium">Unidade</TableHead>
                    <TableHead className="font-medium">Ocupados</TableHead>
                    <TableHead className="font-medium">Ocupação</TableHead>
                    <TableHead className="font-medium">Livres</TableHead>
                    <TableHead className="font-medium">Higienização</TableHead>
                    <TableHead className="font-medium">Reservados</TableHead>
                    <TableHead className="font-medium">Bloqueados</TableHead>
                    <TableHead className="font-medium">Plantões</TableHead>
                    <TableHead className="font-medium">Cobertura</TableHead>
                    <TableHead className="font-medium">Vagas abertas</TableHead>
                    <TableHead className="font-medium">Atendimentos</TableHead>
                    <TableHead className="font-medium">Internações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unidades.map((u) => <LinhaUnidade key={u.id} u={u} />)}
                  {varias && (
                    <TableRow className="border-t font-medium tabular">
                      <TableCell className="py-2 font-sans">Todas</TableCell>
                      <TableCell>{total.leitos === 0 ? '—' : `${contagem(total.ocupados)} de ${total.leitos}`}</TableCell>
                      <TableCell>{porcento(total.taxa)}</TableCell>
                      <TableCell colSpan={4} />
                      <TableCell>{total.plantoes}</TableCell>
                      <TableCell />
                      <TableCell>{total.vagas}</TableCell>
                      <TableCell>{contagem(total.atendimentos)}</TableCell>
                      <TableCell>{contagem(total.internacoes)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <PessoasPorPapel unidades={unidades} />
        </>
      )}
    </div>
  )
}

function LinhaUnidade({ u }: { u: IndicadorUnidade }) {
  const semLeito = u.leitos.total === 0
  const cob = cobertura(u.escala)
  return (
    <TableRow className="border-t tabular">
      <TableCell className="py-2 font-sans">
        <span className="block text-tinta">{u.nome}</span>
        <span className="block text-rotulo text-tinta-sussurro">{tipo(u.tipo)}</span>
      </TableCell>
      <TableCell>{semLeito ? 'sem leito' : `${contagem(u.leitos.ocupados)} de ${u.leitos.total}`}</TableCell>
      <TableCell>{porcento(u.leitos.taxa)}</TableCell>
      <TableCell>{semLeito ? '—' : u.leitos.livres}</TableCell>
      <TableCell>{semLeito ? '—' : u.leitos.higienizacao}</TableCell>
      <TableCell>{semLeito ? '—' : u.leitos.reservados}</TableCell>
      <TableCell>{semLeito ? '—' : u.leitos.bloqueados}</TableCell>
      <TableCell>{u.escala.plantoes}</TableCell>
      <TableCell>{cob === null ? '—' : porcento(cob)}</TableCell>
      <TableCell className={u.escala.vagas > 0 ? 'text-atencao' : undefined}>{u.escala.vagas}</TableCell>
      <TableCell>{contagem(u.atendimentos)}</TableCell>
      <TableCell>{contagem(u.internacoes)}</TableCell>
    </TableRow>
  )
}

/** Papéis nas linhas, unidades nas colunas: quem falta salta aos olhos. */
function PessoasPorPapel({ unidades }: { unidades: IndicadorUnidade[] }) {
  const papeis = papeisComGente(
    unidades.reduce<Partial<Record<Papel, number>>>((acc, u) => {
      for (const [p, n] of Object.entries(u.pessoas) as [Papel, number][]) acc[p] = (acc[p] ?? 0) + n
      return acc
    }, {}),
  ).map(([p]) => p)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Pessoas por papel</CardTitle>
        <CardDescription>Vínculos ativos em cada unidade. Quem tem dois papéis conta nos dois; o total conta a pessoa uma vez.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {papeis.length === 0 ? (
          <p className="text-apoio text-tinta-sussurro">Nenhum vínculo ativo nas unidades.</p>
        ) : (
          <Table variante="referencia" className="w-full text-apoio" style={{ minWidth: 200 + unidades.length * 140 }}>
            <TableHeader className="text-left text-rotulo text-tinta-sussurro">
              <TableRow>
                <TableHead className="py-1.5 font-medium">Papel</TableHead>
                {unidades.map((u) => <TableHead key={u.id} className="font-medium">{u.nome}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {papeis.map((p) => (
                <TableRow key={p} className="border-t tabular">
                  <TableCell className="py-2 font-sans">{PAPEL_LABEL[p] ?? p}</TableCell>
                  {unidades.map((u) => {
                    const n = u.pessoas[p] ?? 0
                    return <TableCell key={u.id} className={n === 0 ? 'text-tinta-sussurro' : undefined}>{n}</TableCell>
                  })}
                </TableRow>
              ))}
              <TableRow className="border-t font-medium tabular">
                <TableCell className="py-2 font-sans">Pessoas</TableCell>
                {unidades.map((u) => <TableCell key={u.id}>{u.pessoas_total}</TableCell>)}
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
