// Detalhes da admissão (protótipo, Configurações da Unidade, P/index.html
// 7626–7645): esquemas que o médico marca na admissão, só para estatística da
// unidade — não geram solicitação e não saem na folha. O banco já tinha a
// configuração (migration 20261005000002: admissao_detalhes_config,
// salvar_admissao_esquema, definir_admissao_detalhes_obrigatorio); faltava a
// tela do gestor.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Cartao, Chip } from '@/components/documentos/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Esquema = { id: string; nome: string; itens: string[]; ativo: boolean }
type Config = { esquemas: Esquema[]; obrigatorios: string[] }

export function DetalhesAdmissao() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const [nome, setNome] = React.useState('')
  const [itens, setItens] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)

  const cfg = useQuery({
    queryKey: ['admissao-detalhes-config', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admissao_detalhes_config', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as Config
    },
  })
  const setores = useQuery({
    queryKey: ['setores-internacao-config', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('setores').select('id, nome').eq('unidade_id', unidadeId!).eq('ativo', true)
        .eq('tipo', 'internacao').order('ordem')
      if (error) throw error
      return data ?? []
    },
  })
  const recarregar = () => void qc.invalidateQueries({ queryKey: ['admissao-detalhes-config'] })

  async function salvar(e: { nome: string; itens: string[]; id?: string; ativo?: boolean }) {
    setErro(null)
    const { error } = await supabase.rpc('salvar_admissao_esquema', {
      p_unidade: unidadeId!, p_nome: e.nome, p_itens: e.itens, p_esquema: e.id, p_ativo: e.ativo ?? true,
    })
    if (error) { setErro(error.message); return false }
    recarregar()
    return true
  }
  async function obrigatorio(setor: string, sim: boolean) {
    setErro(null)
    const { error } = await supabase.rpc('definir_admissao_detalhes_obrigatorio', { p_setor: setor, p_obrigatorio: sim })
    if (error) return setErro(error.message)
    recarregar()
  }

  const esquemas = cfg.data?.esquemas ?? []
  const obrig = new Set(cfg.data?.obrigatorios ?? [])
  const lista = itens.split(',').map((x) => x.trim()).filter(Boolean)

  return (
    <Cartao icone={<ClipboardList />} titulo="Detalhes da admissão">
      <p className="text-apoio text-pretty text-tinta-sussurro">
        Esquemas que o médico marca na admissão, só para estatística da unidade. Não geram solicitação e não saem na folha. Sem esquema ativo, o bloco não aparece na admissão.
      </p>
      <div className="flex flex-col">
        {esquemas.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum esquema cadastrado.</span>}
        {esquemas.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-3 border-b border-trilha py-2.5 last:border-0">
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
              <span className={e.ativo ? 'text-corpo font-medium text-tinta' : 'text-corpo font-medium text-tinta-sussurro line-through'}>{e.nome}</span>
              <span className="text-apoio text-tinta-sussurro">{e.itens.join(', ')}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => void salvar({ ...e, ativo: !e.ativo })}>{e.ativo ? 'Remover' : 'Reativar'}</Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-[1_1_200px] flex-col gap-[5px]"><span className="text-apoio font-medium text-grafite">Esquema</span>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Origem da internação" /></label>
        <label className="flex flex-[2_1_280px] flex-col gap-[5px]"><span className="text-apoio font-medium text-grafite">Itens (separe por vírgula)</span>
          <Input value={itens} onChange={(e) => setItens(e.target.value)} placeholder="Ex.: Demanda espontânea, SAMU, Transferência" /></label>
        <Button disabled={nome.trim().length < 2 || lista.length === 0} onClick={async () => {
          if (await salvar({ nome, itens: lista })) { setNome(''); setItens('') }
        }}>Incluir esquema</Button>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-apoio font-medium text-grafite">Obrigatório nos setores</span>
        <div className="flex flex-wrap gap-[7px]">
          {(setores.data ?? []).map((s) => (
            <Chip key={s.id} ativo={obrig.has(s.id)} onClick={() => void obrigatorio(s.id, !obrig.has(s.id))}>{s.nome}</Chip>
          ))}
          {setores.data?.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum setor de internação.</span>}
        </div>
      </div>
      {erro && <p className="text-apoio text-critico">{erro}</p>}
    </Cartao>
  )
}
