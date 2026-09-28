import { useState } from 'react'

import {
  ANIMAIS, NOTAS_PECONHENTOS, TABELA_SORO, expansaoEscorpiaoMl, fichaPeconhentosPed, prednisonaLoxoscelesMgDia, volumeSaarMl, type Animal, type Gravidade,
} from '@/clinico/pediatria/peconhentosPed'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

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
          <LinhaLivro nome="Prednisona" conta={<strong>{br(prednisonaLoxoscelesMgDia(p.peso), 1)} mg/dia</strong>} texto="crianças 1 mg/kg/dia durante 5 dias (adultos 40 mg/dia — não usado como teto na criança)" pagina="p. 214" />
        </Bloco>
      )}
      {calc && p.peso > 0 && animal === 'escorpiao' && (
        <Bloco titulo="Choque no acidente escorpiônico (p. 211)">
          <LinhaLivro nome="Expansão com cristaloide" conta={<strong>{br(expansaoEscorpiaoMl(p.peso), 0)} mL</strong>} texto="expansão de 5 mL/kg e observar a volemia; balanço hídrico rigoroso" pagina="p. 211" />
        </Bloco>
      )}

      <Bloco titulo="Notas do capítulo">
        {NOTAS_PECONHENTOS.map((n) => (
          <p key={n.texto} className="text-muted-foreground">
            {n.texto} ({n.pagina})
          </p>
        ))}
      </Bloco>
    </ToolLayout>
  )
}
