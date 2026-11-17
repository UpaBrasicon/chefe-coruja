import { useState } from 'react'

import {
  COLUNA_ADULTO_LB, ERRATA_LUND_BROWDER_ADULTO, QUEIMADURA, RECOMENDACOES_ABA, fichaQueimaduraAdulto, reposicaoQueimado, superficieQueimadaAdulto, totalCorpoAdulto, valorRegiaoAdulto,
} from '@/clinico/adulto/queimadura'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { REGIOES_LB } from '@/clinico/pediatria/queimadura'
import { Chip } from '@/components/monitor/Pagina'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'
import { numero } from '@/lib/formato'
import { cn } from '@/lib/utils'

import { Bloco, CampoPeso } from './PecasLoteC'

const ml = (x: number) => numero(Math.round(x))
const pct = (x: number) => numero(Math.round(x * 100) / 100)

const FRACOES: [number, string][] = [
  [0, '0'],
  [0.25, '¼'],
  [0.5, '½'],
  [0.75, '¾'],
  [1, 'toda'],
]

/** Queimadura do adulto: SCQ pelo boneco de frente e costas (Lund e Browder, ICr) e reposição inicial pela ABA 2024. */
export function QueimaduraAdulto() {
  const [peso, setPeso] = useState(0)
  const [fracoes, setFracoes] = useState<Record<string, number>>({})
  const [scqManual, setScqManual] = useState(0)
  const scqLB = superficieQueimadaAdulto(fracoes)
  const scq = scqManual > 0 ? scqManual : scqLB ?? 0
  const r = reposicaoQueimado(peso, scq)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaQueimaduraAdulto.id)
  const origemScq = scqManual > 0 ? 'estimada (informada)' : 'pela Figura 1 (Lund e Browder, coluna Adulto)'

  // Texto do "Copiar" (C4 = A): peso, SCQ e o volume inicial com os limites de vigilância que a tela mostra.
  const copia = r
    ? textoCopia({
        ferramenta: 'Queimadura — superfície queimada e reposição inicial (adulto)',
        dados: [
          ['Peso', `${numeroBr(peso)} kg`],
          ['SCQ', `${pct(scq)}% ${origemScq}`],
        ],
        resultado: r.aplica
          ? [
              `Início a ${QUEIMADURA.inicioMlKgScq} mL/kg/%SCQ: ${ml(r.volume24hMl)} mL em 24 h (ABA 2024, Questão 3, p. 581)`,
              `Só a taxa inicial: titular pela resposta. Para comparação, o Parkland (${QUEIMADURA.parklandMlKgScq} mL/kg/%SCQ) daria ${ml(r.parkland24hMl)} mL.`,
              `Vigilância (pressão intra-abdominal e intraocular) se o volume de 24 h, real ou previsto, se aproximar de ${ml(r.limiteVigilanciaMl)} mL (${r.limiteVigilancia}) (ABA 2024, Questão 10, p. 586).`,
            ]
          : [`A diretriz da ABA 2024 trata de adultos com ${QUEIMADURA.scqMinima}% ou mais de SCQ; abaixo disso, ela não se aplica.`],
        fonte: textoFontes(fichaQueimaduraAdulto),
        versao: fichaQueimaduraAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Queimadura — superfície queimada e reposição inicial (adulto)"
      description="Superfície corporal queimada pelo esquema de Lund e Browder (frente e costas) e volume inicial do choque pela American Burn Association 2024, com os limites que pedem vigilância."
      ficha={fichaQueimaduraAdulto}
    >
      <CampoPeso id="qa-peso" peso={peso} onChange={setPeso} />

      <Bloco
        titulo="Superfície corporal queimada — Lund e Browder, coluna Adulto (ICr, Figura 1, p. 160)"
        descricao="Só entram queimaduras de 2º e 3º graus. Marque a fração de cada superfície atingida, na frente e nas costas."
      >
        <p className="tabular-nums">
          Coluna Adulto: A = {pct(COLUNA_ADULTO_LB.a)} · B = {pct(COLUNA_ADULTO_LB.b)} · C = {pct(COLUNA_ADULTO_LB.c)} · total da coluna {pct(totalCorpoAdulto())}%
        </p>
        <div className="grid gap-2 md:grid-cols-2">
          {REGIOES_LB.map((reg) => (
            <div key={reg.id} className="flex flex-wrap items-center justify-between gap-2 rounded-controle border px-3 py-1.5">
              <span>
                {reg.nome} {reg.face !== 'única' && <span className="text-tinta-sussurro">({reg.face === 'anterior' ? 'frente' : 'costas'})</span>} <span className="text-rotulo text-tinta-sussurro">{pct(valorRegiaoAdulto(reg))}%</span>
              </span>
              <div role="radiogroup" aria-label={`Fração queimada: ${reg.nome}${reg.face !== 'única' ? ` (${reg.face === 'anterior' ? 'frente' : 'costas'})` : ''}`} className="flex gap-1">
                {FRACOES.map(([v, t]) => (
                  <Chip key={t} variante="opcao" radio ativo={(fracoes[reg.id] ?? 0) === v} onClick={() => setFracoes((f) => ({ ...f, [reg.id]: v }))}>
                    {t}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="tabular-nums">SCQ pela Figura 1: <strong>{pct(scqLB ?? 0)}%</strong></p>
        <NumberField id="qa-scq" label="Ou informe a SCQ estimada (substitui a soma acima)" unit="%" value={scqManual} onChange={setScqManual} min={0} max={100} step={0.5} />
        {ERRATA_LUND_BROWDER_ADULTO.map((e) => <p key={e} className="text-apoio text-atencao">Errata: {e}</p>)}
      </Bloco>

      {r && (
        <div role="status" className={cn('rounded-cartao border px-4 py-3', r.aplica ? 'border-fio' : 'border-atencao')}>
          {r.aplica ? (
            <>
              <p className="text-corpo font-semibold text-tinta">Início a {QUEIMADURA.inicioMlKgScq} mL/kg/%SCQ: {ml(r.volume24hMl)} mL em 24 h</p>
              <p className="text-apoio text-tinta-apoio">
                Só a taxa inicial: titular pela resposta. Para comparação, o Parkland ({QUEIMADURA.parklandMlKgScq} mL/kg/%SCQ) daria {ml(r.parkland24hMl)} mL.
                Vigilância (pressão intra-abdominal e intraocular) se o volume de 24 h, real ou previsto, se aproximar de {ml(r.limiteVigilanciaMl)} mL ({r.limiteVigilancia}).
              </p>
            </>
          ) : (
            <p className="text-apoio text-tinta">A diretriz da ABA 2024 trata de adultos com {QUEIMADURA.scqMinima}% ou mais de SCQ; abaixo disso, ela não se aplica.</p>
          )}
        </div>
      )}
      <p className="text-apoio text-tinta-sussurro">A ABA 2024 não traz como dividir o volume nas primeiras horas; a tela não inventa esse dado. A reposição da criança (Parkland do ICr) tem tela própria na Pediatria e não é usada aqui.</p>

      <Bloco titulo="Recomendações da ABA 2024">
        {RECOMENDACOES_ABA.map((x) => <p key={x.texto} className="text-apoio text-tinta-apoio">{x.texto} ({x.pagina})</p>)}
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!r}
        armadilhas={[...ERRATA_LUND_BROWDER_ADULTO.map((e) => `Lund e Browder — errata do livro: ${e}`), ...(guia?.armadilhas ?? [])]}
        ficha={fichaQueimaduraAdulto}
        guia={guia}
      />
      <ResumoFlutuante
        principal={r ? (r.aplica ? `${ml(r.volume24hMl)} mL em 24 h (início a ${QUEIMADURA.inicioMlKgScq} mL/kg/%SCQ)` : `SCQ abaixo de ${QUEIMADURA.scqMinima}%: a ABA 2024 não se aplica`) : scq > 0 ? `SCQ ${pct(scq)}% · informe o peso` : 'Marque a superfície queimada e o peso'}
        detalhe={r ? `Adulto · ${numeroBr(peso)} kg · SCQ ${pct(scq)}%${r.aplica ? ` · vigilância perto de ${ml(r.limiteVigilanciaMl)} mL` : ''}` : undefined}
        tom={r && !r.aplica ? 'atencao' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
