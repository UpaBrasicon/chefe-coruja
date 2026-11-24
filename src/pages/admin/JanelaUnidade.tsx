import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { TIPO_UNIDADE_LABEL } from '@/lib/constants'
import type { UnidadeCadastro } from '@/lib/dadosAdmin'
import { ramoParaGravar, RAMO_ROTULO, type Ramo } from '@/lib/redeSecretaria'
import type { TipoUnidade } from '@/types/database'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'

// 5A, tarefa 1 (D2 do RT em 02/11/2026; tela na opção A): cadastro e edição
// da unidade numa janela, pelas RPCs admin_criar_unidade e
// admin_editar_unidade. O CNES entra no cadastro; depois é do gestor
// (definir_cnes_unidade, em Configuração).
//
// Rede por secretaria (RT, 24/11/2026): o "Nova unidade" da árvore abre esta
// mesma janela com a organização, a secretaria e o tipo já escolhidos; depois
// de criar, liga a unidade à secretaria (admin_unidade_na_rede).

/** O que o "Nova unidade" da árvore da rede já traz escolhido. */
export type NovaUnidadeInicial = {
  organizacao_id: string
  tipo: TipoUnidade | ''
  secretaria: { id: string; nome: string } | null
  ramo: Ramo | null
}

const TIPOS = Object.keys(TIPO_UNIDADE_LABEL) as TipoUnidade[]

/** Linha da janela: rótulo à esquerda, campo à direita (no celular, um embaixo do outro). */
function Linha({ id, rotulo, nota, children }: { id: string; rotulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[140px_1fr] sm:items-start sm:gap-4">
      <Label htmlFor={id} className="sm:pt-2">{rotulo}</Label>
      <div className="flex min-w-0 flex-col gap-1">
        {children}
        {nota && <span className="text-rotulo text-tinta-sussurro">{nota}</span>}
      </div>
    </div>
  )
}

/** `unidade` nula com `aberto` = nova unidade. */
export function JanelaUnidade({ aberto, unidade, inicial, onFechar }: {
  aberto: boolean; unidade: UnidadeCadastro | null; inicial?: NovaUnidadeInicial | null; onFechar: () => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent className="sm:max-w-xl">
        {/* a chave refaz o formulário com os dados da unidade escolhida (ou em branco) */}
        {aberto && <FormUnidade key={unidade?.id ?? 'nova'} unidade={unidade} inicial={unidade ? null : inicial ?? null} onFechar={onFechar} />}
      </DialogContent>
    </Dialog>
  )
}

