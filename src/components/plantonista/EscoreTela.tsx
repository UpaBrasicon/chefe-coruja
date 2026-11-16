import { useState, type ReactNode } from 'react'

import { temReferenciaPediatrica, textoFontes } from '@/clinico/ficha'
import { numero, type Escore, type Respostas } from '@/clinico/escore'
import { ESCORES_PILOTO } from '@/content/pilotoCalculadoras'
import { textoCopia } from '@/domain/copiaCalculo'
import { usePacienteCentral } from '@/lib/pacienteCentral'
import { Chip } from '@/components/monitor/Pagina'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { SemReferenciaPediatrica } from '@/components/plantonista/SemReferenciaPediatrica'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Revisão visual 3.8 (opção C, leitura de manual): cada item é uma linha, com a
// pergunta à esquerda e as opções à direita; o resultado vem em frase, sem
// bolha nem borda colorida. O cálculo e os textos são os do pacote src/clinico.

/** Opções curtas cabem na linha da pergunta; as longas descem para baixo dela. */
const cabeNaLinha = (rotulos: string[]) => rotulos.length <= 4 && rotulos.join('').length <= 40

function Linha({ rotulo, ajuda, rotuloId, opcoesEmLinha, children }: {
  rotulo: React.ReactNode; ajuda?: string; rotuloId?: string; opcoesEmLinha: boolean; children: React.ReactNode
}) {
  return (
    <div className={cn('flex gap-x-4 gap-y-2 border-b border-trilha px-5 py-3 last:border-0', opcoesEmLinha ? 'flex-wrap items-center justify-between' : 'flex-col')}>
      {/* A base de 260 px só vale lado a lado (a pergunta divide a linha com as
          opções). Em coluna ela virava 260 px de altura vazia em cada item. */}
      <div className={cn('flex min-w-0 flex-col gap-0.5', opcoesEmLinha && 'flex-[1_1_260px]')}>
        <span id={rotuloId} className="text-controle text-tinta">{rotulo}</span>
        {ajuda && <span className="text-apoio text-tinta-sussurro">{ajuda}</span>}
      </div>
      {children}
    </div>
  )
}

