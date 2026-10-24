import { useState } from 'react'

import {
  PRIMEIRA_HORA, SINAIS_CLASSICOS, TABELA1_LCR, TABELA2_MENINGITE, dosesPorPeso, fichaMeningiteAdulto, riscoListeria, suspeitaMeningite,
} from '@/clinico/adulto/meningite'
import { Chip } from '@/components/monitor/Pagina'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { numero } from '@/lib/formato'

import { Bloco, CampoPeso, LinhaManual, Pergunta } from './PecasLoteC'

const br = (x: number) => numero(Math.round(x * 10) / 10)

/** Meningite e encefalite do adulto (cap. 43 do manual do HCFMUSP). */
export function MeningiteAdulto() {
  const [peso, setPeso] = useState(0)
  const [idade, setIdade] = useState(0)
  const [sinais, setSinais] = useState<string[]>([])
  const [imuno, setImuno] = useState<boolean>()
  const [corticoide, setCorticoide] = useState<boolean>()
  const [gestante, setGestante] = useState<boolean>()
  const doses = dosesPorPeso(peso)
  const listeria = riscoListeria({ idadeAnos: idade > 0 ? idade : undefined, imunossuprimido: imuno, corticoide, gestante })
  const alternar = (s: string) => setSinais((m) => (m.includes(s) ? m.filter((x) => x !== s) : [...m, s]))

  return (
    <ToolLayout
      title="Meningite e encefalite — adulto"
      description="Suspeita clínica, primeira hora, esquema empírico com ampicilina quando há risco de Listeria, dexametasona e aciclovir por peso, e padrões do LCR. Adulto (14 anos ou mais)."
      ficha={fichaMeningiteAdulto}
    >
      <CampoPeso id="men-peso" peso={peso} onChange={setPeso}>
        <NumberField id="men-idade" label="Idade" unit="anos" value={idade} onChange={setIdade} min={0} />
      </CampoPeso>

      <Bloco titulo="Suspeita clínica (p. 589)" descricao="Suspeitar com ao menos dois dos quatro sinais clássicos (presentes em mais de 90%). Na encefalite: crise, alteração de comportamento, rebaixamento mais proeminente e sinais focais.">
        <div role="group" aria-label="Sinais clássicos" className="flex flex-wrap gap-2">
          {SINAIS_CLASSICOS.map((s) => <Chip key={s} ativo={sinais.includes(s)} onClick={() => alternar(s)}>{s}</Chip>)}
        </div>
        {sinais.length > 0 && (
          <p className="text-apoio text-tinta">
            {suspeitaMeningite(sinais.length) ? `${sinais.length} de 4: suspeita de meningite pelo critério do capítulo.` : '1 de 4: abaixo do critério de dois sinais; reavaliar.'}
          </p>
        )}
      </Bloco>

      <Bloco titulo="Primeira hora">
        {PRIMEIRA_HORA.map((p) => <p key={p.texto} className="text-apoio text-tinta-apoio">{p.texto} ({p.pagina})</p>)}
      </Bloco>

      <Bloco titulo="Esquema empírico (Tabela 2, p. 591–592)">
        <Pergunta rotulo="Imunossupressão" valor={imuno} onChange={setImuno} />
        <Pergunta rotulo="Uso de corticoide" valor={corticoide} onChange={setCorticoide} />
        <Pergunta rotulo="Gestante" valor={gestante} onChange={setGestante} />
        <LinhaManual nome="Ceftriaxona" texto="2 g EV 12/12 h, por 10–14 dias no empírico" pagina="Tabela 2, p. 591" />
        <LinhaManual
          nome="Ampicilina"
          texto="2 g EV 4/4 h, associada quando há risco de Listeria"
          conta={listeria.length ? <strong>indicada: {listeria.join(', ')}</strong> : 'sem fator de risco informado'}
          pagina="Tabela 2, p. 591–592; p. 593"
        />
        <LinhaManual
          nome="Dexametasona"
          texto="0,15 mg/kg/dose EV 6/6 h por 4 dias, de preferência com a primeira dose do antibiótico"
          conta={doses ? <strong>{br(doses.dexametasonaMg)} mg 6/6 h</strong> : 'informe o peso'}
          pagina="Tabela 2, p. 591"
        />
        <LinhaManual
          nome="Aciclovir (suspeita de encefalite herpética)"
          texto="10 mg/kg/dose EV 8/8 h por 14–21 dias; reajustar pela função renal"
          conta={doses ? <strong>{br(doses.aciclovirMg)} mg 8/8 h</strong> : 'informe o peso'}
          pagina="Tabela 2, p. 591"
        />
      </Bloco>

      <Bloco titulo="Por agente (Tabela 2, p. 591–592)">
        <div className="overflow-x-auto">
          <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
            <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Agente</TableHead><TableHead className="pr-3 pb-2">Tratamento</TableHead><TableHead className="pr-3 pb-2">Corticoide</TableHead></TableRow></TableHeader>
            <TableBody>{TABELA2_MENINGITE.map((e) => <TableRow key={e.quem} className="border-t"><TableCell className="pr-3 py-2 font-medium">{e.quem}</TableCell><TableCell className="pr-3 py-2">{e.antibiotico}</TableCell><TableCell className="pr-3 py-2">{e.corticoide}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      </Bloco>

      <Bloco titulo="Padrões do LCR (Tabela 1, p. 590)" descricao="Nenhum achado isolado decide; o diagnóstico é pelo conjunto (p. 593).">
        <div className="overflow-x-auto">
          <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
            <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Exame</TableHead><TableHead className="pr-3 pb-2">Viral</TableHead><TableHead className="pr-3 pb-2">Herpética</TableHead><TableHead className="pr-3 pb-2">Bacteriana</TableHead><TableHead className="pr-3 pb-2">Tuberculosa</TableHead></TableRow></TableHeader>
            <TableBody>{TABELA1_LCR.map((l) => <TableRow key={l.exame} className="border-t"><TableCell className="pr-3 py-2 font-medium">{l.exame}</TableCell><TableCell className="pr-3 py-2">{l.viral}</TableCell><TableCell className="pr-3 py-2">{l.herpetica}</TableCell><TableCell className="pr-3 py-2">{l.bacteriana}</TableCell><TableCell className="pr-3 py-2">{l.tuberculosa}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
        <p className="text-apoio text-tinta-sussurro">* Como alternativa, glicorraquia menor que 2/3 da sérica.</p>
      </Bloco>

      <p className="text-apoio text-tinta-sussurro">O capítulo não traz quimioprofilaxia de contatos; a meningite da criança tem tela própria na Pediatria.</p>
    </ToolLayout>
  )
}
