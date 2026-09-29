import { useState } from 'react'

import { idadeEmDias, SEM_VALOR_NEONATAL_P2 } from '@/clinico/pediatria/fonteP2'
import {
  DOSES_SRI, EQUIPAMENTO, NOTAS_SRI, equipamentoPorIdade, fichaViaAereaPediatrica, fluxoApneia,
  profundidadeCm, succinilcolinaAplica, tuboPorIdade, type Tubo,
} from '@/clinico/pediatria/viaAerea'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { num, pesoValido } from './formatoP2'
import { Bloco, CampoPesoRn, LinhaDose, LinhaReferencia } from './PecasP2'

function LinhaTubo({ rotulo, t }: { rotulo: string; t: Tubo }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="font-medium">{rotulo}: <span className="tabular-nums">{num(t.calculadoMm, 2)} mm</span> pela fórmula</p>
      <p className="text-tinta-sussurro">
        Tubos vizinhos: {t.vizinhosMm.map((d) => `${num(d, 1)} mm (profundidade ${num(profundidadeCm(d)!, 1)} cm no lábio superior)`).join(' · ')}
      </p>
    </div>
  )
}

/** Via aérea pediátrica: tubo, equipamento por idade e doses da SRI (livro do ICr, caps. 4 e 13). */
export function ViaAereaPediatrica() {
  const [anos, setAnos] = useState(0)
  const [meses, setMeses] = useState(0)
  const [peso, setPeso] = useState(0)
  const [rn, setRn] = useState(false)
  const dias = idadeEmDias(anos, meses) ?? 0
  const temIdade = anos > 0 || meses > 0
  const t = tuboPorIdade(anos)
  const eq = temIdade ? equipamentoPorIdade(dias) : null
  const fluxo = temIdade ? fluxoApneia(dias) : null

  return (
    <ToolLayout
      title="Via aérea pediátrica"
      description="Tubo com e sem cuff e profundidade pela idade, equipamento por idade e peso e doses da sequência rápida — livro do ICr-HCFMUSP."
      ficha={fichaViaAereaPediatrica}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <NumberField id="va-anos" label="Idade — anos completos" unit="anos" value={anos} onChange={setAnos} min={0} max={13} step={1} />
          <NumberField id="va-meses" label="e meses" unit="meses" value={meses} onChange={setMeses} min={0} max={11} step={1} />
        </CardContent>
      </Card>

      {temIdade && (
        <Bloco titulo="Tubo endotraqueal (p. 75)">
          {t ? (
            <>
              <LinhaTubo rotulo="Sem cuff — (idade/4) + 4" t={t.semCuff} />
              <LinhaTubo rotulo="Com cuff — (idade/4) + 3,5" t={t.comCuff} />
              <p className="text-tinta-sussurro">Profundidade = 3 × diâmetro interno, se o tubo for o adequado ao tamanho da criança. O livro não diz como arredondar; a tela mostra o calculado e os tamanhos vizinhos.</p>
            </>
          ) : (
            <p className="text-tinta-sussurro">As fórmulas usam a idade em anos (aqui, de 1 a 13 anos completos). Abaixo de 1 ano, veja a tabela de equipamento.</p>
          )}
          <p className="text-rotulo text-tinta-sussurro">Livro ICr, cap. 4, p. 75. A fórmula sem cuff é a mesma do Anexo 2 do manual HCFMUSP (p. 1494).</p>
        </Bloco>
      )}

      {temIdade && fluxo !== null && (
        <LinhaReferencia rotulo="O₂ por cateter nasal durante a apneia" texto={`${fluxo} L/min (5 L/min abaixo de 1 ano; 10 L/min de 1 a 7 anos; 15 L/min acima de 7).`} pagina="cap. 4, p. 69" />
      )}

      <Bloco titulo="Equipamento por idade e peso (cap. 13, Tabelas 2 e 3)">
        {temIdade && !eq && <p className="text-atencao">A tabela do livro vai até 8–10 anos; acima disso não há linha.</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-tinta-sussurro">
              <tr>{['Idade e peso', 'Máscara O₂', 'Guedel', 'Laringoscópio', 'Tubo', 'Manguito', 'Jelco', 'Sonda gástrica', 'Dreno de tórax', 'Foley', 'Colar'].map((h) => <th key={h} className="px-1.5 py-1 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {EQUIPAMENTO.map((l) => (
                <tr key={l.rotulo} className={cn('border-t', eq === l && 'bg-acao/5 font-medium')}>
                  {[l.rotulo, l.mascaraO2, l.guedel, l.laringoscopio, l.tubo, l.manguito, l.jelco, l.sondaGastrica, l.drenoTorax, l.foley, l.colarCervical].map((v, i) => <td key={i} className="px-1.5 py-1">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-rotulo text-tinta-sussurro">Livro ICr, cap. 13, p. 150–151.</p>
      </Bloco>

      <CampoPesoRn id="va-peso" peso={peso} setPeso={setPeso} rn={rn} setRn={setRn} />
      <Bloco titulo="Sequência rápida — doses (cap. 4, Tabelas 1 e 2)">
        {rn ? (
          <p className="text-tinta-sussurro">{SEM_VALOR_NEONATAL_P2}</p>
        ) : !pesoValido(peso) ? (
          <p className="text-tinta-sussurro">Informe o peso para calcular (acima de 0 e até 80 kg).</p>
        ) : (
          DOSES_SRI.filter((d) => succinilcolinaAplica(d.id, peso)).map((d) => <LinhaDose key={d.id} d={d} peso={peso} />)
        )}
        {!rn && pesoValido(peso) && peso === 10 && <p className="text-atencao">Succinilcolina: a Tabela 2 separa menos de 10 kg e mais de 10 kg; 10 kg exatos não têm linha (errata).</p>}
      </Bloco>

      <Bloco titulo="Do capítulo de SRI">
        {NOTAS_SRI.map((n) => <LinhaReferencia key={n.texto} texto={n.texto} pagina={`cap. 4, ${n.pagina}`} />)}
      </Bloco>
    </ToolLayout>
  )
}
