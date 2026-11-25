-- ════════════════════════════════════════════════════════════════════════════
-- Ajustes da revisão (RT, 24/11/2026), item 4: materiais cadastrados pela
-- farmácia.
--
-- Até aqui o cadastro de materiais (material_salvar) era do faturamento e do
-- gestor. O RT decidiu: quem cadastra é o farmacêutico (e o gestor); o
-- faturamento só lança na conta.
--   • private.pode_cadastrar_material(unidade): administrador geral, gestor ou
--     farmacêutico da unidade (tenho_papel: vale para conta com vários papéis);
--   • material_salvar passa a exigir pode_cadastrar_material. O faturamento
--     deixa de criar e alterar material;
--   • materiais_da_unidade (leitura) passa a abrir também para o farmacêutico.
--     O faturamento continua lendo, porque lança o material na conta;
--   • conta_lancar_material e conta_retirar_material não mudam (faturamento).
-- materiais_unidade segue sem grant direto (REVOKE ALL de authenticated): a
-- escrita só passa pela RPC, então a RLS não muda.
--
-- Trocas de texto reaplicáveis; se um trecho não for achado, para.
-- ROLLBACK: docs/banco/ROLLBACK-20270421000070-079.sql (trocas de volta e
--   DROP FUNCTION private.pode_cadastrar_material).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.pode_cadastrar_material(p_unidade uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(private.eh_super_admin(), false)
      OR private.tenho_papel(p_unidade, 'gestor')
      OR private.tenho_papel(p_unidade, 'farmaceutico')
$$;
REVOKE ALL ON FUNCTION private.pode_cadastrar_material(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pode_cadastrar_material(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.trocar_uma_vez(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

-- escrita: farmacêutico e gestor (não mais o faturamento)
SELECT pg_temp.trocar_uma_vez('public.material_salvar(uuid, uuid, text, text, text, boolean)'::regprocedure,
  $old$  IF NOT private.pode_ver_contas(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: os materiais são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';$old$,
  $new$  IF NOT private.pode_cadastrar_material(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o cadastro de materiais é da farmácia e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';$new$);

-- leitura: quem lança na conta (faturamento e gestor) e quem cadastra (farmácia)
SELECT pg_temp.trocar_uma_vez('public.materiais_da_unidade(uuid)'::regprocedure,
  $old$  IF NOT private.pode_ver_contas(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: os materiais são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';$old$,
  $new$  IF NOT (private.pode_ver_contas(p_unidade) OR private.pode_cadastrar_material(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: os materiais são da farmácia, do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';$new$);
