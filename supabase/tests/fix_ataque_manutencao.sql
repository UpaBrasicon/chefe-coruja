-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270307000002_ataque_manutencao.sql (achado P2-1 do
-- A01; decisão do RT em 07/11/2026: A em M1 a M5,
-- docs/teste-rede/CORRECOES-A01-DIAGNOSTICO.md). Tudo em transação com
-- ROLLBACK. O cenário é criado aqui. Nenhuma dose aqui é recomendação: os
-- valores são só texto de teste.
--
-- 1. M1: "Agora" e manutenção (contínuo) do mesmo medicamento e via ficam
--    ativos juntos;
-- 2. M3: duas manutenções do mesmo medicamento e via continuam recusadas;
-- 3. M2: dois "Agora" sem a dose feita: recusado; com a primeira feita: aceito;
-- 4. a alteração da manutenção continua funcionando com o "Agora" ao lado;
-- 5. a checagem conta as administrações de cada item;
-- 6. M5: a mesma regra no leito (observação); só "Agora" exato fica fora da
--    trava, outro texto ("imediato") continua travando.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',   '00000000-0000-4000-8000-0000000a7a01'),
  ('upa',   '00000000-0000-4000-8000-0000000a7a02'),
  ('porta', '00000000-0000-4000-8000-0000000a7a11'),
  ('obs',   '00000000-0000-4000-8000-0000000a7a12'),
  ('med',   '00000000-0000-4000-8000-0000000a7a21'),
  ('enf',   '00000000-0000-4000-8000-0000000a7a22'),
  ('pac1',  '00000000-0000-4000-8000-0000000a7a31'),
  ('ep1',   '00000000-0000-4000-8000-0000000a7a32'),
  ('pac2',  '00000000-0000-4000-8000-0000000a7a33'),
  ('ep2',   '00000000-0000-4000-8000-0000000a7a34'),
  ('int2',  '00000000-0000-4000-8000-0000000a7a35'),
  ('mag',   '00000000-0000-4000-8000-0000000a7a41'),
  ('dipi',  '00000000-0000-4000-8000-0000000a7a42'),
  ('cefa',  '00000000-0000-4000-8000-0000000a7a43');
GRANT ALL ON ids TO authenticated;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.id(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', pg_temp.id(p)::text, true);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated;
CREATE TEMP TABLE v (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
GRANT ALL ON v TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM v WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text) TO authenticated;
-- prescreve pelo médico (item em json, como a tela manda)
CREATE FUNCTION pg_temp.presc(p_pac text, p_med text, p_dose text, p_via text, p_freq text) RETURNS uuid LANGUAGE sql AS $$
  SELECT public.prescrever(pg_temp.id(p_pac), json_build_object('medicamento_id', pg_temp.id(p_med), 'dose', p_dose,
                                                                'via', p_via, 'posologia', p_freq)::jsonb) $$;
GRANT EXECUTE ON FUNCTION pg_temp.presc(text, text, text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.presc_sql(p_pac text, p_med text, p_dose text, p_via text, p_freq text) RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.prescrever(%L, %L)', pg_temp.id(p_pac), json_build_object('medicamento_id', pg_temp.id(p_med),
                'dose', p_dose, 'via', p_via, 'posologia', p_freq)) $$;
GRANT EXECUTE ON FUNCTION pg_temp.presc_sql(text, text, text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.ativos(p_pac text, p_med text) RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*) FROM public.prescricao_itens it JOIN public.prescricoes pr ON pr.id = it.prescricao_id
   WHERE pr.paciente_id = pg_temp.id(p_pac) AND it.medicamento_id = pg_temp.id(p_med) AND it.suspenso_em IS NULL $$;
GRANT EXECUTE ON FUNCTION pg_temp.ativos(text, text) TO authenticated;

INSERT INTO auth.users (id, email) SELECT id, nome || '@ataque.local' FROM ids WHERE nome IN ('med', 'enf');
INSERT INTO public.perfis (id, nome_completo) SELECT id, 'Pessoa ' || nome FROM ids WHERE nome IN ('med', 'enf')
ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do ataque e manutenção');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('upa'), pg_temp.id('org'), 'UPA do ataque e manutenção', 'upa');
INSERT INTO public.setores (id, unidade_id, nome, tipo) VALUES
  (pg_temp.id('porta'), pg_temp.id('upa'), 'Pronto-socorro', 'emergencia'),
  (pg_temp.id('obs'), pg_temp.id('upa'), 'Observação', 'observacao');
INSERT INTO public.vinculos (perfil_id, unidade_id, papel) VALUES
  (pg_temp.id('med'), pg_temp.id('upa'), 'plantonista'), (pg_temp.id('enf'), pg_temp.id('upa'), 'enfermeiro');
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT pg_temp.id('upa'), pg_temp.id(s), pg_temp.id(p), private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM (VALUES ('porta', 'med'), ('obs', 'med'), ('porta', 'enf'), ('obs', 'enf')) x(s, p);
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio FROM public.escala_plantao e
 WHERE e.unidade_id = pg_temp.id('upa') ON CONFLICT DO NOTHING;

