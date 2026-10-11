-- ════════════════════════════════════════════════════════════════════════════
-- Teste de ponta a ponta — infraestrutura do roteiro executável.
--
-- Esquema e2e (só ambiente local ou homologação):
--   e2e.resultados  — cada passo: papel, rota, o que fez, o esperado, o obtido
--   e2e.vars        — ids gerados num passo e usados nos seguintes
--   e2e.passo(...)  — roda um comando COMO a conta do papel (role authenticated
--                     + claims do JWT), sem parar o roteiro se falhar
--   e2e.como_postgres(...) — ajuste de ambiente (ex.: simular tempo passado)
-- Esperado: 'ok' (deve funcionar) ou 'erro:<início da mensagem>' (deve ser
-- recusado, para permissões negativas). Cada passo roda na sua própria
-- transação quando o script é chamado pelo psql (autocommit).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS e2e;
GRANT USAGE ON SCHEMA e2e TO authenticated;

CREATE TABLE IF NOT EXISTS e2e.resultados (
  id          bigserial PRIMARY KEY,
  rodada      text NOT NULL DEFAULT to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'),
  passo       text NOT NULL,
  paciente    int,
  papel       text,
  rota        text,
  descricao   text NOT NULL,
  esperado    text NOT NULL,
  situacao    text NOT NULL CHECK (situacao IN ('ok', 'falha', 'lacuna', 'ajuste')),
  detalhe     text,
  em          timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS e2e.vars (nome text PRIMARY KEY, valor text);
GRANT SELECT ON e2e.vars TO authenticated;

CREATE OR REPLACE FUNCTION e2e.v(p text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT valor FROM e2e.vars WHERE nome = p $$;
CREATE OR REPLACE FUNCTION e2e.u(p text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT valor::uuid FROM e2e.vars WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION e2e.v(text), e2e.u(text) TO authenticated;

-- contas E2E por papel
CREATE OR REPLACE FUNCTION e2e.conta(p_papel text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_papel
    WHEN 'recepcao' THEN 'e2000000-0000-4000-8000-000000000001' WHEN 'enfermeiro' THEN 'e2000000-0000-4000-8000-000000000002'
    WHEN 'tecnico' THEN 'e2000000-0000-4000-8000-000000000003' WHEN 'plantonista' THEN 'e2000000-0000-4000-8000-000000000004'
    WHEN 'plantonista2' THEN 'e2000000-0000-4000-8000-000000000005' WHEN 'farmaceutico' THEN 'e2000000-0000-4000-8000-000000000006'
    WHEN 'regulador' THEN 'e2000000-0000-4000-8000-000000000007' WHEN 'nir' THEN 'e2000000-0000-4000-8000-000000000008'
    WHEN 'gestor' THEN 'e2000000-0000-4000-8000-000000000009' WHEN 'admin' THEN 'e2000000-0000-4000-8000-000000000010'
    WHEN 'faturamento' THEN 'e2000000-0000-4000-8000-000000000011' WHEN 'medico_hospital' THEN 'e2000000-0000-4000-8000-000000000012'
    WHEN 'medico_maternidade' THEN 'e2000000-0000-4000-8000-000000000013' WHEN 'medico_uti' THEN 'e2000000-0000-4000-8000-000000000014'
    -- conta de outra organização (para permissão negativa)
    WHEN 'plantonista_outra_rede' THEN '10000000-0000-4000-8000-000000000002'
  END::uuid
$$;

-- CPF válido (fictício) a partir de 9 dígitos
CREATE OR REPLACE FUNCTION e2e.cpf(p9 text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s int := 0; d1 int; d2 int; i int;
BEGIN
  FOR i IN 1..9 LOOP s := s + substr(p9, i, 1)::int * (11 - i); END LOOP;
  d1 := CASE WHEN s % 11 < 2 THEN 0 ELSE 11 - s % 11 END;
  s := 0;
  FOR i IN 1..9 LOOP s := s + substr(p9, i, 1)::int * (12 - i); END LOOP;
  s := s + d1 * 2;
  d2 := CASE WHEN s % 11 < 2 THEN 0 ELSE 11 - s % 11 END;
  RETURN p9 || d1 || d2;
END $$;

-- primeiro discriminador de uma cor no fluxograma (o protocolo carregado no ambiente)
CREATE OR REPLACE FUNCTION e2e.disc(p_unidade uuid, p_fluxograma uuid, p_cor text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT private.discriminadores_efetivos(p_unidade, p_fluxograma) -> p_cor -> 0 ->> 0
$$;
GRANT EXECUTE ON FUNCTION e2e.disc(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION e2e.passo(p_passo text, p_paciente int, p_papel text, p_rota text, p_descricao text,
                                    p_sql text, p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_resultado text; v_situacao text; v_detalhe text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', e2e.conta(p_papel), 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    EXECUTE p_sql INTO v_resultado;
    PERFORM set_config('role', 'postgres', true);
    IF p_esperado = 'ok' THEN
      v_situacao := 'ok'; v_detalhe := left(v_resultado, 400);
      IF p_guardar IS NOT NULL THEN
        INSERT INTO e2e.vars VALUES (p_guardar, v_resultado) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor;
      END IF;
    ELSE
      v_situacao := 'falha'; v_detalhe := 'PASSOU sem erro (deveria ser recusado): ' || left(coalesce(v_resultado, ''), 300);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'postgres', true);
    IF p_esperado = 'ok' THEN
      v_situacao := 'falha'; v_detalhe := SQLSTATE || ': ' || SQLERRM;
    ELSIF p_esperado = 'erro' OR SQLERRM LIKE substr(p_esperado, 6) || '%' THEN
      v_situacao := 'ok'; v_detalhe := 'recusado: ' || SQLERRM;
    ELSE
      v_situacao := 'falha'; v_detalhe := 'recusado com outra mensagem: ' || SQLERRM;
    END IF;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_paciente, p_papel, p_rota, p_descricao, p_esperado, v_situacao, v_detalhe);
  RETURN v_situacao || ' — ' || p_passo || ' — ' || coalesce(v_detalhe, '');
END $$;

-- lacuna: o que o roteiro pede e o produto não tem
CREATE OR REPLACE FUNCTION e2e.lacuna(p_passo text, p_paciente int, p_papel text, p_descricao text, p_detalhe text)
RETURNS text LANGUAGE sql AS $$
  INSERT INTO e2e.resultados (passo, paciente, papel, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_paciente, p_papel, p_descricao, 'existir', 'lacuna', p_detalhe)
  RETURNING 'lacuna — ' || p_passo
$$;

-- ajuste de ambiente feito como postgres (simular tempo, etc.), registrado
CREATE OR REPLACE FUNCTION e2e.ajuste(p_passo text, p_descricao text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  INSERT INTO e2e.resultados (passo, descricao, esperado, situacao, detalhe) VALUES (p_passo, p_descricao, 'ajuste', 'ajuste', left(p_sql, 300));
  RETURN 'ajuste — ' || p_passo;
END $$;

SELECT 'framework E2E pronto';
