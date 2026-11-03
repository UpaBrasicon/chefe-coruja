// ─────────────────────────────────────────────────────────────────────────────
// Cifra um .pfx para o cofre como o navegador faz (5C-5.4b), para o teste ponta
// a ponta na homologação (deploy/e2e-cofre-homolog.sql). Só para teste: o
// certificado de verdade é cifrado na tela (5.4c) e não passa por aqui.
//
//   node services/rnds-envio/simulador/cifrar.ts --pfx <arquivo> --credencial <uuid>
//
// A senha vem de RNDS_PFX_SENHA e a chave pública (o JSON de
// public.rnds_chave_publica: {id, jwk}) de RNDS_CHAVE_PUBLICA. Imprime o cifrado.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { cifrarCertificado, type ChavePublica } from '../../../src/interop/rnds/cofre.ts'

const { values } = parseArgs({ options: { pfx: { type: 'string' }, credencial: { type: 'string' } } })
if (!values.pfx || !values.credencial || !process.env.RNDS_CHAVE_PUBLICA) {
  console.error('uso: RNDS_CHAVE_PUBLICA=<json> RNDS_PFX_SENHA=<senha> node cifrar.ts --pfx <arquivo> --credencial <uuid>')
  process.exit(2)
}
const chave = JSON.parse(process.env.RNDS_CHAVE_PUBLICA) as ChavePublica
const cifrado = await cifrarCertificado(chave, values.credencial, {
  pfx: readFileSync(values.pfx),
  senha: process.env.RNDS_PFX_SENHA ?? '',
})
console.log(JSON.stringify(cifrado))
