import { useState } from 'react'

import {
  ANIMAIS, DIFERENCAS_MS_2026, MS_ARANHAS_TABELA, NOTAS_PECONHENTOS, PCDT_ESCORPIAO, TABELA_SORO, expansaoEscorpiaoMl, fichaPeconhentosPed, prednisonaLoxoscelesMgDia, volumeSaarMl,
  type Animal, type Gravidade,
} from '@/clinico/pediatria/peconhentosPed'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, br, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, LinhaLivro, Nota, Opcoes, Pendencia } from './PecasIcr'

/** Escorpião e aranhas — soro pela gravidade escolhida pelo médico (cap. 19 do livro do ICr). */
export function PeconhentosPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [animal, setAnimal] = useState<Animal>('escorpiao')
  const [grav, setGrav] = useState<Gravidade>('moderado')
  const linha = TABELA_SORO[animal][grav]
  const calc = !p.rn && idadePediatrica(p.anos, p.meses)
  const saar = linha.ampolas && linha.soro !== 'soro antilatrodéctico (SALatr)'
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaPeconhentosPed.id)
  const resultadoLivro = linha.ampolas ? `${linha.soro}: ${faixaBr(linha.ampolas, 0)} ampola(s)${saar ? ` · ${faixaBr(volumeSaarMl(linha.ampolas), 0)} mL` : ''}` : 'Sem soro nesta classe'
  const pcdt = animal === 'escorpiao' ? PCDT_ESCORPIAO.ampolas[grav] : null
  const arMs = animal === 'loxosceles' ? MS_ARANHAS_TABELA.loxosceles : animal === 'phoneutria' ? MS_ARANHAS_TABELA.phoneutria : null
  const arMsSoro = animal === 'loxosceles' ? MS_ARANHAS_TABELA.loxoscelesSoro : MS_ARANHAS_TABELA.phoneutriaSoro

  // Texto do "Copiar" (C4 = A): dados, a classe escolhida pelo médico, o soro do livro, o que o MS traz e as medidas do peso, com a página.
  const copia = calc
    ? textoCopia({
        ferramenta: 'Escorpião e aranhas — soro por gravidade (criança)',
        dados: [
          ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
          ['Idade', `${p.anos} anos e ${p.meses} meses`],
          ['Animal', ANIMAIS[animal]],
          ['Gravidade (avaliação do médico)', grav],
        ],
        resultado: [
          `Livro do ICr: ${linha.ampolas ? `${faixaBr(linha.ampolas, 0)} ampola(s) ${linha.via}. ` : ''}${linha.outros} (${linha.pagina})`,
          ...(linha.idade ? [linha.idade] : []),
          ...(saar ? ['SAAr: 1 ampola = 5 mL; 1 mL neutraliza 1,5 dose mínima mortal (p. 212).'] : []),
          ...(p.peso > 0 && animal === 'loxosceles' && grav !== 'leve' ? [`Prednisona: ${br(prednisonaLoxoscelesMgDia(p.peso), 1)} mg/dia — crianças 1 mg/kg/dia durante 5 dias (Tabela 3, p. 214)`] : []),
          ...(p.peso > 0 && animal === 'escorpiao' ? [`Choque no acidente escorpiônico: expansão com cristaloide ${br(expansaoEscorpiaoMl(p.peso), 0)} mL — expansão de 5 mL/kg e observar a volemia; balanço hídrico rigoroso (p. 211)`] : []),
          ...(animal === 'escorpiao'
            ? [`PCDT 2026 (MS), escorpião ${grav}: ${pcdt ? `${faixaBr(pcdt, 0)} frasco(s)-ampola` : 'sem soro'} — ${PCDT_ESCORPIAO.soro}; máximo ${PCDT_ESCORPIAO.maximo}, independentemente da idade. Via: ${PCDT_ESCORPIAO.via}. (Quadro 4, p. 17)`]
            : []),
          ...(arMs ? arMs.map((l) => `Portal do MS — ${l.forma} (${l.clinica}): ${l.ampolas ? `${faixaBr(l.ampolas, 0)} ampola(s) de ${arMsSoro}` : 'sem soro'}.`) : []),
          ...(animal === 'latrodectus' ? [`Portal do MS: ${MS_ARANHAS_TABELA.latrodectus}.`] : []),
        ],
        fonte: textoFontes(fichaPeconhentosPed),
        versao: fichaPeconhentosPed.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Escorpião e aranhas — soro por gravidade"
      description="Classe de gravidade escolhida pelo médico → número de ampolas das tabelas do livro do ICr-HCFMUSP, volume do SAAr e medidas associadas. A ferramenta não classifica o acidente."
      ficha={fichaPeconhentosPed}
    >
      <CampoPaciente id="pec" p={p} onChange={setP} />
      <Bloco titulo="Acidente">
        <Opcoes label="Animal" valor={animal} opcoes={(Object.keys(ANIMAIS) as Animal[]).map((a) => [a, ANIMAIS[a]])} onChange={setAnimal} />
        <Opcoes label="Gravidade (avaliação do médico)" valor={grav} opcoes={[['leve', 'Leve'], ['moderado', 'Moderado'], ['grave', 'Grave']]} onChange={setGrav} />
      </Bloco>

      <Bloco titulo={`${ANIMAIS[animal]} — ${grav}`} descricao={linha.clinica}>
        {p.rn ? (
          <Pendencia p={p} precisaPeso={false} />
        ) : calc ? (
          <LinhaLivro
            nome={linha.ampolas ? `${linha.soro}` : 'Sem soro nesta classe'}
            conta={
              linha.ampolas ? (
                <strong>
                  {faixaBr(linha.ampolas, 0)} ampola(s){saar && ` · ${faixaBr(volumeSaarMl(linha.ampolas), 0)} mL`}
                </strong>
              ) : undefined
            }
            texto={`${linha.ampolas ? `${faixaBr(linha.ampolas, 0)} ampola(s) ${linha.via}. ` : ''}${linha.outros}`}
            pagina={linha.pagina}
            nota={linha.idade}
          />
        ) : null}
        {saar && <Nota>SAAr: 1 ampola = 5 mL; 1 mL neutraliza 1,5 dose mínima mortal (p. 212).</Nota>}
      </Bloco>

      {calc && p.peso > 0 && animal === 'loxosceles' && grav !== 'leve' && (
        <Bloco titulo="Prednisona (Tabela 3, p. 214)">
          <LinhaLivro nome="Prednisona" conta={<strong>{br(prednisonaLoxoscelesMgDia(p.peso), 1)} mg/dia</strong>} texto="crianças 1 mg/kg/dia durante 5 dias" pagina="p. 214" />
        </Bloco>
      )}
      {calc && p.peso > 0 && animal === 'escorpiao' && (
        <Bloco titulo="Choque no acidente escorpiônico (p. 211)">
          <LinhaLivro nome="Expansão com cristaloide" conta={<strong>{br(expansaoEscorpiaoMl(p.peso), 0)} mL</strong>} texto="expansão de 5 mL/kg e observar a volemia; balanço hídrico rigoroso" pagina="p. 211" />
        </Bloco>
      )}

      {animal === 'escorpiao' && (
        <Bloco titulo="PCDT dos Acidentes Escorpiônicos — MS 2026" descricao={`Fonte do MS decidida pelo RT em 28/09/2026 (${PCDT_ESCORPIAO.pagina}).`}>
          <LinhaLivro
            nome={`Escorpião ${grav} — PCDT 2026`}
            conta={PCDT_ESCORPIAO.ampolas[grav] ? <strong>{faixaBr(PCDT_ESCORPIAO.ampolas[grav]!, 0)} frasco(s)-ampola</strong> : <strong>sem soro</strong>}
            texto={`${PCDT_ESCORPIAO.soro}; máximo ${PCDT_ESCORPIAO.maximo}, independentemente da idade. Via: ${PCDT_ESCORPIAO.via}.`}
            pagina="Quadro 4, p. 17"
          />
          <p className="text-tinta-sussurro">Observação: sem clínica {PCDT_ESCORPIAO.observacao.semClinica}; leve {PCDT_ESCORPIAO.observacao.leve}; com soro {PCDT_ESCORPIAO.observacao.comSoro} (Quadro 3, p. 9; p. 15). {PCDT_ESCORPIAO.risco} (p. 10).</p>
        </Bloco>
      )}
      {animal !== 'escorpiao' && (
        <Bloco titulo="Portal do Ministério da Saúde — aranhas" descricao="Tabela adaptada do Manual 2001 e do Ofício Circular 2/2014, consultada em 28/09/2026.">
          {animal === 'loxosceles' && MS_ARANHAS_TABELA.loxosceles.map((l) => (
            <p key={l.forma}><strong>{l.forma}</strong> ({l.clinica}): {l.ampolas ? `${faixaBr(l.ampolas, 0)} ampola(s) de ${MS_ARANHAS_TABELA.loxoscelesSoro}` : 'sem soro'}.</p>
          ))}
          {animal === 'phoneutria' && MS_ARANHAS_TABELA.phoneutria.map((l) => (
            <p key={l.forma}><strong>{l.forma}</strong> ({l.clinica}): {l.ampolas ? `${faixaBr(l.ampolas, 0)} ampola(s) de ${MS_ARANHAS_TABELA.phoneutriaSoro}` : 'sem soro'}.</p>
          ))}
          {animal === 'latrodectus' && <p className="text-atencao">{MS_ARANHAS_TABELA.latrodectus}.</p>}
        </Bloco>
      )}

      <Bloco titulo="Notas do capítulo">
        {NOTAS_PECONHENTOS.map((n) => (
          <p key={n.texto} className="text-tinta-sussurro">
            {n.texto} ({n.pagina})
          </p>
        ))}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc}
        armadilhas={guia?.armadilhas ?? []}
        ficha={fichaPeconhentosPed}
        guia={guia}
        comparacao={
          <BlocoComparacao titulo="Livro do ICr × MS (PCDT 2026 e portal)">
            <ul className="list-disc pl-5 text-tinta-sussurro">{DIFERENCAS_MS_2026.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={p.rn ? 'Recém-nascido: sem valor neonatal no capítulo' : calc ? `${ANIMAIS[animal]} ${grav}: ${resultadoLivro}` : 'A partir de 14 anos é adulto: ferramenta pediátrica'}
        detalhe={calc ? (animal === 'escorpiao' ? `Livro do ICr · PCDT 2026: ${pcdt ? `${faixaBr(pcdt, 0)} frasco(s)-ampola` : 'sem soro'}` : 'Livro do ICr; o portal do MS vem ao lado, na tela.') : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
