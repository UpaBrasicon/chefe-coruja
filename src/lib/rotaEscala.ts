import type { Papel } from '@/types/database'

/**
 * Destino de `/escala` pelo **papel ativo** (o perfil em foco no menu do
 * usuário), igual ao menu de cada papel: gestor e admin montam a escala na
 * própria rota; o plantonista vê a dele na Agenda; os demais em `/minha-escala`.
 *
 * Teste em produção de 31/10/2026, achado 1: a rota escolhia pela lista de
 * papéis da unidade, e quem também é gestor via as abas do gestor com o
 * conteúdo do plantonista (`Escala.tsx` decide pelo papel ativo).
 *
 * `null` = fica em `/escala` (a tela do gestor).
 */
export function destinoEscala(papelAtivo: Papel | null): string | null {
  if (papelAtivo === 'gestor' || papelAtivo === 'admin') return null
  if (papelAtivo === 'plantonista') return '/agenda?aba=escala'
  return '/minha-escala'
}
