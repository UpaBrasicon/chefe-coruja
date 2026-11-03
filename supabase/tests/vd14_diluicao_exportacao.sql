-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270209000010_diluicao_exportacao_datas.sql (VD14 do
-- lote "Virada de data", BACKLOG.md). Tudo em transação com ROLLBACK. O
-- cenário é criado aqui, sem depender do seed; roda também na homologação.
--
-- 1. A exportação de um período conta os dias de Brasília: de 00h do primeiro
--    dia até 24h do último. Antes contava do dia UTC: de 21h da véspera a 21h.
-- 2. A diluição publicada tem a data de revisão do dia de Brasília, também na
--    publicação antiga (publicar_diluicao) sem a data. O dia é fixado
--    trocando private.data_atual() dentro da transação.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';

INSERT INTO auth.users (instance_id, id, aud, role, email)
SELECT '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', u::text || '@vd14.teste'
FROM unnest(ARRAY['4e140000-0000-4000-8000-000000000001', '4e140000-0000-4000-8000-000000000002']::uuid[]) u;
INSERT INTO public.perfis (id, nome_completo) VALUES
  ('4e140000-0000-4000-8000-000000000001', 'Farmacêutica do VD14'),
  ('4e140000-0000-4000-8000-000000000002', 'Super admin do VD14')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.super_admins (perfil_id) VALUES ('4e140000-0000-4000-8000-000000000002');
INSERT INTO public.organizacoes (id, nome) VALUES ('4e141000-0000-4000-8000-000000000001', 'Rede do VD14');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('4e142000-0000-4000-8000-000000000001', '4e141000-0000-4000-8000-000000000001', 'UPA do VD14', 'hospital');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  ('4e140000-0000-4000-8000-000000000001', '4e142000-0000-4000-8000-000000000001', 'farmaceutico');
INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('4e144000-0000-4000-8000-000000000001', 'Vdquatorze', 'vdquatorze', 'Frasco-ampola 1 g pó', 'teste');

-- ── 1. exportação de 10/05/2031 ─────────────────────────────────────────────
INSERT INTO public.pacientes (id, unidade_id, nome, created_at) VALUES
  ('4e143000-0000-4000-8000-000000000001', '4e142000-0000-4000-8000-000000000001', 'Véspera às 22h', '2031-05-09 22:00:00-03'),
  ('4e143000-0000-4000-8000-000000000002', '4e142000-0000-4000-8000-000000000001', 'Dia às 8h',      '2031-05-10 08:00:00-03'),
  ('4e143000-0000-4000-8000-000000000003', '4e142000-0000-4000-8000-000000000001', 'Dia às 22h',     '2031-05-10 22:00:00-03'),
  ('4e143000-0000-4000-8000-000000000004', '4e142000-0000-4000-8000-000000000001', 'Dia seguinte',   '2031-05-11 00:30:00-03');

DO $$
DECLARE
  v jsonb;
  ids text;
BEGIN
  v := private.exp_linhas(jsonb_populate_record(NULL::public.exportacoes, jsonb_build_object(
         'unidade_id', '4e142000-0000-4000-8000-000000000001', 'conjunto', 'pacientes',
         'desde', '2031-05-10', 'ate', '2031-05-10', 'mascarado', true)), 0, 100);
  SELECT string_agg(right(x, 1), ',' ORDER BY x) INTO ids FROM jsonb_array_elements_text(v->'pacientes') x;
  IF ids IS DISTINCT FROM '2,3' THEN
    RAISE EXCEPTION 'FALHOU: exportação de 10/05/2031 deveria trazer os cadastros das 8h e das 22h (2,3); veio %', ids;
  END IF;
  RAISE NOTICE 'OK  exportação de um dia vai de 00h a 24h de Brasília';
END $$;

-- ── 2. data de revisão da diluição ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.data_atual() RETURNS date LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT date '2031-12-31' $$;

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('4e140000-0000-4000-8000-000000000001');
DO $$
DECLARE v uuid;
BEGIN
  v := public.salvar_diluicao(NULL, '{"medicamento_id": "4e144000-0000-4000-8000-000000000001", "via": "EV",
    "unidade_id": "4e142000-0000-4000-8000-000000000001"}');
  PERFORM public.salvar_diluicao(v, '{"diluicao_volume_min_ml": "100", "tempo_infusao_min": "30", "fonte": "Manual da unidade, p. 12",
    "revisor_crf": "CRF-GO 1234"}');
  PERFORM public.publicar_diluicao_versao(v);
  IF (SELECT data_revisao FROM public.diluicao WHERE id = v) IS DISTINCT FROM date '2031-12-31' THEN
    RAISE EXCEPTION 'FALHOU: publicar_diluicao_versao deveria datar a revisão pelo dia de Brasília (31/12/2031); veio %',
      (SELECT data_revisao FROM public.diluicao WHERE id = v);
  END IF;
  -- duas em rascunho para a publicação antiga (a publicada não se edita)
  PERFORM set_config('teste.dil2', public.salvar_diluicao(NULL, '{"medicamento_id": "4e144000-0000-4000-8000-000000000001", "via": "IM",
    "unidade_id": "4e142000-0000-4000-8000-000000000001"}')::text, true);
  PERFORM set_config('teste.dil3', public.salvar_diluicao(NULL, '{"medicamento_id": "4e144000-0000-4000-8000-000000000001", "via": "SC",
    "unidade_id": "4e142000-0000-4000-8000-000000000001"}')::text, true);
  RAISE NOTICE 'OK  publicar_diluicao_versao data a revisão pelo dia de Brasília';
END $$;

SELECT pg_temp.como('4e140000-0000-4000-8000-000000000002');
DO $$
DECLARE v uuid := current_setting('teste.dil2')::uuid;
BEGIN
  PERFORM public.publicar_diluicao(v, 'CRF-GO 4321');
  IF (SELECT data_revisao FROM public.diluicao WHERE id = v) IS DISTINCT FROM date '2031-12-31' THEN
    RAISE EXCEPTION 'FALHOU: publicar_diluicao sem a data deveria usar o dia de Brasília (31/12/2031); veio %',
      (SELECT data_revisao FROM public.diluicao WHERE id = v);
  END IF;
  v := current_setting('teste.dil3')::uuid;
  PERFORM public.publicar_diluicao(v, 'CRF-GO 4321', date '2031-06-01');
  IF (SELECT data_revisao FROM public.diluicao WHERE id = v) IS DISTINCT FROM date '2031-06-01' THEN
    RAISE EXCEPTION 'FALHOU: publicar_diluicao com a data deveria gravar a data informada';
  END IF;
  RAISE NOTICE 'OK  publicar_diluicao usa o dia de Brasília quando não recebe a data';
END $$;

RESET ROLE;
SELECT 'vd14 ok' AS resultado;
ROLLBACK;
