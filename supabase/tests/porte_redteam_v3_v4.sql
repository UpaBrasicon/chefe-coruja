-- Testes das correções do red-team (migration 20261019000001). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_redteam_v3_v4.sql
-- Ids do seed: unidade 21..01, plantonista A ...0002, médico ...0001, paciente 23..01.
BEGIN;

-- ── V3: registrar_prescricao_itens não sobrescreve prescrição de outro médico ─
-- Isola o guard do DONO: o check de acesso real (paciente_no_meu_plantao) já é
-- coberto pelos testes de plantão; aqui é stubado para true para alcançar o
-- guard. Prescrição ativa pertence ao médico ...0001.
CREATE OR REPLACE FUNCTION private.paciente_no_meu_plantao(p_paciente uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f$ SELECT true $f$;

INSERT INTO public.prescricoes (unidade_id, paciente_id, medico_id, status, criada_por)
VALUES ('21000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001','ativa','10000000-0000-4000-8000-000000000001');

-- não-dono (plantonista ...0002, não gestor) → BLOQUEADO
SELECT set_config('request.jwt.claims',
  json_build_object('sub','10000000-0000-4000-8000-000000000002','role','authenticated')::text, true);
DO $$
BEGIN
  PERFORM public.registrar_prescricao_itens('23000000-0000-4000-8000-000000000001','x','[{"descricao":"a"}]'::jsonb);
  RAISE EXCEPTION 'FALHOU V3: não-dono sobrescreveu prescrição de outro médico';
EXCEPTION WHEN others THEN
  IF SQLERRM NOT LIKE '%pertence a outro médico%' THEN
    RAISE EXCEPTION 'FALHOU V3: erro inesperado: %', SQLERRM;
  END IF;
  RAISE NOTICE 'OK  V3: não-dono é bloqueado de sobrescrever prescrição alheia';
END $$;

-- dono (médico ...0001) → reusa a própria
SELECT set_config('request.jwt.claims',
  json_build_object('sub','10000000-0000-4000-8000-000000000001','role','authenticated')::text, true);
DO $$
DECLARE v uuid;
BEGIN
  v := public.registrar_prescricao_itens('23000000-0000-4000-8000-000000000001','ok','[{"descricao":"soro"}]'::jsonb);
  IF v IS NULL THEN RAISE EXCEPTION 'FALHOU V3: dono não conseguiu reusar a própria prescrição'; END IF;
  RAISE NOTICE 'OK  V3: dono reutiliza a própria prescrição';
END $$;

-- ── V4: passagem de plantão sem config NÃO aplica automaticamente ────────────
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES ('10000000-0000-4000-8000-0000000000bb','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','plantb@teste.local', now(), now());
INSERT INTO public.perfis (id, nome_completo) VALUES ('10000000-0000-4000-8000-0000000000bb','Plantonista B')
  ON CONFLICT (id) DO UPDATE SET nome_completo='Plantonista B';
INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo, criado_por)
  VALUES ('10000000-0000-4000-8000-0000000000bb','21000000-0000-4000-8000-000000000001','plantonista',true,
          '10000000-0000-4000-8000-000000000002') ON CONFLICT DO NOTHING;
DELETE FROM public.configuracoes_unidade
 WHERE unidade_id='21000000-0000-4000-8000-000000000001' AND chave='escala_passagem_exige_aprovacao';

SELECT set_config('request.jwt.claims',
  json_build_object('sub','10000000-0000-4000-8000-000000000002','role','authenticated')::text, true);
-- ids de escala_plantao são gerados no seed (gen_random_uuid) → buscar dinâmico
DO $$
DECLARE v_antes uuid; v_depois uuid; v_shift uuid;
BEGIN
  SELECT id INTO v_shift FROM public.escala_plantao
   WHERE perfil_id='10000000-0000-4000-8000-000000000002'
     AND unidade_id='21000000-0000-4000-8000-000000000001' AND ativo
   ORDER BY data, turno LIMIT 1;
  IF v_shift IS NULL THEN RAISE EXCEPTION 'setup: nenhum plantão do seed para o teste V4'; END IF;
  SELECT perfil_id INTO v_antes FROM public.escala_plantao WHERE id=v_shift;
  PERFORM public.passar_plantao(v_shift,'10000000-0000-4000-8000-0000000000bb','t');
  SELECT perfil_id INTO v_depois FROM public.escala_plantao WHERE id=v_shift;
  IF v_depois <> v_antes THEN
    RAISE EXCEPTION 'FALHOU V4: passagem aplicada sem aprovação (dono % -> %)', v_antes, v_depois;
  END IF;
  RAISE NOTICE 'OK  V4: sem config, passagem exige aprovação (não aplica automaticamente)';
END $$;

-- opt-out explícito valor=false ainda aplica
INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor)
VALUES ('21000000-0000-4000-8000-000000000001','escala_passagem_exige_aprovacao','false');
DO $$
DECLARE v_depois uuid; v_shift uuid;
BEGIN
  SELECT id INTO v_shift FROM public.escala_plantao
   WHERE perfil_id='10000000-0000-4000-8000-000000000002'
     AND unidade_id='21000000-0000-4000-8000-000000000001' AND ativo
   ORDER BY data, turno OFFSET 1 LIMIT 1;
  IF v_shift IS NULL THEN RAISE EXCEPTION 'setup: segundo plantão não encontrado'; END IF;
  PERFORM public.passar_plantao(v_shift,'10000000-0000-4000-8000-0000000000bb','t2');
  SELECT perfil_id INTO v_depois FROM public.escala_plantao WHERE id=v_shift;
  IF v_depois <> '10000000-0000-4000-8000-0000000000bb' THEN
    RAISE EXCEPTION 'FALHOU V4: opt-out explícito (false) deveria aplicar';
  END IF;
  RAISE NOTICE 'OK  V4: opt-out explícito (valor=false) aplica a passagem';
END $$;

ROLLBACK;
