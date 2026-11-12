-- ════════════════════════════════════════════════════════════════════════════
-- Unidade de demonstração (pedido 8, J4) — 4/4: apaga a rede inteira.
--
-- SÓ NA HOMOLOGAÇÃO (mesma trava do 01). Apaga a "Rede de Demonstração", a
-- UPA 24h Jardim Primavera e tudo o que foi gravado nela (pacientes, escala,
-- check-ins, vínculos, inclusive os da conta que recebeu acesso pelo 03), as
-- 24 pessoas fictícias (perfis e contas do Auth) e a auditoria da unidade.
--
-- Como scripts/e2e/99_limpar_rede_e2e.sql, roda com
-- session_replication_role = replica (as tabelas clínicas e a auditoria são só
-- de inserção). Com os gatilhos desligados as chaves estrangeiras não agem, então
-- o roteiro segue o catálogo (pg_constraint) e apaga, de pai para filho, toda
-- linha que aponta para o que sai. A cadeia de hash da auditoria da homologação
-- fica com as linhas da unidade a menos, como na limpeza da rede E2E.
--
-- Uso (homologação): npx supabase db query --linked -f scripts/demo/99_limpar_rede_demonstracao.sql
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── trava ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = '31000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Este banco não é a homologação (falta a UPA Homologação). Confira o projeto ligado (kswurfyxxvfydpjfrivy).';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizacoes WHERE id = 'd0000000-0000-4000-8000-000000000001' AND nome <> 'Rede de Demonstração') THEN
    RAISE EXCEPTION 'O id d0000000-…-0001 é de outra organização: nada foi apagado.';
  END IF;
END $$;

SET LOCAL session_replication_role = replica;

-- linhas a apagar (tabela + ctid); mesma função do 02_plantao_agora.sql
CREATE TEMP TABLE demo_marca (rel oid NOT NULL, linha tid NOT NULL, PRIMARY KEY (rel, linha)) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.demo_apagar_marcados(p_preservar regclass[], p_esquemas text[]) RETURNS bigint LANGUAGE plpgsql AS $f$
DECLARE
  fk record; r record; n bigint; v_novas bigint; v_total bigint := 0;
BEGIN
  LOOP
    v_novas := 0;
    FOR fk IN
      SELECT c.conrelid::regclass AS filho, c.confrelid::regclass AS pai, c.confrelid AS pai_oid,
             (SELECT string_agg(format('f.%I', a.attname), ', ' ORDER BY k.i)
                FROM unnest(c.conkey) WITH ORDINALITY k(num, i) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num) AS cols_f,
             (SELECT string_agg(format('%I = NULL', a.attname), ', ' ORDER BY k.i)
                FROM unnest(c.conkey) WITH ORDINALITY k(num, i) JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.num) AS anular,
             (SELECT string_agg(format('p.%I', a.attname), ', ' ORDER BY k.i)
                FROM unnest(c.confkey) WITH ORDINALITY k(num, i) JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.num) AS cols_p
        FROM pg_constraint c
        JOIN pg_class cf ON cf.oid = c.conrelid
        JOIN pg_namespace nf ON nf.oid = cf.relnamespace
       WHERE c.contype = 'f' AND cf.relkind = 'r' AND nf.nspname = ANY (p_esquemas)
         AND c.confrelid IN (SELECT DISTINCT m.rel FROM demo_marca m)
    LOOP
      IF fk.filho = ANY (p_preservar) THEN
        EXECUTE format('UPDATE %s f SET %s WHERE (%s) IN (SELECT %s FROM %s p WHERE p.ctid = ANY ($1))',
                       fk.filho, fk.anular, fk.cols_f, fk.cols_p, fk.pai)
          USING ARRAY(SELECT m.linha FROM demo_marca m WHERE m.rel = fk.pai_oid);
      ELSE
        EXECUTE format('INSERT INTO pg_temp.demo_marca (rel, linha) SELECT %s, f.ctid FROM %s f WHERE (%s) IN (SELECT %s FROM %s p WHERE p.ctid = ANY ($1)) ON CONFLICT DO NOTHING',
                       fk.filho::oid, fk.filho, fk.cols_f, fk.cols_p, fk.pai)
          USING ARRAY(SELECT m.linha FROM demo_marca m WHERE m.rel = fk.pai_oid);
        GET DIAGNOSTICS n = ROW_COUNT;
        v_novas := v_novas + n;
      END IF;
    END LOOP;
    EXIT WHEN v_novas = 0;
  END LOOP;
  FOR r IN SELECT m.rel, array_agg(m.linha) AS linhas FROM demo_marca m GROUP BY m.rel LOOP
    EXECUTE format('DELETE FROM %s WHERE ctid = ANY ($1)', r.rel::regclass) USING r.linhas;
    GET DIAGNOSTICS n = ROW_COUNT;
    v_total := v_total + n;
  END LOOP;
  RETURN v_total;
