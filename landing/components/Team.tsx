/**
 * Seção "Quem somos". Sem foto: a imagem provisória da equipe saiu em
 * 09/11/2026, a pedido do RT, até haver foto real.
 */
export function Team() {
  return (
    <section className="container-site py-16">
      <div className="mx-auto max-w-3xl">
        <h2 className="section-title">Quem somos</h2>
        <p className="mt-4 text-slate-600">
          O Chefe Coruja foi criado numa UPA por um médico coordenador, a partir de problemas do plantão:
          escala no papel, leitos sem visão e prescrição sem rastreio.
        </p>
        <p className="mt-3 text-slate-600">O sistema segue as resoluções do CFM e a LGPD.</p>
      </div>
    </section>
  )
}
