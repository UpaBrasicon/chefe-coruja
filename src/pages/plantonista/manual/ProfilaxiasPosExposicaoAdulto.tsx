import { useState } from 'react'

import {
  ACIDENTE_RAIVA, ANIMAL_RAIVA, FERIMENTO_TETANO, FONTE_HBV, HBV, HISTORICO_TETANO, IMUNOGLOBULINA_PROFILAXIA, RAIVA, RISCO_FONTE_HBV,
  SITUACAO_HBV, TABELA5_TETANO, TRATAMENTO_TETANO, fichaHepatiteBAdulto, fichaRaivaAdulto, fichaTetanoAdulto, hbigMl,
  profilaxiaHepatiteB, profilaxiaRaiva, profilaxiaTetano, tratamentoTetanoPorPeso,
  type AcidenteRaiva, type AnimalRaiva, type ContatoRaiva, type FerimentoTetano, type FonteHbv, type HistoricoVacinalTetano,
  type SituacaoProfissional,
} from '@/clinico/adulto/profilaxiaPosExposicao'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Escolha } from './LoteAPecas'
import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const simNao = (b: boolean) => (b ? 'sim' : 'não')

/** Tétano: profilaxia por ferimento × histórico vacinal (Anexo 7) e tratamento do tétano acidental (cap. 93). */
export function TetanoProfilaxiaAdulto() {
  const [peso, setPeso] = useState(0)
  const [historico, setHistorico] = useState<HistoricoVacinalTetano>('incerta')
  const [ferimento, setFerimento] = useState<FerimentoTetano>('limpo')
  const p = profilaxiaTetano(historico, ferimento)
  const t = tratamentoTetanoPorPeso(peso)
  const tt = TRATAMENTO_TETANO

  return (
    <ToolLayout
      title="Tétano — profilaxia e tratamento (adulto)"
      description="Vacina e SAT/IGHAT pelo ferimento e pelo histórico vacinal (Anexo 7), e doses do tratamento do tétano acidental pelo manual do HC. Adulto (14 anos ou mais)."
      ficha={fichaTetanoAdulto}
    >
      <Bloco titulo="Profilaxia no ferimento (Anexo 7, p. 1511)">
        <Escolha label="História de vacinação contra tétano" value={historico} onChange={setHistorico} opcoes={HISTORICO_TETANO} />
        <Escolha label="Ferimento" value={ferimento} onChange={setFerimento} opcoes={FERIMENTO_TETANO} />
        <LinhaManual
          nome="O que a tabela traz para essa combinação"
          texto={`vacina: ${simNao(p.vacina)}; SAT ou IGHAT: ${simNao(p.imunoglobulina)}. ${IMUNOGLOBULINA_PROFILAXIA.sat}; ${IMUNOGLOBULINA_PROFILAXIA.ighat}`}
          pagina={IMUNOGLOBULINA_PROFILAXIA.pagina}
          conta={<><strong>Vacina: {simNao(p.vacina)}</strong> · <strong>SAT/IGHAT: {simNao(p.imunoglobulina)}</strong></>}
          errata={TABELA5_TETANO.errata}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="pb-1 text-left text-muted-foreground">Tabela 5 do cap. 93 ({TABELA5_TETANO.pagina}), para comparação</caption>
            <thead>
              <tr><th className="pr-2">Ferimento</th>{TABELA5_TETANO.colunas.map((c) => <th key={c} className="pr-2">{c}</th>)}</tr>
            </thead>
            <tbody>
              {TABELA5_TETANO.linhas.map((l) => (
                <tr key={l.ferimento} className="border-t align-top">
                  <td className="pr-2 font-medium">{l.ferimento}</td>
                  {l.celulas.map((c, i) => <td key={i} className="pr-2">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>

      <CampoPeso id="tet-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Tétano acidental — tratamento (cap. 93)" descricao="Internação em UTI; as doses abaixo são as que o manual traz.">
        <LinhaManual nome="Imunoglobulina" texto={tt.imunoglobulina.texto} pagina={tt.imunoglobulina.pagina} />
        <LinhaManual nome="Antibióticos" texto={tt.antibioticos.texto} pagina={tt.antibioticos.pagina} />
        <LinhaManual nome="Espasmos" texto={tt.espasmos.texto} pagina={tt.espasmos.pagina} errata={tt.espasmos.errata} />
        <LinhaManual nome="Bloqueio neuromuscular" texto={tt.bnm.texto} pagina={tt.bnm.pagina}
          conta={t ? <>rocurônio <strong>{br(t.rocuronioMg, 0)} mg</strong> · vecurônio {br(t.vecuronioPrimingMg, 2)} mg → <strong>{br(t.vecuronioMg)} mg</strong></> : 'informe o peso'} />
        <LinhaManual nome="Sulfato de magnésio" texto={tt.magnesio.texto} pagina={tt.magnesio.pagina}
          conta={t ? <>ataque <strong>{br(t.magnesioAtaqueG, 2)} g</strong> em 30 min · <strong>{br(t.magnesioManutencaoGH)} g/h</strong></> : 'informe o peso'} />
        <LinhaManual nome="Disautonomia" texto={tt.disautonomia.texto} pagina={tt.disautonomia.pagina} errata={tt.disautonomia.errata} />
        <LinhaManual nome="Evolução desfavorável" texto={tt.fatoresRisco.texto} pagina={tt.fatoresRisco.pagina} />
      </Bloco>
    </ToolLayout>
  )
}

/** Raiva: fluxograma de profilaxia pós-exposição do Anexo 4. */
export function RaivaPosExposicaoAdulto() {
  const [contato, setContato] = useState<ContatoRaiva>('direto')
  const [acidente, setAcidente] = useState<AcidenteRaiva>('leve')
  const [animal, setAnimal] = useState<AnimalRaiva>('sem-suspeita')
  const [area, setArea] = useState<'sim' | 'nao' | ''>('')
  const precisaArea = contato === 'direto' && acidente === 'grave' && animal === 'sem-suspeita'
  const r = profilaxiaRaiva(contato, acidente, animal, area === '' ? null : area === 'sim')

  return (
    <ToolLayout
      title="Raiva — profilaxia pós-exposição (adulto)"
      description="Fluxograma do Anexo 4 do manual do HC: tipo de contato, gravidade do acidente e animal → vacina, sorovacinação ou observação. Adulto (14 anos ou mais)."
      ficha={fichaRaivaAdulto}
    >
      <Bloco titulo="Exposição (Anexo 4, p. 1497)">
        <Escolha label="Contato" value={contato} onChange={setContato}
          opcoes={[{ value: 'direto', label: 'Direto' }, { value: 'indireto-morcego', label: 'Indireto com morcego' }]} />
        {contato === 'direto' && (
          <>
            <Escolha label="Acidente" value={acidente} onChange={setAcidente} opcoes={[{ value: 'leve', label: 'Leve' }, { value: 'grave', label: 'Grave' }]} />
            <p className="text-sm text-muted-foreground">Leve: {ACIDENTE_RAIVA.leve}. Grave: {ACIDENTE_RAIVA.grave}.</p>
            <Escolha label="Animal" value={animal} onChange={setAnimal} opcoes={ANIMAL_RAIVA} />
            {precisaArea && (
              <Escolha label="Área de raiva controlada, animal só doméstico ou que só sai acompanhado, sem contato com outros animais?" value={area} onChange={setArea}
                opcoes={[{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não ou dúvida' }]} />
            )}
          </>
        )}
        <LinhaManual
          nome="O que o fluxograma traz"
          texto={r ? r.texto : 'responda à pergunta sobre a área e o animal'}
          pagina={RAIVA.pagina}
          conta={r ? <strong>{r.texto}</strong> : undefined}
          nota={RAIVA.nota}
        />
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          <li>Vacina (4 doses): {RAIVA.vacina4}.</li>
          <li>Vacina (2 doses): {RAIVA.vacina2}.</li>
          {r?.observar10Dias && <li>Observação: {RAIVA.observacao}.</li>}
          <li>Animais de interesse econômico: {RAIVA.interesseEconomico}. Contato indireto: {RAIVA.contatoIndireto}.</li>
        </ul>
      </Bloco>
    </ToolLayout>
  )
}

/** Hepatite B após exposição ocupacional a material biológico (Anexo 6). */
export function HepatiteBPosExposicaoAdulto() {
  const [peso, setPeso] = useState(0)
  const [fonte, setFonte] = useState<FonteHbv>('positivo-ou-risco')
  const [situacao, setSituacao] = useState<SituacaoProfissional>('nao-vacinado')
  const c = profilaxiaHepatiteB(fonte, situacao)
  const ml = hbigMl(peso)
  const mostraHbig = c.dosesHbig > 0 || c.hbigSeAntiHbsBaixo

  return (
    <ToolLayout
      title="Hepatite B — profilaxia pós-exposição ocupacional (adulto)"
      description="Anexo 6 do manual do HC: situação do paciente-fonte × situação vacinal do profissional exposto, com o volume de HBIG por peso. Adulto (14 anos ou mais)."
      ficha={fichaHepatiteBAdulto}
    >
      <CampoPeso id="hbv-peso" peso={peso} onChange={setPeso} />
      <Bloco titulo="Exposição ocupacional (Anexo 6, p. 1504–1510)" descricao={`Fonte com risco: ${RISCO_FONTE_HBV}.`}>
        <Escolha label="Paciente-fonte" value={fonte} onChange={setFonte} opcoes={FONTE_HBV} />
        <Escolha label="Profissional exposto" value={situacao} onChange={setSituacao} opcoes={SITUACAO_HBV} />
        <LinhaManual
          nome="O que a tabela traz"
          texto={c.itens.join(' ')}
          pagina={HBV.pagina}
          conta={mostraHbig ? (ml !== null ? <>HBIG {c.hbigSeAntiHbsBaixo ? 'se anti-HBs < 10: ' : `${c.dosesHbig} × `}<strong>{br(ml, 2)} mL</strong> IM (0,06 mL/kg)</> : 'informe o peso para o volume de HBIG') : undefined}
          nota={HBV.alergia}
          errata={HBV.errata}
        />
      </Bloco>
    </ToolLayout>
  )
}
