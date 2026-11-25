// Planilha / evolução dos exames do leito (EXM10, modelo do RT de 25/11/2026):
// matriz analito × data da coleta com os analitos dos resultados
// (exame_resultado_itens), agrupados pelo exame. Os valores saem como vieram.
// Unidade, faixa e marca só quando vêm do laboratório; o app não calcula faixa,
// seta nem "limítrofe" e não traz faixa fixa. O crítico é o do laboratório.
//
// "Lançar resultado" (só o médico com o paciente no plantão e o NIR de plantão,
// decisão do RT de 25/11/2026, B-09; quem decide é o servidor, em
// posso_lancar_planilha): gaveta com o exame aguardando, a data e a hora
// da coleta e os valores (nome e valor, como estão no papel). Grava como
// resultado à mão, sem marca (registrar_resultado_estruturado). Sem botão de
// "evolução de exemplo" (EXM11).
import { FlaskConical, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'

import type { PedidoLeito } from '@/components/internacao/exames/dados'
import { pendente } from '@/components/internacao/exames/dados'
import { Chip, Vazio } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { analitosConhecidos, instanteDoCampo, itensDoLancamento, montarPlanilha, type ResultadoLido } from '@/lib/examesAba'
import { dataHoraInput, diaMesHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

export function PlanilhaExamesLeito({ pedidos, resultados, podeLancar, recarregar }: {
  pedidos: PedidoLeito[]; resultados: ResultadoLido[]
  /** O servidor disse que quem está na tela lança valores (usePodeLancarPlanilha). */
  podeLancar: boolean
  recarregar: () => void
}) {
  const planilha = montarPlanilha(resultados)
  const [filtro, setFiltro] = React.useState<string | null>(null)
  const [lancando, setLancando] = React.useState(false)
  const grupos = filtro ? planilha.grupos.filter((g) => g.exame === filtro) : planilha.grupos
  const comResultado = new Set(resultados.map((r) => r.exame_id))
  // lançamento à mão: exames aguardando, fora os de imagem (que têm laudo, não valores)
  const aguardando = pedidos.filter((p) => pendente(p) && !comResultado.has(p.id) && p.grupo !== 'imagem' && p.tipo !== 'imagem')

  return (
    <section aria-label="Planilha e evolução" className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie p-4">
      <div className="flex flex-wrap items-center gap-2">
        {planilha.grupos.length > 1 && (
          <div role="radiogroup" aria-label="Exame" className="flex flex-wrap gap-1.5">
            <Chip radio ativo={filtro === null} onClick={() => setFiltro(null)}>Todos</Chip>
            {planilha.grupos.map((g) => <Chip key={g.exame} radio ativo={filtro === g.exame} onClick={() => setFiltro(g.exame)}>{g.exame}</Chip>)}
          </div>
        )}
        {podeLancar && (
          <Button size="sm" className="ml-auto" disabled={aguardando.length === 0} onClick={() => setLancando(true)}
            title={aguardando.length === 0 ? 'Nenhum exame aguardando resultado para lançar' : undefined}>
            <Plus aria-hidden /> Lançar resultado
          </Button>
        )}
      </div>

      {planilha.colunas.length === 0 ? (
        <Vazio icone={FlaskConical} titulo="Nenhum valor de exame ainda"
          texto={podeLancar ? 'Os valores aparecem aqui quando o laboratório manda o resultado ou quando você lança à mão um exame aguardando.' : 'Os valores aparecem aqui quando o laboratório manda o resultado.'} />
      ) : (
        <>
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-[1] min-w-48 bg-campo">Parâmetro · unidade · referência</TableHead>
                {planilha.colunas.map((c) => (
                  <TableHead key={c.quando} className="whitespace-nowrap text-right">
                    {diaMesHora(c.quando)}
                    {c.manual && <span className="block text-rotulo font-normal text-tinta-sussurro">à mão</span>}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.flatMap((g) => [
                <TableRow key={`g-${g.exame}`} className="bg-trilha hover:bg-trilha">
                  <TableCell className="sticky left-0 z-[1] bg-trilha font-semibold text-tinta">{g.exame}</TableCell>
                  <TableCell colSpan={planilha.colunas.length} />
                </TableRow>,
                ...g.linhas.map((l) => (
                  <TableRow key={`${g.exame}-${l.analito}`}>
                    <TableCell className="sticky left-0 z-[1] bg-superficie">
                      <span className="text-apoio text-tinta">{l.analito}</span>
                      {l.unidade && <span className="ml-1.5 text-rotulo text-tinta-sussurro">{l.unidade}</span>}
                      {l.referencia && <span className="block text-rotulo text-tinta-sussurro">ref. do laboratório: {l.referencia}</span>}
                    </TableCell>
                    {l.celulas.map((c, k) => (
                      <TableCell key={k} className={`text-right text-apoio tabular-nums ${c?.critico ? 'font-semibold text-critico' : 'text-tinta'}`}>
                        {c ? (
                          <>
                            {c.valor}
                            {c.marca && <span className="ml-1 text-rotulo font-semibold">{c.marca}</span>}
                            {c.critico && <span className="block text-rotulo">crítico (laboratório)</span>}
                          </>
                        ) : <span className="text-tinta-sussurro">—</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                )),
              ])}
            </TableBody>
          </Table>
          <p className="text-rotulo text-tinta-sussurro">
            Valores como vieram, da coleta mais recente para a mais antiga. Unidade, referência e marca só quando o laboratório manda; o app não calcula faixa nem marca valor.
          </p>
        </>
      )}

      {podeLancar && lancando && <LancarResultado aguardando={aguardando} resultados={resultados} aoFechar={() => setLancando(false)} aoGravar={() => { setLancando(false); recarregar() }} />}
    </section>
  )
}

type Linha = { chave: number; analito: string; valor: string }

function LancarResultado({ aguardando, resultados, aoFechar, aoGravar }: {
  aguardando: PedidoLeito[]; resultados: ResultadoLido[]; aoFechar: () => void; aoGravar: () => void
}) {
  const [exame, setExame] = React.useState(aguardando[0]?.id ?? '')
  const [coleta, setColeta] = React.useState(() => dataHoraInput())
  const escolhido = aguardando.find((x) => x.id === exame)
  // os parâmetros já vistos neste paciente para o mesmo exame (nada de lista fixa)
  const conhecidos = analitosConhecidos(resultados, escolhido?.exame)
  const sugeridos = conhecidos.length ? conhecidos : analitosConhecidos(resultados)
  const [linhas, setLinhas] = React.useState<Linha[]>(() => [{ chave: 0, analito: '', valor: '' }])
  const [gravando, setGravando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const proxima = React.useRef(1)

  React.useEffect(() => {
    // trocar o exame sugere os parâmetros dele (vazios), se ainda não há valor digitado
    setLinhas((ls) => ls.some((l) => l.valor.trim())
      ? ls
      : (conhecidos.length ? conhecidos : ['']).map((analito) => ({ chave: proxima.current++, analito, valor: '' })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exame])

  const mudar = (chave: number, d: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...d } : l)))
  const gravar = async () => {
    setErro(null)
    const { itens, erro: problema } = itensDoLancamento(linhas)
    if (problema) return setErro(problema)
    const quando = instanteDoCampo(coleta)
    if (!quando) return setErro('Informe a data e a hora da coleta.')
    if (!exame) return setErro('Escolha o exame.')
    setGravando(true)
    const { error } = await supabase.rpc('registrar_resultado_estruturado', { p_exame: exame, p_coleta_em: quando, p_itens: itens })
    setGravando(false)
    if (error) return setErro(error.message)
    aoGravar()
  }

  return (
    <Gaveta aberta onAbertaChange={(v) => { if (!v) aoFechar() }} rotulo="Lançar resultado">
      <GavetaCabeca sobre="Planilha de exames" titulo="Lançar resultado" detalhe="Os valores como estão no laudo, para a data e a hora da coleta." />
      <div className="flex flex-col gap-3 px-[22px] py-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="lancar-exame">Exame aguardando</Label>
          <CampoSelecao id="lancar-exame" value={exame} onChange={(e) => setExame(e.target.value)}>
            {aguardando.map((x) => <option key={x.id} value={x.id}>{x.exame}</option>)}
          </CampoSelecao>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="lancar-coleta">Data e hora da coleta</Label>
          <Input id="lancar-coleta" type="datetime-local" value={coleta} max={dataHoraInput()} onChange={(e) => setColeta(e.target.value)} />
        </div>
        <datalist id="lancar-analitos">{sugeridos.map((a) => <option key={a} value={a} />)}</datalist>
        <div className="flex flex-col gap-1.5">
          <span className="text-rotulo font-semibold text-tinta-sussurro">Valores</span>
          {linhas.map((l, k) => (
            <div key={l.chave} className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto] items-center gap-1.5">
              <Input aria-label={`Parâmetro ${k + 1}`} list="lancar-analitos" maxLength={80} placeholder="Parâmetro" value={l.analito} onChange={(e) => mudar(l.chave, { analito: e.target.value })} />
              <Input aria-label={`Valor de ${l.analito || `parâmetro ${k + 1}`}`} maxLength={60} placeholder="Valor" value={l.valor} onChange={(e) => mudar(l.chave, { valor: e.target.value })} />
              <Button size="icon-xs" variant="ghost" aria-label={`Tirar ${l.analito || `linha ${k + 1}`}`} disabled={linhas.length === 1}
                onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}><Trash2 aria-hidden /></Button>
            </div>
          ))}
          <Button size="xs" variant="outline" className="self-start" onClick={() => setLinhas((ls) => [...ls, { chave: proxima.current++, analito: '', valor: '' }])}>
            <Plus aria-hidden /> Parâmetro
          </Button>
        </div>
        {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button disabled={gravando || !exame} onClick={() => void gravar()}>Salvar na planilha</Button>
        </div>
      </div>
      <GavetaPe>
        Fica como resultado à mão (transcrição), com seu nome. Unidade, referência e marca não entram à mão: vêm do laboratório quando houver integração.
      </GavetaPe>
    </Gaveta>
  )
}
