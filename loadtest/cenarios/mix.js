// Distribui os VUs pelos papéis (60% plantonista, 20% enfermagem, 10% gestor,
// 10% recepção) de forma estável por VU, e roda a jornada do papel com o token
// do usuário correspondente.
import exec from 'k6/execution'
import { usuarioDoVU } from '../lib/auth.js'
import { plantonista } from './plantonista.js'
import { enfermagem } from './enfermagem.js'
import { gestor } from './gestor.js'
import { recepcao } from './recepcao.js'

function papelDoVU(vu) {
  const r = vu % 10
  if (r < 6) return 'plantonista'
  if (r < 8) return 'enfermeiro'
  if (r < 9) return 'gestor'
  return 'recepcao'
}

const FN = { plantonista, enfermeiro: enfermagem, gestor, recepcao }

export function rodarPorPapel() {
  const vu = exec.vu.idInTest
  const papel = papelDoVU(vu)
  const usuario = usuarioDoVU(papel, vu)
  FN[papel](usuario.access_token)
}