function FormUnidade({ unidade, inicial, onFechar }: { unidade: UnidadeCadastro | null; inicial: NovaUnidadeInicial | null; onFechar: () => void }) {
  const qc = useQueryClient()
  const nova = !unidade
  const [orgId, setOrgId] = React.useState(unidade?.organizacao_id ?? inicial?.organizacao_id ?? '')
  const [nome, setNome] = React.useState(unidade?.nome ?? '')
  const [tipo, setTipo] = React.useState<TipoUnidade | ''>(unidade?.tipo ?? inicial?.tipo ?? '')
  const [cnes, setCnes] = React.useState(unidade?.cnes ?? '')
  const [municipio, setMunicipio] = React.useState(unidade?.municipio ?? '')
  const [uf, setUf] = React.useState(unidade?.uf ?? '')
  const [endereco, setEndereco] = React.useState(unidade?.endereco ?? '')
  const [ativo, setAtivo] = React.useState(unidade?.ativo ?? true)

  const orgs = useQuery({
    queryKey: ['organizacoes-admin'],
    enabled: nova,
    queryFn: async () => {
      const { data, error } = await supabase.from('organizacoes').select('id, nome').eq('ativo', true).order('nome')
      if (error) throw error
      return data ?? []
    },
  })
  const listaOrgs = orgs.data ?? []
  const org = nova ? (inicial?.organizacao_id ?? (listaOrgs.length === 1 ? listaOrgs[0].id : orgId)) : unidade.organizacao_id

  const salvar = useMutation({
    mutationFn: async () => {
      if (nova) {
        const { data: id, error } = await supabase.rpc('admin_criar_unidade', {
          p_organizacao: org, p_nome: nome.trim(), p_tipo: tipo as TipoUnidade,
          p_cnes: cnes.trim() || undefined, p_municipio: municipio.trim() || undefined, p_uf: uf.trim() || undefined,
        })
        if (error) throw error
        // criada a partir da árvore: já entra na secretaria
        if (inicial?.secretaria && id) {
          const r = await supabase.rpc('admin_unidade_na_rede', {
            p_unidade: id, p_secretaria: inicial.secretaria.id, p_ramo: ramoParaGravar(inicial.ramo) ?? undefined,
          })
          if (r.error) throw new Error(`A unidade foi criada, mas não entrou na secretaria: ${r.error.message}`)
        }
      } else {
        const { error } = await supabase.rpc('admin_editar_unidade', {
          p_unidade: unidade.id, p_nome: nome.trim(), p_tipo: tipo as TipoUnidade, p_ativo: ativo,
          p_municipio: municipio.trim() || undefined, p_uf: uf.trim() || undefined,
        })
        if (error) throw error
        // LG8: o endereço vai por função própria (o gestor também o define)
        if (endereco.trim() !== (unidade.endereco ?? '')) {
          const r = await supabase.rpc('definir_endereco_unidade', { p_unidade: unidade.id, p_endereco: endereco.trim() || undefined })
          if (r.error) throw r.error
        }
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-unidades'] })
      void qc.invalidateQueries({ queryKey: ['unidades-cadastro'] })
      fechar()
    },
  })
  function fechar() {
    salvar.reset()
    onFechar()
  }

  const cnesDigitos = cnes.replace(/\D/g, '')
  const cnesRuim = nova && cnesDigitos !== '' && cnesDigitos.length !== 7
  const ufRuim = uf.trim() !== '' && !/^[A-Za-z]{2}$/.test(uf.trim())
  const enderecoRuim = endereco.trim() !== '' && (endereco.trim().length < 5 || endereco.trim().length > 300)
  const pronto = !!org && nome.trim().length >= 3 && !!tipo && !cnesRuim && !ufRuim && !enderecoRuim

  return (
    <>
      <DialogHeader>
        <DialogTitle>{nova ? 'Nova unidade' : 'Editar unidade'}</DialogTitle>
        <DialogDescription>
          {nova
            ? 'A unidade é criada ativa, sem setores e sem equipe. O tipo define o menu de quem trabalha nela.'
            : 'O tipo só muda sem atendimento aberto e sem leito ocupado.'}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3.5 text-apoio">
        {nova && inicial?.secretaria && (
          <p className="rounded-controle bg-campo px-3 py-2 text-tinta-apoio">
            Entra em {inicial.secretaria.nome}{inicial.ramo ? `, no grupo ${RAMO_ROTULO[inicial.ramo]}` : ''}.
          </p>
        )}
        {nova && !inicial && listaOrgs.length > 1 && (
          <Linha id="un-org" rotulo="Organização">
            <CampoSelecao id="un-org" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Escolha a organização</option>
              {listaOrgs.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </CampoSelecao>
          </Linha>
        )}
        <Linha id="un-nome" rotulo="Nome">
          <Input id="un-nome" placeholder="ex.: UBS Vila Nova" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Linha>
        <Linha id="un-tipo" rotulo="Tipo" nota={tipo === 'ubs' ? 'Numa UBS, porta, leitos, internação, AIH e APAC ficam fora do menu.' : undefined}>
          <CampoSelecao id="un-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoUnidade)}>
            <option value="">Escolha o tipo</option>
            {TIPOS.map((t) => <option key={t} value={t}>{TIPO_UNIDADE_LABEL[t]}</option>)}
          </CampoSelecao>
        </Linha>
        <Linha id="un-cnes" rotulo="CNES" nota={nova ? 'Opcional. Depois do cadastro, quem preenche é o gestor, em Configuração.' : 'Preenchido pelo gestor da unidade, em Configuração.'}>
          {nova ? (
            <Input id="un-cnes" inputMode="numeric" placeholder="7 dígitos" aria-invalid={cnesRuim} value={cnes} onChange={(e) => setCnes(e.target.value)} />
          ) : (
            <span id="un-cnes" className="py-2 text-corpo text-tinta">{unidade.cnes ?? 'não informado'}</span>
          )}
          {cnesRuim && <span className="text-rotulo text-critico">O CNES tem 7 dígitos.</span>}
        </Linha>
        <Linha id="un-municipio" rotulo="Município">
          <Input id="un-municipio" value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
        </Linha>
        {!nova && (
          <Linha id="un-endereco" rotulo="Endereço" nota="Rua e número. Vai nos documentos de telemedicina (Res. CFM 2.314/2022, art. 13).">
            <Input id="un-endereco" maxLength={300} value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </Linha>
        )}
        <Linha id="un-uf" rotulo="UF">
          <Input id="un-uf" className="w-20 uppercase" maxLength={2} aria-invalid={ufRuim} value={uf} onChange={(e) => setUf(e.target.value)} />
          {ufRuim && <span className="text-rotulo text-critico">A UF tem 2 letras.</span>}
        </Linha>
        {!nova && (
          <Linha id="un-situacao" rotulo="Situação" nota={!ativo ? 'Inativa, a unidade sai da lista da rede.' : undefined}>
            <CampoSelecao id="un-situacao" value={ativo ? 'ativa' : 'inativa'} onChange={(e) => setAtivo(e.target.value === 'ativa')}>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
            </CampoSelecao>
          </Linha>
        )}
        {salvar.error && <MensagemErro erro={salvar.error} acao="salvar a unidade" />}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={fechar}>Cancelar</Button>
        <Button disabled={!pronto || salvar.isPending} onClick={() => salvar.mutate()}>{nova ? 'Criar unidade' : 'Salvar'}</Button>
      </DialogFooter>
    </>
  )
}
