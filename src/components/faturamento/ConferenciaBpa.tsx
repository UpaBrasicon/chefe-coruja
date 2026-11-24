// Conferência do BPA na ordem de quem fecha (revisão do perfil Faturamento,
// RT em 24/11/2026): o resumo numa frase (FT4), o que impede o fechamento como
// primeiro passo e os avisos recolhidos (FT2) e "Para corrigir" por causa, com
// os pacientes e a lista para a recepção (FT3). As regras moram em
// src/lib/bpaResumo.ts; os dados são os da RPC bpa_conferencia.
import { ChevronRight, Download, Printer } from 'lucide-react'
import * as React from 'react'

import { EnderecoSus } from '@/components/paciente/EnderecoSus'
import { Aviso } from '@/components/ui/aviso'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { competenciaNaTela } from '@/lib/aih'
import { codigoSigtapNaTela, ORIGEM_BPA, type Conferencia, type GlobalBpa, type OrigemBpa } from '@/lib/bpa'
import {
  BLOQUEIO_DO_GESTOR, BLOQUEIO_NA_CONFIGURACAO, csvParaRecepcao, efeitoNaTela, faltaNaTela, frasePanorama, gruposParaCorrigir, htmlParaRecepcao,
  ONDE_CORRIGE, pacientesComFalta, partesDoBloqueio, plural, type GrupoCorrigir, type PacienteCorrigir,
} from '@/lib/bpaResumo'
import { baixarCsv, nomeArquivoCsv } from '@/lib/csv'
import { dataIso, diaMes, dataHora } from '@/lib/formato'

/** FT4: a frase com os números e, abaixo, o detalhe por tipo de linha. */
export function ResumoBpa({ c }: { c: Conferencia }) {
  const tipos = (Object.keys(ORIGEM_BPA) as OrigemBpa[]).filter((o) => (c.por_origem[o] ?? 0) > 0)
  return (
    <div className="flex flex-col gap-1">
      <p className="text-corpo text-tinta text-pretty">{frasePanorama(c)}</p>
      {tipos.length > 0 && (
        <p className="text-apoio text-tinta-sussurro">
          {tipos.map((o) => `${ORIGEM_BPA[o]}: ${c.por_origem[o]}`).join(' · ')}
        </p>
      )}
    </div>
  )
}

/** FT2: o que impede o fechamento vem primeiro, com o caminho; os avisos numa linha recolhida. */
export function AntesDeFechar({ globais, onConfigurar }: { globais: GlobalBpa[]; onConfigurar: () => void }) {
  const bloqueios = globais.filter((g) => g.tipo === 'bloqueio')
  const avisos = globais.filter((g) => g.tipo === 'aviso')
  if (bloqueios.length === 0 && avisos.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {bloqueios.length > 0 && (
        <Aviso tom="critico" titulo={bloqueios.length === 1 ? 'Antes de fechar' : `Antes de fechar: ${bloqueios.length} passos`}>
          <ol className="flex flex-col gap-1">
            {bloqueios.map((g) => {
              const { titulo, detalhe } = partesDoBloqueio(g)
              return (
                <li key={g.codigo} className="flex flex-col">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{titulo}</span>
                    {BLOQUEIO_NA_CONFIGURACAO.has(g.codigo) && (
                      <>
                        <span aria-hidden>·</span>
                        <Button type="button" variant="link" className="min-h-0 p-0 align-baseline text-critico underline" onClick={onConfigurar}>abrir Configuração</Button>
                      </>
                    )}
                    {BLOQUEIO_DO_GESTOR.has(g.codigo) && <span className="text-tinta-apoio">· o gestor preenche em Unidade › Configurações</span>}
                  </span>
                  {detalhe && <span className="text-tinta-apoio">{detalhe}</span>}
                </li>
              )
            })}
          </ol>
        </Aviso>
      )}
      {avisos.length > 0 && (
        <details className="group rounded-container border border-fio bg-superficie px-3 py-2 text-apoio">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-atencao">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
            {plural(avisos.length, 'aviso', 'avisos')}
            <span className="text-tinta-sussurro">· não impedem o fechamento</span>
          </summary>
          <ul className="mt-2 flex flex-col gap-1 pl-6 text-tinta-apoio">
            {avisos.map((g) => <li key={g.codigo}>{g.texto}</li>)}
          </ul>
        </details>
      )}
    </div>
  )
}

/** FT2: uma frase sobre as duas competências do fechamento. */
export function ExplicaProcessamento({ competencia }: { competencia: string }) {
  return (
    <p className="text-rotulo text-tinta-sussurro">
      {competenciaNaTela(competencia)} é o mês dos atendimentos. A competência de processamento é o mês em que o arquivo é entregue ao SIA,
      em geral o mês corrente.
    </p>
  )
}

function abrirFolha(html: string): string | null {
  const janela = window.open('', '_blank')
  if (!janela) return 'O navegador bloqueou a janela de impressão. Permita janelas deste site e tente de novo.'
  janela.document.write(html)
  janela.document.close()
  janela.focus()
  setTimeout(() => janela.print(), 300)
  return null
}

