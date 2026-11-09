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
          O Chefe Coruja nasceu dentro de uma UPA, liderado por um médico coordenador que viveu os desafios
          do dia a dia: escalas no papel, leitos sem visibilidade e prescrição sem rastreio.
        </p>
        <p className="mt-3 text-slate-600">
          Unimos prática assistencial e tecnologia para entregar uma plataforma que organiza a operação e
          respeita as normas brasileiras, da Resolução CFM à LGPD.
        </p>
      </div>
    </section>
  )
}
