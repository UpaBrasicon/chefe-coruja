-- Alerta de sepse do adulto para o gestor (teste da rede, B P2-1; decisão A do
-- RT em 11/11/2026, docs/teste-rede/SEPSE-ADULTO-ALERTA-DIAGNOSTICO.md).
-- public.alertas_sepse passa a listar também o adulto (14 anos ou mais) em
-- admissão, observação ou internação, quando há gatilho de infecção (o mesmo da
-- criança: suspeita marcada pelo médico ou CID de infecção) e NEWS2 de 5 ou mais
-- pelos sinais vitais registrados (private.calcular_acuidade, RCP 2017, escala 1;
-- rastreio pelo NEWS2: Surviving Sepsis Campaign 2026, rec. 4).
--   nivel 'news2_rastreio': NEWS2 de 5 a 6; nivel 'news2_alto': 7 ou mais.
-- A parte da criança (Phoenix) não muda, nem a assinatura nem a regra de acesso.
--
-- Expand: mesma assinatura e mesma saída; só entram linhas novas, do adulto.
-- Idempotente (CREATE OR REPLACE).
-- Rollback (testado na homologação): recriar a versão de
-- 20270209000002_escores_pediatricos_data.sql (o laço do adulto sai).

CREATE OR REPLACE FUNCTION public.alertas_sepse(p_unidade uuid)
 RETURNS TABLE(paciente_id uuid, nivel text, total integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r record; ph jsonb; g jsonb; v_meses int; a jsonb;
BEGIN
  IF NOT private.segundo_fator_ok() THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  -- criança: Phoenix (sem mudança)
  FOR r IN
    SELECT DISTINCT p.id, p.data_nascimento FROM public.internacoes i
    JOIN public.pacientes p ON p.id = i.paciente_id
    WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
      AND p.data_nascimento > private.data_atual() - interval '14 years'
      AND (private.papel_na_unidade(p_unidade) = 'gestor' OR private.paciente_em_cuidado_no_plantao(p.id))
  LOOP
    g := private.gatilho_infeccao(r.id);
    CONTINUE WHEN g IS NULL;
    v_meses := (extract(year FROM age(private.data_atual(), r.data_nascimento)) * 12 + extract(month FROM age(private.data_atual(), r.data_nascimento)))::int;
    ph := private.calcular_phoenix(r.id, v_meses, g);
    paciente_id := r.id;
    total := (ph ->> 'total')::int;
    nivel := CASE WHEN (ph ->> 'choque')::boolean THEN 'choque' WHEN (ph ->> 'sepse')::boolean THEN 'sepse' ELSE 'rastreio' END;
    RETURN NEXT;
  END LOOP;
  -- adulto: gatilho de infecção e NEWS2 de 5 ou mais
  FOR r IN
    SELECT DISTINCT p.id FROM public.internacoes i
    JOIN public.pacientes p ON p.id = i.paciente_id
    WHERE i.unidade_id = p_unidade AND i.status IN ('admitido', 'em_observacao', 'internado')
      AND p.data_nascimento <= private.data_atual() - interval '14 years'
      AND (private.papel_na_unidade(p_unidade) = 'gestor' OR private.paciente_em_cuidado_no_plantao(p.id))
  LOOP
    CONTINUE WHEN private.gatilho_infeccao(r.id) IS NULL;
    a := private.calcular_acuidade(r.id);
    CONTINUE WHEN a ->> 'escala' IS DISTINCT FROM 'NEWS2' OR coalesce((a ->> 'total')::int, 0) < 5;
    paciente_id := r.id;
    total := (a ->> 'total')::int;
    nivel := CASE WHEN total >= 7 THEN 'news2_alto' ELSE 'news2_rastreio' END;
    RETURN NEXT;
  END LOOP;
END $function$;