/** FT3: as causas, cada uma com os pacientes e o que falta; a lista sai para a recepção. */
export function ParaCorrigirBpa({ c, competencia, unidadeNome, onConfigurar }: {
  c: Conferencia; competencia: string; unidadeNome: string; onConfigurar: () => void
}) {
  const grupos = gruposParaCorrigir(c.linhas)
  const pacientes = pacientesComFalta(c.linhas)
  const [erro, setErro] = React.useState<string | null>(null)
  const cab = () => ({ unidade: unidadeNome, competencia: competenciaNaTela(competencia), geradoEm: Date.now() })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-corpo">Para corrigir</CardTitle>
        <CardDescription>
          Cada causa abre o que precisa ser completado e onde. Até 500 linhas, as que ficam fora primeiro.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        {grupos.length === 0 ? (
          <p className="text-tinta-sussurro">Nada para corrigir nesta competência.</p>
        ) : (
          <>
            {pacientes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-controle border border-fio bg-trilha/60 px-3 py-2">
                <span className="mr-auto text-tinta-apoio">
                  Lista para a recepção: {plural(pacientes.length, 'paciente', 'pacientes')} com cadastro incompleto
                </span>
                <Button size="xs" variant="outline"
                  onClick={() => baixarCsv(nomeArquivoCsv(`cadastros para completar ${competencia}`, dataIso()), csvParaRecepcao(pacientes, cab()))}>
                  <Download className="size-3.5" aria-hidden /> CSV
                </Button>
                <Button size="xs" variant="outline" onClick={() => setErro(abrirFolha(htmlParaRecepcao(pacientes, cab())))}>
                  <Printer className="size-3.5" aria-hidden /> Imprimir
                </Button>
              </div>
            )}
            <MensagemErro texto={erro} />
            <ul className="flex flex-col divide-y divide-trilha rounded-controle border border-fio">
              {grupos.map((g) => <GrupoParaCorrigir key={g.codigo} g={g} onConfigurar={onConfigurar} />)}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function GrupoParaCorrigir({ g, onConfigurar }: { g: GrupoCorrigir; onConfigurar: () => void }) {
  const quantos = g.quem === 'paciente' ? plural(g.pacientes.length, 'paciente', 'pacientes') : plural(g.linhas.length, 'linha', 'linhas')
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2">
          <ChevronRight className="size-4 shrink-0 self-center text-tinta-sussurro transition-transform group-open:rotate-90" aria-hidden />
          <span className="font-medium text-tinta">{g.rotulo}</span>
          <span className="tabular-nums text-tinta-apoio">{quantos}</span>
          <span className={g.efeito.fora > 0 ? 'text-critico' : 'text-tinta-sussurro'}>{efeitoNaTela(g.efeito)}</span>
        </summary>
        <div className="flex flex-col gap-2 px-3 pb-3 pl-9">
          <p className="text-tinta-apoio">
            {ONDE_CORRIGE[g.quem]}
            {g.quem === 'configuracao' && (
              <> <Button type="button" variant="link" className="min-h-0 p-0 align-baseline underline" onClick={onConfigurar}>Abrir Configuração</Button></>
            )}
          </p>
          {g.quem === 'paciente' ? (
            <ul className="flex flex-col gap-1.5">
              {g.pacientes.map((p) => <PacienteParaCorrigir key={p.paciente_id} p={p} />)}
            </ul>
          ) : (
            <ul className="flex flex-col gap-1">
              {g.linhas.map((l) => (
                <li key={`${l.origem}-${l.origem_id}`} className="flex flex-wrap gap-x-2 text-tinta-apoio">
                  <span className="text-tinta">{l.profissional ?? 'Sem profissional'}</span>
                  <span className="text-rotulo text-tinta-sussurro">
                    {ORIGEM_BPA[l.origem]} · {codigoSigtapNaTela(l.procedimento)}{l.quantidade > 1 ? ` × ${l.quantidade}` : ''} · {dataHora(l.em)} · {l.paciente}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  )
}

// Endereço, nacionalidade, etnia e o motivo de não ter CPF o faturamento completa
// aqui (EnderecoSus); raça/cor, sexo, nascimento e CNS/CPF são da recepção.
const COMPLETA_AQUI = new Set(['endereco', 'nacionalidade', 'etnia', 'documento'])

function PacienteParaCorrigir({ p }: { p: PacienteCorrigir }) {
  const [aberto, setAberto] = React.useState(false)
  const podeAqui = p.falta.some((k) => COMPLETA_AQUI.has(k))
  return (
    <li className="flex flex-col gap-1.5 rounded-controle border border-fio px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium text-tinta">{p.paciente}</span>
        <span className="text-tinta-apoio">falta {faltaNaTela(p.falta)}</span>
        <span className="text-rotulo text-tinta-sussurro">atendido em {p.atendimentos.map((e) => diaMes(e)).join(', ')}</span>
        {podeAqui && (
          <Button type="button" size="xs" variant="outline" className="ml-auto" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
            {aberto ? 'Fechar cadastro' : 'Abrir cadastro'}
          </Button>
        )}
      </div>
      {aberto && <EnderecoSus pacienteId={p.paciente_id} titulo={false} />}
    </li>
  )
}
