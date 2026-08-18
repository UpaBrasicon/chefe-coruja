/**
 * FAQ — exatamente 5 perguntas com <details>. Checklist item 9.
 * Inclui marcação Schema.org FAQPage (JSON-LD).
 */
const FAQS = [
  {
    pergunta: 'O Chefe Coruja atende UPAs, hospitais e clínicas?',
    resposta:
      'Sim. A plataforma foi desenhada para hospitais, UPAs e clínicas, com módulos de prontuário eletrônico, gestão de leitos, prescrição e escala médica adaptáveis ao porte e fluxo de cada unidade.',
  },
  {
    pergunta: 'A plataforma é compatível com a LGPD e as normas do CFM?',
    resposta:
      'Sim. O Chefe Coruja foi construído com conformidade nativa à LGPD (tratamento de dados de saúde como dado sensível) e às diretrizes do CFM para prontuário eletrônico, incluindo trilha de auditoria e controle de acesso por papel.',
  },
  {
    pergunta: 'Como funciona a escala médica na plataforma?',
    resposta:
      'O gestor monta a escala fixa e mensal por setor e turno; o plantonista visualiza sua agenda, solicita trocas e justifica faltas. Acesso ao atendimento é liberado conforme a escala do dia.',
  },
  {
    pergunta: 'Quanto tempo leva para implantar?',
    resposta:
      'A implantação típica leva de 1 a 4 semanas, incluindo configuração da unidade, cadastro de equipe e treinamento. O cronograma é ajustado à realidade de cada cliente.',
  },
  {
    pergunta: 'Os dados dos pacientes ficam seguros e armazenados no Brasil?',
    resposta:
      'Sim. Utilizamos infraestrutura em nuvem com criptografia em trânsito e em repouso, controles de acesso por papel e trilha de auditoria. Políticas de retenção seguem a legislação de prontuário vigente.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.pergunta,
    acceptedAnswer: { '@type': 'Answer', text: f.resposta },
  })),
}

export function FAQ() {
  return (
    <section className="container-site py-16">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="section-title">Perguntas frequentes</h2>
          <p className="section-subtitle">Tire as principais dúvidas sobre o Chefe Coruja.</p>
        </div>
        <div className="mt-8 flex flex-col gap-3">
          {FAQS.map((f) => (
            <details
              key={f.pergunta}
              className="group rounded-xl border border-slate-200 bg-white px-5 py-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900">
                {f.pergunta}
                <span className="text-primary transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-slate-600">{f.resposta}</p>
            </details>
          ))}
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </section>
  )
}
