-- Teste de fluxo A (25/11/2026): cria a "UBS Homologação" na rede de homologação.
-- SÓ HOMOLOGAÇÃO (trava: ambiente_teste). Passos como o login teste.homolog, pelas RPCs do app,
-- menos: vínculos (o app só cria por convite, que exige CPF/nascimento que a conta de teste não tem;
-- gestor não entra por convite) e escala (a pessoa já está escalada na UPA no mesmo turno).
BEGIN;
DO $trava$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.configuracao_plataforma WHERE chave='ambiente_teste' AND valor::text='true') THEN
    RAISE EXCEPTION 'Só na homologação.'; END IF;
END $trava$;

CREATE TEMP TABLE _r (k text, v text) ON COMMIT DROP;
GRANT ALL ON _r TO authenticated;

SELECT set_config('request.jwt.claims', json_build_object('sub','757db1d9-589d-461c-bed6-24adfed1fa29','role','authenticated','email','teste.homolog@chefecoruja.com.br')::text, true);
SET LOCAL ROLE authenticated;

-- 1. unidade (tela Administrador > Rede > Nova unidade)
INSERT INTO _r SELECT 'unidade', public.admin_criar_unidade('30000000-0000-4000-8000-000000000001'::uuid, 'UBS Homologação', 'ubs'::public.tipo_unidade, '9990025', 'Aparecida de Goiânia', 'GO')::text;
-- 2. liga à secretaria da UPA Homologação
SELECT public.admin_unidade_na_rede((SELECT v::uuid FROM _r WHERE k='unidade'), '879c7583-8cad-46ef-bf42-d07866e57e2c'::uuid, 'ubs');

RESET ROLE;
-- 3. vínculos (inserção direta, como o NIR de 24/11)
INSERT INTO public.vinculos (perfil_id, unidade_id, papel, ativo, criado_por)
SELECT '757db1d9-589d-461c-bed6-24adfed1fa29', (SELECT v::uuid FROM _r WHERE k='unidade'), p::public.papel, true, '757db1d9-589d-461c-bed6-24adfed1fa29'
FROM unnest(ARRAY['recepcao','enfermeiro','tecnico_enfermagem','plantonista','gestor']) p;

SET LOCAL ROLE authenticated;
-- 4. setores (tela Setores do gestor: insert direto na tabela, RLS do gestor)
INSERT INTO public.setores (unidade_id, nome, tipo, ordem)
SELECT (SELECT v::uuid FROM _r WHERE k='unidade'), n, 'consultorio', o FROM (VALUES ('Consultório 1',1),('Consultório 2',2)) x(n,o);
RESET ROLE;

-- 5. escala de hoje (manhã e tarde) nos dois consultórios; papel nulo = vale pelos vínculos
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, ativo, criado_por, observacao)
SELECT s.unidade_id, s.id, '757db1d9-589d-461c-bed6-24adfed1fa29', (now() AT TIME ZONE 'America/Sao_Paulo')::date, t, true,
       '757db1d9-589d-461c-bed6-24adfed1fa29', 'Teste de fluxo UBS/UPA 25/11 (não apagar durante o teste)'
FROM public.setores s CROSS JOIN unnest(ARRAY['manha','tarde']) t
WHERE s.unidade_id = (SELECT v::uuid FROM _r WHERE k='unidade');
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_sem_sobreposicao;

-- 6. presença: check-in da manhã pela RPC do app; tarde direto (o turno ainda não começou)
SELECT set_config('request.jwt.claims', json_build_object('sub','757db1d9-589d-461c-bed6-24adfed1fa29','role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
INSERT INTO _r SELECT 'checkin', public.registrar_checkin((SELECT v::uuid FROM _r WHERE k='unidade'), NULL, NULL, 'Check-in de teste (fluxo UBS/UPA 25/11)', NULL)::text;
INSERT INTO _r SELECT 'setores_agora', string_agg(x::text, ',') FROM public.setores_na_escala_agora() x;
RESET ROLE;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em, checkin_dentro, observacao, criado_por)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio, true, 'Check-in de teste (fluxo UBS/UPA 25/11)', e.perfil_id
FROM public.escala_plantao e JOIN public.setores s ON s.id=e.setor_id
WHERE e.unidade_id=(SELECT v::uuid FROM _r WHERE k='unidade') AND e.turno='tarde' AND s.nome='Consultório 1'
ON CONFLICT (perfil_id, unidade_id, data, turno) DO NOTHING;

CREATE TEMP TABLE _res ON COMMIT DROP AS SELECT jsonb_build_object('r',(SELECT jsonb_object_agg(k,v) FROM _r),
 'unidade',(SELECT to_jsonb(u) FROM public.unidades u WHERE u.id=(SELECT v::uuid FROM _r WHERE k='unidade')),
 'setores',(SELECT jsonb_agg(jsonb_build_object('id',id,'nome',nome)) FROM public.setores WHERE unidade_id=(SELECT v::uuid FROM _r WHERE k='unidade')),
 'salas',(SELECT jsonb_agg(sa.nome) FROM public.salas sa JOIN public.setores s ON s.id=sa.setor_id WHERE s.unidade_id=(SELECT v::uuid FROM _r WHERE k='unidade')),
 'turnos',(SELECT count(*) FROM public.turnos_unidade WHERE unidade_id=(SELECT v::uuid FROM _r WHERE k='unidade')),
 'escala',(SELECT jsonb_agg(jsonb_build_object('t',turno,'i',inicio,'d',duracao_min)) FROM public.escala_plantao WHERE unidade_id=(SELECT v::uuid FROM _r WHERE k='unidade')),
 'presenca',(SELECT jsonb_agg(jsonb_build_object('t',turno,'c',checkin_em)) FROM public.presenca_plantonista WHERE unidade_id=(SELECT v::uuid FROM _r WHERE k='unidade'))) res;

--FIM
COMMIT;
