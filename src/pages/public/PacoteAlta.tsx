// Pacote de alta — a página do paciente, sem login (Fase 3.6).
// O link sozinho não mostra nada: o código de 6 dígitos impresso na orientação
// de alta é pedido a CADA abertura (nada fica guardado no aparelho, de
// propósito). Três códigos errados bloqueiam o link.
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { useParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'

type Documento = { tipo: string; numero: string | null; emitido_em: string; conteudo: string }
type Aberto = {
  situacao: 'ok'
  primeiro_nome: string
  unidade: string
  alta_em: string | null
  expira_em: string
  orientacoes: string[]
  retorno: string | null
  documentos: Documento[]
}
type Resposta = Aberto | { situacao: string; restantes?: number }

const NOME_DOC: Record<string, string> = {
  receita: 'Receita',
  atestado: 'Atestado',
  encaminhamento: 'Encaminhamento',
  pedido_exames: 'Pedido de exames',
  sumario_alta: 'Resumo da alta',
}
const RECUSA: Record<string, string> = {
  inexistente: 'Este link não existe. Confira o endereço na folha da alta.',
  revogado: 'Este link foi desativado pela unidade. Peça um novo na recepção.',
  bloqueado: 'Três códigos errados bloquearam este link. Peça um novo na unidade.',
  expirado: 'Este link venceu (vale 30 dias). Peça um novo na unidade.',
}

const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '')

// O conteúdo do documento é o que a ferramenta gravou; aqui vira texto simples.
function legivel(conteudo: string): { rotulo: string; valor: string }[] {
  let obj: unknown
  try {
    obj = JSON.parse(conteudo)
  } catch {
    return [{ rotulo: '', valor: conteudo }]
  }
  const linhas: { rotulo: string; valor: string }[] = []
  const andar = (v: unknown, chave: string) => {
    if (/(^id$|_id$|^paciente$|^setor|^unidade|cpf|cns|nascimento)/i.test(chave)) return
    if (v === null || v === undefined || v === '' || v === false) return
    if (Array.isArray(v)) return v.forEach((x) => andar(x, chave))
    if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).forEach(([k, x]) => andar(x, k))
    const rotulo = chave.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
    linhas.push({ rotulo: rotulo.charAt(0).toUpperCase() + rotulo.slice(1), valor: v === true ? 'sim' : String(v) })
  }
  andar(obj, '')
  return linhas
}

export default function PacoteAlta() {
  const { token = '' } = useParams()
  const [codigo, setCodigo] = React.useState('')
  const [resposta, setResposta] = React.useState<Resposta | null>(null)
  const [enviando, setEnviando] = React.useState(false)

  const situacao = useQuery({
    queryKey: ['pacote-alta-situacao', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('situacao_pacote_alta', { p_token: token })
      if (error) throw error
      return data as unknown as { situacao: string; unidade?: string }
    },
  })

  async function conferir(c: string) {
    setEnviando(true)
    const { data, error } = await supabase.rpc('abrir_pacote_alta', { p_token: token, p_codigo: c })
    setEnviando(false)
    setCodigo('')
    setResposta(error ? { situacao: 'falha' } : (data as unknown as Resposta))
  }

  const r = resposta
  const aberto = r?.situacao === 'ok' ? (r as Aberto) : null
  const recusa = RECUSA[r?.situacao ?? ''] ?? (situacao.data && situacao.data.situacao !== 'ativo' ? RECUSA[situacao.data.situacao] : null)

  return (
    <div className="min-h-screen bg-campo px-4 py-8 text-tinta">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5">
        <header>
          <p className="text-sm text-tinta-apoio">{aberto?.unidade ?? situacao.data?.unidade ?? 'Chefe Coruja'}</p>
          <h1 className="text-2xl font-semibold">Sua alta</h1>
        </header>

        {recusa && !aberto && <p className="rounded-lg border border-critico/30 bg-critico/[0.08] p-4 text-critico">{recusa}</p>}

        {!aberto && !recusa && (
          <section className="flex flex-col gap-3 rounded-xl border border-fio bg-superficie p-5">
            <label htmlFor="codigo" className="font-medium">Digite o código de 6 dígitos da folha da alta</label>
            <input
              id="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigo}
              disabled={enviando}
              onChange={(e) => {
                const c = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCodigo(c)
                if (c.length === 6) void conferir(c)
              }}
              className="h-12 rounded-lg border border-fio bg-campo px-3 text-center font-mono text-2xl tracking-[0.4em]"
            />
            {r?.situacao === 'codigo_errado' && (
              <p className="text-sm text-critico">Código errado. Restam {(r as { restantes?: number }).restantes} tentativa(s).</p>
            )}
            {r?.situacao === 'falha' && <p className="text-sm text-critico">Sem conexão. Tente de novo.</p>}
            <p className="text-xs text-tinta-apoio">O código é pedido toda vez que você abrir esta página. Nada fica guardado no aparelho.</p>
          </section>
        )}

        {aberto && (
          <>
            <p>
              Olá, {aberto.primeiro_nome}. {aberto.alta_em ? `Alta em ${dia(aberto.alta_em)}. ` : ''}Este link vale até {dia(aberto.expira_em)}.
            </p>
            <details open className="rounded-xl border border-fio bg-superficie p-4">
              <summary className="cursor-pointer font-semibold">Orientações</summary>
              <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
                {aberto.orientacoes.map((o, k) => <li key={k}>{o}</li>)}
              </ol>
              {aberto.retorno && <p className="mt-3"><strong>Retorno:</strong> {aberto.retorno}</p>}
            </details>
            {aberto.documentos.map((d, k) => (
              <details key={k} className="rounded-xl border border-fio bg-superficie p-4">
                <summary className="cursor-pointer font-semibold">
                  {NOME_DOC[d.tipo] ?? d.tipo}
                  <span className="ml-2 text-xs font-normal text-tinta-apoio">nº {d.numero ?? '—'} · {dia(d.emitido_em)}</span>
                </summary>
                <dl className="mt-2 flex flex-col gap-1 text-sm">
                  {legivel(d.conteudo).map((l, j) => (
                    <div key={j}>
                      {l.rotulo && <dt className="inline font-medium">{l.rotulo}: </dt>}
                      <dd className="inline whitespace-pre-wrap">{l.valor}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ))}
            {aberto.documentos.length === 0 && (
              <p className="text-sm text-tinta-apoio">Nenhum documento emitido além das orientações.</p>
            )}
            <button type="button" onClick={() => window.print()} className="self-start rounded-lg border border-fio px-4 py-2 text-sm">
              Imprimir
            </button>
            <p className="text-xs text-tinta-apoio">
              Os documentos com valor legal são as vias assinadas entregues na alta. Esta página é uma cópia para consulta.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
