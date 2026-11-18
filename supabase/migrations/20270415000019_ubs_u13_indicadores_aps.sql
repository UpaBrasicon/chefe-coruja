-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U13, PR 1 (plano em docs/ubs/U13-PLANO.md; U13 = A e
-- G1–G3 = A do RT em 18/11/2026): indicadores C1, C6 e C7 da SAPS no painel do
-- gestor. C2 a C5 saem dos painéis que já existem (puericultura, pré-natal e
-- hiperdia), na tela.
--
-- Fonte: notas metodológicas C1, C6 e C7 da SAPS/MS para eSF e eAP (versões de
-- junho de 2026) e NT 8/2026-DEAPS/SAPS/MS.
--
-- public.indicadores_aps(unidade) devolve, para a UBS:
-- C1 Mais acesso (últimos 4 meses; o Ministério avalia por quadrimestre):
--    atendimentos de demanda programada (consulta agendada programada, cuidado
--    continuado e consulta agendada) sobre todos os atendimentos (com a escuta
--    inicial, a consulta no dia e a urgência), de médico e enfermeiro.
--    O pré-natal do parceiro (U6, E3) conta como consulta agendada. Ficha vencida
--    (sem profissional) não conta.
-- C6 Pessoa idosa (60 anos ou mais, últimos 12 meses): A consulta de médico ou
--    enfermeiro (25) e B peso e altura no mesmo dia (25). C (visitas do ACS) e
--    D (vacina da influenza) ficam fora do app e contam zero (G1 = A).
-- C7 Mulher, prevenção do câncer: A colo do útero de 25 a 64 anos
--    (citopatológico pedido ou coleta registrada em 36 meses; 20 pontos);
--    C saúde sexual e reprodutiva de 14 a 69 anos (atendimento de médico ou
--    enfermeiro em 12 meses com o problema ou CID/CIAP da nota; 30); D mamografia
--    de 50 a 69 anos (pedida em 24 meses; 20). B (vacina HPV de 9 a 14) fica fora
--    do app e conta zero.
-- Médico e enfermeiro pelo papel na unidade (G2 = A; o Ministério usa o CBO).
-- Denominador: cadastro ativo na UBS (G3 = A; o Ministério usa o vínculo da
-- Portaria SAPS 161/2024).
--
-- Idempotente. Teste: supabase/tests/ubs_u13_indicadores_aps.sql
--
-- Rollback: DROP FUNCTION public.indicadores_aps(uuid), private.aps_atendeu(uuid, uuid),
--   private.aps_ssr(text[], text[], text[]);
-- ════════════════════════════════════════════════════════════════════════════

-- atendeu como médico ou enfermeiro da unidade (G2 = A)
CREATE OR REPLACE FUNCTION private.aps_atendeu(p_perfil uuid, p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_perfil IS NOT NULL AND EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade
                                           AND v.papel::text IN ('plantonista', 'enfermeiro'))
