-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270415000034_ubs_rf6_caderneta_em_atraso.sql
-- (refinamento da UBS, RF6). Tudo em transação com ROLLBACK; o cenário é
-- criado aqui, sem vacina aplicada (todas as faltas aparecem).
--
-- 1. criança de 6 meses: pentavalente, VIP e pneumocócica a completar (C2); a
--    tríplice viral ainda não, porque a janela abre aos 12 meses;
-- 2. criança de 18 meses: a tríplice viral entra;
-- 3. gestante com 22 semanas: dTpa (C3); com 16 semanas, ainda não;
-- 4. pessoa de 70 anos: influenza (C6);
-- 5. menina de 10 anos: HPV (C7); menino de 10 anos, não;
-- 6. adulto de 30 anos: nada; sem data de nascimento: nada;
-- 7. a caderneta devolve o campo 'pendencias'.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TEMP TABLE ids (nome text PRIMARY KEY, id uuid) ON COMMIT DROP;
INSERT INTO ids VALUES
  ('org',     '00000000-0000-4000-8000-00000000f6a1'),
  ('ubs',     '00000000-0000-4000-8000-00000000f6a2'),
  ('bebe',    '00000000-0000-4000-8000-00000000f6c1'),
  ('crianca', '00000000-0000-4000-8000-00000000f6c2'),
  ('gest22',  '00000000-0000-4000-8000-00000000f6c3'),
  ('gest16',  '00000000-0000-4000-8000-00000000f6c4'),
  ('idoso',   '00000000-0000-4000-8000-00000000f6c5'),
  ('menina',  '00000000-0000-4000-8000-00000000f6c6'),
  ('menino',  '00000000-0000-4000-8000-00000000f6c7'),
  ('adulto',  '00000000-0000-4000-8000-00000000f6c8'),
  ('semnasc', '00000000-0000-4000-8000-00000000f6c9');
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM ids WHERE nome = p $$;
CREATE FUNCTION pg_temp.ok(cond boolean, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: %', p_ok; END IF;
  RAISE NOTICE 'OK  %', p_ok;
END $$;
-- as vacinas pendentes do paciente, em ordem
CREATE FUNCTION pg_temp.pend(p text) RETURNS text[] LANGUAGE sql AS $$
  SELECT coalesce(array_agg(x ->> 'indicador' || ':' || (x ->> 'vacina') ORDER BY x ->> 'indicador', x ->> 'vacina'), '{}')
    FROM public.pacientes pa, jsonb_array_elements(private.vacina_pendencias(pa)) x
   WHERE pa.id = pg_temp.id(p) $$;

INSERT INTO public.organizacoes (id, nome) VALUES (pg_temp.id('org'), 'Rede do RF6');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES (pg_temp.id('ubs'), pg_temp.id('org'), 'UBS do RF6', 'ubs');
INSERT INTO public.pacientes (id, unidade_id, nome, data_nascimento, sexo) VALUES
  (pg_temp.id('bebe'),    pg_temp.id('ubs'), 'Bebê RF6',     (private.data_atual() - interval '6 months')::date,  'F'),
  (pg_temp.id('crianca'), pg_temp.id('ubs'), 'Criança RF6',  (private.data_atual() - interval '18 months')::date, 'M'),
  (pg_temp.id('gest22'),  pg_temp.id('ubs'), 'Gestante 22s', (private.data_atual() - interval '28 years')::date,  'F'),
  (pg_temp.id('gest16'),  pg_temp.id('ubs'), 'Gestante 16s', (private.data_atual() - interval '25 years')::date,  'F'),
  (pg_temp.id('idoso'),   pg_temp.id('ubs'), 'Idoso RF6',    (private.data_atual() - interval '70 years')::date,  'M'),
  (pg_temp.id('menina'),  pg_temp.id('ubs'), 'Menina RF6',   (private.data_atual() - interval '10 years')::date,  'F'),
  (pg_temp.id('menino'),  pg_temp.id('ubs'), 'Menino RF6',   (private.data_atual() - interval '10 years')::date,  'M'),
  (pg_temp.id('adulto'),  pg_temp.id('ubs'), 'Adulto RF6',   (private.data_atual() - interval '30 years')::date,  'F'),
  (pg_temp.id('semnasc'), pg_temp.id('ubs'), 'Sem nasc RF6', NULL, 'F');
INSERT INTO public.pre_natal_gestacoes (unidade_id, paciente_id, origem, dum) VALUES
  (pg_temp.id('ubs'), pg_temp.id('gest22'), 'manual', private.data_atual() - 154),
  (pg_temp.id('ubs'), pg_temp.id('gest16'), 'manual', private.data_atual() - 112);

SELECT pg_temp.ok(pg_temp.pend('bebe') @> ARRAY['C2:pentavalente', 'C2:pneumocócica', 'C2:VIP']
                  AND pg_temp.pend('bebe') <@ ARRAY['C2:pentavalente', 'C2:pneumocócica', 'C2:VIP'],
  '1. 6 meses: pentavalente, VIP e pneumocócica; sem tríplice viral antes dos 12 meses');
SELECT pg_temp.ok('C2:tríplice viral' = ANY (pg_temp.pend('crianca')), '2. 18 meses: a tríplice viral entra');
SELECT pg_temp.ok(pg_temp.pend('gest22') = ARRAY['C3:dTpa'], '3. gestante com 22 semanas: dTpa');
SELECT pg_temp.ok(pg_temp.pend('gest16') = '{}', '3. gestante com 16 semanas: ainda não');
SELECT pg_temp.ok(pg_temp.pend('idoso') = ARRAY['C6:influenza'], '4. 70 anos: influenza');
SELECT pg_temp.ok(pg_temp.pend('menina') = ARRAY['C7:HPV'], '5. menina de 10 anos: HPV');
SELECT pg_temp.ok(pg_temp.pend('menino') = '{}', '5. menino de 10 anos: nada pelo C7');
SELECT pg_temp.ok(pg_temp.pend('adulto') = '{}', '6. adulto de 30 anos: nada');
SELECT pg_temp.ok(pg_temp.pend('semnasc') = '{}', '6. sem data de nascimento: nada');
SELECT pg_temp.ok((SELECT position('''pendencias'', private.vacina_pendencias(pa)' IN prosrc) > 0
                     FROM pg_proc WHERE oid = 'public.vacina_caderneta(uuid)'::regprocedure),
  '7. a caderneta devolve as pendências');

ROLLBACK;
