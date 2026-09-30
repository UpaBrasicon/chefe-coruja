import type { ReactNode } from 'react'
import * as React from 'react'

import { UFS } from '@/lib/constants'
import { CATEGORIAS, ESTADOS_CIVIS, RACAS_COR, SEXOS } from '@/lib/cadastro'
import { erroCns, erroCpf, erroNascimento, formatarCns, formatarCpf, soDigitos } from '@/lib/documentos'
import { cn } from '@/lib/utils'
import { ehPediatrico, idadeEm } from '@/domain/idade'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { hojeSP, idadeLegivel, type Cadastro, type CampoCadastro } from './cadastroForm'

// Campos do cadastro do paciente no desenho do protótipo (rec-cadastro e o
// cadastro completo da porta): rótulo 13/500 em cima, campo em fundo `campo`,
// sexo, raça/cor e categoria em botões-cápsula. Usado pela Recepção (ficha) e
// pela porta ("Salvar e usar neste atendimento").

export function Campo({ id, rotulo, erro, dica, className, children }: {
  id?: string; rotulo: string; erro?: string; dica?: ReactNode; className?: string; children: ReactNode
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-[5px]', className)}>
      <Label htmlFor={id} className="text-apoio font-medium text-grafite">{rotulo}</Label>
      {children}
      {erro ? (
        <span id={id ? `${id}-erro` : undefined} role="alert" className="text-rotulo text-critico">{erro}</span>
      ) : dica ? (
        <span className="text-rotulo text-tinta-sussurro">{dica}</span>
      ) : null}
    </div>
  )
}

