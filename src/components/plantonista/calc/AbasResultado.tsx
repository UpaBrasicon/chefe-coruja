import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'

import type { Ficha } from '@/clinico/ficha'
import { textoRef, type Guia, type ItemGuia, type PassoGuia } from '@/clinico/guia'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { ID_ABAS_RESULTADO, type IdAba } from './contexto'

// Abas abaixo do resultado, como no modelo do RT (MDCalc): Próximos passos,
// Armadilhas, Evidências e Comentário do RT. Pedido do RT de 16/11/2026;
// próximos passos e comentário do RT = opção A. Toda frase mostra a fonte.


export function AbasResultado({
  aba,
  onAba,
  passos,
  semResultado,
  armadilhas,
  ficha,
  guia,
  comparacao,
}: {
  aba: IdAba
  onAba: (a: IdAba) => void
  passos: PassoGuia[]
  /** ainda sem resultado: os próximos passos esperam as respostas */
  semResultado?: boolean
  /** do escore (cuidados) e do guia */
  armadilhas: (ItemGuia | string)[]
  ficha: Ficha
  guia?: Guia
  /** tabelas de comparação entre fontes que a ferramenta já tinha */
  comparacao?: ReactNode
}) {
  return (
    <section id={ID_ABAS_RESULTADO} aria-label="Próximos passos e evidências" className="scroll-mt-4 rounded-cartao border border-fio bg-superficie px-5 pt-3 pb-5">
      <Tabs value={aba} onValueChange={(v) => onAba(v as IdAba)} className="gap-4">
        <TabsList>
          <TabsTrigger value="proximos">Próximos passos</TabsTrigger>
          <TabsTrigger value="armadilhas">Armadilhas</TabsTrigger>
          <TabsTrigger value="evidencias">Evidências</TabsTrigger>
          <TabsTrigger value="comentario">Comentário do RT</TabsTrigger>
        </TabsList>

        <TabsContent value="proximos" className="flex flex-col gap-3 text-apoio">
          {semResultado ? (
            <p className="text-tinta-sussurro">Responda os itens: os próximos passos dependem do resultado.</p>
          ) : passos.length === 0 ? (
            <p className="text-tinta-sussurro">Ainda sem próximos passos aprovados pelo responsável técnico para esta ferramenta. Veja as evidências e as armadilhas.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {passos.map((p) => (
                <li key={p.tema ?? p.texto} className="flex flex-col gap-0.5 border-l-2 border-acao pl-3">
                  {p.tema && <span className="font-semibold text-tinta">{p.tema}</span>}
                  <span className="text-tinta">{p.texto}</span>
                  <span className="text-rotulo text-tinta-sussurro">{textoRef(p.ref)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-rotulo text-tinta-sussurro">Referência da fonte citada, não ordem médica: a decisão é do médico.</p>
        </TabsContent>

        <TabsContent value="armadilhas" className="text-apoio">
          {armadilhas.length === 0 ? (
            <p className="text-tinta-sussurro">Sem armadilhas registradas para esta ferramenta.</p>
          ) : (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-tinta">
              {armadilhas.map((a) => (typeof a === 'string' ? <li key={a}>{a}</li> : <li key={a.texto}>{a.texto} <span className="text-tinta-sussurro">({textoRef(a.ref)})</span></li>))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="evidencias" className="flex flex-col gap-4 text-apoio">
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-tinta">Fontes desta ferramenta</span>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-tinta">
              {ficha.fontes.map((f) => (
                <li key={f.citacao}>
                  {f.citacao}
                  {f.url && (
                    <a href={f.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-acao underline-offset-4 hover:underline">
                      abrir <ExternalLink className="size-3" aria-hidden />
                    </a>
                  )}
                </li>
              ))}
            </ol>
            <span className="text-rotulo text-tinta-sussurro">Revisado em {ficha.revisadoEm} · versão da regra {ficha.versao}</span>
          </div>
          {(guia?.evidencias ?? []).length > 0 && (
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              {guia!.evidencias!.map((e) => <li key={e.texto}>{e.texto} <span className="text-tinta-sussurro">({textoRef(e.ref)})</span></li>)}
            </ul>
          )}
          {comparacao}
        </TabsContent>

        <TabsContent value="comentario" className="text-apoio">
          {guia?.comentarioRT ? (
            <figure className="flex flex-col gap-1 border-l-2 border-acao pl-3">
              <blockquote className="text-tinta">{guia.comentarioRT.texto}</blockquote>
              <figcaption className="text-rotulo text-tinta-sussurro">{guia.comentarioRT.autor}, {guia.comentarioRT.data}</figcaption>
            </figure>
          ) : (
            <p className="text-tinta-sussurro">O responsável técnico ainda não comentou esta ferramenta.</p>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}
