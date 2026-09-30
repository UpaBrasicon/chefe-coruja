import { Link } from 'react-router-dom'
import { Baby, TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useModoNaFerramenta } from '@/lib/pacienteCentral'
import { semReferenciaPediatrica, type PublicoFerramenta } from '@/content/publicoFerramentas'
import { SEM_REFERENCIA_PEDIATRICA } from '@/clinico/ficha'

// O modo do paciente dentro da ferramenta (P/index.html 33215–33245, faixa
// de modo). No pediátrico, ferramenta de adulto NÃO calcula: "negar e calcular
// na mesma tela é pior que só calcular" — a entrada e o resultado somem e a
// faixa vermelha diz por quê. O espelho vale para a regra só pediátrica em
// modo adulto.

/** Selo curto ao lado do título: toda ferramenta de adulto leva. */
export function SeloSemReferenciaPediatrica({ publico }: { publico: PublicoFerramenta }) {
  if (!semReferenciaPediatrica(publico)) return null
  return (
    <span
      title={SEM_REFERENCIA_PEDIATRICA}
      className="inline-flex items-center gap-1.5 rounded-capsula border border-fio bg-superficie px-2.5 py-[3px] text-rotulo font-medium whitespace-nowrap text-tinta-apoio"
    >
      <Baby className="size-3.5" aria-hidden />
      Sem referência pediátrica
    </span>
  )
}

export function FaixaModo({ publico }: { publico: PublicoFerramenta }) {
  const { paciente: p, bloqueiaPedi, bloqueiaAdulto } = useModoNaFerramenta(publico)
  if (!p.modo) return null
  const alerta = bloqueiaPedi || bloqueiaAdulto
  const pedi = p.modo === 'pediatrico'
  const partes = [
    pedi ? 'Modo pediátrico' : 'Modo adulto',
    p.leitura.idade !== null ? `${p.leitura.idade} ${p.unidadeIdade}` : null,
    p.leitura.pesoKg !== null ? `${String(p.leitura.pesoKg).replace('.', ',')} kg aferidos` : 'sem peso informado',
    !pedi && p.gestante ? 'gestante' : null,
  ].filter(Boolean)

  return (
    <div
      role={alerta ? 'alert' : 'note'}
      className={cn(
        'mb-[18px] flex items-start gap-2.5 rounded-menu border px-[15px] py-[13px]',
        alerta ? 'border-critico/20 bg-alerta-critico text-critico' : pedi ? 'border-pediatria/20 bg-pediatria/[0.06] text-pediatria' : 'border-marca/20 bg-alerta-marca text-acao',
      )}
    >
      {alerta ? <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Baby className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div className="flex flex-col gap-1">
        <p className="text-controle font-semibold">
          {bloqueiaPedi ? 'Sem referência pediátrica' : bloqueiaAdulto ? 'Regra pediátrica' : partes.join(' · ')}
        </p>
        <p className="text-apoio leading-[1.45]">
          {bloqueiaPedi
            ? 'Esta ferramenta foi construída com referência de adulto e por isso não calcula em modo pediátrico: a entrada e o resultado estão suprimidos. As faixas, doses e limites dela não valem para criança, e nada é convertido do adulto por peso. Use as ferramentas da seção Pediatria.'
            : bloqueiaAdulto
              ? `Esta ferramenta foi escrita para criança (até antes dos 14 anos) e não calcula em modo adulto: a entrada e o resultado estão suprimidos. Se o paciente é criança, troque o paciente na Central.`
              : 'Escolhido à mão na Central, nesta sessão. Confira o peso no campo da ferramenta.'}
        </p>
        {alerta && (
          <div className="mt-1 flex flex-wrap gap-2">
            <Link to="/plantonista" className="rounded-controle border border-current/30 bg-superficie px-3 py-1.5 text-apoio font-medium hover:border-current">
              Trocar o paciente na Central
            </Link>
            {bloqueiaPedi && (
              <Link to="/plantonista/pediatria" className="rounded-controle border border-current/30 bg-superficie px-3 py-1.5 text-apoio font-medium hover:border-current">
                Ferramentas pediátricas
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
