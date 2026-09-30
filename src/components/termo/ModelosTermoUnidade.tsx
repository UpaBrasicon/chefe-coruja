// ─────────────────────────────────────────────────────────────────────────────
// Modelos de termo de consentimento da unidade (protótipo: Unidade ›
// Configurações › "Termos de consentimento"). O médico escolhe o modelo no
// leito ou na porta; o texto técnico e a declaração jurídica são da unidade —
// o sistema não traz texto pronto.
//
// Editar cria VERSÃO NOVA (a anterior fica no histórico e os termos já
// gerados continuam apontando para ela); desativar tira o modelo da escolha
// do médico sem apagar nada. Só o gestor escreve (o banco confere).
// ─────────────────────────────────────────────────────────────────────────────
import { FileSignature, History, Pencil, Power, PowerOff } from 'lucide-react'
import * as React from 'react'

import { useUnidade } from '@/contexts/UnidadeContext'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Chip, Chips, TituloSecao, Vazio } from '@/components/monitor/Pagina'

import {
  CAMPOS_TERMO, mensagemErro, quando, useAtivarModeloTermo, useModelosTermoUnidade, useSalvarModeloTermo,
  type ModeloTermoLinha,
} from './termo'

type Rascunho = { modeloId: string | null; titulo: string; procedimento: string; texto: string; declaracao: string }
const VAZIO: Rascunho = { modeloId: null, titulo: '', procedimento: '', texto: '', declaracao: '' }

type Grupo = { atual: ModeloTermoLinha; anteriores: ModeloTermoLinha[] }

function agrupar(linhas: ModeloTermoLinha[]): Grupo[] {
  const porRaiz = new Map<string, ModeloTermoLinha[]>()
  for (const l of linhas) porRaiz.set(l.raiz_id, [...(porRaiz.get(l.raiz_id) ?? []), l])
  const grupos: Grupo[] = []
  for (const vs of porRaiz.values()) {
    const ordenadas = [...vs].sort((a, b) => b.versao - a.versao)
    const atual = ordenadas.find((v) => v.vigente) ?? ordenadas[0]
    grupos.push({ atual, anteriores: ordenadas.filter((v) => v.id !== atual.id) })
  }
  return grupos.sort((a, b) => a.atual.titulo.localeCompare(b.atual.titulo, 'pt-BR'))
}

