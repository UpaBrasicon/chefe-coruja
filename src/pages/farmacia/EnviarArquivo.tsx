// "Enviar lista de medicações" e "Enviar padrão da unidade" (P/index.html
// 9612–9625 e 9680–9690). O arquivo vai ao bucket privado "farmacia", na pasta
// da unidade, e fica registrado em arquivos_farmacia (quem, quando, nome,
// tamanho) — migration 20261009000001. O app não lê o conteúdo.
// compacto (revisão visual 3.7b): uma linha só, o último arquivo e o botão de
// enviar à direita, para ficar no topo da Disponibilidade sem cartão.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, ShieldCheck, type LucideIcon } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { dataHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

type Arquivo = { id: string; nome: string; tamanho: number; caminho: string; enviado_em: string; enviado_por: { nome_completo: string } | null }

const ACEITOS = '.xlsx,.xls,.csv,.doc,.docx,.pdf'
const tamanho = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`)
const quando = (iso: string) => dataHora(iso)

export function EnviarArquivo({ unidade, tipo, rotulo, ajuda, icone: Icone, compacto = false }: {
  unidade: string; tipo: 'lista_medicacoes' | 'padrao_diluicao'; rotulo: string; ajuda: string; icone: LucideIcon; compacto?: boolean
}) {
  const qc = useQueryClient()
  const [enviando, setEnviando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const recentes = useQuery({
    queryKey: ['arquivos-farmacia', unidade, tipo],
    queryFn: async () => {
      const { data, error } = await supabase.from('arquivos_farmacia' as never)
        .select('id, nome, tamanho, caminho, enviado_em, enviado_por:perfis!arquivos_farmacia_enviado_por_fkey(nome_completo)')
        .eq('unidade_id', unidade).eq('tipo', tipo).order('enviado_em', { ascending: false }).limit(3)
      if (error) throw error
      return (data ?? []) as unknown as Arquivo[]
    },
  })

  async function enviar(arquivo: File) {
    setEnviando(true); setErro(null)
    try {
      const nomeSeguro = arquivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-120)
      const caminho = `${unidade}/${tipo}/${Date.now()}-${nomeSeguro}`
      const up = await supabase.storage.from('farmacia').upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false })
      if (up.error) throw up.error
      const { error } = await supabase.rpc('registrar_arquivo_farmacia', {
        p_unidade: unidade, p_tipo: tipo, p_caminho: caminho, p_nome: arquivo.name, p_tamanho: arquivo.size, p_tipo_mime: arquivo.type || undefined,
      })
      if (error) throw error
      void qc.invalidateQueries({ queryKey: ['arquivos-farmacia', unidade, tipo] })
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  async function baixar(a: Arquivo) {
    const { data, error } = await supabase.storage.from('farmacia').createSignedUrl(a.caminho, 60, { download: a.nome })
    if (error) return setErro(error.message)
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const ultimo = recentes.data?.[0]
  const campo = (
    <input type="file" accept={ACEITOS} className="sr-only" disabled={enviando}
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void enviar(f) }} />
  )
  if (compacto) {
    return (
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-apoio">
        {ultimo ? (
          <>
            <span className="text-tinta-sussurro">{tipo === 'lista_medicacoes' ? 'Última lista' : 'Último padrão enviado'}: {ultimo.nome} · recebido {quando(ultimo.enviado_em)}{ultimo.enviado_por ? ` · ${ultimo.enviado_por.nome_completo}` : ''}</span>
            <Button variant="link" size="xs" onClick={() => void baixar(ultimo)} className="h-auto min-h-0 gap-1 px-0">
              <Download className="size-3.5" aria-hidden /> Baixar
            </Button>
          </>
        ) : <span className="text-tinta-sussurro">{tipo === 'lista_medicacoes' ? 'Nenhuma lista enviada ainda.' : 'Nenhum padrão enviado ainda.'}</span>}
        <label title={ajuda} className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-controle border border-fio bg-superficie px-2.5 py-1 text-rotulo font-medium text-tinta-apoio transition-colors hover:border-acao hover:text-acao has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-acao">
          {campo}
          {enviando ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Icone className="size-3.5" aria-hidden />}
          <span>{enviando ? 'Enviando…' : rotulo}</span>
        </label>
        {erro && <p role="alert" className="basis-full text-apoio text-critico">{erro}</p>}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-cartao border border-fio bg-superficie px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-controle bg-acao px-3.5 py-2 text-apoio font-medium text-sobre-acao transition-opacity hover:opacity-90 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-acao">
          {campo}
          {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icone className="size-4" aria-hidden />}
          <span>{enviando ? 'Enviando…' : rotulo}</span>
        </label>
        <span className="min-w-[240px] flex-1 text-apoio text-pretty text-tinta-sussurro">{ajuda}</span>
      </div>
      {ultimo && (
        <div className="flex flex-wrap items-center gap-2 text-apoio text-conforme">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          <span>{ultimo.nome} · {tamanho(ultimo.tamanho)} · recebido {quando(ultimo.enviado_em)}{ultimo.enviado_por ? ` · ${ultimo.enviado_por.nome_completo}` : ''}</span>
          <Button variant="link" size="xs" onClick={() => void baixar(ultimo)} className="h-auto min-h-0 gap-1 px-0">
            <Download className="size-3.5" aria-hidden /> Baixar
          </Button>
        </div>
      )}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
    </div>
  )
}
