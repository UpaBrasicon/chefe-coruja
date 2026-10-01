import { BUSINESS } from '@/lib/site'

/**
 * Localização — Google Maps embed (keyless) + link "Como chegar". Checklist item 19.
 * Usa o embed clássico sem API key (`output=embed`): zero exposição de billing
 * (red-team V16). Não depende de NEXT_PUBLIC_MAPS_KEY.
 */
export function Location() {
  const endereco = encodeURIComponent(
    `${BUSINESS.address.street}, ${BUSINESS.address.city} - ${BUSINESS.address.region}, ${BUSINESS.address.postalCode}`
  )
  const embedSrc = `https://maps.google.com/maps?q=${endereco}&t=&z=15&ie=UTF8&iwloc=&output=embed`

  return (
    <section className="container-site py-16">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="section-title">Onde estamos</h2>
          <p className="section-subtitle">Atendemos todo o Brasil, com sede em Aparecida de Goiânia · GO.</p>
          <address className="mt-6 text-sm not-italic text-slate-600">
            <p className="font-semibold text-slate-900">{BUSINESS.name}</p>
            <p>{BUSINESS.address.street}</p>
            <p>
              {BUSINESS.address.city} · {BUSINESS.address.region} · {BUSINESS.address.postalCode}
            </p>
            <p className="mt-2">
              <a href={`tel:${BUSINESS.telephone.replace(/\D/g, '')}`} className="text-primary hover:underline">
                {BUSINESS.telephone}
              </a>
            </p>
          </address>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${endereco}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline mt-6"
          >
            Como chegar
          </a>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <iframe
            title={`Mapa — ${BUSINESS.name}, ${BUSINESS.address.city}`}
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