END $f$;

DO $$
DECLARE
  v_org constant uuid := 'd0000000-0000-4000-8000-000000000001';
  v_un  uuid[];
  v_pes uuid[];
  v_pac uuid[];
  v_ep  uuid[];
  v_int uuid[];
  v_ids uuid[];
  t record;
  v_apagadas bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizacoes WHERE id = v_org)
     AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id::text LIKE 'd0300000%') THEN
    RAISE NOTICE 'A rede de demonstração não existe: nada a apagar.';
    RETURN;
  END IF;
  v_un  := ARRAY(SELECT id FROM public.unidades WHERE organizacao_id = v_org);
  v_pes := ARRAY(SELECT id FROM auth.users WHERE id::text LIKE 'd0300000%');
  v_pac := ARRAY(SELECT id FROM public.pacientes WHERE unidade_id = ANY (v_un));
  v_ep  := ARRAY(SELECT id FROM public.episodios WHERE unidade_id = ANY (v_un) OR paciente_id = ANY (v_pac));
  v_int := ARRAY(SELECT id FROM public.internacoes WHERE unidade_id = ANY (v_un) OR paciente_id = ANY (v_pac));

  -- sementes: a organização, as unidades e os perfis das pessoas fictícias
  INSERT INTO demo_marca SELECT 'public.organizacoes'::regclass::oid, ctid FROM public.organizacoes WHERE id = v_org;
  INSERT INTO demo_marca SELECT 'public.unidades'::regclass::oid, ctid FROM public.unidades WHERE id = ANY (v_un);
  INSERT INTO demo_marca SELECT 'public.perfis'::regclass::oid, ctid FROM public.perfis WHERE id = ANY (v_pes);
  -- e o que guarda unidade, organização, paciente, episódio, internação ou
  -- pessoa da rede sem chave estrangeira
  FOR t IN SELECT c.table_schema, c.table_name, c.column_name
             FROM information_schema.columns c
             JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
                                              AND tb.table_type = 'BASE TABLE'
            WHERE c.table_schema IN ('public', 'private') AND c.data_type = 'uuid'
              AND c.column_name IN ('unidade_id', 'organizacao_id', 'paciente_id', 'episodio_id', 'internacao_id', 'perfil_id') LOOP
    v_ids := CASE t.column_name WHEN 'unidade_id' THEN v_un WHEN 'organizacao_id' THEN ARRAY[v_org] WHEN 'paciente_id' THEN v_pac
                                WHEN 'episodio_id' THEN v_ep WHEN 'internacao_id' THEN v_int ELSE v_pes END;
    CONTINUE WHEN cardinality(v_ids) = 0;
    EXECUTE format('INSERT INTO pg_temp.demo_marca (rel, linha) SELECT %s, ctid FROM %I.%I WHERE %I = ANY ($1) ON CONFLICT DO NOTHING',
                   format('%I.%I', t.table_schema, t.table_name)::regclass::oid, t.table_schema, t.table_name, t.column_name)
      USING v_ids;
  END LOOP;

  -- nada se preserva
  v_apagadas := pg_temp.demo_apagar_marcados('{}'::regclass[], ARRAY['public', 'private']);
  RAISE NOTICE 'Rede de demonstração apagada: % unidade(s), % pessoa(s), % paciente(s), % linha(s) no total.',
    cardinality(v_un), cardinality(v_pes), cardinality(v_pac), v_apagadas;
END $$;

SET LOCAL session_replication_role = origin;

-- contas do Auth com as chaves ligadas: o que ainda apontar para elas no banco
-- recusa a exclusão (e nada fica gravado); sessões e fatores saem em cascata
DELETE FROM auth.identities WHERE user_id::text LIKE 'd0300000%';
DELETE FROM auth.users WHERE id::text LIKE 'd0300000%';

COMMIT;

SELECT 'rede de demonstração apagada' AS situacao,
       (SELECT count(*) FROM public.organizacoes WHERE id = 'd0000000-0000-4000-8000-000000000001') AS organizacoes,
       (SELECT count(*) FROM public.unidades WHERE organizacao_id = 'd0000000-0000-4000-8000-000000000001') AS unidades,
       (SELECT count(*) FROM public.perfis WHERE id::text LIKE 'd0300000%') AS perfis,
       (SELECT count(*) FROM auth.users WHERE id::text LIKE 'd0300000%') AS contas;