/** Botões-cápsula de escolha única (sexo, raça/cor, categoria). Clicar de novo desmarca. */
export function Escolhas<V extends string>({ rotulo, opcoes, valor, onChange, className }: {
  rotulo: string; opcoes: readonly { valor: V; rotulo: string }[]; valor: string; onChange: (v: V | '') => void; className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-[5px]', className)}>
      <span className="text-apoio font-medium text-grafite">{rotulo}</span>
      <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-[7px]">
        {opcoes.map((o) => {
          const on = valor === o.valor
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? '' : o.valor)}
              className={cn(
                'rounded-capsula border px-[13px] py-1.5 text-apoio transition-colors',
                on ? 'border-marca bg-marca/10 font-medium text-acao' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao',
              )}
            >
              {o.rotulo}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const SELECT = 'h-9 w-full min-w-0 rounded-controle border border-fio bg-campo px-2.5 text-controle text-tinta outline-none focus-visible:border-marca'

/**
 * O formulário. `identificacao=false` esconde nome, nascimento, sexo e mãe
 * (cadastro existente na ficha: só contato, documentos e dados do SUS).
 * `extras` entra depois do convênio (a porta põe peso e alergias ali).
 */
export function CamposCadastro({ prefixo, valores, onChange, identificacao = true, extras, hoje = hojeSP() }: {
  prefixo: string
  valores: Cadastro
  onChange: (k: CampoCadastro, v: string) => void
  identificacao?: boolean
  extras?: ReactNode
  hoje?: string
}) {
  const [tocados, setTocados] = React.useState<Partial<Record<CampoCadastro, boolean>>>({})
  const tocar = (k: CampoCadastro) => () => setTocados((t) => ({ ...t, [k]: true }))
  const id = (k: string) => `${prefixo}-${k}`
  const txt = (k: CampoCadastro) => ({
    id: id(k),
    value: valores[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(k, e.target.value),
  })

  // ao vivo: CPF/CNS reclamam quando completos ou ao sair do campo
  const eCpf = erroCpf(valores.cpf, !!tocados.cpf)
  const eCns = erroCns(valores.cns, !!tocados.cns)
  const eNasc = erroNascimento(valores.data_nascimento, hoje)
  const idade = idadeLegivel(valores.data_nascimento, hoje)
  const pediatrico = valores.data_nascimento && !eNasc ? ehPediatrico(valores.data_nascimento, hoje) : null
  const menor = valores.data_nascimento && !eNasc ? (idadeEm(valores.data_nascimento, hoje)?.anos ?? 99) < 18 : false

  return (
    <div className="flex flex-wrap gap-3">
      {identificacao && (
        <>
          <Campo id={id('nome')} rotulo="Nome completo" className="basis-full">
            <Input {...txt('nome')} autoComplete="off" />
          </Campo>
          <Campo id={id('nome_social')} rotulo="Nome social" className="flex-[1_1_240px]">
            <Input {...txt('nome_social')} autoComplete="off" />
          </Campo>
          <Campo id={id('data_nascimento')} rotulo="Data de nascimento" erro={eNasc} className="flex-[1_1_180px]"
            dica={idade ? `${idade}${pediatrico ? ' · pediátrico' : ''}` : undefined}>
            <Input {...txt('data_nascimento')} type="date" max={hoje} aria-invalid={!!eNasc} aria-describedby={eNasc ? `${id('data_nascimento')}-erro` : undefined} />
          </Campo>
        </>
      )}
      <Campo id={id('cpf')} rotulo="CPF" erro={eCpf} className="flex-[1_1_180px]">
        <Input
          id={id('cpf')}
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          value={formatarCpf(valores.cpf)}
          onChange={(e) => onChange('cpf', soDigitos(e.target.value).slice(0, 11))}
          onBlur={tocar('cpf')}
          aria-invalid={!!eCpf}
          aria-describedby={eCpf ? `${id('cpf')}-erro` : undefined}
        />
      </Campo>
      <Campo id={id('cns')} rotulo="Cartão SUS" erro={eCns} className="flex-[1_1_200px]">
        <Input
          id={id('cns')}
          inputMode="numeric"
          autoComplete="off"
          placeholder="000 0000 0000 0000"
          value={formatarCns(valores.cns)}
          onChange={(e) => onChange('cns', soDigitos(e.target.value).slice(0, 15))}
          onBlur={tocar('cns')}
          aria-invalid={!!eCns}
          aria-describedby={eCns ? `${id('cns')}-erro` : undefined}
        />
      </Campo>
      {identificacao && (
        <Campo id={id('nome_mae')} rotulo="Nome da mãe" className="basis-full">
          <Input {...txt('nome_mae')} autoComplete="off" />
        </Campo>
      )}
      <Campo id={id('estado_civil')} rotulo="Estado civil" className="flex-[1_1_180px]">
        <select id={id('estado_civil')} className={SELECT} value={valores.estado_civil} onChange={(e) => onChange('estado_civil', e.target.value)}>
          <option value="">—</option>
          {/* valor antigo fora da lista continua visível */}
          {valores.estado_civil && !(ESTADOS_CIVIS as readonly string[]).includes(valores.estado_civil) && (
            <option value={valores.estado_civil}>{valores.estado_civil}</option>
          )}
          {ESTADOS_CIVIS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </Campo>
      <Escolhas rotulo="Categoria" opcoes={CATEGORIAS} valor={valores.categoria} onChange={(v) => onChange('categoria', v)} className="flex-[1_1_240px]" />
      {valores.categoria === 'convenio' && (
        <Campo id={id('convenio')} rotulo="Convênio" className="flex-[1_1_200px]">
          <Input {...txt('convenio')} autoComplete="off" />
        </Campo>
      )}
      {extras}
      <Campo id={id('telefone')} rotulo="Telefone" className="flex-[1_1_180px]">
        <Input {...txt('telefone')} type="tel" inputMode="tel" autoComplete="off" />
      </Campo>
      <Campo id={id('endereco')} rotulo="Endereço (logradouro, nº, complemento, bairro)" className="basis-full">
        <Input {...txt('endereco')} autoComplete="off" />
      </Campo>
      <Campo id={id('municipio')} rotulo="Município" className="flex-[1_1_240px]">
        <Input {...txt('municipio')} autoComplete="off" />
      </Campo>
      <Campo id={id('uf')} rotulo="UF" className="flex-[0_1_96px]">
        <select id={id('uf')} className={SELECT} value={valores.uf} onChange={(e) => onChange('uf', e.target.value)}>
          <option value="">—</option>
          {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </Campo>
      <Campo id={id('responsavel_nome')} rotulo="Nome do responsável" className="flex-[1_1_300px]"
        dica={menor && !valores.responsavel_nome.trim() ? 'Menor sem responsável pode ser cadastrado (abrigo, escola, outro local).' : undefined}>
        <Input {...txt('responsavel_nome')} autoComplete="off" />
      </Campo>
      <Campo id={id('responsavel_parentesco')} rotulo="Parentesco ou vínculo" className="flex-[1_1_180px]">
        <Input {...txt('responsavel_parentesco')} autoComplete="off" />
      </Campo>
      <Campo id={id('responsavel_documento')} rotulo="Documento do responsável" className="flex-[1_1_180px]">
        <Input {...txt('responsavel_documento')} autoComplete="off" />
      </Campo>
      <Campo id={id('responsavel_telefone')} rotulo="Telefone do responsável" className="flex-[1_1_180px]">
        <Input {...txt('responsavel_telefone')} type="tel" inputMode="tel" autoComplete="off" />
      </Campo>
      {identificacao && (
        <Escolhas rotulo="Sexo" opcoes={SEXOS} valor={valores.sexo} onChange={(v) => onChange('sexo', v)} className="flex-[1_1_200px]" />
      )}
      <Escolhas rotulo="Raça/cor" opcoes={RACAS_COR} valor={valores.raca_cor} onChange={(v) => onChange('raca_cor', v)} className="basis-full" />
    </div>
  )
}
