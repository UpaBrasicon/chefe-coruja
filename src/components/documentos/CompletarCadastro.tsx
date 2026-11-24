// "Completar cadastro" sem sair do documento (MA3, revisão da Internação
// aprovada pelo RT em 24/11/2026): uma gaveta só com os campos que faltam
// para o laudo de AIH (CNS, nascimento, sexo, raça/cor, mãe, endereço,
// município, UF). Grava pelo mesmo salvar_cadastro_paciente do cadastro
// completo, com o resto do cadastro como está.
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { UFS } from '@/lib/constants'
import { RACAS_COR_CADASTRO, SEXOS } from '@/lib/cadastro'
import { CADASTRO_VAZIO, errosCadastro, normalizarCadastro, type Cadastro, type CampoCadastro } from '@/lib/cadastroPaciente'
import { formatarCns, soDigitos } from '@/lib/documentos'
import { Escolhas } from '@/components/paciente/CamposCadastro'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

/** O rótulo de cadastroFaltaAih → o campo do cadastro (o prontuário é do sistema: não entra). */
const CAMPO_DA_FALTA: Record<string, CampoCadastro> = {
  CNS: 'cns', 'data de nascimento': 'data_nascimento', sexo: 'sexo', 'raça/cor': 'raca_cor', 'nome da mãe': 'nome_mae',
  endereço: 'endereco', município: 'municipio', UF: 'uf',
}

export function GavetaCompletarCadastro({ pacienteId, nome, faltam, aberta, onAbertaChange }: {
  pacienteId: string; nome: string; faltam: string[]; aberta: boolean; onAbertaChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState<Cadastro | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const campos = faltam.map((f) => CAMPO_DA_FALTA[f]).filter((c): c is CampoCadastro => !!c)

  React.useEffect(() => {
    if (!aberta) return
    let vivo = true
    void (async () => {
      const { data } = await supabase.from('pacientes').select(Object.keys(CADASTRO_VAZIO).join(', ')).eq('id', pacienteId).maybeSingle()
      const f = { ...CADASTRO_VAZIO }
      for (const k of Object.keys(CADASTRO_VAZIO) as CampoCadastro[]) f[k] = ((data as Record<string, string | null> | null)?.[k] ?? '') as string
      if (vivo) setForm(f)
    })()
    return () => { vivo = false }
  }, [aberta, pacienteId])

  const mudar = (k: CampoCadastro, v: string) => { setErro(null); setForm((f) => (f ? { ...f, [k]: v } : f)) }
  async function salvar() {
    if (!form) return
    const erros = errosCadastro(form)
    const primeiro = campos.map((c) => erros[c]).find(Boolean)
    if (primeiro) return setErro(primeiro)
    setSalvando(true)
    const { error } = await supabase.rpc('salvar_cadastro_paciente', { p_paciente: pacienteId, p_dados: normalizarCadastro(form), p_outra_pessoa: false })
    setSalvando(false)
    if (error) return setErro(error.message)
    void qc.invalidateQueries({ queryKey: ['paciente-cadastro', pacienteId] })
    void qc.invalidateQueries({ queryKey: ['cabecalho-paciente', pacienteId] })
    onAbertaChange(false)
  }

  return (
    <Gaveta aberta={aberta} onAbertaChange={onAbertaChange} rotulo={`Completar o cadastro de ${nome}`}>
      <GavetaCabeca sobre="Completar cadastro" titulo={nome} detalhe="Só o que falta para o laudo de AIH" />
      <div className="flex flex-1 flex-col gap-3 px-[22px] py-4">
        {!form ? <Spinner /> : campos.map((k) => (
          k === 'sexo' ? <Escolhas key={k} rotulo="Sexo" opcoes={SEXOS} valor={form.sexo} onChange={(v) => mudar('sexo', v)} />
            : k === 'raca_cor' ? <Escolhas key={k} rotulo="Raça/cor" opcoes={RACAS_COR_CADASTRO} valor={form.raca_cor} onChange={(v) => mudar('raca_cor', v)} />
              : k === 'uf' ? (
                <div key={k} className="flex flex-col gap-1">
                  <Label htmlFor="cc-uf">UF</Label>
                  <CampoSelecao id="cc-uf" value={form.uf} onChange={(e) => mudar('uf', e.target.value)}>
                    <option value="">Escolha…</option>
                    {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </CampoSelecao>
                </div>
              ) : (
                <div key={k} className="flex flex-col gap-1">
                  <Label htmlFor={`cc-${k}`}>{faltam.find((f) => CAMPO_DA_FALTA[f] === k)}</Label>
                  <Input id={`cc-${k}`} type={k === 'data_nascimento' ? 'date' : 'text'}
                    value={k === 'cns' ? formatarCns(form.cns) : form[k]}
                    onChange={(e) => mudar(k, k === 'cns' ? soDigitos(e.target.value).slice(0, 15) : e.target.value)} />
                </div>
              )
        ))}
        {faltam.includes('prontuário') && <p className="text-apoio text-tinta-sussurro">O número do prontuário é dado pelo sistema na recepção.</p>}
        {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
        <div className="flex gap-2">
          <Button disabled={!form || salvando} onClick={() => void salvar()}>{salvando ? <Spinner className="size-4" /> : <Check />} Salvar no cadastro</Button>
          <Button variant="outline" onClick={() => onAbertaChange(false)}>Cancelar</Button>
        </div>
      </div>
      <GavetaPe>O resto do cadastro fica como está. Para corrigir outro dado, use "Completar ou corrigir cadastro".</GavetaPe>
    </Gaveta>
  )
}
