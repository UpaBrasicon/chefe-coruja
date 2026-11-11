// Laudo por grupo (pedido do RT de 11/11/2026; G1 a G5 = A): um arquivo para
// vários exames do mesmo grupo. A lista vem de exames_aguardando_laudo (só o
// que aguarda resultado, tem grupo e quem pede pode registrar); aqui só se
// agrupa e se decide o que a tela oferece.
import type { GrupoExame } from './exames.ts'

export type ExameAguardandoLaudo = {
  id: string; exame: string; grupo: GrupoExame; situacao: string; pedido_em: string; urgencia: string | null; tipo: string | null
}

export const ROTULO_GRUPO_LAUDO: Record<GrupoExame, string> = { laboratorio: 'Laboratório', grafico: 'ECG e gráficos', imagem: 'Imagem' }
const ORDEM: GrupoExame[] = ['laboratorio', 'grafico', 'imagem']

/** Grupos com dois ou mais exames aguardando: só eles ganham o laudo do grupo (um exame só vai pelo registro do exame). */
export function gruposParaLaudo(exames: ExameAguardandoLaudo[]): { grupo: GrupoExame; exames: ExameAguardandoLaudo[] }[] {
  return ORDEM
    .map((grupo) => ({ grupo, exames: exames.filter((e) => e.grupo === grupo) }))
    .filter((g) => g.exames.length >= 2)
}

/** Foto (JPG ou PNG) só quando todos os marcados são de imagem; o envio segue a regra do primeiro marcado. */
export function laudoAceitaFoto(marcados: ExameAguardandoLaudo[]): boolean {
  return marcados.length > 0 && marcados.every((e) => e.tipo === 'imagem')
}
