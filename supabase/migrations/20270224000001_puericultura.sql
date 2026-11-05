-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 7, puericultura, parte 1 (BACKLOG.md; K6 = A do RT em 05/11/2026:
-- logo depois do pré-natal, com as mesmas regras; "Sim, puericultura" no
-- mesmo dia).
--
-- Régua: nota metodológica C2 (cuidado no desenvolvimento infantil) da
-- SAPS/MS, assinada em junho de 2026 e lida na fonte em 05/11/2026:
--   • entra toda criança vinculada com até 2 anos de vida (item 14 e seção
--     4.1): aqui, a criança com cadastro ativo na UBS e nascida há menos de 2
--     anos. Não há CID de entrada, ao contrário do pré-natal;
--   • sai por mudança de território ou de equipe e por óbito (item 15): aqui,
--     à mão, com motivo, pelo médico ou pelo enfermeiro; e sozinha aos 2 anos;
--   • (A) e (B): consulta de médico ou enfermeiro com o problema/condição
--     avaliada "Puericultura" (Quadro 02);
--   • (C): peso e altura no mesmo dia (Quadro 03);
--   • (D) visitas do ACS e (E) vacinas não existem no app (K3: "não
--     registrado"); o teto no app é 60 de 100.
-- O prazo de (A), "até o 30º dia de vida", e a regra de "em dia" ficam em
-- src/domain/puericultura.ts.
--
-- 1. puericultura_saidas: a saída à mão (mudança, óbito), que pode ser desfeita.
-- 2. private.puericultura_registros: a 1ª consulta, as consultas (com as
--    datas), os pesos com altura (com as datas) até os 2 anos e a próxima
--    consulta marcada.
-- 3. RPCs: puericultura_painel e puericultura_do_paciente (médico,
--    enfermagem e gestor, como o hiperdia e o pré-natal); puericultura_retirar
--    e puericultura_desfazer_saida (médico e enfermeiro).
--
-- Idempotente. Teste: supabase/tests/5a_puericultura.sql
--
-- Rollback (na ordem):
--   DROP FUNCTION IF EXISTS public.puericultura_painel(uuid), public.puericultura_do_paciente(uuid),
--     public.puericultura_retirar(uuid, text), public.puericultura_desfazer_saida(uuid),
--     private.puericultura_registros(uuid, date), private.puericultura_crianca(date),
--     private.puericultura_exigir_cuidador(uuid);
--   DROP TABLE IF EXISTS public.puericultura_saidas;
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.puericultura_saidas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id   uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  motivo        text NOT NULL CHECK (length(btrim(motivo)) >= 5),
  saida_por     uuid REFERENCES public.perfis(id),
  saida_em      timestamptz NOT NULL DEFAULT now(),
  desfeita_por  uuid REFERENCES public.perfis(id),
  desfeita_em   timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_puericultura_saidas_ativa ON public.puericultura_saidas (paciente_id) WHERE desfeita_em IS NULL;

ALTER TABLE public.puericultura_saidas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.puericultura_saidas FROM anon, authenticated;
COMMENT ON TABLE public.puericultura_saidas IS
  'Puericultura da UBS (5A, tarefa 7; nota C2 da SAPS/MS): saída à mão da criança (mudança de território ou de equipe, óbito). Acesso só pelas RPCs puericultura_*.';

-- ── apoio ───────────────────────────────────────────────────────────────────
-- criança da régua: nascida hoje ou antes, e há menos de 2 anos
CREATE OR REPLACE FUNCTION private.puericultura_crianca(p_nasc date)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT p_nasc IS NOT NULL AND p_nasc <= private.data_atual()
     AND private.data_atual() < (p_nasc + interval '2 years')::date
$$;

CREATE OR REPLACE FUNCTION private.puericultura_exigir_cuidador(p_unidade uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = p_unidade AND tipo::text = 'ubs') THEN
    RAISE EXCEPTION 'A puericultura é da UBS.';
  END IF;
  IF NOT (private.tenho_papel(p_unidade, 'plantonista') IS TRUE OR private.tenho_papel(p_unidade, 'enfermeiro') IS TRUE) THEN
    RAISE EXCEPTION 'Acesso negado: a puericultura é registrada pelo médico ou pelo enfermeiro da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;

-- o que o app registra até os 2 anos (nota C2, Quadros 02 e 03)
CREATE OR REPLACE FUNCTION private.puericultura_registros(p_paciente uuid, p_nasc date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ate date := (p_nasc + interval '2 years')::date;  -- exclusivo
  v_primeira date; v_consultas int; v_datas jsonb; v_pa_datas jsonb;
BEGIN
  -- (A) e (B): consulta da UBS com o problema "Puericultura"
  SELECT min(c.d), count(*), coalesce(jsonb_agg(c.d ORDER BY c.d), '[]'::jsonb)
    INTO v_primeira, v_consultas, v_datas
    FROM (SELECT (e.encerrado_em AT TIME ZONE 'America/Sao_Paulo')::date AS d
            FROM public.episodios e
           WHERE e.paciente_id = p_paciente AND e.tipo_atendimento_aps IS NOT NULL AND e.conduta_aps IS NOT NULL
             AND e.encerrado_em IS NOT NULL AND 'puericultura' = ANY (coalesce(e.problemas_aps, '{}'))) c
   WHERE c.d >= p_nasc AND c.d < v_ate;

  -- (C) peso e altura no mesmo dia (um por dia)
  SELECT coalesce(jsonb_agg(x.d ORDER BY x.d), '[]'::jsonb) INTO v_pa_datas
    FROM (SELECT DISTINCT (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date AS d
            FROM public.observacao o JOIN public.conceito k ON k.id = o.conceito_id
           WHERE o.paciente_id = p_paciente AND k.nome = 'peso'
             AND EXISTS (SELECT 1 FROM public.observacao o2 JOIN public.conceito k2 ON k2.id = o2.conceito_id
                          WHERE o2.paciente_id = p_paciente AND k2.nome = 'estatura'
                            AND (o2.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date = (o.aferido_em AT TIME ZONE 'America/Sao_Paulo')::date)) x
   WHERE x.d >= p_nasc AND x.d < v_ate;

  RETURN jsonb_build_object(
    'primeira_consulta', v_primeira, 'consultas', v_consultas, 'datas_consultas', v_datas,
    'peso_altura', jsonb_array_length(v_pa_datas), 'datas_peso_altura', v_pa_datas,
    'proxima_consulta', (SELECT min(a.inicio) FROM public.agendamentos a
                          WHERE a.paciente_id = p_paciente AND a.tipo = 'consulta' AND a.situacao = 'agendado' AND a.inicio > now()));
END $$;

REVOKE ALL ON FUNCTION private.puericultura_crianca(date), private.puericultura_exigir_cuidador(uuid),
  private.puericultura_registros(uuid, date) FROM PUBLIC, anon, authenticated;

-- ── painel e criança (K4, K5) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.puericultura_painel(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.hiperdia_ve(p_unidade) THEN
    RAISE EXCEPTION 'A puericultura é vista pelo médico, pela enfermagem e pelo gestor da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = p_unidade AND tipo::text = 'ubs') THEN
    RAISE EXCEPTION 'A puericultura é da UBS.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('paciente_id', pa.id, 'nome', pa.nome, 'nome_social', pa.nome_social,
                                        'data_nascimento', pa.data_nascimento, 'nome_mae', pa.nome_mae)
                     || private.puericultura_registros(pa.id, pa.data_nascimento)
           ORDER BY pa.data_nascimento DESC, pa.nome)
      FROM public.pacientes pa
     WHERE pa.unidade_id = p_unidade AND pa.ativo AND private.puericultura_crianca(pa.data_nascimento)
       AND NOT EXISTS (SELECT 1 FROM public.puericultura_saidas s WHERE s.paciente_id = pa.id AND s.desfeita_em IS NULL)), '[]'::jsonb);
END $$;

-- bloco da consulta: crianca = false fora da régua (mais de 2 anos, outra unidade)
CREATE OR REPLACE FUNCTION public.puericultura_do_paciente(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacientes;
BEGIN
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT FOUND OR NOT private.hiperdia_ve(pa.unidade_id) THEN
    RAISE EXCEPTION 'A puericultura é vista pelo médico, pela enfermagem e pelo gestor da UBS.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT pa.ativo OR NOT private.puericultura_crianca(pa.data_nascimento)
     OR NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = pa.unidade_id AND tipo::text = 'ubs') THEN
    RETURN jsonb_build_object('crianca', false);
  END IF;
  RETURN jsonb_build_object('crianca', true, 'data_nascimento', pa.data_nascimento,
    'saida', (SELECT jsonb_build_object('motivo', s.motivo, 'em', s.saida_em) FROM public.puericultura_saidas s
               WHERE s.paciente_id = pa.id AND s.desfeita_em IS NULL))
    || private.puericultura_registros(pa.id, pa.data_nascimento);
END $$;

-- ── saída à mão (item 15) ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.puericultura_retirar(p_paciente uuid, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacientes; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  PERFORM private.puericultura_exigir_cuidador(pa.unidade_id);
  IF NOT private.puericultura_crianca(pa.data_nascimento) THEN RAISE EXCEPTION 'A puericultura vai até os 2 anos.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Escreva o motivo da saída (mínimo de 5 letras).'; END IF;
  IF EXISTS (SELECT 1 FROM public.puericultura_saidas WHERE paciente_id = pa.id AND desfeita_em IS NULL) THEN
    RAISE EXCEPTION 'A criança já saiu da puericultura.';
  END IF;
  INSERT INTO public.puericultura_saidas (unidade_id, paciente_id, motivo, saida_por)
  VALUES (pa.unidade_id, pa.id, btrim(p_motivo), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('puericultura_retirada', 'puericultura_saidas', v_id, pa.unidade_id, NULL);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.puericultura_desfazer_saida(p_paciente uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.puericultura_saidas;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO s FROM public.puericultura_saidas WHERE paciente_id = p_paciente AND desfeita_em IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'A criança não saiu da puericultura.'; END IF;
  PERFORM private.puericultura_exigir_cuidador(s.unidade_id);
  UPDATE public.puericultura_saidas SET desfeita_em = now(), desfeita_por = private.meu_perfil_id() WHERE id = s.id;
  PERFORM private.registrar_auditoria('puericultura_saida_desfeita', 'puericultura_saidas', s.id, s.unidade_id, NULL);
END $$;

REVOKE ALL ON FUNCTION public.puericultura_painel(uuid), public.puericultura_do_paciente(uuid),
  public.puericultura_retirar(uuid, text), public.puericultura_desfazer_saida(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puericultura_painel(uuid), public.puericultura_do_paciente(uuid),
  public.puericultura_retirar(uuid, text), public.puericultura_desfazer_saida(uuid) TO authenticated;