INSERT INTO public.medicamento (id, principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  (pg_temp.id('mag'), 'Sulfato de magnésio ataque', 'sulfato de magnesio ataque', 'solução injetável (teste ataque)', 'teste-ataque'),
  (pg_temp.id('dipi'), 'Dipirona ataque', 'dipirona ataque', 'solução injetável (teste ataque)', 'teste-ataque'),
  (pg_temp.id('cefa'), 'Cefalexina ataque', 'cefalexina ataque', 'cápsula (teste ataque)', 'teste-ataque');

-- paciente 1 na porta, em atendimento; paciente 2 na observação
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo, setor_id) VALUES
  (pg_temp.id('pac1'), pg_temp.id('upa'), 'Paciente Ataque Um', '1990-01-01', 'F', pg_temp.id('porta')),
  (pg_temp.id('pac2'), pg_temp.id('upa'), 'Paciente Ataque Dois', '1970-05-05', 'M', pg_temp.id('obs'));
INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, etapa, queixa, aberto_por, chegada_em,
                              atendimento_medico_id, atendimento_iniciado_em)
VALUES (pg_temp.id('ep1'), pg_temp.id('upa'), pg_temp.id('pac1'), pg_temp.id('porta'), 'atendimento', 'Queixa de teste', pg_temp.id('med'),
        now() - interval '2 hours', pg_temp.id('med'), now() - interval '2 hours'),
       (pg_temp.id('ep2'), pg_temp.id('upa'), pg_temp.id('pac2'), pg_temp.id('porta'), 'atendimento', 'Queixa de teste', pg_temp.id('med'),
        now() - interval '4 hours', pg_temp.id('med'), now() - interval '4 hours');
INSERT INTO public.observacao (unidade_id, paciente_id, conceito_id, aferido_em, valor_num, origem)
SELECT pg_temp.id('upa'), p, c.id, now(), 70, 'manual'
  FROM unnest(ARRAY[pg_temp.id('pac1'), pg_temp.id('pac2')]) p, public.conceito c WHERE c.nome = 'peso' AND c.unidade_id IS NULL;
INSERT INTO public.internacoes (id, organizacao_id, unidade_id, paciente_id, status, tipo_internacao, origem_admissao,
                                setor_atual_id, data_admissao, episodio_id)
VALUES (pg_temp.id('int2'), pg_temp.id('org'), pg_temp.id('upa'), pg_temp.id('pac2'), 'em_observacao', 'observacao', 'emergencia',
        pg_temp.id('obs'), now() - interval '1 hour', pg_temp.id('ep2'));

SET LOCAL ROLE authenticated;
SELECT pg_temp.como('med');

-- ── 1. M1: ataque ("Agora") e manutenção (contínuo) juntos ──────────────────
INSERT INTO v SELECT 'mag_ataque', pg_temp.presc('pac1', 'mag', 'dose de teste A', 'EV', 'Agora');
INSERT INTO v SELECT 'mag_manut', pg_temp.presc('pac1', 'mag', 'dose de teste B', 'EV', 'Contínuo');
SELECT pg_temp.ok(pg_temp.ativos('pac1', 'mag') = 2, 'M1: ataque (Agora) e manutenção (Contínuo) ativos juntos');

-- ── 2. M3: duas manutenções continuam recusadas ─────────────────────────────
SELECT pg_temp.falha(pg_temp.presc_sql('pac1', 'mag', 'dose de teste C', 'EV', '8/8h'),
  'Este medicamento já está prescrito por esta via', 'M3: contínuo + 8/8h do mesmo medicamento e via é recusado');
SELECT pg_temp.falha(pg_temp.presc_sql('pac1', 'mag', 'dose de teste C', 'ev', 'Contínuo'),
  'Este medicamento já está prescrito por esta via', 'M3: a via em minúsculas não escapa da trava');

-- ── 3. M2: dois "Agora" ─────────────────────────────────────────────────────
INSERT INTO v SELECT 'dipi_1', pg_temp.presc('pac1', 'dipi', 'dose de teste', 'EV', 'Agora');
SELECT pg_temp.falha(pg_temp.presc_sql('pac1', 'dipi', 'dose de teste', 'EV', 'Agora'),
  'Já há um "Agora" deste medicamento por esta via ainda sem a dose feita', 'M2: segundo "Agora" sem a dose feita é recusado');
SELECT pg_temp.como('enf');
SELECT public.checar(pg_temp.v('dipi_1'), 'nao_feito', NULL, 'Paciente fora do box no teste');
SELECT pg_temp.como('med');
SELECT pg_temp.falha(pg_temp.presc_sql('pac1', 'dipi', 'dose de teste', 'EV', 'Agora'),
  'Já há um "Agora"', 'M2: "não feito" não conta como dose feita');
