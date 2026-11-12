import { useEffect, useRef, useState } from 'react'

import { ALTURA_TELA, LARGURA_TELA, TELAS } from './telas'

// "Um plantão" (pedido 8, J4): três telas reais do app, da unidade de
// demonstração da homologação. No computador a tela fica parada enquanto a
// pessoa rola, e cada trecho da rolagem mostra uma tela; os botões levam ao
// trecho de cada uma. No celular as três vêm em sequência, sem rolagem presa.
// Quem pede menos movimento vê a troca sem transição (landing.css).
export function UmPlantao() {
  const [atual, setAtual] = useState(0)
  const marcas = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) setAtual(Number((e.target as HTMLElement).dataset.indice))
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    marcas.current.forEach((m) => m && obs.observe(m))
    return () => obs.disconnect()
  }, [])

  const irPara = (i: number) => {
    setAtual(i)
    const suave = !matchMedia('(prefers-reduced-motion: reduce)').matches
    marcas.current[i]?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'center' })
  }
  const tela = TELAS[atual]

  return (
    <section className="plantao" id="telas" aria-labelledby="um-plantao">
      {/* trechos da rolagem: um por tela, só no computador */}
      <div className="plantao-marcas" aria-hidden="true">
        {TELAS.map((t, i) => (
          <div key={t.id} data-indice={i} ref={(el) => { marcas.current[i] = el }} />
        ))}
      </div>

      <div className="plantao-fixo">
        <div className="registro-margem">
          <span className="registro-rotulo">Telas</span>
          <div className="plantao-botoes" role="group" aria-label="Telas do sistema">
            {TELAS.map((t, i) => (
              // padrao-ok: seletor da página pública (desenho de marca, landing.css)
              <button key={t.id} type="button" aria-pressed={i === atual} onClick={() => irPara(i)}>
                {t.rotulo}
              </button>
            ))}
          </div>
        </div>
        <div className="plantao-corpo">
          {/* padrao-ok: título da página pública (desenho de marca, landing.css) */}
          <h2 id="um-plantao">Um plantão, em três telas.</h2>
          <p className="registro-abertura plantao-legenda" aria-live="polite">
            <b>{tela.titulo}.</b> {tela.texto}
          </p>
          <div className="plantao-quadro">
            {TELAS.map((t, i) => (
              <img
                key={t.id}
                src={t.arquivo}
                width={LARGURA_TELA}
                height={ALTURA_TELA}
                loading="lazy"
                decoding="async"
                alt={i === atual ? t.alt : ''}
                aria-hidden={i !== atual}
                className={i === atual ? 'atual' : undefined}
              />
            ))}
          </div>
          <ol className="plantao-lista">
            {TELAS.map((t) => (
              <li key={t.id}>
                <p>
                  <b>{t.titulo}.</b> {t.texto}
                </p>
                <img src={t.arquivo} width={LARGURA_TELA} height={ALTURA_TELA} loading="lazy" decoding="async" alt={t.alt} />
              </li>
            ))}
          </ol>
          <p className="plantao-nota">Telas reais do sistema, com pacientes e equipe fictícios.</p>
        </div>
      </div>
    </section>
  )
}
