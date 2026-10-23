import { useId } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/utils'
import { alterarPaciente, definirModo, usePacienteCentral } from '@/lib/pacienteCentral'
import { IDADE_ADULTO_ANOS } from '@/domain/idade'
import { rotuloIdadeDigitada, type UnidadeIdade } from '@/domain/pacienteCentral'
import { Button } from '@/components/ui/button'
import { CaixaMarcar } from '@/components/ui/caixa-marcar'
import { Input } from '@/components/ui/input'

// "Adulto ou pediátrico?" (P/index.html 1377–1417, valsModo): o paciente vem
// antes da ferramenta. Nenhuma ferramenta da Central assume idade sozinha; no
// modo pediátrico as de adulto não calculam, e o selo diz por quê.

const UNIDADES: UnidadeIdade[] = ['dias', 'meses', 'anos']

function BotaoModo({ ativo, pedi, onClick, children }: { ativo: boolean; pedi?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant="outline"
      size="bloco"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        'min-w-0 flex-1 rounded-container px-3 py-0 font-semibold',
        ativo && (pedi
          ? 'border-pediatria bg-pediatria text-sobre-acao hover:border-pediatria hover:text-sobre-acao'
          : 'border-acao bg-acao text-sobre-acao hover:text-sobre-acao'),
      )}
    >
      {children}
    </Button>
  )
}

