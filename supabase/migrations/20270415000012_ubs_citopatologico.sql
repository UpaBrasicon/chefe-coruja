-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U6, decisão E2 = A (docs/ubs/U6-LISTA-EXAMES-ENFERMEIRO.md):
-- o pedido de exame aceita o citopatológico (SIGTAP 02.03.01, citopatologia).
-- Antes só laboratório (02.02), imagem (02.04 a 02.07) e ECG (02.11).
--
-- 1. Os CHECKs de exames_unidade e exames_pedidos aceitam 020301; o grupo novo
--    do pedido é "citopatologia" (pedido separado, como laboratório, imagem e
--    ECG). A coluna gerada `tipo` passa a dizer "citopatologia" nesses códigos.
-- 2. Catálogo, busca, lista da unidade, pedido impresso, pedido da porta e da
--    internação aceitam o grupo novo (trocas de trecho).
-- 3. O enfermeiro pede o citopatológico de rastreamento (02.03.01.008-6) na
--    consulta de enfermagem: linha "colo" da lista do protocolo. Fonte:
--    Ministério da Saúde, Protocolos da Atenção Básica: Saúde das Mulheres
--    (2016), p. 175: "Exame citopatológico do colo do útero", quem faz
--    "Enfermeiro(a)/médico(a)". A coleta (02.01.02.003-3) já está nos
--    procedimentos da UBS (20270415000009).
--
-- O resultado do citopatológico entra pelo registro do exame, como imagem e ECG
-- (a porta do laboratório integrado segue só com 02.02).
--
-- Idempotente. Teste: supabase/tests/ubs_citopatologico.sql
--
-- Rollback (na ordem): as trocas invertidas (os trechos estão abaixo); recriar
-- private.ubs_exames_enfermagem() e private.exame_consulta_enfermagem() de
-- 20270415000011_ubs_pre_natal_parceiro.sql; os CHECKs e a expressão de `tipo`
-- de 20261208000001_imagem_no_sistema.sql e 20270203000004_exames_por_grupo.sql
-- (só sem pedido de citopatológico gravado).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.u6c_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(replace(p_pares[k + 1], chr(13), '') IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 1. tabelas ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exames_unidade_procedimento_check'
                   AND pg_get_constraintdef(oid) LIKE '%020301%') THEN
    ALTER TABLE public.exames_unidade DROP CONSTRAINT IF EXISTS exames_unidade_procedimento_check;
    ALTER TABLE public.exames_unidade ADD CONSTRAINT exames_unidade_procedimento_check
      CHECK (procedimento ~ '^(0202|020301|0204|0205|0206|0207|0211)[0-9]+$' AND length(procedimento) = 10);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exames_pedidos_procedimento'
                   AND pg_get_constraintdef(oid) LIKE '%020301%') THEN
    ALTER TABLE public.exames_pedidos DROP CONSTRAINT IF EXISTS exames_pedidos_procedimento;
    ALTER TABLE public.exames_pedidos ADD CONSTRAINT exames_pedidos_procedimento
      CHECK (procedimento IS NULL OR (procedimento ~ '^(0202|020301|0204|0205|0206|0207|0211)[0-9]+$' AND length(procedimento) = 10));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exames_pedidos_grupo'
                   AND pg_get_constraintdef(oid) LIKE '%citopatologia%') THEN
    ALTER TABLE public.exames_pedidos DROP CONSTRAINT IF EXISTS exames_pedidos_grupo;
    ALTER TABLE public.exames_pedidos ADD CONSTRAINT exames_pedidos_grupo
      CHECK (grupo IS NULL OR grupo IN ('laboratorio', 'imagem', 'grafico', 'citopatologia'));
  END IF;
  IF position('020301' IN (SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attribute a
                             JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                            WHERE a.attrelid = 'public.exames_pedidos'::regclass AND a.attname = 'tipo')) = 0 THEN
    ALTER TABLE public.exames_pedidos ALTER COLUMN tipo SET EXPRESSION AS (
      CASE WHEN procedimento IS NULL THEN NULL
           WHEN left(procedimento, 4) = '0202' THEN 'laboratorio'
           WHEN left(procedimento, 6) = '020301' THEN 'citopatologia'
           ELSE 'imagem' END);
  END IF;
  IF position('020301' IN (SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attribute a
                             JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                            WHERE a.attrelid = 'public.exames_unidade'::regclass AND a.attname = 'tipo')) = 0 THEN
    ALTER TABLE public.exames_unidade ALTER COLUMN tipo SET EXPRESSION AS (
      CASE WHEN left(procedimento, 4) = '0202' THEN 'laboratorio'
           WHEN left(procedimento, 6) = '020301' THEN 'citopatologia'
           ELSE 'imagem' END);
  END IF;
