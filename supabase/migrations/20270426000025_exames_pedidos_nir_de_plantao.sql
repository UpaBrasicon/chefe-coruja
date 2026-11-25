-- Decisão do RT de 25/11/2026 (achado B-09 do teste de fluxo B), complemento da
-- 20270426000023: o NIR lança valores na planilha, mas a tela lista os exames
-- aguardando resultado lendo exames_pedidos, e a política de leitura só deixava
-- o gestor e quem tem o paciente no plantão. O NIR de plantão na unidade via
-- zero pedidos e não tinha o que lançar. Política nova, só de leitura, para o
-- NIR com escala ativa na unidade. As outras políticas não mudam. Idempotente.

DROP POLICY IF EXISTS exames_pedidos_nir_de_plantao ON public.exames_pedidos;
CREATE POLICY exames_pedidos_nir_de_plantao ON public.exames_pedidos
  FOR SELECT TO authenticated
  USING (private.sou_nir(unidade_id) AND private.na_escala_agora(unidade_id));

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS exames_pedidos_nir_de_plantao ON public.exames_pedidos;