$$;
REVOKE ALL ON FUNCTION private.aps_atendeu(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- saúde sexual e reprodutiva (C7, item 24-g da nota): problema da ficha, CIAP-2 ou CID-10
CREATE OR REPLACE FUNCTION private.aps_ssr(p_problemas text[], p_cids text[], p_ciaps text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 'saude_sexual_reprodutiva' = ANY (coalesce(p_problemas, '{}'))
      OR coalesce(p_ciaps, '{}') && ARRAY['B25', 'W02', 'W10', 'W11', 'W12', 'W13', 'W14', 'W15', 'W79', 'W82',
                                          'X01', 'X02', 'X03', 'X04', 'X05', 'X06', 'X07', 'X08', 'X09', 'X10', 'X11', 'X12', 'X13',
                                          'X23', 'X24', 'X82', 'X89', 'Y14']
      OR EXISTS (SELECT 1 FROM unnest(coalesce(p_cids, '{}')) c, LATERAL (SELECT upper(replace(c, '.', '')) AS k) n
                  WHERE left(n.k, 3) IN ('N80', 'N91', 'N92', 'N93', 'N94', 'N95', 'N96', 'N97', 'O03', 'O04', 'Z30', 'Z31', 'Z70')
                     OR n.k IN ('R102', 'T742', 'Z123', 'Z124', 'Z205', 'Z206', 'Z320', 'Z600', 'Z630', 'Z640', 'Z717', 'Z725')
                     OR n.k LIKE 'Y05%')
$$;
REVOKE ALL ON FUNCTION private.aps_ssr(text[], text[], text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.indicadores_aps(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hoje date := private.data_atual();
  v_c1 jsonb; v_c6 jsonb; v_c7 jsonb;
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT (private.sou_gestor_da_unidade(p_unidade) OR private.hiperdia_ve(p_unidade)) THEN
    RAISE EXCEPTION 'Os indicadores da UBS são vistos pelo gestor e pela equipe da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = p_unidade AND tipo::text = 'ubs') THEN
    RAISE EXCEPTION 'Os indicadores da APS são da UBS.';
  END IF;

  -- C1: atendimentos de médico e enfermeiro nos últimos 4 meses
  SELECT jsonb_build_object(
           'programados', count(*) FILTER (WHERE e.tipo_atendimento_aps IN ('consulta_programada', 'consulta_agendada', 'pre_natal_parceiro')),
           'total', count(*),
           'de', v_hoje - 120, 'ate', v_hoje)
    INTO v_c1
    FROM public.episodios e
   WHERE e.unidade_id = p_unidade AND e.tipo_atendimento_aps IS NOT NULL AND e.etapa = 'encerrado'
     AND (e.encerrado_em AT TIME ZONE 'America/Sao_Paulo')::date > v_hoje - 120
     AND private.aps_atendeu(coalesce(e.desfecho_por, e.encerrado_por), p_unidade);

  -- C6: pessoas com 60 anos ou mais
  WITH idosos AS (
    SELECT pa.id FROM public.pacientes pa
     WHERE pa.unidade_id = p_unidade AND pa.ativo AND pa.data_nascimento IS NOT NULL
       AND pa.data_nascimento <= (v_hoje - interval '60 years')::date),
  pontos AS (
    SELECT i.id,
           CASE WHEN EXISTS (SELECT 1 FROM public.episodios e
                              WHERE e.paciente_id = i.id AND e.unidade_id = p_unidade AND e.tipo_atendimento_aps IS NOT NULL
                                AND e.etapa = 'encerrado' AND e.encerrado_em > now() - interval '12 months'
                                AND private.aps_atendeu(coalesce(e.desfecho_por, e.encerrado_por), p_unidade)) THEN 25 ELSE 0 END AS a,
           CASE WHEN EXISTS (SELECT 1 FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
                              WHERE o.paciente_id = i.id AND c.nome = 'peso' AND o.aferido_em > now() - interval '12 months'
                                AND EXISTS (SELECT 1 FROM public.observacao o2 JOIN public.conceito c2 ON c2.id = o2.conceito_id
                                             WHERE o2.paciente_id = i.id AND c2.nome = 'estatura'
                                               AND (o2.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date = (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date))
                THEN 25 ELSE 0 END AS b
      FROM idosos i)
  SELECT jsonb_build_object('pessoas', count(*), 'consulta', count(*) FILTER (WHERE a > 0), 'peso_altura', count(*) FILTER (WHERE b > 0),
                            'media', CASE WHEN count(*) > 0 THEN round(avg(a + b), 1) END)
    INTO v_c6 FROM pontos;

  -- C7: mulheres de 14 a 69 (C), 25 a 64 (A) e 50 a 69 (D)
  WITH mulheres AS (
    SELECT pa.id, date_part('year', age(v_hoje, pa.data_nascimento))::int AS idade
      FROM public.pacientes pa
     WHERE pa.unidade_id = p_unidade AND pa.ativo AND pa.data_nascimento IS NOT NULL AND upper(coalesce(pa.sexo, '')) LIKE 'F%'),
  m AS (
    SELECT w.id, w.idade,
           (w.idade BETWEEN 25 AND 64 AND (
              EXISTS (SELECT 1 FROM public.exames_pedidos x WHERE x.paciente_id = w.id AND x.situacao IS DISTINCT FROM 'cancelado'
                         AND x.procedimento IN ('0203010086', '0203010019') AND x.pedido_em > now() - interval '36 months')
              OR EXISTS (SELECT 1 FROM public.procedimentos_realizados p WHERE p.paciente_id = w.id AND p.cancelado_em IS NULL
                            AND p.procedimento = '0201020033' AND p.realizado_em > now() - interval '36 months'))) AS colo,
           (w.idade BETWEEN 14 AND 69 AND EXISTS (
              SELECT 1 FROM public.episodios e
               WHERE e.paciente_id = w.id AND e.unidade_id = p_unidade AND e.tipo_atendimento_aps IS NOT NULL AND e.etapa = 'encerrado'
                 AND e.encerrado_em > now() - interval '12 months'
                 AND private.aps_atendeu(coalesce(e.desfecho_por, e.encerrado_por), p_unidade)
                 AND private.aps_ssr(e.problemas_aps, e.cid_aps, e.ciap_aps))) AS ssr,
           (w.idade BETWEEN 50 AND 69 AND EXISTS (
              SELECT 1 FROM public.exames_pedidos x WHERE x.paciente_id = w.id AND x.situacao IS DISTINCT FROM 'cancelado'
                 AND x.procedimento IN ('0204030030', '0204030188') AND x.pedido_em > now() - interval '24 months')) AS mama
      FROM mulheres w)
  SELECT jsonb_build_object(
           'colo', jsonb_build_object('faixa', count(*) FILTER (WHERE idade BETWEEN 25 AND 64), 'feito', count(*) FILTER (WHERE colo)),
           'ssr', jsonb_build_object('faixa', count(*) FILTER (WHERE idade BETWEEN 14 AND 69), 'feito', count(*) FILTER (WHERE ssr)),
           'mama', jsonb_build_object('faixa', count(*) FILTER (WHERE idade BETWEEN 50 AND 69), 'feito', count(*) FILTER (WHERE mama)))
    INTO v_c7 FROM m;

  RETURN jsonb_build_object('c1', v_c1, 'c6', v_c6, 'c7', v_c7, 'gerado_em', now());
END $$;
REVOKE ALL ON FUNCTION public.indicadores_aps(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicadores_aps(uuid) TO authenticated;
