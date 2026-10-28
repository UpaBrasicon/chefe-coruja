// Certificados A1 por unidade, numa pasta do servidor (até o cofre da 5.4):
//   <pasta>/<unidade_id>.pfx    o certificado
//   <pasta>/<unidade_id>.senha  a senha, numa linha
// A pasta fica fora do repositório e do Supabase, só com leitura para o serviço.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Certificados } from './ciclo.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function certificadosEmPasta(pasta: string): Certificados {
  return {
    async obter(unidade) {
      if (!UUID.test(unidade)) return null // o nome do arquivo vem do id; nada de caminho
      try {
        const [pfx, senha] = await Promise.all([
          readFile(join(pasta, `${unidade}.pfx`)),
          readFile(join(pasta, `${unidade}.senha`), 'utf8'),
        ])
        return { pfx, senha: senha.trim() }
      } catch {
        return null
      }
    },
  }
}
