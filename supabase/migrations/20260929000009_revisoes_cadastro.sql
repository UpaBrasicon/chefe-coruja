-- Log das revisões de cadastro (medicamentos e diluições) feitas em lote,
-- fora das telas: cada campo alterado guarda o valor anterior, o novo, a
-- fonte declarada, o lote e quem aprovou. Só de inserção.
CREATE TABLE IF NOT EXISTS public.revisoes_cadastro (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote        text NOT NULL,
  tabela      text NOT NULL CHECK (tabela IN ('medicamento', 'diluicao')),
  registro_id uuid NOT NULL,
  referencia  text,           -- ex.: "A8" (Nº na lista enviada para revisão)
  campo       text NOT NULL,
  anterior    text,
  novo        text,
  fonte       text NOT NULL,
  aprovacao   text NOT NULL,
  em          timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_revisoes_cadastro_so_insercao ON public.revisoes_cadastro;
CREATE TRIGGER trg_revisoes_cadastro_so_insercao BEFORE UPDATE OR DELETE ON public.revisoes_cadastro
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.revisoes_cadastro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS revisoes_cadastro_select ON public.revisoes_cadastro;
CREATE POLICY revisoes_cadastro_select ON public.revisoes_cadastro FOR SELECT TO authenticated
  USING (private.sou_farmaceutico() OR private.eh_super_admin());
REVOKE INSERT, UPDATE, DELETE ON public.revisoes_cadastro FROM anon, authenticated;
GRANT SELECT ON public.revisoes_cadastro TO authenticated;

-- vínculo com o registro ANVISA desfeito por estar errado, à espera do certo
ALTER TABLE public.medicamento ADD COLUMN IF NOT EXISTS anvisa_vinculo_pendente boolean NOT NULL DEFAULT false;
