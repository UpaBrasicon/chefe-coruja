import { ferramentasDoCid, type FaixaPaciente } from '../clinico/cidFerramentas.ts'
import { ROTA_DA_FICHA } from '../clinico/indice.ts'

// F2 das ferramentas pelo CID (pedido do RT de 17/11/2026; CF4 = A): junta as
// ferramentas de todos os CIDs do atendimento, sem repetir, na ordem dos CIDs.
// Só lista e abre: nenhum resultado, dose, cor ou conduta sai daqui.

export const ROTULO_BLOCO_CID = 'Atalho para ferramentas de referência. A decisão é do médico.'

export type FerramentaDoCid = { ficha: string; rota: string; motivo: string; cid: string }

export function ferramentasDosCids(cids: (string | null | undefined)[], faixa: FaixaPaciente): FerramentaDoCid[] {
  const vistas = new Set<string>()
  const lista: FerramentaDoCid[] = []
  for (const cid of cids) {
    if (!cid?.trim()) continue
    for (const l of ferramentasDoCid(cid, faixa)) {
      const rota = ROTA_DA_FICHA[l.ficha]
      if (!rota || vistas.has(l.ficha)) continue
      vistas.add(l.ficha)
      lista.push({ ficha: l.ficha, rota, motivo: l.motivo, cid: cid.trim().split(/\s|—/)[0].toUpperCase() })
    }
  }
  return lista
}
