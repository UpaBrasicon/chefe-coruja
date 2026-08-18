import Image from 'next/image'

/**
 * Seção "Quem somos" — foto real da equipe.
 * Checklist item 8. TODO: substituir pela foto real (1500x1000, formato webp).
 */
export function Team() {
  return (
    <section className="container-site py-16">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className="relative">
          {/* TODO: foto real da equipe — recomenda-se 1500x1000 (3:2), webp */}
          <Image
            src="/equipe-placeholder.svg"
            alt="Equipe do Chefe Coruja reunida na unidade de Aparecida de Goiânia"
            width={1500}
            height={1000}
            className="rounded-2xl border border-slate-200 shadow-lg"
          />
        </div>
        <div>
          <h2 className="section-title">Quem somos</h2>
          {/* TODO: texto real de apresentação da equipe */}
          <p className="mt-4 text-slate-600">
            O Chefe Coruja nasceu dentro de uma UPA, liderado por um médico coordenador que viveu os desafios
            do dia a dia: escalas no papel, leitos sem visibilidade e prescrição sem rastreio.
          </p>
          <p className="mt-3 text-slate-600">
            Unimos prática assistencial e tecnologia para entregar uma plataforma que organiza a operação e
            respeita as normas brasileiras — da Resolução CFM à LGPD.
          </p>
          {/* TODO: citar nome e CRM do fundador, com autorização */}
        </div>
      </div>
    </section>
  )
}
