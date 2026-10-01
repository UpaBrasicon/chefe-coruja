-- ════════════════════════════════════════════════════════════════════════════
-- Onda 12 — Verificações do sistema para o administrador geral (a TELA
-- "Erros e alertas" precisa chamá-las do navegador).
--
-- As funções public.hermes_* (migrations 20260927000006 e 20260927000008)
-- rodam as verificações de lógica, mas são REVOGADAS de authenticated e só o
-- service_role executa (os agentes Hermes). O administrador geral abre a tela
-- no navegador (papel authenticated) e não consegue chamá-las direto.
--
-- Esta função é um invólucro SECURITY DEFINER, no mesmo padrão da leitura dos
-- erros (20261016000001): confere o super admin DENTRO e, como roda com o dono
-- (postgres, dono também das hermes_*), executa as verificações e devolve tudo
-- num jsonb já com nomes legíveis (unidade, setor, profissional) no lugar dos
-- UUIDs crus. Nenhuma identidade de paciente — as hermes_* só devolvem IDs de
-- profissional e contagens.
--
-- Reaplicável (CREATE OR REPLACE).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.verificacoes_sistema()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado: verificações do sistema são do administrador geral.';
  END IF;

  SELECT jsonb_build_object(
    'gerado_em', now(),
    'escala', jsonb_build_object(
      'plantoes_sobrepostos', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'perfil', pf.nome_completo, 'unidade_a', ua.nome, 'unidade_b', ub.nome,
          'inicio_a', t.inicio_a, 'inicio_b', t.inicio_b) ORDER BY t.inicio_a), '[]'::jsonb)
        FROM public.hermes_plantoes_sobrepostos() t
        LEFT JOIN public.perfis pf ON pf.id = t.perfil_id
        LEFT JOIN public.unidades ua ON ua.id = t.unidade_a
        LEFT JOIN public.unidades ub ON ub.id = t.unidade_b
      ),
      'buracos_escala', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'unidade', u.nome, 'setor', t.setor, 'horas_sem_ninguem', t.horas_sem_ninguem,
          'primeira_hora', t.primeira_hora_brasilia)), '[]'::jsonb)
        FROM public.hermes_buracos_escala() t
        LEFT JOIN public.unidades u ON u.id = t.unidade_id
      ),
      'checkin_pendente', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'perfil', pf.nome_completo, 'unidade', u.nome, 'setor', t.setor,
          'inicio', t.inicio_brasilia)), '[]'::jsonb)
        FROM public.hermes_checkin_pendente() t
        LEFT JOIN public.perfis pf ON pf.id = t.perfil_id
        LEFT JOIN public.unidades u ON u.id = t.unidade_id
      ),
      'setores_ocupados_sem_plantao', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'unidade', u.nome, 'setor', s.nome, 'leitos_ocupados', t.leitos_ocupados)), '[]'::jsonb)
        FROM public.hermes_setores_ocupados_sem_plantao() t
        LEFT JOIN public.unidades u ON u.id = t.unidade_id
        LEFT JOIN public.setores s ON s.id = t.setor_id
      )
    ),
    'cadastro', jsonb_build_object(
      'perfis_sem_vinculo', (
        SELECT coalesce(jsonb_agg(jsonb_build_object('perfil', pf.nome_completo)), '[]'::jsonb)
        FROM public.hermes_perfis_sem_vinculo() t
        LEFT JOIN public.perfis pf ON pf.id = t.perfil_id
      ),
      'crm_duplicado', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'crm', t.crm, 'uf_crm', nullif(t.uf_crm, ''),
          'perfis', (SELECT coalesce(jsonb_agg(p2.nome_completo ORDER BY p2.nome_completo), '[]'::jsonb)
                     FROM public.perfis p2 WHERE p2.id = ANY(t.perfis)))), '[]'::jsonb)
        FROM public.hermes_crm_duplicado() t
      )
    ),
    'seguranca', jsonb_build_object(
      'cadeia_auditoria', public.hermes_cadeia_auditoria(),
      'acessos_anomalos', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'perfil', pf.nome_completo, 'unidade', u.nome, 'aberturas', t.aberturas,
          'impressoes', t.impressoes, 'pacientes_distintos', t.pacientes_distintos)), '[]'::jsonb)
        FROM public.hermes_acessos_anomalos() t
        LEFT JOIN public.perfis pf ON pf.id = t.perfil_id
        LEFT JOIN public.unidades u ON u.id = t.unidade_id
      )
    ),
    'operacao', jsonb_build_object(
      'revisoes_paradas', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'unidade', u.nome, 'pendentes', t.pendentes, 'mais_antiga', t.mais_antiga_brasilia)), '[]'::jsonb)
        FROM public.hermes_revisoes_paradas() t
        LEFT JOIN public.unidades u ON u.id = t.unidade_id
      )
    )
  ) INTO v;

  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.verificacoes_sistema() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verificacoes_sistema() TO authenticated;
