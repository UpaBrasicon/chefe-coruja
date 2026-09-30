import { useState } from 'react'

import {
  CARGA_ADULTO, DIRETRIZ_PALS_2025, DROGAS_RCP, FAIXAS_RCP, GRUPOS_RCP, NOTAS_CHOQUE, OUTROS_PARAMETROS,
  cargasPorPeso, fichaRcpPediatrica, metaPadRcp2025, parametrosRcp, type FaixaRcp, type GrupoRcp,
} from '@/clinico/pediatria/rcp'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { faixaTxt, num, pesoValido } from './formatoP2'
import { AvisoRn, Bloco, CampoPesoRn, LinhaDose, LinhaReferencia, PesoInvalido } from './PecasP2'

const botao = (ativo: boolean) =>
  cn('rounded-lg border px-3 py-2 text-left text-sm transition-colors', ativo ? 'border-acao bg-acao/5 ring-1 ring-acao' : 'hover:bg-trilha/50')

/** RCP pediátrica: parâmetros, cargas de choque e drogas (livro do ICr, caps. 1 e 2). */
export function RcpPediatrica() {
  const [faixa, setFaixa] = useState<FaixaRcp>('crianca')
  const [peso, setPeso] = useState(0)
  const [rn, setRn] = useState(false)
  const p = parametrosRcp(faixa)
  const c = pesoValido(peso) ? cargasPorPeso(peso) : null

  return (
    <ToolLayout
      title="RCP pediátrica"
      description="Compressão e ventilação por faixa, cargas de desfibrilação e cardioversão por peso e drogas da PCR — livro do ICr-HCFMUSP."
      ficha={fichaRcpPediatrica}
    >
      <Card>
        <CardContent className="flex flex-col gap-2 pt-6">
          <p className="text-sm font-semibold">Faixa do suporte básico</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(FAIXAS_RCP) as FaixaRcp[]).map((f) => (
              <button key={f} type="button" aria-pressed={faixa === f} onClick={() => setFaixa(f)} className={botao(faixa === f)}>{FAIXAS_RCP[f]}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Bloco titulo="Compressão e ventilação">
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
          {([['Frequência', p.frequencia], ['Profundidade', p.profundidade], ['Relação compressão:ventilação', p.relacao], ['Com via aérea avançada', p.viaAereaAvancada], ['Pulso', p.pulso], ['Técnica', p.tecnica]] as const).map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-tinta-sussurro">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <p className="text-rotulo text-tinta-sussurro">Livro ICr, {p.pagina}.</p>
        {OUTROS_PARAMETROS.map((o) => <LinhaReferencia key={o.rotulo} rotulo={o.rotulo} texto={o.valor} pagina={o.pagina} />)}
      </Bloco>

      <CampoPesoRn id="rcp-peso" peso={peso} setPeso={setPeso} rn={rn} setRn={setRn} />
      {rn ? <AvisoRn /> : !c ? <PesoInvalido /> : (
        <>
          <Bloco titulo="Cargas pelo peso">
            <dl className="grid gap-x-4 gap-y-1 tabular-nums sm:grid-cols-[auto_1fr]">
              <dt className="text-tinta-sussurro">FV/TV sem pulso — 1º choque (2 J/kg)</dt><dd><strong>{num(c.primeiro, 1)} J</strong></dd>
              <dt className="text-tinta-sussurro">2º choque (4 J/kg)</dt><dd><strong>{num(c.segundo, 1)} J</strong></dd>
              <dt className="text-tinta-sussurro">Seguintes (4 a 10 J/kg)</dt><dd><strong>{faixaTxt(c.subsequentes, 1)} J</strong> ou a dose máxima de adulto ({faixaTxt(CARGA_ADULTO.bifasico, 0)} J bifásico; {CARGA_ADULTO.monofasico} J monofásico)</dd>
              <dt className="text-tinta-sussurro">Cardioversão TSV — inicial (0,5 a 1 J/kg)</dt><dd><strong>{faixaTxt(c.cardioversaoInicial, 1)} J</strong></dd>
              <dt className="text-tinta-sussurro">Cardioversão TSV — se persistir (1 a 2 J/kg)</dt><dd><strong>{faixaTxt(c.cardioversaoSeguinte, 1)} J</strong></dd>
            </dl>
            {c.acimaDoAdulto && <p className="text-atencao">A ponta de cima dos choques seguintes passa de {CARGA_ADULTO.bifasico[1]} J, a carga máxima bifásica de adulto citada no livro.</p>}
            {NOTAS_CHOQUE.map((n) => <LinhaReferencia key={n.texto} texto={n.texto} pagina={n.pagina} />)}
          </Bloco>
          {(Object.keys(GRUPOS_RCP) as GrupoRcp[]).map((g) => (
            <Bloco key={g} titulo={GRUPOS_RCP[g]}>
              {DROGAS_RCP.filter((d) => d.grupo === g).map((d) => <LinhaDose key={d.id} d={d} peso={peso} />)}
            </Bloco>
          ))}
        </>
      )}
      <Bloco titulo="AHA/AAP 2025 × livro do ICr">
        <p className="text-sm text-tinta-sussurro">Destaques oficiais das diretrizes 2025 (p. 11–15); o texto integral do Part 8 não foi aberto. Com linha arterial na RCP, a diretriz mira PAD ≥ {metaPadRcp2025(faixa)} mmHg para a faixa escolhida.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left align-top text-sm">
            <thead className="text-tinta-sussurro"><tr><th className="pr-3 pb-2">Tema</th><th className="pr-3 pb-2">AHA/AAP 2025</th><th className="pr-3 pb-2">Estado · p.</th><th className="pb-2">Livro do ICr</th></tr></thead>
            <tbody>
              {DIRETRIZ_PALS_2025.map((d) => (
                <tr key={d.tema} className="border-t">
                  <td className="pr-3 py-2 font-medium">{d.tema}</td>
                  <td className="pr-3 py-2">{d.aha}</td>
                  <td className="pr-3 py-2 whitespace-nowrap text-tinta-sussurro">{d.estado} · {d.pagina}</td>
                  <td className="py-2 text-tinta-sussurro">{d.livro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
    </ToolLayout>
  )
}
