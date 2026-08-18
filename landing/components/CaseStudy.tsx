/**
 * Case de sucesso (1 caso detalhado): problema → solução → resultado com métrica.
 * Checklist item 6. TODO: substituir pelos dados reais do case.
 */
export function CaseStudy() {
  return (
    <section className="container-site py-16">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 md:p-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Caso de sucesso</p>
        {/* TODO: nome real da unidade (ex.: "UPA Centro — Aparecida de Goiânia") */}
        <h2 className="section-title mt-2">UPA reduziu fila de espera e ganhou visibilidade da operação</h2>

        <div className="mt-8 grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Problema</h3>
            {/* TODO: descrever o problema real (ex.: escala no papel, leitos sem visão em tempo real) */}
            <p className="mt-2 text-sm text-slate-600">
              Gestão de leitos feita em planilhas, escala médica no papel e prescrição manual — sem rastreio
              e com risco de erro. Falta de indicadores para decidir.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Solução</h3>
            {/* TODO: descrever a solução implantada */}
            <p className="mt-2 text-sm text-slate-600">
              Implantação do Chefe Coruja: prontuário eletrônico, painel de leitos em tempo real, prescrição
              digital e escala integrada — com trilha de auditoria e conformidade LGPD.
            </p>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Resultado</h3>
            {/* TODO: métrica real (ex.: -35% no tempo de internação na observação) */}
            <p className="mt-2 text-3xl font-extrabold text-emerald-600">-35%</p>
            <p className="mt-1 text-sm text-slate-600">
              no tempo médio de permanência na observação, com leitos sempre atualizados.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
