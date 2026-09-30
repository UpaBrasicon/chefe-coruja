-- Testes das correções de nome da base de medicamentos (migration
-- 20261013000001, onda 10 do porte). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_correcoes_nomes.sql
-- A troca é por nome exato; Laculose e Tranexamico mudam também a chave
-- normalizada; diluição publicada não muda (imutável), rascunho muda; nome
-- que não está na lista (e o que já está certo) fica como está; rodar de novo
-- não muda nada.
BEGIN;
INSERT INTO public.medicamento (principio_ativo, principio_ativo_norm, apresentacao, fonte) VALUES
  ('Lidocaina', 'lidocaina', 'Ampola 20 mL', 'teste-correcoes'),
  ('Laculose', 'laculose', 'Frasco 100 mL', 'teste-correcoes'),
  ('Tranexamico', 'tranexamico', 'Ampola 5 mL', 'teste-correcoes'),
  ('Fenitoina (comprimido)', 'fenitoina comprimido', 'Comprimido 100 mg', 'teste-correcoes'),
  ('Dobutamina', 'dobutamina', 'Ampola 20 mL', 'teste-correcoes'),
  ('lidocaina', 'lidocaina gel', 'Gel 2%', 'teste-correcoes');

INSERT INTO public.diluicao (medicamento_id, principio_ativo, apresentacao, via, fonte, status, versao, vigente_desde, publicado_em)
SELECT id, 'Lidocaina', 'Ampola 20 mL', 'EV', 'teste-correcoes-pub', 'publicado', 1, now(), now()
  FROM public.medicamento WHERE fonte = 'teste-correcoes' AND principio_ativo_norm = 'lidocaina';
INSERT INTO public.diluicao (medicamento_id, principio_ativo, apresentacao, via, fonte, status, versao)
SELECT id, 'Lidocaina', 'Ampola 20 mL', 'IM', 'teste-correcoes-rasc', 'rascunho', 1
  FROM public.medicamento WHERE fonte = 'teste-correcoes' AND principio_ativo_norm = 'lidocaina';

DO $$
DECLARE n integer; nomes text;
BEGIN
  n := private.aplicar_correcoes_nome_medicamento();
  IF n <> 4 THEN RAISE EXCEPTION 'FALHOU: esperava 4 nomes corrigidos, vieram %', n; END IF;

  SELECT string_agg(principio_ativo || '=' || principio_ativo_norm, ' | ' ORDER BY principio_ativo_norm)
    INTO nomes FROM public.medicamento WHERE fonte = 'teste-correcoes';
  IF nomes <> 'Ácido tranexâmico=acido tranexamico | Dobutamina=dobutamina | Fenitoína (comprimido)=fenitoina comprimido | Lactulose=lactulose | Lidocaína=lidocaina | lidocaina=lidocaina gel' THEN
    RAISE EXCEPTION 'FALHOU: cadastro depois da correção: %', nomes;
  END IF;

  IF (SELECT principio_ativo FROM public.diluicao WHERE fonte = 'teste-correcoes-pub') <> 'Lidocaina' THEN
    RAISE EXCEPTION 'FALHOU: diluição publicada mudou de nome';
  END IF;
  IF (SELECT principio_ativo FROM public.diluicao WHERE fonte = 'teste-correcoes-rasc') <> 'Lidocaína' THEN
    RAISE EXCEPTION 'FALHOU: rascunho de diluição não recebeu o nome corrigido';
  END IF;

  n := private.aplicar_correcoes_nome_medicamento();
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: segunda aplicação mudou % linhas', n; END IF;

  IF (SELECT count(*) FROM private.correcao_nome_medicamento) <> 30 THEN
    RAISE EXCEPTION 'FALHOU: a lista não tem as 30 correções do protótipo';
  END IF;
  RAISE NOTICE 'ok: correções de nome de medicamento';
END $$;

-- quem usa o app não chama a função nem lê a lista
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM private.aplicar_correcoes_nome_medicamento();
    RAISE EXCEPTION 'FALHOU: authenticated conseguiu aplicar as correções';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