END $$;

-- ── 2. funções ──────────────────────────────────────────────────────────────
SELECT pg_temp.u6c_trocar('private.grupo_do_procedimento(text)'::regprocedure,
  $a$WHEN left(p, 4) = '0211' THEN 'grafico'$a$,
  $b$WHEN left(p, 6) = '020301' THEN 'citopatologia' WHEN left(p, 4) = '0211' THEN 'grafico'$b$);

SELECT pg_temp.u6c_trocar('private.exame_do_catalogo(uuid,text)'::regprocedure,
  $a$'^(0202|0204|0205|0206|0207|0211)'$a$, $b$'^(0202|020301|0204|0205|0206|0207|0211)'$b$);
SELECT pg_temp.u6c_trocar('public.buscar_exames(uuid,text,boolean)'::regprocedure,
  $a$'^(0202|0204|0205|0206|0207|0211)'$a$, $b$'^(0202|020301|0204|0205|0206|0207|0211)'$b$);
SELECT pg_temp.u6c_trocar('private.pedido_emitido_vira_exames()'::regprocedure,
  $a$'^(0202|0204|0205|0206|0207|0211)'$a$, $b$'^(0202|020301|0204|0205|0206|0207|0211)'$b$);
SELECT pg_temp.u6c_trocar('public.definir_exame_unidade(uuid,text,text,text,boolean,integer)'::regprocedure,
  $a$'^(0202|0204|0205|0206|0207|0211)'$a$, $b$'^(0202|020301|0204|0205|0206|0207|0211)'$b$,
  $a$não é de laboratório (02.02), imagem (02.04 a 02.07) ou métodos gráficos (02.11) no SIGTAP carregado.$a$,
  $b$não é de laboratório (02.02), citopatológico (02.03.01), imagem (02.04 a 02.07) ou métodos gráficos (02.11) no SIGTAP carregado.$b$);

SELECT pg_temp.u6c_trocar('private.pedido_de_um_grupo(text,text,text)'::regprocedure,
  $a$"grafico": "ECG / métodos gráficos"}'$a$, $b$"grafico": "ECG / métodos gráficos", "citopatologia": "citopatológico"}'$b$);

SELECT pg_temp.u6c_trocar('public.pedir_exames(uuid,jsonb,text,text)'::regprocedure,
  $a$fora dos grupos de exame do SIGTAP (02.02, 02.04 a 02.07, 02.11).$a$,
  $b$fora dos grupos de exame do SIGTAP (02.02, 02.03.01, 02.04 a 02.07, 02.11).$b$,
  $a$NOT IN ('laboratorio', 'imagem', 'grafico')$a$, $b$NOT IN ('laboratorio', 'imagem', 'grafico', 'citopatologia')$b$,
  $a$'Grupo do exame: laboratório, imagem ou ECG.'$a$, $b$'Grupo do exame: laboratório, imagem, ECG ou citopatológico.'$b$);