export default function ModelosTermoUnidade() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade.id
  const modelos = useModelosTermoUnidade(unidadeId)
  const salvar = useSalvarModeloTermo(unidadeId)
  const ativar = useAtivarModeloTermo(unidadeId)
  const [r, setR] = React.useState<Rascunho>(VAZIO)
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [filtro, setFiltro] = React.useState<'ativos' | 'todos'>('ativos')
  const [historico, setHistorico] = React.useState<string | null>(null)
  const formulario = React.useRef<HTMLDivElement>(null)

  const grupos = agrupar(modelos.data ?? [])
  const ativos = grupos.filter((g) => g.atual.ativo)
  const visiveis = filtro === 'ativos' ? ativos : grupos
  const editando = grupos.find((g) => g.atual.id === r.modeloId)?.atual ?? null
  const pronto = r.titulo.trim().length >= 3 && r.procedimento.trim().length >= 3 && r.texto.trim().length >= 20

  function editar(m: ModeloTermoLinha) {
    setR({ modeloId: m.id, titulo: m.titulo, procedimento: m.procedimento, texto: m.texto, declaracao: m.declaracao ?? '' })
    setErro(null)
    setAviso(null)
    formulario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function gravar() {
    if (!pronto || salvar.isPending) return
    setErro(null)
    setAviso(null)
    try {
      const id = await salvar.mutateAsync(r)
      setAviso(r.modeloId
        ? id === r.modeloId ? 'Nada mudou no modelo: nenhuma versão nova.' : `“${r.titulo.trim()}” salvo como versão nova. A anterior fica no histórico.`
        : `Modelo “${r.titulo.trim()}” cadastrado.`)
      setR(VAZIO)
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  async function alternar(m: ModeloTermoLinha) {
    setErro(null)
    setAviso(null)
    try {
      await ativar.mutateAsync({ modeloId: m.id, ativo: !m.ativo })
      setAviso(m.ativo ? `“${m.titulo}” desativado: sai da escolha do médico. Os termos já gerados não mudam.` : `“${m.titulo}” reativado.`)
      if (r.modeloId === m.id && m.ativo) setR(VAZIO)
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-2xl">
        <TituloSecao className="mb-1">Termos de consentimento</TituloSecao>
        <p className="text-apoio text-tinta-sussurro [text-wrap:pretty]">
          Modelos que o médico escolhe ao gerar o termo do paciente. O texto técnico e a declaração jurídica são da unidade.
          Editar cria versão nova; a anterior fica no histórico, e os termos já gerados não mudam.
        </p>
      </div>

      {erro && <p role="alert" className="rounded-controle bg-alerta-critico px-3 py-2 text-apoio text-critico">{erro}</p>}
      {aviso && <p role="status" className="rounded-controle bg-alerta-conforme px-3 py-2 text-apoio text-conforme">{aviso}</p>}

      <Chips rotulo="Filtrar modelos">
        <Chip ativo={filtro === 'ativos'} onClick={() => setFiltro('ativos')} contagem={ativos.length}>Ativos</Chip>
        <Chip ativo={filtro === 'todos'} onClick={() => setFiltro('todos')} contagem={grupos.length}>Todos</Chip>
      </Chips>

      {modelos.isLoading ? (
        <div className="flex h-24 items-center justify-center"><Spinner /></div>
      ) : modelos.error ? (
        <p className="text-apoio text-critico">Falha ao carregar os modelos: {mensagemErro(modelos.error)}</p>
      ) : visiveis.length === 0 ? (
        <Vazio icone={FileSignature} titulo={filtro === 'ativos' ? 'Nenhum modelo ativo' : 'Nenhum modelo cadastrado'}
          texto="Sem modelo, o médico escreve o procedimento e as informações do termo à mão." />
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map(({ atual: m, anteriores }) => (
            <li key={m.raiz_id} className={cn('flex flex-col gap-1.5 rounded-container border bg-superficie px-4 py-3',
              r.modeloId === m.id ? 'border-acao' : 'border-fio')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('text-corpo font-medium text-tinta', !m.ativo && 'text-tinta-sussurro')}>{m.titulo}</span>
                <span className="text-apoio text-tinta-sussurro">{m.procedimento}</span>
                {!m.ativo && <Badge variant="secondary">Desativado</Badge>}
                <Badge variant="outline">Versão {m.versao}</Badge>
              </div>
              <p className="line-clamp-2 text-rotulo text-tinta-sussurro">{m.texto}</p>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="outline" size="xs" onClick={() => editar(m)} disabled={r.modeloId === m.id}>
                  <Pencil />
                  Editar
                </Button>
                <Button variant={m.ativo ? 'destructive' : 'outline'} size="xs" onClick={() => void alternar(m)} disabled={ativar.isPending}>
                  {m.ativo ? <PowerOff /> : <Power />}
                  {m.ativo ? 'Desativar' : 'Reativar'}
                </Button>
                {anteriores.length > 0 && (
                  <Button variant="ghost" size="xs" onClick={() => setHistorico((h) => (h === m.raiz_id ? null : m.raiz_id))}
                    aria-expanded={historico === m.raiz_id}>
                    <History />
                    {anteriores.length === 1 ? '1 versão anterior' : `${anteriores.length} versões anteriores`}
                  </Button>
                )}
              </div>
              {historico === m.raiz_id && (
                <ul className="mt-1 flex flex-col gap-2 border-t border-trilha pt-2">
                  {anteriores.map((v) => (
                    <li key={v.id} className="text-rotulo text-tinta-sussurro">
                      <span className="font-semibold">Versão {v.versao}</span> · {quando(v.criado_em)} · {v.titulo} · {v.procedimento}
                      <p className="mt-0.5 whitespace-pre-wrap text-tinta-apoio">{v.texto}</p>
                      {v.declaracao && <p className="mt-0.5 whitespace-pre-wrap italic">Declaração: {v.declaracao}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <div ref={formulario} className="flex flex-col gap-2.5 rounded-container border border-fio bg-superficie p-4">
        <p className="text-corpo font-semibold text-tinta">
          {editando ? `Editar “${editando.titulo}” (salva como versão ${editando.versao + 1})` : 'Novo modelo'}
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Input value={r.titulo} onChange={(e) => setR((x) => ({ ...x, titulo: e.target.value }))} placeholder="Nome do modelo" aria-label="Nome do modelo" maxLength={120} />
          <Input value={r.procedimento} onChange={(e) => setR((x) => ({ ...x, procedimento: e.target.value }))} placeholder="Procedimento" aria-label="Procedimento" maxLength={200} />
        </div>
        <Textarea value={r.texto} onChange={(e) => setR((x) => ({ ...x, texto: e.target.value }))} rows={5}
          placeholder="Texto técnico: o que é, benefícios, riscos e alternativas" aria-label="Texto técnico" />
        <p className="text-rotulo leading-[1.5] text-tinta-sussurro [text-wrap:pretty]">
          Campos que o sistema preenche: {CAMPOS_TERMO.map((c, i) => (
            <React.Fragment key={c.chave}>{i > 0 && ', '}<code className="font-mono text-tinta-apoio">{`{${c.chave}}`}</code> ({c.descricao})</React.Fragment>
          ))}.
        </p>
        <label className="flex flex-col gap-1 text-apoio font-medium text-grafite">
          Declaração do termo (texto jurídico da unidade)
          <Textarea value={r.declaracao} onChange={(e) => setR((x) => ({ ...x, declaracao: e.target.value }))} rows={3}
            placeholder="Continua depois de “Eu, [nome], ”. Em branco, sai a frase padrão." />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          {(r.modeloId || r.titulo || r.texto) && (
            <Button variant="outline" size="sm" onClick={() => { setR(VAZIO); setErro(null) }}>
              {r.modeloId ? 'Desistir da edição' : 'Limpar'}
            </Button>
          )}
          <Button size="sm" onClick={() => void gravar()} disabled={!pronto || salvar.isPending || !unidadeId}>
            {salvar.isPending && <Spinner className="size-3.5 text-white" />}
            {r.modeloId ? 'Salvar versão nova' : 'Adicionar modelo'}
          </Button>
        </div>
      </div>
    </div>
  )
}
