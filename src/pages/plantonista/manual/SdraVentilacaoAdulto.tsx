import { useState } from 'react'

import { DIRETRIZ_SDRA_2024, ERRATA_VT_SDRA,
  NOME_BERLIM, RESGATE_HIPOXEMIA, SDRA, TABELAS_PEEP, berlim, conferirSdra, drivingPressure, fichaSdraAdulto, marcosPf, peepParaFio2,
  relacaoPF, relacaoSF, sdraGlobal2024, tabelaPeepDaClasse, vtSdra, type ColunaPeep, type SuporteSdra2024, type TabelaPeepId,
} from '@/clinico/adulto/ventilacaoMecanica'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { textoCopia } from '@/domain/copiaCalculo'

import { Alertas, Bloco, Escolha, Resultado } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const colunaTexto = (c: ColunaPeep) => `FiO2 ${faixaBr(c.fio2, 1)} → PEEP ${faixaBr(c.peep, 0)}`

const SUPORTES: { value: SuporteSdra2024; label: string }[] = [
  { value: 'vmi', label: 'Ventilação invasiva' }, { value: 'vni', label: 'VNI/CPAP ≥ 5 cmH2O' }, { value: 'cnaf30', label: 'CNAF ≥ 30 L/min' }, { value: 'o2', label: 'O2 convencional' }, { value: 'nenhum', label: 'Nenhum' },
]

