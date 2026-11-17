import { useState } from 'react'

import {
  ERRATA_HIPOGLICEMIA_EV, EV_G_KG, EV_MAX_G, LIMIARES_GLICEMIA, MANUTENCAO_TABELA2, OPCOES_ORAIS, ORAL_REFERENCIA_G, VIG_INICIAL, calcularLinha, fichaHipoglicemiaPed,
  glicoseOralG, glucagonMg, linhaTabela, linhasTexto, taxaDextroseMlH,
} from '@/clinico/pediatria/hipoglicemiaPed'
import { regraPraticaMlH } from '@/clinico/pediatria/manutencao'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, br, faixaBr, idadeAnos, idadePediatrica, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, LinhaLivro, Nota, Opcoes, Pendencia } from './PecasIcr'

/** Hipoglicemia na criança — cap. 51 do Pronto-Socorro ICr-HCFMUSP. */
export function HipoglicemiaPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [vig, setVig] = useState(0)
  const [pct, setPct] = useState(10)
  const idade = idadeAnos(p.anos, p.meses)
  const calc = podeCalcular(p)
  const linhas = calc ? [...(linhasTexto(idade) ?? []), linhaTabela(idade)].filter((l) => l !== null) : []
  const oral = calc ? glicoseOralG(p.peso) : null
  const taxa = calc && vig > 0 ? taxaDextroseMlH(vig, p.peso, pct) : null
  const manut = calc ? regraPraticaMlH(p.peso) : null
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaHipoglicemiaPed.id)

  // Texto do "Copiar" (C3 e C4 = A): dados, via oral, linhas EV, glucagon e infusão de glicose da tela, com a página.
  const copia = calc
    ? textoCopia({
        ferramenta: 'Hipoglicemia — glicose e glucagon por peso (criança)',
        dados: [
          ['Peso', `${numeroBr(p.peso)} kg`],
          ['Idade', `${p.anos} anos e ${p.meses} meses`],
          ['VIG', vig > 0 ? `${numeroBr(vig)} mg/kg/min` : ''],
          ['Dextrose', vig > 0 ? `${pct}%` : ''],
        ],
        resultado: [
          ...(oral !== null ? [`Via oral (consciente e deglutindo): 0,3 g/kg = ${br(oral)} g (p. 510)`] : []),
          `Via EV (PALS no texto: ${EV_G_KG.join(' a ')} g/kg, máximo ${EV_MAX_G} g) (p. 510–511):`,
          ...linhas.map((l) => {
            const r = calcularLinha(l, p.peso)!
            return `- ${l.solucao} (${l.fonte === 'texto' ? 'texto' : 'Tabela 2'}): ${faixaBr(r.ml, 0)} mL = ${faixaBr(r.g, 1)} g${r.limitada ? ' (máximo)' : ''} — ${faixaBr(l.mlKg, 0)} mL/kg${l.maxMl ? ` (máx. ${l.maxMl} mL)` : ''}${l.preparo ? `; preparo: ${l.preparo}` : ''} (${l.pagina})`
          }),
          `- Glucagon IM ou SC (sem via oral e sem acesso venoso): ${br(glucagonMg(p.peso), 1)} mg — 0,5 mg (< 25 kg) ou 1 mg (≥ 25 kg), máximo 1 mg; glicemia a cada 10 a 15 min (p. 510)`,
          ...(taxa !== null ? [`Após a reversão: taxa ${br(taxa)} mL/h de dextrose ${pct}% (VIG × 6 × peso ÷ % de dextrose; p. 510)`] : []),
          ...(manut !== null ? [`Solução de manutenção da Tabela 2: ${br(manut, 0)} mL/h — SG 10% ${MANUTENCAO_TABELA2.sg10Ml} mL + NaCl 20% ${MANUTENCAO_TABELA2.nacl20Ml} mL + KCl 19,1% ${MANUTENCAO_TABELA2.kcl191Ml} mL; manter glicemia ${MANUTENCAO_TABELA2.glicemia.join(' a ')} mg/dL (${MANUTENCAO_TABELA2.pagina})`] : []),
        ],
        fonte: textoFontes(fichaHipoglicemiaPed),
        versao: fichaHipoglicemiaPed.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Hipoglicemia — glicose e glucagon por peso"
      description="Glicose por via oral, bolus EV por idade (texto e Tabela 2), glucagon por peso e velocidade de infusão de glicose, pelo livro do ICr-HCFMUSP. O capítulo não traz valor neonatal."
      ficha={fichaHipoglicemiaPed}
    >
      <CampoPaciente id="hipo" p={p} onChange={setP} />
      <Bloco titulo="Diagnóstico (p. 507–509)">
        <p>
          Tríade de Whipple: sintomas + glicemia venosa total &lt; {LIMIARES_GLICEMIA.sangueTotal} mg/dL ou plasmática/sérica &lt; {LIMIARES_GLICEMIA.plasma} mg/dL + melhora com glicose. Com sintomas, &lt;{' '}
          {LIMIARES_GLICEMIA.comSintomas} mg/dL confirma (p. 509).
        </p>
        <Nota>Coletar a amostra crítica no momento da hipoglicemia, sem adiar o tratamento (p. 509–510).</Nota>
      </Bloco>

      <Pendencia p={p} />

      {calc && oral !== null && (
        <Bloco titulo="Via oral — consciente e deglutindo (p. 510)" descricao={`0,3 g/kg de carboidrato de rápida absorção; o livro põe "(${ORAL_REFERENCIA_G.join(' a ')} g)" ao lado. Sem resposta em 15 min: via EV.`}>
          <p className="tabular-nums">
            0,3 g/kg: <strong>{br(oral)} g</strong>
          </p>
          <ul className="text-tinta-sussurro">
            {OPCOES_ORAIS.map((o) => (
              <li key={o.nome}>
                {o.nome}: {br(o.g)} g por {o.porcao} → ≈ {br(oral / o.g)} × ({o.porcao})
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {calc && (
        <Bloco titulo="Via EV (p. 510–511)" descricao={`PALS no texto: ${EV_G_KG.join(' a ')} g/kg, máximo ${EV_MAX_G} g. Os volumes abaixo respeitam os ${EV_MAX_G} g e os máximos da Tabela 2.`}>
          {linhas.map((l) => {
            const r = calcularLinha(l, p.peso)!
            return (
              <LinhaLivro
                key={`${l.fonte}-${l.solucao}`}
                nome={`${l.solucao} (${l.fonte === 'texto' ? 'texto' : 'Tabela 2'})`}
                texto={`${faixaBr(l.mlKg, 0)} mL/kg${l.maxMl ? ` (máx. ${l.maxMl} mL)` : ''}${l.preparo ? `; preparo: ${l.preparo}` : ''}`}
                conta={
                  <>
                    <strong>{faixaBr(r.ml, 0)} mL</strong> <span className="text-tinta-sussurro">= {faixaBr(r.g, 1)} g</span>
                    {r.limitada && <span className="text-atencao"> (máximo)</span>}
                  </>
                }
                pagina={l.pagina}
              />
            )
          })}
          {ERRATA_HIPOGLICEMIA_EV.map((e) => (
            <Errata key={e} texto={e} />
          ))}
          <LinhaLivro
            nome="Glucagon IM ou SC — sem via oral e sem acesso venoso"
            texto="0,5 mg (< 25 kg) ou 1 mg (≥ 25 kg), máximo 1 mg; glicemia a cada 10 a 15 min"
            conta={<strong>{br(glucagonMg(p.peso), 1)} mg</strong>}
            pagina="p. 510"
          />
        </Bloco>
      )}

      {calc && (
        <Bloco
          titulo="Após a reversão — velocidade de infusão de glicose (p. 510)"
          descricao={`VIG inicial: lactentes ${VIG_INICIAL.lactente.join(' a ')} mg/kg/min; crianças mais velhas ${VIG_INICIAL.criancaMaior.join(' a ')} mg/kg/min. Taxa (mL/h) = VIG × 6 × peso ÷ % de dextrose.`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField id="hipo-vig" label="VIG" unit="mg/kg/min" value={vig} onChange={setVig} step={0.5} />
            <Opcoes label="Dextrose" valor={pct} opcoes={[[5, '5%'], [10, '10%']]} onChange={setPct} />
          </div>
          {taxa !== null && (
            <p className="tabular-nums">
              Taxa: <strong>{br(taxa)} mL/h</strong> de dextrose {pct}%
            </p>
          )}
          <LinhaLivro
            nome="Solução de manutenção da Tabela 2"
            texto={`SG 10% ${MANUTENCAO_TABELA2.sg10Ml} mL + NaCl 20% ${MANUTENCAO_TABELA2.nacl20Ml} mL + KCl 19,1% ${MANUTENCAO_TABELA2.kcl191Ml} mL; manter glicemia ${MANUTENCAO_TABELA2.glicemia.join(' a ')} mg/dL; velocidade pela regra prática`}
            conta={manut !== null && <strong>{br(manut, 0)} mL/h</strong>}
            pagina={MANUTENCAO_TABELA2.pagina}
          />
        </Bloco>
      )}
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc}
        armadilhas={[...ERRATA_HIPOGLICEMIA_EV.map((e) => `Errata do livro: ${e}`), ...(guia?.armadilhas ?? [])]}
        ficha={fichaHipoglicemiaPed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? `Criança · ${numeroBr(p.peso)} kg${p.anos > 0 || p.meses > 0 ? ` · ${p.anos} a ${p.meses} m` : ''}` : p.rn ? 'Recém-nascido: sem valor neonatal no capítulo' : idadePediatrica(p.anos, p.meses) ? 'Informe o peso' : 'A partir de 14 anos é adulto: ferramenta pediátrica'}
        detalhe={calc && oral !== null ? `Via oral ${br(oral)} g · glucagon ${br(glucagonMg(p.peso), 1)} mg; "Copiar" leva as linhas EV.` : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
