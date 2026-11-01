import type { Papel } from '@/types/database'

/**
 * A categoria da aba Escala (`/minha-escala`) é o **papel ativo** (o perfil em
 * foco no menu do usuário), não a lista de papéis da unidade.
 *
 * Teste em produção de 31/10/2026, achado 3: o subtítulo e o dia diziam
 * "Plantonista e Telemedicina e Enfermeiro e…" para quem tem vários papéis.
 *
 * `null` = sem categoria (gestor, admin ou nenhum papel ativo): a tela mostra tudo.
 */
export function categoriaDaTela(papelAtivo: Papel | null, papeisDaUnidade: Papel[]): Papel | null {
  if (!papelAtivo || papelAtivo === 'gestor' || papelAtivo === 'admin') return null
  return papeisDaUnidade.includes(papelAtivo) ? papelAtivo : null
}

/** O plantão é da categoria da tela? Plantão sem categoria conta como plantonista (como em `vagas_abertas`, M1). */
export function daCategoria(papelDoPlantao: Papel | null, categoria: Papel | null): boolean {
  return categoria === null || (papelDoPlantao ?? 'plantonista') === categoria
}
