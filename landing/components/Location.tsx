import { BUSINESS } from '@/lib/site'

/**
 * Localização — Google Maps embed (keyless). Checklist item 19.
 * Usa o embed clássico sem API key (`output=embed`): zero exposição de billing
 * (red-team V16). Mostra só a cidade: o endereço da sede ainda não foi
 * definido (o provisório saiu em 09/11/2026, a pedido do RT).
 */
export function Location() {
  const cidade = encodeURIComponent(`${BUSINESS.address.city} - ${BUSINESS.address.region}`)
  const embedSrc = `https://maps.google.com/maps?q=${cidade}&t=&z=12&ie=UTF8&iwloc=&output=embed`

  return (
    <section className="container-site py-16">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="section-title">Onde estamos</h2>
          <p className="section-subtitle">Atendemos todo o Brasil, com sede em Aparecida de Goiânia · GO.</p>
          <address className="mt-6 text-sm not-italic text-slate-600">
            <p className="font-semibold text-slate-900">{BUSINESS.name}</p>
            <p>
              {BUSINESS.address.city} · {BUSINESS.address.region}
            </p>
            <p className="mt-2">
              <a href={`mailto:${BUSINESS.email}`} className="text-primary hover:underline">
                {BUSINESS.email}
              </a>
            </p>
            {BUSINESS.telephone && (
              <p className="mt-2">
                <a href={`tel:${BUSINESS.telephone.replace(/\D/g, '')}`} className="text-primary hover:underline">
                  {BUSINESS.telephone}
                </a>
              </p>
            )}
          </address>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <iframe
            title={`Mapa — ${BUSINESS.address.city}`}
            src={embedSrc}
            width="100%"
            height="420"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  )
}
