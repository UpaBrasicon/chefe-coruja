/**
 * Geolocalização — captura com ALTA PRECISÃO.
 *
 * Usa enableHighAccuracy: true (GPS/augmentada quando disponível) + timeout
 * generoso + maximumAge 0 (não reaproveita posição velha). Fallbacks em
 * cascata: quando o GPS demora, tenta com precisão padrão antes de desistir.
 */

export type Posicao = { lat: number; lng: number }

function promessaPosicao(opcoes: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocalização não suportada neste navegador.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, opcoes)
  })
}

/**
 * Captura a posição com alta precisão. Em caso de timeout do GPS, tenta uma
 * segunda vez com precisão padrão (mais rápida) — nunca lança erro se a
 * segunda tentativa resolver.
 */
export async function obterPosicao(): Promise<Posicao> {
  try {
    const p = await promessaPosicao({
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 0,
    })
    return { lat: p.coords.latitude, lng: p.coords.longitude }
  } catch (erroAlta) {
    // GPS demorou/negou — última tentativa com precisão padrão.
    try {
      const p = await promessaPosicao({
        enableHighAccuracy: false,
        timeout: 8_000,
        maximumAge: 60_000,
      })
      return { lat: p.coords.latitude, lng: p.coords.longitude }
    } catch {
      throw erroAlta
    }
  }
}