function TabelaPeep({ id, destaque }: { id: TabelaPeepId; destaque: ColunaPeep[] }) {
  const t = TABELAS_PEEP[id]
  return (
    <div className="overflow-x-auto">
      <p className="font-medium">{t.nome} <span className="text-tinta-sussurro">({t.pagina})</span></p>
      <Table variante="referencia" className="text-rotulo tabular-nums">
        <TableBody>
          <TableRow><TableHead className="pr-2 text-left">FiO2</TableHead>{t.colunas.map((c, i) => <TableCell key={i} className={`border px-1.5 py-1 ${destaque.includes(c) ? 'bg-acao/15 font-semibold' : ''}`}>{faixaBr(c.fio2, 1).replace('–', '↔')}</TableCell>)}</TableRow>
          <TableRow><TableHead className="pr-2 text-left">PEEP</TableHead>{t.colunas.map((c, i) => <TableCell key={i} className={`border px-1.5 py-1 ${destaque.includes(c) ? 'bg-acao/15 font-semibold' : ''}`}>{faixaBr(c.peep, 0).replace('–', '↔')}</TableCell>)}</TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

/** SDRA no DE — Berlim, Tabela 5 e tabelas PEEP × FiO2 do cap. 37 do manual do HCFMUSP. */
export function SdraVentilacaoAdulto() {
  const [pao2, setPao2] = useState(0)
  const [fio2, setFio2] = useState(0)
  const [peep, setPeep] = useState(0)
  const [peso, setPeso] = useState(0)
  const [tabela, setTabela] = useState<TabelaPeepId>('baixo')
  const [pplato, setPplato] = useState(0)
  const [fr, setFr] = useState(0)
  const [tins, setTins] = useState(0)
  const [fluxo, setFluxo] = useState(0)
  const [ph, setPh] = useState(0)

  const [spo2, setSpo2] = useState(0)
  const [suporte, setSuporte] = useState<SuporteSdra2024>('vmi')
  const [limitado, setLimitado] = useState(false)

  const pf = relacaoPF(pao2, fio2)
  const b = pf !== null ? berlim(pf, peep) : null
  const sf = relacaoSF(spo2, fio2)
  const g24 = pf !== null || sf !== null ? sdraGlobal2024({ pf: pf ?? undefined, sf: sf ?? undefined, spo2: informado(spo2), suporte, peep: informado(peep), recursosLimitados: limitado }) : null
  const vt = b?.classe ? vtSdra(b.classe, peso) : null
  const leitura = peepParaFio2(tabela, fio2 / 100)
  const destaque = leitura ? (leitura.exatas.length ? leitura.exatas : [leitura.anterior, leitura.seguinte].filter((c): c is ColunaPeep => !!c)) : []
  const dp = drivingPressure(pplato, peep)
  const avisos = conferirSdra({ pplato: informado(pplato), peep: pplato > 0 ? peep : undefined, fr: informado(fr), tins: informado(tins), fluxo: informado(fluxo), ph: informado(ph) })
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaSdraAdulto.id)
  const marcos = pf !== null ? marcosPf(pf) : []
  const textoPf = pf !== null ? `P/F ${br(pf, 0)} mmHg — ${b?.classe ? NOME_BERLIM[b.classe] : 'sem classe'}` : null
  const textoG24 = g24 ? (g24.categoria ? `SDRA ${g24.categoria}${g24.gravidade ? ` — ${g24.gravidade}` : ''}${g24.criterioOxigenacao ? '' : ' — oxigenação acima dos cortes'}` : 'sem categoria com o suporte informado') : null
  const textoLeitura = leitura
    ? leitura.exatas.length
      ? `FiO2 ${br(fio2 / 100, 2)}: ${leitura.exatas.map(colunaTexto).join(' · ')}`
      : `FiO2 ${br(fio2 / 100, 2)} sem coluna na tabela. Vizinhas: ${[leitura.anterior, leitura.seguinte].filter((c): c is ColunaPeep => !!c).map(colunaTexto).join(' · ')}`
    : null
  const temResultado = pf !== null || g24 !== null || dp !== null || avisos.length > 0 || fr > 0 || tins > 0 || fluxo > 0 || ph > 0

  // Texto do "Copiar" (C4 = A): oxigenação, classe, Vt pelo peso informado, tabela de PEEP e a conferência da Tabela 5.
  const copia = temResultado
    ? textoCopia({
        ferramenta: 'SDRA — ventilação protetora (adulto)',
        dados: [
          ['PaO2', pao2 > 0 ? `${br(pao2, 0)} mmHg` : ''],
          ['FiO2', fio2 > 0 ? `${br(fio2, 0)}%` : ''],
          ['PEEP', peep > 0 ? `${br(peep, 0)} cmH2O` : ''],
          ['SpO2', spo2 > 0 ? `${br(spo2, 0)}%` : ''],
          ['Suporte respiratório', g24 ? SUPORTES.find((s) => s.value === suporte)!.label : ''],
          ['Recursos limitados', g24 && limitado ? 'sim' : ''],
          ['Peso usado na conta', peso > 0 ? `${br(peso, 1)} kg` : ''],
          ['Tabela de PEEP', leitura ? TABELAS_PEEP[tabela].nome : ''],
          ['Pplatô', pplato > 0 ? `${br(pplato, 0)} cmH2O` : ''],
          ['FR', fr > 0 ? `${br(fr, 0)} rpm` : ''],
          ['Tins', tins > 0 ? `${br(tins, 2)} s` : ''],
          ['Fluxo (VCV)', fluxo > 0 ? `${br(fluxo, 0)} L/min` : ''],
          ['pH', ph > 0 ? br(ph, 2) : ''],
        ],
        resultado: [
          ...(textoPf ? [`${textoPf} (Berlim, p. 505)`] : []),
          ...(b?.nota ? [b.nota] : []),
          ...marcos,
          ...(sf !== null ? [`S/F ${br(sf, 0)}`] : []),
          ...(textoG24 ? [`Definição global 2024: ${textoG24}`, ...g24!.notas] : []),
          ...(vt ? [`Vt pela classe de Berlim (Tabela 5, p. 506): ${faixaBr(vt, 0)} mL`] : []),
          ...(textoLeitura ? [`${TABELAS_PEEP[tabela].nome} (${TABELAS_PEEP[tabela].pagina}): ${textoLeitura}`] : []),
          ...(dp !== null ? [`Driving pressure (Pplatô − PEEP): ${br(dp, 0)} cmH2O`] : []),
          ...(pplato > 0 || fr > 0 || tins > 0 || fluxo > 0 || ph > 0 ? (avisos.length ? avisos : ['Nenhum valor informado fora da Tabela 5.']) : []),
        ],
        fonte: textoFontes(fichaSdraAdulto),
        versao: fichaSdraAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="SDRA — ventilação protetora (adulto)"
      description="Classe de Berlim pela P/F, Vt por gravidade, tabelas PEEP × FiO2 (ARDSnet, ALVEOLI, LOVS), driving pressure e marcos de prona e bloqueio, como o cap. 37 do manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaSdraAdulto}
    >
      <Bloco titulo="Critérios de Berlim (p. 505)" descricao="Relação PO2/FiO2 com PEEP ≥ 5 cmH2O: leve 201–300, moderada 101–200, grave ≤ 100. O capítulo traz só a relação P/F.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="sd-pao2" label="PaO2" unit="mmHg" value={pao2} onChange={setPao2} step={1} />
          <NumberField id="sd-fio2" label="FiO2" unit="%" value={fio2} onChange={setFio2} step={5} />
          <NumberField id="sd-peep" label="PEEP" unit="cmH2O" value={peep} onChange={setPeep} step={1} />
        </div>
        {pf !== null && (
          <>
            <Resultado rotulo="P/F" valor={`${br(pf, 0)} mmHg — ${b?.classe ? NOME_BERLIM[b.classe] : 'sem classe'}`} />
            {b?.nota && <p className="text-tinta-sussurro">{b.nota}</p>}
            <Alertas itens={marcos} />
          </>
        )}
      </Bloco>

      <Bloco titulo="Definição global de SDRA 2024" descricao="Só o critério de oxigenação (Tabela 1): P/F ≤ 300 ou S/F ≤ 315 com SpO2 ≤ 97%. Início em 1 semana, opacidades bilaterais (RX, TC ou ultrassom) e exclusão de derrame/atelectasia/nódulos ficam com quem avalia.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="sd-spo2" label="SpO2 (para a S/F)" unit="%" value={spo2} onChange={setSpo2} step={1} max={100} />
          <Escolha label="Suporte respiratório" value={suporte} onChange={setSuporte} opcoes={SUPORTES} />
          <label className="flex items-center gap-2 text-apoio"><input type="checkbox" className="size-4" checked={limitado} onChange={(e) => setLimitado(e.target.checked)} /> Recursos limitados (sem PEEP/fluxo exigidos)</label>
        </div>
        {sf !== null && <Resultado rotulo="S/F" valor={`${br(sf, 0)}`} />}
        {g24 ? (
          <>
            <Resultado rotulo="Leitura 2024" valor={g24.categoria ? `SDRA ${g24.categoria}${g24.gravidade ? ` — ${g24.gravidade}` : ''}${g24.criterioOxigenacao ? '' : ' — oxigenação acima dos cortes'}` : 'sem categoria com o suporte informado'} />
            {g24.notas.map((n) => <p key={n} className="text-tinta-sussurro">{n}</p>)}
          </>
        ) : <p className="text-tinta-sussurro">Informe PaO2 e FiO2 ou SpO2 e FiO2.</p>}
      </Bloco>

      <Bloco titulo="Tabela 5 — ajuste na SDRA (p. 506)" descricao="O livro não diz qual peso usar no mL/kg nem traz fórmula de peso predito: informe o peso que você quer usar.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="Vt" valor={`leve ${SDRA.vtLeve} mL/kg; moderada/grave ${faixaBr(SDRA.vtModeradaGrave, 0)} mL/kg`} />
          {/* A errata do Vt fica no item: muda o mL/kg da conta (C6 = A). */}
          <p className="text-apoio text-tinta-sussurro">Errata: {ERRATA_VT_SDRA}</p>
          <Resultado rotulo="PEEP" valor="leve/moderada: tabela PEEP baixo; grave: PEEP alto" />
          <Resultado rotulo="FiO2" valor="100% inicial → SatO2 > 92%" />
          <Resultado rotulo="FR" valor={`${SDRA.frInicial} rpm inicial; graves podem precisar de ${faixaBr(SDRA.frGrave, 0)}`} />
          <Resultado rotulo="PCV · VCV" valor="Tins ≤ 1 s · fluxo 45–60 L/min; I:E ≥ 1:2" />
          <Resultado rotulo="Pressões" valor="Pplatô ≤ 30; evitar driving pressure > 15 cmH2O" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="sd-peso" label="Peso usado na conta" unit="kg" value={peso} onChange={setPeso} step={0.1} />
          <Resultado rotulo="Vt pela classe de Berlim" valor={vt ? `${faixaBr(vt, 0)} mL` : b?.classe ? 'informe o peso' : 'informe PaO2, FiO2 e PEEP'} />
        </div>
        <p className="text-tinta-sussurro">p. 506: modos controlados nas primeiras 48–72 horas; diminuir espaço morto não fisiológico. p. 507: tolera-se hipercapnia se pH &gt; 7,2.</p>
      </Bloco>

      <Bloco titulo="Tabelas PEEP × FiO2 (p. 506–507)" descricao="A tela marca a coluna da FiO2 informada; sem coluna exata, marca as vizinhas — o livro não interpola. As duas tabelas de PEEP alto têm resultados práticos muito semelhantes (p. 507).">
        <Escolha label="Tabela" value={tabela} onChange={setTabela} opcoes={[{ value: 'baixo', label: 'PEEP baixo (Tabela 6)' }, { value: 'alveoli', label: 'PEEP alto — ALVEOLI' }, { value: 'lovs', label: 'PEEP alto — LOVS' }]} />
        {b?.classe && <p>Para a classe {NOME_BERLIM[b.classe].toLowerCase()}, a Tabela 5 aponta a tabela de PEEP {tabelaPeepDaClasse(b.classe)}.</p>}
        <TabelaPeep id={tabela} destaque={destaque} />
        {textoLeitura && <p>{textoLeitura}</p>}
      </Bloco>

      <Bloco titulo="Conferir o ventilador contra a Tabela 5">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="sd-plato" label="Pplatô" unit="cmH2O" value={pplato} onChange={setPplato} step={1} />
          <Resultado rotulo="Driving pressure (Pplatô − PEEP)" valor={dp !== null ? `${br(dp, 0)} cmH2O` : '—'} />
          <NumberField id="sd-fr" label="FR" unit="rpm" value={fr} onChange={setFr} step={1} />
          <NumberField id="sd-tins" label="Tins" unit="s" value={tins} onChange={setTins} step={0.1} />
          <NumberField id="sd-fluxo" label="Fluxo (VCV)" unit="L/min" value={fluxo} onChange={setFluxo} step={5} />
          <NumberField id="sd-ph" label="pH" value={ph} onChange={setPh} step={0.01} />
        </div>
        {avisos.length ? <Alertas itens={avisos} /> : <p>Nenhum valor informado fora da Tabela 5.</p>}
      </Bloco>

      <Bloco titulo="Hipoxemia grave — recursos citados (p. 507–508)">
        <ul className="list-disc pl-5">{RESGATE_HIPOXEMIA.map((r) => <li key={r.nome}><strong>{r.nome}:</strong> {r.texto} <span className="text-tinta-sussurro">({r.pagina})</span></li>)}</ul>
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={guia?.armadilhas ?? []}
        ficha={fichaSdraAdulto}
        guia={guia}
        comparacao={
          // Tabela de comparação com as diretrizes vai para "Evidências" (C6 = A); nenhum valor do manual muda.
          <BlocoComparacao titulo="ATS 2024, ESICM 2023 e definição global 2024 × manual do HC" resumo="Textos integrais lidos. Onde a ATS e a ESICM divergem (bloqueio neuromuscular), as duas aparecem.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Força · fonte</TableHead><TableHead className="pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>
                  {DIRETRIZ_SDRA_2024.map((d) => (
                    <TableRow key={d.tema} className="border-t">
                      <TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell>
                      <TableCell className="pr-3 py-2">
                        {d.diretriz}
                        {d.nota && <p role="note" className="mt-2 rounded-controle border border-atencao/40 bg-alerta-atencao px-2 py-1 text-rotulo text-atencao">{d.nota}</p>}
                      </TableCell>
                      <TableCell className="pr-3 py-2 text-tinta-sussurro">{d.forca} · {d.fonte}</TableCell>
                      <TableCell className="py-2 text-tinta-sussurro">{d.livro}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={textoPf ?? (textoG24 ? `Definição 2024: ${textoG24}` : 'Informe PaO2, FiO2 e PEEP')}
        detalhe={[
          ...(vt ? [`Vt ${faixaBr(vt, 0)} mL`] : []),
          ...(dp !== null ? [`driving pressure ${br(dp, 0)} cmH2O`] : []),
          ...(avisos.length ? [`${avisos.length} valor${avisos.length > 1 ? 'es' : ''} fora da Tabela 5`] : []),
          ...(marcos.length ? [`${marcos.length} marco${marcos.length > 1 ? 's' : ''} de P/F (prona, bloqueio)`] : []),
        ].join(' · ') || undefined}
        tom={avisos.length || marcos.length ? 'atencao' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
