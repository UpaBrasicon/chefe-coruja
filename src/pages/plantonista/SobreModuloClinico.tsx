import { Info } from 'lucide-react'
import { Link } from 'react-router-dom'

import { TituloPagina } from '@/components/monitor/Pagina'
import { SOBRE_MODULO_CLINICO } from '@/content/sobreModuloClinico'

// LG11, decisão C5: rotulagem mínima do módulo clínico (texto aprovado pelo RT em 17/11/2026).
export default function SobreModuloClinico() {
  return (
    <div className="flex max-w-[720px] flex-col gap-[22px]">
      <TituloPagina icone={Info} titulo="Sobre o módulo clínico" descricao="Finalidade, limites e como relatar erro" className="mb-0" />
      {SOBRE_MODULO_CLINICO.map((p) => (
        <section key={p.titulo} className="flex flex-col gap-1.5">
          <h2 className="text-corpo font-semibold text-tinta">{p.titulo}</h2>
          {p.texto && <p className="text-corpo text-tinta-apoio">{p.texto}</p>}
          {p.itens && (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-corpo text-tinta-apoio">
              {p.itens.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <Link to="/plantonista" className="text-apoio text-acao underline-offset-4 hover:underline">
        Voltar à Central
      </Link>
    </div>
  )
}
