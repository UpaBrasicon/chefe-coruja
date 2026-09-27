-- ════════════════════════════════════════════════════════════════════════════
-- Hermes (rodada B) — verificações dos agentes no banco.
--
-- O Cérbero e o Falcão faziam estas contas no TypeScript, com a data UTC
-- ("hoje" virava amanhã às 21h de Brasília), com o rótulo do turno em vez da
-- janela do plantão (a noite que começou ontem sumia) e sujeitos ao corte de
-- 1000 linhas da API (falsos "sem papel"). Aqui a conta usa a janela
-- (inicio + duracao_min) e o relógio do servidor. Só o service role executa.
-- ════════════════════════════════════════════════════════════════════════════

-- Mesmo profissional em duas UNIDADES ao mesmo tempo (fisicamente impossível).
-- Vários setores da mesma unidade ao mesmo tempo é legítimo (ADR 0003).
CREATE OR REPLACE FUNCTION public.hermes_plantoes_sobrepostos(p_horas integer DEFAULT 24)
RETURNS TABLE (perfil_id uuid, unidade_a uuid, unidade_b uuid, inicio_a timestamptz, inicio_b timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT DISTINCT ON (a.perfil_id, a.unidade_id, b.unidade_id)
         a.perfil_id, a.unidade_id, b.unidade_id, a.inicio, b.inicio
  FROM public.escala_plantao a
  JOIN public.escala_plantao b
    ON b.perfil_id = a.perfil_id AND b.unidade_id > a.unidade_id AND b.ativo
   AND b.inicio < a.inicio + make_interval(mins => a.duracao_min)
   AND a.inicio < b.inicio + make_interval(mins => b.duracao_min)
  WHERE a.ativo
    AND a.inicio < now() + make_interval(hours => p_horas)
    AND a.inicio + make_interval(mins => a.duracao_min) > now() - make_interval(hours => p_horas)
  ORDER BY a.perfil_id, a.unidade_id, b.unidade_id, a.inicio;
$$;

-- Perfil ativo sem nenhum vínculo ativo.
CREATE OR REPLACE FUNCTION public.hermes_perfis_sem_vinculo()
RETURNS TABLE (perfil_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id FROM public.perfis p
  WHERE p.ativo AND NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = p.id AND v.ativo);
$$;

-- Mesmo CRM (e UF) em perfis diferentes.
CREATE OR REPLACE FUNCTION public.hermes_crm_duplicado()
RETURNS TABLE (crm text, uf_crm text, perfis uuid[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.crm, coalesce(p.uf_crm, ''), array_agg(p.id ORDER BY p.id)
  FROM public.perfis p
  WHERE nullif(btrim(p.crm), '') IS NOT NULL
  GROUP BY p.crm, coalesce(p.uf_crm, '')
  HAVING count(*) > 1;
$$;

-- Setor com leito ocupado e ninguém de plantão AGORA (janela real, com a
-- noite que começou ontem).
CREATE OR REPLACE FUNCTION public.hermes_setores_ocupados_sem_plantao()
RETURNS TABLE (unidade_id uuid, setor_id uuid, leitos_ocupados bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.unidade_id, s.id, count(*)
  FROM public.leitos l
  JOIN public.setores s ON s.id = l.setor_id AND s.ativo
  WHERE l.status = 'ocupado'
    AND NOT EXISTS (
      SELECT 1 FROM public.escala_plantao e
      WHERE e.setor_id = s.id AND e.ativo
        AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min))
  GROUP BY s.unidade_id, s.id;
$$;

-- Plantões do perfil numa janela, com horário de Brasília (para a Corujinha).
CREATE OR REPLACE FUNCTION public.hermes_plantoes_do_perfil(p_perfil uuid, p_dias integer DEFAULT 7)
RETURNS TABLE (inicio_brasilia text, fim_brasilia text, duracao_horas numeric, setor text, unidade text, em_curso boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_char(e.inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
         to_char((e.inicio + make_interval(mins => e.duracao_min)) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
         round(e.duracao_min / 60.0, 1), s.nome, u.nome,
         e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id
  JOIN public.unidades u ON u.id = e.unidade_id
  WHERE e.perfil_id = p_perfil AND e.ativo
    AND e.inicio + make_interval(mins => e.duracao_min) > now()
    AND e.inicio < now() + make_interval(days => least(greatest(p_dias, 1), 31))
  ORDER BY e.inicio
  LIMIT 100;
$$;

-- Quantos profissionais por setor num dia civil de Brasília (sem nomes).
CREATE OR REPLACE FUNCTION public.hermes_plantao_do_dia(p_unidade uuid, p_dia date)
RETURNS TABLE (setor text, inicio_brasilia text, duracao_horas numeric, profissionais bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.nome, to_char(e.inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'), round(e.duracao_min / 60.0, 1), count(*)
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id
  WHERE e.unidade_id = p_unidade AND e.ativo
    AND (e.inicio AT TIME ZONE 'America/Sao_Paulo')::date = p_dia
  GROUP BY s.nome, s.ordem, e.inicio, e.duracao_min
  ORDER BY e.inicio, s.ordem;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['hermes_plantoes_sobrepostos(integer)', 'hermes_perfis_sem_vinculo()', 'hermes_crm_duplicado()',
                           'hermes_setores_ocupados_sem_plantao()', 'hermes_plantoes_do_perfil(uuid,integer)',
                           'hermes_plantao_do_dia(uuid,date)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
