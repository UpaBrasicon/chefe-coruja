import { useState } from 'react'

import { calcularDose, idadeEmDias, SEM_VALOR_NEONATAL_P2, type DosePeso } from '@/clinico/pediatria/fonteP2'
import { textoFontes } from '@/clinico/ficha'
import {
  DOSES_SRI, EQUIPAMENTO, NOTAS_SRI, equipamentoPorIdade, fichaViaAereaPediatrica, fluxoApneia,
  profundidadeCm, succinilcolinaAplica, tuboPorIdade, type Tubo,
} from '@/clinico/pediatria/viaAerea'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { faixaTxt, num, pesoValido } from './formatoP2'
import { Bloco, CampoPesoRn, LinhaDose, LinhaReferencia } from './PecasP2'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Linha do "Copiar": a mesma conta da LinhaDose (PecasP2). */
function doseP2Txt(d: DosePeso, peso: number): string[] {
  const r = calcularDose(d, peso)
  if (!r) return []
  return [`- ${d.nome}: ${faixaTxt(r.dose)} ${d.unidade}${r.volumeMl && d.unidade !== 'mL' ? ` · ${faixaTxt(r.volumeMl)} mL` : ''}${r.noMaximo ? ' (limitado ao máximo do livro)' : ''} · ${d.via} (${d.pagina})`]
}

const tuboTxt = (rotulo: string, t: Tubo) =>
  `${rotulo}: ${num(t.calculadoMm, 2)} mm pela fórmula; vizinhos ${t.vizinhosMm.map((d) => `${num(d, 1)} mm (profundidade ${num(profundidadeCm(d)!, 1)} cm no lábio superior)`).join(' · ')} (cap. 4, p. 75)`

function LinhaTubo({ rotulo, t }: { rotulo: string; t: Tubo }) {
  return (
    <div className="rounded-controle border px-3 py-2">
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
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaViaAereaPediatrica.id)
  const doses = !rn && pesoValido(peso)
  const temConta = temIdade || doses
  const idadeTxt = temIdade ? `${anos} a ${meses} m` : ''

  // Texto do "Copiar" (C3 e C4 = A): tubo, equipamento da faixa e doses da SRI que estão na tela, com a página do livro.
  const copia = () =>
    textoCopia({
      ferramenta: 'Via aérea pediátrica (PS Pediatria ICr-HCFMUSP)',
      dados: [
        ['Idade', temIdade ? `${anos} anos e ${meses} meses` : ''],
        ['Peso', peso > 0 ? `${numeroBr(peso)} kg` : ''],
        ['Recém-nascido', rn ? 'sim' : ''],
      ],
      resultado: [
        ...(temIdade && t ? [tuboTxt('Tubo sem cuff — (idade/4) + 4', t.semCuff), tuboTxt('Tubo com cuff — (idade/4) + 3,5', t.comCuff)] : []),
        ...(temIdade && fluxo !== null ? [`O₂ por cateter nasal durante a apneia: ${fluxo} L/min (cap. 4, p. 69)`] : []),
        ...(eq
          ? [`Equipamento (${eq.rotulo}): máscara O₂ ${eq.mascaraO2}; Guedel ${eq.guedel}; laringoscópio ${eq.laringoscopio}; tubo ${eq.tubo}; manguito ${eq.manguito}; jelco ${eq.jelco}; sonda gástrica ${eq.sondaGastrica}; dreno de tórax ${eq.drenoTorax}; Foley ${eq.foley}; colar ${eq.colarCervical} (cap. 13, p. 150–151)`]
          : []),
        ...(doses
          ? [
              'Sequência rápida (cap. 4, Tabelas 1 e 2):',
              ...DOSES_SRI.filter((d) => succinilcolinaAplica(d.id, peso)).flatMap((d) => doseP2Txt(d, peso)),
              ...(peso === 10 ? ['Succinilcolina: a Tabela 2 separa menos de 10 kg e mais de 10 kg; 10 kg exatos não têm linha (errata).'] : []),
            ]
          : []),
      ],
      fonte: textoFontes(fichaViaAereaPediatrica),
      versao: fichaViaAereaPediatrica.versao,
      quando: new Date(),
    })

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
          <Table variante="referencia" className="w-full min-w-[720px] text-left text-rotulo">
            <TableHeader className="text-tinta-sussurro">
              <TableRow>{['Idade e peso', 'Máscara O₂', 'Guedel', 'Laringoscópio', 'Tubo', 'Manguito', 'Jelco', 'Sonda gástrica', 'Dreno de tórax', 'Foley', 'Colar'].map((h) => <TableHead key={h} className="px-1.5 py-1 font-medium">{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {EQUIPAMENTO.map((l) => (
                <TableRow key={l.rotulo} className={cn('border-t', eq === l && 'bg-acao/5 font-medium')}>
                  {[l.rotulo, l.mascaraO2, l.guedel, l.laringoscopio, l.tubo, l.manguito, l.jelco, l.sondaGastrica, l.drenoTorax, l.foley, l.colarCervical].map((v, i) => <TableCell key={i} className="px-1.5 py-1">{v}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temConta}
        armadilhas={[...(guia?.armadilhas ?? [])]}
        ficha={fichaViaAereaPediatrica}
        guia={guia}
      />
      <ResumoFlutuante
        principal={temIdade && t ? `Tubo ${num(t.semCuff.calculadoMm, 2)} mm sem cuff · ${num(t.comCuff.calculadoMm, 2)} mm com cuff` : temIdade ? `Criança · ${idadeTxt}` : doses ? `Criança · ${numeroBr(peso)} kg` : 'Informe a idade e o peso'}
        detalhe={temConta ? [temIdade && t ? idadeTxt : '', doses ? `${numeroBr(peso)} kg · doses da SRI acima` : ''].filter(Boolean).join(' · ') || undefined : undefined}
        textoCopia={temConta ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