SELECT pg_temp.u6c_trocar('public.pedir_exames_internacao(uuid,jsonb,text,text,text)'::regprocedure,
  $a$"grafico": "ECG / métodos gráficos"}'$a$, $b$"grafico": "ECG / métodos gráficos", "citopatologia": "citopatológico"}'$b$,
  $a$NOT IN ('laboratorio', 'imagem', 'grafico')$a$, $b$NOT IN ('laboratorio', 'imagem', 'grafico', 'citopatologia')$b$,
  $a$'Grupo do pedido: laboratório, imagem ou ECG.'$a$, $b$'Grupo do pedido: laboratório, imagem, ECG ou citopatológico.'$b$,
  $a$fora dos grupos de exame do SIGTAP (02.02, 02.04 a 02.07, 02.11).$a$,
  $b$fora dos grupos de exame do SIGTAP (02.02, 02.03.01, 02.04 a 02.07, 02.11).$b$);

-- ── 3. o enfermeiro pede o citopatológico de rastreamento ───────────────────
CREATE OR REPLACE FUNCTION private.ubs_exames_enfermagem()
RETURNS TABLE (codigo text, nome text, linhas text[])
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT * FROM (VALUES
    ('0202020380', 'Hemograma completo', ARRAY['pre_natal', 'parceria']),
    ('0202020355', 'Eletroforese de hemoglobina', ARRAY['pre_natal', 'parceria']),
    ('0202120023', 'Grupo ABO', ARRAY['pre_natal', 'parceria']),
    ('0202120082', 'Fator Rh', ARRAY['pre_natal', 'parceria']),
    ('0202120090', 'Coombs indireto', ARRAY['pre_natal']),
    ('0202010473', 'Glicose', ARRAY['pre_natal', 'hiperdia', 'parceria']),
    ('0202010040', 'Curva glicêmica (2 dosagens)', ARRAY['pre_natal']),
    ('0202050017', 'Urina tipo I (EAS)', ARRAY['pre_natal', 'hiperdia']),
    ('0202080080', 'Urocultura', ARRAY['pre_natal']),
    ('0202031179', 'Sífilis (VDRL) em gestante', ARRAY['pre_natal']),
    ('0202031519', 'HIV em gestante', ARRAY['pre_natal']),
    ('0202031454', 'Hepatite B (HBsAg) em gestante', ARRAY['pre_natal']),
    ('0202030768', 'Toxoplasmose IgG', ARRAY['pre_natal']),
    ('0202030873', 'Toxoplasmose IgM', ARRAY['pre_natal']),
    ('0202010503', 'Hemoglobina glicada (HbA1c)', ARRAY['hiperdia']),
    ('0202010317', 'Creatinina', ARRAY['hiperdia']),
    ('0202010600', 'Potássio', ARRAY['hiperdia']),
    ('0202010295', 'Colesterol total', ARRAY['hiperdia', 'parceria']),
    ('0202010279', 'Colesterol HDL', ARRAY['hiperdia', 'parceria']),
    ('0202010678', 'Triglicerídeos', ARRAY['hiperdia', 'parceria']),
    ('0202050092', 'Microalbumina na urina', ARRAY['hiperdia']),
    ('0202031624', 'Sífilis (VDRL) em parceria de gestante', ARRAY['parceria']),
    ('0202031527', 'HIV em parceria de gestante', ARRAY['parceria']),
    ('0202031462', 'Hepatite B (HBsAg) em parceria de gestante', ARRAY['parceria']),
    ('0202031497', 'Hepatite C (anti-HCV) em parceria de gestante', ARRAY['parceria']),
    ('0203010086', 'Citopatológico do colo do útero (rastreamento)', ARRAY['colo'])
  ) AS t(codigo, nome, linhas)
$$;
REVOKE ALL ON FUNCTION private.ubs_exames_enfermagem() FROM PUBLIC, anon, authenticated;

SELECT pg_temp.u6c_trocar('private.exame_consulta_enfermagem()'::regprocedure,
  $a$ELSE ARRAY['pre_natal', 'hiperdia'] END;$a$, $b$ELSE ARRAY['pre_natal', 'hiperdia', 'colo'] END;$b$);
