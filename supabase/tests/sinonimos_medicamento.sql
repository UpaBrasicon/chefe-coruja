-- Testes da migration 20270203000002_sinonimos_medicamento.sql (ponto 11):
-- a carga aprovada pelo RT está inteira; os nomes comerciais reprovados na
-- Anvisa ficaram de fora; os termos de soro estão presos à concentração; e "SF"
-- nunca traz cloreto de sódio que não seja 0,9 %. ROLLBACK no fim.
BEGIN;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, concentracao, fonte) VALUES
  ('Cloreto de sódio', 'cloreto de sodio', 'solução injetável, ampola 10 mL (teste)', '20%', 'teste-sinonimos'),
  ('Cloreto de sódio', 'cloreto de sodio', 'solução injetável, bolsa 500 mL (teste)', '0,9 %', 'teste-sinonimos');

DO $$
DECLARE n int; v text;
BEGIN
  SELECT count(*) INTO n FROM public.medicamento_sinonimo WHERE fonte LIKE '%pelo RT em 28/10/2026%';
  IF n <> 66 THEN RAISE EXCEPTION 'FALHOU: carga com % linhas, esperadas 66 (45 da lista A e 21 da lista B)', n; END IF;
  RAISE NOTICE 'OK  carga inteira (66 linhas)';

  IF EXISTS (SELECT 1 FROM public.medicamento_sinonimo
              WHERE termo_norm IN ('zofran', 'vancocina', 'solu cortef', 'rocefin', 'tazocin')) THEN
    RAISE EXCEPTION 'FALHOU: nome comercial reprovado na Anvisa foi gravado';
  END IF;
  RAISE NOTICE 'OK  reprovados na Anvisa ficaram de fora';

  IF EXISTS (SELECT 1 FROM public.medicamento_sinonimo
              WHERE termo_norm ~ '^(sf|sg|soro fisiologico|soro glicosado|salina|dextrose|g50|nacl 20|glicose hipertonica|sal hipertonico)'
                AND concentracao IS NULL) THEN
    RAISE EXCEPTION 'FALHOU: termo de soro sem concentração';
  END IF;
  RAISE NOTICE 'OK  termos de soro presos à concentração';

  SELECT string_agg(e ->> 'concentracao', ', ') INTO v
    FROM jsonb_array_elements(public.buscar_medicamento(NULL, 'sf')) e
   WHERE e ->> 'principio_ativo' = 'Cloreto de sódio';
  IF v IS NULL OR v ~ '20' THEN RAISE EXCEPTION 'FALHOU: "sf" trouxe %', coalesce(v, 'nada'); END IF;
  RAISE NOTICE 'OK  "sf" traz só o 0,9 %%: %', v;
END $$;
ROLLBACK;
