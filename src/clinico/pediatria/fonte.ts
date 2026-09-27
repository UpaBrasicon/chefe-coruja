import type { Ficha } from '../ficha.ts'
import { MANUAL_HC } from '../adulto/fonte.ts'

// Fonte das ferramentas pediátricas com dose (Fase 5.4): o manual de
// emergência do HCFMUSP (3ª ed., 2022) — só o que o livro traz EXPLICITAMENTE
// para a criança (Anexo 2 e os trechos pediátricos dos capítulos). Nada é
// convertido do adulto; o que o livro não traz não entra (casco).

export function fichaPediatrica(id: string, titulo: string, paginas: string): Ficha {
  return {
    id,
    titulo,
    versao: '2026-09-27.2',
    publico: 'pediatrico',
    fontes: [{ citacao: `${MANUAL_HC.citacao} ${paginas}.`, pediatrica: true }],
    revisadoEm: '27/09/2026 (conferido no livro, com errata anotada)',
  }
}
