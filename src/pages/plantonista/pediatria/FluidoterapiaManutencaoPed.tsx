import { useState } from 'react'

import {
  CATEGORIAS_FIGURA1, ERRATA_FAIXAS_HOLLIDAY, ERRATA_TABELAS_SOLUCOES, MAX_ML_H, SOLUCOES_PADRAO, TABELA_SOLUCOES, composicao, expansaoMl, fichaManutencaoPed, manutencao,
  volumeCategoria,
} from '@/clinico/pediatria/manutencao'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, br, faixaBr, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, LinhaLivro, Nota, Pendencia } from './PecasIcr'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Fluidoterapia de manutenção pediátrica — cap. 77 do Pronto-Socorro ICr-HCFMUSP. */
export function FluidoterapiaManutencaoPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaManutencaoPed.id)
  const m = podeCalcular(p) ? manutencao(p.peso) : null

  // Texto do "Copiar" (C4 = A): Holliday-Segar, regra prática, expansão e as categorias da Figura 1, com a página.
  const copia = () =>
    m &&
    textoCopia({
      ferramenta: 'Fluidoterapia de manutenção — criança',
      dados: [
        ['Peso', `${numeroBr(p.peso)} kg`],
        ['Idade', p.anos > 0 || p.meses > 0 ? `${p.anos} anos e ${p.meses} meses` : ''],
      ],
      resultado: [
        `Holliday-Segar: ${br(m.mlDia, 0)} mL/dia → ${br(m.mlHCalculado)} mL/h${m.mlHCalculado > MAX_ML_H ? ` → ${MAX_ML_H} mL/h (teto)` : ''} (Livro ICr, p. 840–841)`,
        `Regra prática: ${br(m.praticaMlH)} mL/h (Livro ICr, p. 840–841)`,
        ...(m.noTeto ? [`Cálculo acima de ${MAX_ML_H} mL/h: o livro limita a velocidade em ${MAX_ML_H} mL/h.`] : []),
        `Depleção de volume ou hipoperfusão: ${br(expansaoMl(p.peso), 0)} mL (20 mL/kg de soro isotônico, repetindo até perfusão adequada) (Figura 1, p. 842)`,
        ...CATEGORIAS_FIGURA1.map((c) => `${c.grupo} (${faixaBr([c.fracao[0] * 100, c.fracao[1] * 100], 0)}% do volume calculado): ${faixaBr(volumeCategoria(p.peso, c), 1)} mL/h (Figura 1, p. 842)`),
      ],
      fonte: textoFontes(fichaManutencaoPed),
      versao: fichaManutencaoPed.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Fluidoterapia de manutenção — criança"
      description="Necessidade hídrica basal por Holliday-Segar e pela regra prática, soluções-padrão e categorias da Figura 1 do livro do ICr-HCFMUSP. Pediatria: até antes dos 14 anos."
      ficha={fichaManutencaoPed}
    >
      <CampoPaciente id="manut" p={p} onChange={setP} />
      <Pendencia p={p} />

      {m && (
        <Bloco titulo="Necessidade hídrica basal (p. 840–841)" descricao={`Holliday-Segar em 24 h ÷ 24, ou a regra prática em mL/h. Teto do livro: ${MAX_ML_H} mL/h em bomba de infusão contínua.`}>
          <p className="tabular-nums">
            Holliday-Segar: <strong>{br(m.mlDia, 0)} mL/dia</strong> → {br(m.mlHCalculado)} mL/h
            {m.mlHCalculado > MAX_ML_H && <> → <strong>{MAX_ML_H} mL/h</strong> (teto)</>}
          </p>
          <p className="tabular-nums">
            Regra prática: <strong>{br(m.praticaMlH)} mL/h</strong>
          </p>
          {m.noTeto && <p className="text-atencao">Cálculo acima de {MAX_ML_H} mL/h: o livro limita a velocidade em {MAX_ML_H} mL/h.</p>}
          <Nota>Exemplo do livro: 17 kg → 1.350 mL/dia (56 mL/h) ou 54 mL/h pela regra prática (p. 841–842).</Nota>
        </Bloco>
      )}

      {m && (
        <Bloco titulo="Categorias da Figura 1 (p. 842)" descricao="O livro categoriza o paciente por distúrbio de concentração/diluição urinária; solução SG 5% 1.000 mL + NaCl 20% 40 mL, na fração do volume calculado para a criança.">
          <LinhaLivro
            nome="Depleção de volume ou hipoperfusão"
            texto="se sim, expandir com 20 mL/kg de soro isotônico (crianças), repetindo até perfusão adequada"
            conta={<strong>{br(expansaoMl(p.peso), 0)} mL</strong>}
            pagina="Figura 1, p. 842"
          />
          {CATEGORIAS_FIGURA1.map((c) => (
            <LinhaLivro
              key={c.id}
              nome={c.grupo}
              texto={`${c.exemplos}; ${faixaBr([c.fracao[0] * 100, c.fracao[1] * 100], 0)}% do volume calculado`}
              conta={<strong>{faixaBr(volumeCategoria(p.peso, c), 1)} mL/h</strong>}
              pagina="Figura 1, p. 842"
              nota={c.nota}
            />
          ))}
        </Bloco>
      )}

      <Bloco titulo="Soluções-padrão (Tabela 2, p. 841)" descricao="Composição conferida a partir do preparo, com NaCl 20% = 3,4 mEq/mL e KCl 19,1% = 2,5 mEq/mL (Tabela 11, p. 558).">
        {SOLUCOES_PADRAO.map((s) => {
          const c = composicao(s)
          return (
            <div key={s.id} className="rounded-controle border px-3 py-2 tabular-nums">
              <div className="font-medium">{s.nome}</div>
              <div className="text-tinta-sussurro">
                SG 5% {s.sg5Ml} mL + NaCl 20% {s.nacl20Ml} mL + KCl 19,1% {s.kcl191Ml} mL ({br(c.volumeMl, 0)} mL)
              </div>
              <div>
                Livro: Na {s.livro.na} · K {s.livro.k} · Cl {s.livro.cl} mEq · osm {s.livro.osm} mOsm/L · glicose {s.livro.glicoseG} g
              </div>
              <div className="text-tinta-sussurro">
                Pelo preparo: Na {br(c.naMeq, 0)} · K {br(c.kMeq, 0)} · Cl {br(c.clMeq, 0)} mEq no frasco (Na {br(c.naMeqL, 0)} mEq/L) · osm ≈ {br(c.osmMOsmL, 0)} mOsm/L
              </div>
            </div>
          )
        })}
      </Bloco>

      <Bloco titulo="Principais soluções (Tabela 1, p. 840)" descricao="Isotônica: Na próximo do plasma (131 a 154 mEq/L); hipotônica: < 130 mEq/L (p. 838).">
        <div className="overflow-x-auto">
          <Table variante="referencia" className="w-full text-left tabular-nums">
            <TableHeader>
              <TableRow className="text-tinta-sussurro">
                <TableHead className="py-1 pr-3 font-medium">Solução</TableHead>
                <TableHead className="py-1 pr-3 font-medium">Na</TableHead>
                <TableHead className="py-1 pr-3 font-medium">K</TableHead>
                <TableHead className="py-1 pr-3 font-medium">Cl</TableHead>
                <TableHead className="py-1 font-medium">Osm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TABELA_SOLUCOES.map((s) => (
                <TableRow key={s.nome} className="border-t">
                  <TableCell className="py-1 pr-3">{s.nome}</TableCell>
                  <TableCell className="py-1 pr-3">{s.na}</TableCell>
                  <TableCell className="py-1 pr-3">{s.k ?? '—'}</TableCell>
                  <TableCell className="py-1 pr-3">{s.cl}</TableCell>
                  <TableCell className="py-1">{s.osm}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Nota>Eletrólitos em mEq/L; osmolaridade em mOsm/L. O acompanhamento (diurese, balanço hídrico, peso, eletrólitos e função renal) segue o livro (p. 841).</Nota>
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!m}
        armadilhas={[`Faixas de Holliday-Segar — errata do livro: ${ERRATA_FAIXAS_HOLLIDAY}`, `Tabelas 1 e 2 — errata do livro: ${ERRATA_TABELAS_SOLUCOES}`, ...(guia?.armadilhas ?? [])]}
        ficha={fichaManutencaoPed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={m ? `Holliday-Segar ${m.noTeto ? `${MAX_ML_H} mL/h (teto)` : `${br(m.mlHCalculado)} mL/h`}` : 'Informe o peso'}
        detalhe={m ? `Criança · ${numeroBr(p.peso)} kg · regra prática ${br(m.praticaMlH)} mL/h` : undefined}
        tom={m?.noTeto ? 'atencao' : 'neutro'}
        textoCopia={copia() || undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
