/**
 * Depoimentos reais (3 cards) — nome, cargo e unidade.
 * Checklist item 7. TODO: substituir pelos depoimentos reais.
 */
const DEPOIMENTOS = [
  {
    nome: 'Nome do Diretor Técnico', // TODO: nome real + autorização
    cargo: 'Diretor Técnico', // TODO: cargo real
    unidade: 'UPA — Aparecida de Goiânia', // TODO: unidade real
    texto:
      'A plataforma organizou nossa escala e o fluxo de leitos em tempo real. Conseguimos acompanhar a operação de qualquer lugar. (Texto placeholder — TODO)',
  },
  {
    nome: 'Nome do Coordenador Médico', // TODO
    cargo: 'Coordenador Médico', // TODO
    unidade: 'Hospital — Região Centro-Oeste', // TODO
    texto:
      'A conformidade com a LGPD e a trilha de auditoria nos deram segurança para migrar do papel para o prontuário eletrônico. (Texto placeholder — TODO)',
  },
  {
    nome: 'Nome da Gestora', // TODO
    cargo: 'Gestora de Unidade', // TODO
    unidade: 'Clínica — Goiânia', // TODO
    texto:
      'A prescrição digital e o acompanhamento da observação reduziram erros e aceleraram o atendimento dos pacientes. (Texto placeholder — TODO)',
  },
]

export function Testimonials() {
  return (
    <section className="container-site py-16">
      <div className="text-center">
        <h2 className="section-title">Quem usa, recomenda</h2>
        <p className="section-subtitle">Diretores técnicos, coordenadores e gestores de unidades de saúde.</p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {DEPOIMENTOS.map((d) => (
          <figure key={d.nome} className="flex flex-col rounded-2xl border border-slate-200 p-6">
            <blockquote className="flex-1 text-sm text-slate-700">“{d.texto}”</blockquote>
            <figcaption className="mt-4 border-t border-slate-100 pt-4">
              <p className="font-semibold text-slate-900">{d.nome}</p>
              <p className="text-xs text-slate-500">
                {d.cargo} · {d.unidade}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