SELECT pg_temp.como('enf');
SELECT public.checar(pg_temp.v('dipi_1'), 'feito');
SELECT pg_temp.como('med');
INSERT INTO v SELECT 'dipi_2', pg_temp.presc('pac1', 'dipi', 'dose de teste', 'EV', 'agora');
SELECT pg_temp.ok(pg_temp.v('dipi_2') IS NOT NULL AND pg_temp.ativos('pac1', 'dipi') = 2,
  'M2: com a primeira dose feita, um novo "Agora" é aceito');
-- "Agora" ao lado de uma manutenção de outro medicamento não muda nada; e a
-- manutenção nova da dipirona convive com os "Agora"
INSERT INTO v SELECT 'dipi_sn', pg_temp.presc('pac1', 'dipi', 'dose de teste', 'EV', '6/6h');
SELECT pg_temp.ok(pg_temp.ativos('pac1', 'dipi') = 3, 'M1: manutenção da dipirona convive com os "Agora"');

-- ── 4. alteração da manutenção com o "Agora" ao lado ────────────────────────
INSERT INTO v SELECT 'mag_manut2', public.alterar_item_prescricao(pg_temp.v('mag_manut'), '{"posologia":"6/6h"}', 'Trocar a frequência no teste');
RESET ROLE;
SELECT pg_temp.ok((SELECT suspenso_em IS NOT NULL FROM public.prescricao_itens WHERE id = pg_temp.v('mag_manut'))
                  AND (SELECT suspenso_em IS NULL FROM public.prescricao_itens WHERE id = pg_temp.v('mag_ataque'))
                  AND pg_temp.ativos('pac1', 'mag') = 2,
  'alteração da manutenção: a versão nova entra, o ataque segue ativo');
SET LOCAL ROLE authenticated;

-- ── 5. checagem por item ────────────────────────────────────────────────────
-- o sulfato de magnésio é de alta vigilância: sem a liberação da farmácia,
-- cada item pede a sua justificativa na checagem
RESET ROLE;
SELECT pg_temp.ok(private.exige_dupla_checagem(pg_temp.id('upa'), pg_temp.id('mag')), 'cenário: magnésio de alta vigilância');
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('enf');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.v('mag_ataque'), 'feito'),
  'Alta vigilância sem liberação da farmácia', 'ataque de alta vigilância pede a sua justificativa');
SELECT public.checar(pg_temp.v('mag_ataque'), 'feito', NULL, 'Farmácia ainda não liberou no teste');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L, NULL, %L)', pg_temp.v('mag_ataque'), 'feito', 'Farmácia ainda não liberou no teste'),
  'Item "Agora" é dose única e já foi feito', 'o ataque continua dose única');
SELECT pg_temp.falha(format('SELECT public.checar(%L, %L)', pg_temp.v('mag_manut2'), 'feito'),
  'Alta vigilância sem liberação da farmácia', 'a manutenção pede a sua própria justificativa');
SELECT public.checar(pg_temp.v('mag_manut2'), 'feito', NULL, 'Farmácia ainda não liberou no teste');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.administracoes WHERE item_id = pg_temp.v('mag_ataque') AND situacao = 'feito') = 1
                  AND (SELECT count(*) FROM public.administracoes WHERE item_id = pg_temp.v('mag_manut2') AND situacao = 'feito') = 1,
  'cada item tem a sua administração');
SET LOCAL ROLE authenticated;

-- ── 6. M5: no leito (observação) ────────────────────────────────────────────
SELECT pg_temp.como('med');
INSERT INTO v SELECT 'cefa_agora', pg_temp.presc('pac2', 'cefa', 'dose de teste', 'VO', 'Agora');
INSERT INTO v SELECT 'cefa_12', pg_temp.presc('pac2', 'cefa', 'dose de teste', 'VO', '12/12h');
SELECT pg_temp.ok(pg_temp.ativos('pac2', 'cefa') = 2, 'M5: no leito, "Agora" e 12/12h ativos juntos');
SELECT pg_temp.falha(pg_temp.presc_sql('pac2', 'cefa', 'dose de teste', 'VO', 'imediato'),
  'Este medicamento já está prescrito por esta via', 'M5: no leito, "imediato" não é "Agora" e continua travando');
SELECT pg_temp.falha(pg_temp.presc_sql('pac2', 'cefa', 'dose de teste', 'VO', 'Agora'),
  'Já há um "Agora"', 'M5: no leito, segundo "Agora" sem a dose feita é recusado');
RESET ROLE;
SELECT pg_temp.ok((SELECT pr.internacao_id = pg_temp.id('int2') FROM public.prescricao_itens it JOIN public.prescricoes pr ON pr.id = it.prescricao_id
                    WHERE it.id = pg_temp.v('cefa_12')), 'M5: os itens do leito estão na prescrição da observação');
ROLLBACK;