export function ModoPaciente() {
  const p = usePacienteCentral()
  const idPeso = useId()
  const idIdade = useId()
  const { leitura } = p

  if (!p.modo) {
    return (
      <section aria-label="Modo do paciente" className="mb-4 flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-[17px] py-[15px]">
        <span className="text-corpo font-semibold tracking-[-0.01em] text-tinta">Adulto ou pediátrico?</span>
        <span className="text-controle leading-[1.5] text-tinta-apoio">
          Este cálculo é para adulto ou para criança? Nenhuma ferramenta daqui assume idade sozinha: no modo pediátrico, as ferramentas de adulto
          não calculam.
        </span>
        <div className="flex gap-[9px]">
          <BotaoModo ativo={false} onClick={() => definirModo('adulto')}>Adulto</BotaoModo>
          <BotaoModo ativo={false} pedi onClick={() => definirModo('pediatrico')}>Pediátrico</BotaoModo>
        </div>
        <span className="text-apoio leading-[1.45] text-tinta-sussurro">
          Pediatria vai até antes de completar {IDADE_ADULTO_ANOS} anos (regra da unidade). O modo vale só nesta aba e some ao recarregar ou sair.
        </span>
      </section>
    )
  }

  const pedi = p.modo === 'pediatrico'
  const pesoInvalido = p.peso.trim() !== '' && leitura.pesoKg === null
  const campo = pedi ? 'border-pediatria/25 focus-visible:border-pediatria' : 'border-acao/25 focus-visible:border-acao'

  return (
    <section aria-label="Modo do paciente" className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={cn(
            'flex items-center gap-[7px] rounded-capsula border px-3 py-[5px] text-apoio font-semibold whitespace-nowrap',
            pedi ? 'border-pediatria/20 bg-pediatria/10 text-pediatria' : 'border-acao/20 bg-alerta-marca text-acao',
          )}
        >
          {pedi ? 'Pediátrico' : 'Adulto'}
        </span>
        <span className="text-apoio text-tinta-sussurro">escolhido à mão nesta sessão</span>
        <Button
          variant="link"
          onClick={() => definirModo(null)}
          className="min-h-11 gap-1.5 px-1 py-0 hover:no-underline"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Trocar de paciente
        </Button>
      </div>

      <div
        className={cn(
          'flex flex-col gap-[13px] rounded-container border px-[15px] py-[13px]',
          pedi ? 'border-pediatria/15 bg-pediatria/10' : 'border-acao/15 bg-alerta-marca',
        )}
      >
        <span className={cn('rotulo font-semibold', pedi ? 'text-pediatria' : 'text-acao')}>
          {pedi ? 'Idade e peso' : 'Dados do paciente'}
        </span>

        {pedi && (
          <div role="group" aria-label="Unidade da idade" className="flex flex-wrap gap-[7px]">
            {UNIDADES.map((u) => (
              <Button
                key={u}
                variant="outline"
                aria-pressed={p.unidadeIdade === u}
                onClick={() => alterarPaciente({ unidadeIdade: u })}
                className={cn(
                  'min-h-9 rounded-capsula px-[13px] py-0',
                  p.unidadeIdade === u
                    ? 'border-pediatria bg-pediatria font-semibold text-sobre-acao hover:border-pediatria hover:text-sobre-acao'
                    : 'border-pediatria/25 text-pediatria hover:border-pediatria hover:text-pediatria',
                )}
              >
                {u}
              </Button>
            ))}
          </div>
        )}

        <div className="grid max-w-[460px] grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
          {pedi && (
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor={idIdade} className="text-apoio text-tinta-apoio">Idade em {p.unidadeIdade}</label>
              <Input
                id={idIdade}
                inputMode="numeric"
                value={p.idade}
                onChange={(e) => alterarPaciente({ idade: e.target.value })}
                placeholder="4"
                aria-invalid={p.idade.trim() !== '' && leitura.idade === null}
                // padrao-ok: 16 px no campo evita o zoom automático do iOS ao digitar
                className={cn('min-h-11 bg-superficie text-[16px]', campo)}
              />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={idPeso} className="text-apoio text-tinta-apoio">Peso aferido em kg</label>
            <Input
              id={idPeso}
              inputMode="decimal"
              value={p.peso}
              onChange={(e) => alterarPaciente({ peso: e.target.value })}
              placeholder={pedi ? '16' : '70'}
              aria-invalid={pesoInvalido}
              // padrao-ok: 16 px no campo evita o zoom automático do iOS ao digitar
              className={cn('min-h-11 bg-superficie text-[16px]', campo)}
            />
          </div>
        </div>
        {pesoInvalido && <span className="text-apoio text-critico">Peso inválido: digite só o número em kg, maior que zero.</span>}

        {pedi && (
          <div className="flex flex-col gap-px">
            <span className={cn('text-dialogo font-semibold tracking-[-0.02em]', leitura.idade === null ? 'text-tinta-sussurro' : leitura.idadeForaDaPediatria ? 'text-critico' : 'text-pediatria')}>
              {leitura.idade === null ? '—' : leitura.idadeForaDaPediatria ? 'Não é pediatria' : `Pediátrico · ${rotuloIdadeDigitada(leitura.idade, p.unidadeIdade)}`}
            </span>
            <span className="text-apoio text-pediatria">
              {leitura.idade === null ? 'digite a idade' : leitura.idadeForaDaPediatria ? `${IDADE_ADULTO_ANOS} anos ou mais: pela regra da unidade é adulto. Troque o paciente para Adulto.` : `até antes dos ${IDADE_ADULTO_ANOS} anos`}
            </span>
          </div>
        )}

        {!pedi && (
          <CaixaMarcar
            marcado={p.gestante}
            onChange={(gestante) => alterarPaciente({ gestante })}
            className={cn(
              'min-h-11 w-auto items-center gap-2.5 self-start rounded-controle border px-3.5 text-controle text-grafite',
              p.gestante ? 'border-acao bg-acao/5' : 'border-fio-forte bg-superficie',
            )}
          >
            Gestante
          </CaixaMarcar>
        )}
        {!pedi && p.gestante && (
          <span className="flex items-start gap-[7px] rounded-controle bg-alerta-atencao px-[11px] py-2 text-apoio leading-[1.45] text-atencao">
            <TriangleAlert className="mt-0.5 size-[15px] shrink-0" aria-hidden />
            Paciente gestante — confira contraindicação e categoria de risco em cada fármaco antes de prescrever.
          </span>
        )}

        <span className="text-apoio leading-[1.45] text-tinta-apoio">
          {pedi
            ? 'O peso da balança é obrigatório: as ferramentas pediátricas não calculam sem ele, e nada aqui estima peso pela idade. As ferramentas de adulto não calculam neste modo.'
            : leitura.completo
              ? 'O peso vale como referência nesta sessão; confira-o no campo de peso de cada ferramenta. Trocar de paciente zera tudo.'
              : 'Informe o peso aferido: nenhuma ferramenta estima peso de adulto.'}
        </span>
      </div>
    </section>
  )
}
