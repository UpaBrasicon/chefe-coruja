// Rajada de troca de plantão (7h/19h): todos entram juntos — meu_plantao_agora +
// registrar_checkin + censo. O check-in precisa de lat/lng dentro do raio da
// unidade LOADTEST (DADOS.lat/lng, gravados pela massa).
import exec from 'k6/execution'
import { rpc } from '../lib/supa.js'
import { usuarioDoVU } from '../lib/auth.js'
import { DADOS } from '../lib/dados.js'
import { ESCRITA } from '../lib/config.js'

export function pico() {
  const vu = exec.vu.idInTest
  // 80% plantonista, 20% enfermeiro — todos batem ponto na virada
  const papel = vu % 5 === 0 ? 'enfermeiro' : 'plantonista'
  const token = usuarioDoVU(papel, vu).access_token

  rpc(token, 'meu_plantao_agora', {})
  if (ESCRITA) {
    rpc(
      token,
      'registrar_checkin',
      { p_unidade: DADOS.unidade, p_lat: DADOS.lat, p_lng: DADOS.lng },
      { tipo: 'escrita' },
    )
  }
  rpc(token, 'situacao_leitos', { p_unidade: DADOS.unidade })
}