/** Tela única dos escores do pacote src/clinico. */
export function EscoreTela({ escore, children }: { escore: Escore; children?: ReactNode }) {
  // Piloto das calculadoras (RT, 16/11/2026): os escores do piloto seguem o
  // modo da Central (C5 = A) e ganham o resumo flutuante com "Copiar".
  const piloto = ESCORES_PILOTO.has(escore.ficha.id)
  const central = usePacienteCentral()
  const modoCentral = piloto && central.modo ? (central.modo === 'pediatrico' ? 'crianca' : 'adulto') : null
  const guia = piloto ? guiaDa(escore.ficha.id) : undefined
  const [aba, setAba] = useState<IdAba>('proximos')
  const [r, setR] = useState<Respostas>({})
  const [pacienteEscolhido, setPaciente] = useState<'adulto' | 'crianca'>(escore.ficha.publico === 'pediatrico' ? 'crianca' : 'adulto')
  const paciente = modoCentral ?? pacienteEscolhido
  const semRefPedi = paciente === 'crianca' && !temReferenciaPediatrica(escore.ficha)
  const semRefAdulto = paciente === 'adulto' && escore.ficha.publico === 'pediatrico'
  const res = semRefPedi || semRefAdulto ? null : escore.calcular(r)

  return (
    <ToolLayout title={escore.ficha.titulo} description={escore.descricao} ficha={escore.ficha}>
      <section aria-label="Itens do escore" className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        {modoCentral ? (
          <p className="border-b border-trilha px-5 py-2.5 text-apoio text-tinta-apoio">
            Paciente: <span className="font-medium text-tinta">{modoCentral === 'crianca' ? 'criança (menos de 14 anos)' : 'adulto (14 anos ou mais)'}</span>, como escolhido na Central.
          </p>
        ) : (
          <Linha rotulo="Paciente" rotuloId="esc-paciente" opcoesEmLinha>
            <div role="radiogroup" aria-labelledby="esc-paciente" className="flex flex-wrap gap-2">
              {([['adulto', 'Adulto (14 anos ou mais)'], ['crianca', 'Criança (menos de 14 anos)']] as const).map(([v, rotulo]) => (
                <Chip key={v} variante="opcao" radio ativo={paciente === v} onClick={() => setPaciente(v)}>{rotulo}</Chip>
              ))}
            </div>
          </Linha>
        )}

        {escore.itens.map((item) =>
          item.tipo === 'numero' ? (
            <Linha
              key={item.id}
              opcoesEmLinha
              ajuda={item.ajuda}
              rotulo={
                <label htmlFor={`esc-${item.id}`}>
                  {item.rotulo}
                  {item.unidade && <span className="ml-1 text-tinta-sussurro">({item.unidade})</span>}
                  {item.opcional && <span className="ml-1 text-tinta-sussurro">— opcional</span>}
                </label>
              }
            >
              <div className="flex flex-col items-end gap-1">
                <Input
                  id={`esc-${item.id}`}
                  type="number"
                  inputMode="decimal"
                  className="w-32"
                  min={item.min}
                  max={item.max}
                  step={item.passo ?? 'any'}
                  value={typeof r[item.id] === 'number' ? String(r[item.id]) : ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(',', '.')
                    setR((x) => ({ ...x, [item.id]: v === '' ? undefined : Number(v) }))
                  }}
                />
                {typeof r[item.id] === 'number' && numero(escore, r, item.id) === undefined && (
                  <p className="text-apoio text-critico">Valor fora da faixa aceita ({item.min ?? '—'} a {item.max ?? '—'}).</p>
                )}
              </div>
            </Linha>
          ) : item.tipo === 'escolha' ? (
            <Linha key={item.id} rotulo={item.rotulo} rotuloId={`esc-${item.id}`} ajuda={item.ajuda} opcoesEmLinha={cabeNaLinha(item.opcoes.map((o) => o.rotulo))}>
              <div role="radiogroup" aria-labelledby={`esc-${item.id}`} className="flex flex-wrap gap-2">
                {item.opcoes.map((o, idx) => (
                  <Chip key={o.rotulo} variante="opcao" radio ativo={r[item.id] === idx} onClick={() => setR((x) => ({ ...x, [item.id]: idx }))}>
                    {o.rotulo}
                  </Chip>
                ))}
              </div>
            </Linha>
          ) : (
            <label key={item.id} className="flex cursor-pointer items-center gap-3 border-b border-trilha px-5 py-3 text-controle text-tinta last:border-0 hover:bg-campo">
              <input
                type="checkbox"
                className="size-4"
                checked={r[item.id] === true}
                onChange={(e) => setR((x) => ({ ...x, [item.id]: e.target.checked }))}
              />
              <span className="flex-1">{item.rotulo}</span>
              <span className="text-apoio tabular-nums text-tinta-sussurro">{item.pontos > 0 ? `+${item.pontos}` : item.pontos}</span>
            </label>
          ),
        )}
      </section>

      {semRefPedi && <SemReferenciaPediatrica detalhe="Este escore foi validado em adultos." />}
      {semRefAdulto && <p className="text-corpo text-tinta-sussurro">Escore pediátrico: não se aplica ao adulto.</p>}

      {!semRefPedi && !semRefAdulto && !res && (
        <p className="text-apoio text-tinta-sussurro">Responda todos os itens obrigatórios para ver o resultado.</p>
      )}

      {res && (
        <section id="resultado-escore" aria-label="Resultado" aria-live="polite" className="flex scroll-mt-4 flex-col gap-2 rounded-cartao border border-fio bg-superficie px-5 py-4">
          <p className="text-corpo text-tinta">
            {/* a faixa do escore (estado) segue na cor do número, como antes na borda */}
            <span className="font-semibold">{res.rotulo}: </span>
            <span className={cn('font-semibold tabular-nums', res.estado === 2 ? 'text-critico' : res.estado === 1 ? 'text-atencao' : 'text-tinta')}>
              {res.valor}{res.unidade ? ` ${res.unidade}` : ''}
            </span>
            {res.nota && <span className="text-tinta-apoio"> · {res.nota}</span>}
          </p>
          {res.derivados.length > 0 && (
            <dl className="grid gap-x-6 gap-y-1 text-apoio sm:grid-cols-[auto_1fr]">
              {res.derivados.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-tinta-sussurro">{k}</dt>
                  <dd className="tabular-nums text-tinta">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {res.alerta && <p className={cn('text-apoio font-medium', res.estado === 2 ? 'text-critico' : 'text-atencao')}>{res.alerta}</p>}
          {/* No piloto os cuidados vão para a aba "Armadilhas". */}
          {!piloto && res.cuidados.length > 0 && (
            <ul className="list-disc pl-5 text-apoio text-tinta-apoio">
              {res.cuidados.map((c) => <li key={c}>{c}</li>)}
            </ul>
          )}
        </section>
      )}
      {piloto && !semRefPedi && !semRefAdulto ? (
        <>
          <AbasResultado
            aba={aba}
            onAba={setAba}
            passos={res ? passosDaFaixa(guia, res.estado) : []}
            semResultado={!res}
            armadilhas={[...(res?.cuidados ?? []), ...(guia?.armadilhas ?? [])]}
            ficha={escore.ficha}
            guia={guia}
            comparacao={children}
          />
          <ResumoFlutuante
            principal={res ? `${res.rotulo}: ${res.valor}${res.unidade ? ` ${res.unidade}` : ''}` : 'Responda os itens para ver o resultado'}
            detalhe={res?.nota || undefined}
            tom={res?.estado === 2 ? 'critico' : res?.estado === 1 ? 'atencao' : 'neutro'}
            textoCopia={res ? copiaDoEscore(escore, r, paciente, res) : undefined}
            alvoDetalhes={res ? ID_ABAS_RESULTADO : undefined}
            rotuloDetalhes="Próximos passos"
            aoIrDetalhes={() => setAba('proximos')}
          />
        </>
      ) : (
        children
      )}
    </ToolLayout>
  )
}

/** Texto do "Copiar" do escore: respostas dadas, resultado e derivados, alerta, fonte e versão. */
function copiaDoEscore(escore: Escore, r: Respostas, paciente: 'adulto' | 'crianca', res: NonNullable<ReturnType<Escore['calcular']>>) {
  const dados: [string, string][] = [['Paciente', paciente === 'crianca' ? 'criança' : 'adulto']]
  const marcadas: string[] = []
  for (const item of escore.itens) {
    const v = r[item.id]
    if (item.tipo === 'escolha' && typeof v === 'number') dados.push([item.rotulo, item.opcoes[v]?.rotulo ?? ''])
    else if (item.tipo === 'numero' && typeof v === 'number') dados.push([item.rotulo, `${String(v).replace('.', ',')}${item.unidade ? ` ${item.unidade}` : ''}`])
    else if (item.tipo === 'marca' && v === true) marcadas.push(item.rotulo)
  }
  if (marcadas.length) dados.push(['Marcados', marcadas.join(', ')])
  const resultado = [
    `${res.rotulo}: ${res.valor}${res.unidade ? ` ${res.unidade}` : ''}${res.nota ? ` · ${res.nota}` : ''}`,
    ...res.derivados.map(([k, v]) => `${k}: ${v}`),
    ...(res.alerta ? [res.alerta] : []),
  ]
  return textoCopia({ ferramenta: escore.ficha.titulo, dados, resultado, fonte: textoFontes(escore.ficha), versao: escore.ficha.versao, quando: new Date() })
}
