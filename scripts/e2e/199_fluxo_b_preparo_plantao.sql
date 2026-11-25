-- Teste de fluxo B (25/11/2026): escala e presença de hoje para o login de teste
-- na UPA Homologação, nos 4 setores, turnos manhã, tarde e noite.
-- Bypass anotado: o gatilho trg_escala_sem_sobreposicao é desligado e religado
-- na MESMA transação (uma pessoa em 4 setores ao mesmo tempo só existe no teste).
BEGIN;
DO $t$ BEGIN
  IF NOT coalesce((SELECT c.valor FROM public.configuracao_plataforma c WHERE c.chave = 'ambiente_teste'), false) THEN
    RAISE EXCEPTION 'Este banco não é de teste.'; END IF;
END $t$;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, observacao, criado_por)
SELECT '31000000-0000-4000-8000-000000000001', s.id, '757db1d9-589d-461c-bed6-24adfed1fa29', DATE '2026-11-25', t.turno,
       'Teste de fluxo UBS/UPA 25/11 (não apagar durante o teste)', '757db1d9-589d-461c-bed6-24adfed1fa29'
  FROM public.setores s CROSS JOIN (VALUES ('manha'), ('tarde'), ('noite')) t(turno)
 WHERE s.unidade_id = '31000000-0000-4000-8000-000000000001' AND s.ativo
ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_sem_sobreposicao;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em, checkin_dentro, observacao, criado_por)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, greatest(e.inicio, CASE WHEN e.turno = 'manha' THEN now() ELSE e.inicio END), true,
       'Check-in de teste (fluxo UBS/UPA 25/11)', e.perfil_id
  FROM public.escala_plantao e
 WHERE e.perfil_id = '757db1d9-589d-461c-bed6-24adfed1fa29' AND e.data = DATE '2026-11-25'
   AND e.unidade_id = '31000000-0000-4000-8000-000000000001' AND e.setor_id = '32000000-0000-4000-8000-000000000001'
ON CONFLICT (perfil_id, unidade_id, data, turno) DO NOTHING;
SELECT set_config('request.jwt.claims', '{"sub":"757db1d9-589d-461c-bed6-24adfed1fa29","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE _r ON COMMIT DROP AS
SELECT (SELECT string_agg(s.nome || ' ' || e.turno || ' papel=' || coalesce(e.papel::text, 'nulo') || ' ' || to_char(e.inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'), '; ' ORDER BY e.inicio, s.ordem)
          FROM public.escala_plantao e JOIN public.setores s ON s.id = e.setor_id WHERE e.perfil_id = auth.uid() AND e.data = DATE '2026-11-25') AS escala,
       (SELECT string_agg(s.nome, ', ') FROM private.setores_na_escala_agora() x JOIN public.setores s ON s.id = x) AS setores_agora,
       (SELECT count(*) FROM public.presenca_plantonista WHERE perfil_id = auth.uid() AND data = DATE '2026-11-25') AS presencas,
       private.na_escala_agora('31000000-0000-4000-8000-000000000001') AS na_escala;
RESET ROLE;
SELECT to_jsonb(r) FROM _r r;
--FIM
COMMIT;
