import { useMemo, useState } from 'react'

import { BOLUS, GRUPOS, NEONATO_FORA, NOTA_PESO_EMERGENCIA, calcularBolus, fichaBolusPediatrico, type Bolus, type Grupo } from '@/clinico/pediatria/bolus'
import { IDADE_ADULTO_ANOS } from '@/clinico/ficha'
import { textoFontes } from '@/clinico/ficha'
import { CamposPacientePed } from '@/components/plantonista/calc/CamposPacientePed'
import { useInicioPedDaCentral } from '@/components/plantonista/calc/pacienteNaFerramenta'
import { VerMais } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { numero } from '@/lib/formato'

const num = (x: number, casas = 2) => numero(Math.round(x * 10 ** casas) / 10 ** casas)
const faixaTxt = ([a, b]: [number, number], casas = 2) => (a === b ? num(a, casas) : `${num(a, casas)}–${num(b, casas)}`)
const porKgTxt = (b: Bolus) => `${faixaTxt(b.faixa, 3)} ${b.unidade}${b.porKg ? '/kg' : ''}`

function Item({ b, peso, idadeMeses }: { b: Bolus; peso: number; idadeMeses?: number }) {
  const r = calcularBolus(b, peso, idadeMeses)
  const fora = r?.aplica === 'nao'
  return (
    <div className={`rounded-controle border px-3 py-2 text-apoio ${fora ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">
          {b.nome}
          {b.condicao && <Badge variant="outline" className="ml-2 align-middle">{b.condicao.texto}</Badge>}
        </span>
        {r && (
          <span className="tabular-nums">
            <strong>{faixaTxt(r.faixa)} {b.unidade}</strong>
            {r.volumeMl && <span className="text-tinta-sussurro"> · {faixaTxt(r.volumeMl)} mL</span>}
          </span>
        )}
      </div>
      {b.semCalculo ? (
        <p className="mt-1 text-atencao">{b.semCalculo}</p>
      ) : (
        <p className="mt-1 text-tinta-sussurro">
          {porKgTxt(b)}
          {b.maximo !== undefined && ` · máximo ${num(b.maximo, 3)} ${b.unidade}`}
          {b.apresentacao && ` · ${b.apresentacao}`}
          {' · '}{b.via}
        </p>
      )}
      {fora && <p className="text-tinta-sussurro">Fora da condição do livro para o peso/idade informados.</p>}
      {r?.aplica === 'indefinido' && <p className="text-tinta-sussurro">Depende da idade: informe a idade para conferir a condição do livro.</p>}
      {r?.noMaximo && <p className="text-atencao">Dose limitada ao máximo do livro.</p>}
      {r?.abaixoDoAviso && b.aviso && <p className="text-atencao">{b.aviso.texto}</p>}
      {/* Piloto das calculadoras (C6 = A): errata, nota e divergência recolhidas; os avisos de dose acima ficam à vista. */}
      {(b.errata || b.nota || b.anexo2Adulto) && (
        <VerMais>
          {b.errata && <p><Badge variant="outline" className="mr-1">errata</Badge>{b.errata}</p>}
          {b.nota && <p>No livro: {b.nota}</p>}
          {b.anexo2Adulto && <p>Divergência: {b.anexo2Adulto}</p>}
        </VerMais>
      )}
      <p className="text-rotulo text-tinta-sussurro">PS Pediatria ICr-HCFMUSP, {b.pagina}.</p>
    </div>
  )
}

/** Doses pediátricas em bolus por peso (Fase 5.4; fonte em src/clinico/pediatria/fonte.ts). */
export function BolusPediatrico() {
  // Peso e idade da Central (C5 = A): abrem preenchidos, com selo, e continuam editáveis.
  const inicio = useInicioPedDaCentral()
  const [peso, setPeso] = useState(inicio.peso)
  const [anos, setAnos] = useState(inicio.anos)
  const [meses, setMeses] = useState(inicio.meses)
  const [busca, setBusca] = useState('')
  const valido = peso > 0 && peso <= 150
  const idadeInformada = anos > 0 || meses > 0
  const idadeMeses = idadeInformada ? Math.floor(anos) * 12 + Math.floor(meses) : undefined
  const adulto = idadeMeses !== undefined && idadeMeses >= IDADE_ADULTO_ANOS * 12

  const grupos = useMemo(() => {
    const t = busca.trim().toLowerCase()
    const lista = BOLUS.filter((b) => !t || b.nome.toLowerCase().includes(t) || GRUPOS[b.grupo].toLowerCase().includes(t))
    return (Object.keys(GRUPOS) as Grupo[]).map((g) => ({ g, itens: lista.filter((b) => b.grupo === g) })).filter((x) => x.itens.length)
  }, [busca])

  // Texto do "Copiar" (C3 e C4 = A): a lista que está na tela (com a busca), dose do peso, volume e página.
  const copia = () =>
    textoCopia({
      ferramenta: 'Doses pediátricas por peso (Apêndice do PS Pediatria ICr-HCFMUSP)',
      dados: [
        ['Peso', `${numeroBr(peso)} kg`],
        ['Idade', idadeInformada ? `${Math.floor(anos)} anos e ${Math.floor(meses)} meses` : ''],
        ['Busca', busca.trim()],
      ],
      resultado: grupos.flatMap(({ g, itens }) => [
        `${GRUPOS[g]}:`,
        ...itens.flatMap((b) => {
          const r = calcularBolus(b, peso, idadeMeses)
          if (!r || r.aplica === 'nao') return []
          return [`- ${b.nome}: ${faixaTxt(r.faixa)} ${b.unidade}${r.volumeMl ? ` · ${faixaTxt(r.volumeMl)} mL` : ''}${r.noMaximo ? ' (no máximo do livro)' : ''} · ${b.via} (${b.pagina})`]
        }),
      ]),
      fonte: textoFontes(fichaBolusPediatrico),
      versao: fichaBolusPediatrico.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Doses pediátricas por peso"
      description="Apêndice do PS Pediatria ICr-HCFMUSP (4ª ed., 2023), com página. Pediatria: de 1 dia de vida até antes dos 14 anos."
      ficha={fichaBolusPediatrico}
    >
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <CamposPacientePed
            idBase="ped"
            peso={peso}
            anos={anos}
            meses={meses}
            onPeso={setPeso}
            onAnos={setAnos}
            onMeses={setMeses}
            daCentral={inicio.daCentral}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ped-busca" className="text-apoio font-medium">Buscar medicamento</label>
              <Input id="ped-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="ex.: naloxona, crise" />
            </div>
          </CamposPacientePed>
          <p className="text-apoio text-tinta-sussurro">
            {NEONATO_FORA} A idade é opcional: só muda o que o livro separa por idade (ex.: midazolam, diazepam, naloxona).
            A dose mostrada é a faixa do livro para o peso; a escolha dentro dela é do profissional.
          </p>
          <p role="note" className="text-apoio text-tinta-sussurro">{NOTA_PESO_EMERGENCIA}</p>
        </CardContent>
      </Card>

      {adulto && (
        <Card>
          <CardContent className="pt-6 text-apoio text-atencao">A partir de 14 anos completos o paciente é adulto; esta ferramenta é pediátrica.</CardContent>
        </Card>
      )}

      {!valido && !adulto && (
        <Card>
          <CardContent className="pt-6 text-apoio text-tinta-sussurro">Informe o peso para calcular (acima de 0 e até 150 kg).</CardContent>
        </Card>
      )}

      {valido && !adulto && grupos.map(({ g, itens }) => (
        <Card key={g}>
          <CardHeader>
            <CardTitle className="text-corpo">{GRUPOS[g]}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {itens.map((b) => <Item key={b.id} b={b} peso={peso} idadeMeses={idadeMeses} />)}
          </CardContent>
        </Card>
      ))}
      {!adulto && (
        <ResumoFlutuante
          principal={valido ? `Criança · ${numeroBr(peso)} kg${idadeInformada ? ` · ${Math.floor(anos)} a ${Math.floor(meses)} m` : ''}` : 'Informe o peso'}
          detalhe={valido ? 'Doses do peso nas listas acima; "Copiar" leva a lista que está na tela.' : undefined}
          textoCopia={valido ? copia() : undefined}
        />
      )}
    </ToolLayout>
  )
}
