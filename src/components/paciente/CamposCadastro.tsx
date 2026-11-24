import type { ReactNode } from 'react'
import * as React from 'react'

import { UFS } from '@/lib/constants'
import { CATEGORIAS, ESTADOS_CIVIS, RACAS_COR_CADASTRO, SEXOS } from '@/lib/cadastro'
import { erroCns, erroCpf, erroNascimento, formatarCns, formatarCpf, soDigitos } from '@/lib/documentos'
import { cn } from '@/lib/utils'
import { ehPediatrico } from '@/domain/idade'
import { menorDeIdade, mostraResponsavel } from '@/lib/cadastroRecepcao'
import { Chip } from '@/components/monitor/Pagina'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { hojeSP, idadeLegivel, type Cadastro, type CampoCadastro } from '@/lib/cadastroPaciente'

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
            <Chip key={o.valor} variante="opcao" radio ativo={on} onClick={() => onChange(on ? '' : o.valor)}>
              {o.rotulo}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}

const SELECT = 'w-full min-w-0 px-2.5 text-controle outline-none focus-visible:border-acao'

/**
 * O formulário. `identificacao=false` esconde nome, nascimento, sexo e mãe
 * (cadastro existente na ficha: só contato, documentos e dados do SUS).
 * `extras` entra depois do convênio (a porta põe peso e alergias ali).
 * `omitir` tira campos que a tela já mostra em outro lugar (a Recepção põe o
 * nome em cima, junto da queixa). `nascimento` é a data do cadastro existente,
 * quando o campo não aparece, para a regra do responsável.
 */
export function CamposCadastro({ prefixo, valores, onChange, identificacao = true, extras, hoje = hojeSP(), nascimentoObrigatorio = false, omitir = [], nascimento }: {
  prefixo: string
  valores: Cadastro
  onChange: (k: CampoCadastro, v: string) => void
  identificacao?: boolean
  extras?: ReactNode
  /** U11 (N2 = A): na UBS a data de nascimento é obrigatória */ nascimentoObrigatorio?: boolean; hoje?: string
  omitir?: CampoCadastro[]
  nascimento?: string | null
}) {
  const [tocados, setTocados] = React.useState<Partial<Record<CampoCadastro, boolean>>>({})
  const tocar = (k: CampoCadastro) => () => setTocados((t) => ({ ...t, [k]: true }))
  const mostra = (k: CampoCadastro) => !omitir.includes(k)
  // CA2 (revisão do perfil Recepção, RT 24/11/2026): o bloco do responsável
  // aparece para menor de 18 anos ou quando marcado "tem responsável"
  const [temResponsavel, setTemResponsavel] = React.useState(false)
  const nascRegra = valores.data_nascimento || nascimento || ''
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
  const menor = !eNasc && menorDeIdade(nascRegra, hoje)
  const blocoResponsavel = !eNasc ? mostraResponsavel(nascRegra, hoje, temResponsavel, valores) : temResponsavel

  return (
    <div className="flex flex-wrap gap-3">
      {identificacao && (
        <>
          {mostra('nome') && (
            <Campo id={id('nome')} rotulo="Nome completo" className="basis-full">
              <Input {...txt('nome')} autoComplete="off" />
            </Campo>
          )}
          <Campo id={id('nome_social')} rotulo="Nome social" className="flex-[1_1_240px]">
            <Input {...txt('nome_social')} autoComplete="off" />
          </Campo>
          {mostra('data_nascimento') && (
            <Campo id={id('data_nascimento')} rotulo={nascimentoObrigatorio ? 'Data de nascimento *' : 'Data de nascimento'} erro={eNasc} className="flex-[1_1_180px]"
              dica={idade ? `${idade}${pediatrico ? ' · pediátrico' : ''}` : undefined}>
              <Input {...txt('data_nascimento')} type="date" max={hoje} aria-invalid={!!eNasc} aria-describedby={eNasc ? `${id('data_nascimento')}-erro` : undefined} />
            </Campo>
          )}
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
        <CampoSelecao id={id('estado_civil')} className={SELECT} value={valores.estado_civil} onChange={(e) => onChange('estado_civil', e.target.value)}>
          <option value="">Não informado</option>
          {/* valor antigo fora da lista continua visível */}
          {valores.estado_civil && !(ESTADOS_CIVIS as readonly string[]).includes(valores.estado_civil) && (
            <option value={valores.estado_civil}>{valores.estado_civil}</option>
          )}
          {ESTADOS_CIVIS.map((e) => <option key={e} value={e}>{e}</option>)}
        </CampoSelecao>
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
      <Campo id={id('uf')} rotulo="UF" className="flex-[0_1_144px]">
        <CampoSelecao id={id('uf')} className={SELECT} value={valores.uf} onChange={(e) => onChange('uf', e.target.value)}>
          <option value="">Não informado</option>
          {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
        </CampoSelecao>
      </Campo>
      {/* com dado do responsável já preenchido, o bloco fica e a caixa some */}
      {!menor && (temResponsavel || !blocoResponsavel) && (
        <label htmlFor={id('tem-responsavel')} className="flex basis-full items-center gap-2 text-apoio font-medium text-grafite">
          <input id={id('tem-responsavel')} type="checkbox" checked={temResponsavel} onChange={(e) => setTemResponsavel(e.target.checked)} />
          Tem responsável
        </label>
      )}
      {blocoResponsavel && (
        <>
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
        </>
      )}
      {identificacao && (
        <Escolhas rotulo="Sexo" opcoes={SEXOS} valor={valores.sexo} onChange={(v) => onChange('sexo', v)} className="flex-[1_1_200px]" />
      )}
      <div className="flex basis-full flex-col gap-1">
        <Escolhas rotulo="Raça/cor" opcoes={RACAS_COR_CADASTRO} valor={valores.raca_cor} onChange={(v) => onChange('raca_cor', v)} />
        {valores.raca_cor === 'sem_informacao' && (
          <span className="text-rotulo text-tinta-sussurro">Cadastro antigo com raça/cor "Sem informação", que o faturamento (BPA) não aceita. Pergunte ao paciente e marque a que ele declarar.</span>
        )}
      </div>
    </div>
  )
}
