import { useState } from 'react'

import {
  ACIDENTE_RAIVA, ANIMAL_RAIVA, DIFERENCAS_RAIVA_2022, DIFERENCAS_TETANO_GVS, FERIMENTO_GVS, FERIMENTO_TETANO, FONTE_HBV, HBV, HISTORICO_TETANO, IMUNOGLOBULINA_PROFILAXIA,
  PROTOCOLO_RAIVA_2022, RAIVA, RISCO_FONTE_HBV, SITUACAO_HBV, SORO_RAIVA, TABELA5_TETANO, TRATAMENTO_GVS_2024, TRATAMENTO_TETANO, doseSoroRaiva, fichaHepatiteBAdulto,
  fichaRaivaAdulto, fichaTetanoAdulto, hbigMl, profilaxiaHepatiteB, profilaxiaRaiva, profilaxiaTetano, profilaxiaTetanoGvs, tratamentoTetanoPorPeso,
  type AcidenteRaiva, type AnimalRaiva, type ContatoRaiva, type FerimentoGvs, type FerimentoTetano, type FonteHbv, type HistoricoGvs, type HistoricoVacinalTetano,
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
  const [historicoGvs, setHistoricoGvs] = useState<HistoricoGvs>('incerta')
  const [ferimentoGvs, setFerimentoGvs] = useState<FerimentoGvs>('minimo')
  const [vulneravel, setVulneravel] = useState(false)
  const g = profilaxiaTetanoGvs(historicoGvs, ferimentoGvs, vulneravel)
  const gvs = TRATAMENTO_GVS_2024

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

      <Bloco titulo="Guia de Vigilância em Saúde 2024 — profilaxia (Quadro 4, p. 335)" descricao="Fonte do Ministério da Saúde ao lado do Anexo 7 do manual; as quatro linhas coincidem, e o GVS acrescenta a nota d e as situações especiais.">
        <Escolha label="História de vacinação contra tétano" value={historicoGvs} onChange={setHistoricoGvs} opcoes={[...HISTORICO_TETANO, { value: 'mais10Especial' as const, label: '3 doses ou mais; última há 10 anos ou mais, em situações especiais' }]} />
        <Escolha label="Ferimento" value={ferimentoGvs} onChange={setFerimentoGvs} opcoes={FERIMENTO_GVS} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={vulneravel} onChange={(e) => setVulneravel(e.target.checked)} /> Imunodeprimido, desnutrido grave ou idoso (nota d)</label>
        <LinhaManual
          nome="O que o Quadro 4 traz para essa combinação"
          texto={`vacina: ${simNao(g.vacina)}${g.reforco ? ' (um reforço)' : ''}; SAT ou IGHAT: ${simNao(g.imunoglobulina)}. ${g.notas.join(' ')}`}
          pagina={g.pagina}
          conta={<><strong>Vacina: {simNao(g.vacina)}</strong> · <strong>SAT/IGHAT: {simNao(g.imunoglobulina)}</strong></>}
        />
        <p className="text-sm text-muted-foreground">{gvs.desbridamento.texto} ({gvs.desbridamento.pagina}).</p>
      </Bloco>

      <Bloco titulo="Guia de Vigilância em Saúde 2024 — tratamento (Quadros 1–3, p. 328 e 331)">
        <LinhaManual nome="IGHAT" texto={gvs.ighat.texto} pagina={gvs.ighat.pagina} conta={<><strong>{gvs.ighat.terapeuticaUi} UI</strong> (terapêutica; até {gvs.ighat.terapeuticaMaxUi.toLocaleString('pt-BR')}) · profilática {gvs.ighat.profilaticaUi} UI</>} />
        <LinhaManual nome="SAT" texto={gvs.sat.texto} pagina={gvs.sat.pagina} conta={<><strong>{gvs.sat.terapeuticaUi.toLocaleString('pt-BR')} UI</strong> (terapêutico) · profilático {gvs.sat.profilaticaUi.toLocaleString('pt-BR')} UI</>} />
        <LinhaManual nome="Antibiótico" texto={gvs.antibiotico.texto} pagina={gvs.antibiotico.pagina} conta={<>penicilina <strong>2.000.000 UI</strong> 4/4 h · ou metronidazol <strong>{gvs.antibiotico.metronidazolMg} mg</strong> 8/8 h · 7–10 dias</>} />
        <LinhaManual nome="Sedativos (Quadro 1, como impresso)" texto={gvs.sedativos.texto} pagina={gvs.sedativos.pagina} errata={gvs.sedativos.errata} />
        <LinhaManual nome="Medidas gerais" texto={gvs.medidasGerais.texto} pagina={gvs.medidasGerais.pagina} errata={gvs.medidasGerais.errata} />
        <ul className="list-disc pl-5 text-sm text-muted-foreground">{DIFERENCAS_TETANO_GVS.map((d) => <li key={d}>{d}</li>)}</ul>
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
  const [pesoRaiva, setPesoRaiva] = useState(0)
  const soro = doseSoroRaiva(pesoRaiva)

  return (
    <ToolLayout
      title="Raiva — profilaxia pós-exposição (adulto)"
      description="Fluxograma do Anexo 4 do manual do HC: tipo de contato, gravidade do acidente e animal → vacina, sorovacinação ou observação; doses do soro e da imunoglobulina pelas Notas Técnicas do MS (2022 e 2026). Adulto (14 anos ou mais)."
      ficha={fichaRaivaAdulto}
    >
      <CampoPeso id="raiva-peso" peso={pesoRaiva} onChange={setPesoRaiva} />
      <Bloco titulo="Soro e imunoglobulina — Notas Técnicas do MS (8/2022, 134/2022 e 35/2026)" descricao={SORO_RAIVA.texto}>
        <LinhaManual
          nome="Soro antirrábico (SAR) 40 UI/kg"
          texto={`Frasco VINRAB 1000 UI em 5 mL (200 UI/mL); IM em duas massas se o restante não couber na lesão; nunca no mesmo grupo muscular da vacina (${SORO_RAIVA.pagina})`}
          pagina="NT 8/2022, item 2.2; NT 35/2026, itens 3.2 e 4.4"
          conta={soro ? <><strong>{soro.sarUi.toLocaleString('pt-BR')} UI</strong> = {soro.sarMlVinrab.toLocaleString('pt-BR')} mL de VINRAB ({soro.frascosVinrab} frasco{soro.frascosVinrab > 1 ? 's' : ''})</> : 'informe o peso'}
        />
        <LinhaManual nome="Imunoglobulina humana (IGHAR) 20 UI/kg" texto="Preferida em quem já reagiu a soro heterólogo; mesma regra de infiltração" pagina="NT 8/2022, item 2.2" conta={soro ? <strong>{soro.igharUi.toLocaleString('pt-BR')} UI</strong> : 'informe o peso'} />
        {PROTOCOLO_RAIVA_2022.map((i) => <LinhaManual key={i.tema} nome={i.tema} texto={i.ms} pagina={i.pagina} />)}
        <ul className="list-disc pl-5 text-sm text-muted-foreground">{DIFERENCAS_RAIVA_2022.map((d) => <li key={d}>{d}</li>)}</ul>
      </Bloco>

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
