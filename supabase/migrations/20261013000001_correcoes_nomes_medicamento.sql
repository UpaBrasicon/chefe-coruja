-- ─────────────────────────────────────────────────────────────────────────────
-- PORTE DO FRONTEND, ONDA 10 — correções de nome da base de medicamentos
--
-- Aplica o `data/correcoes-nomes.csv` do protótipo (30 nomes, conferidos um a
-- um, nada por heurística): 28 de acentuação, `Laculose` → Lactulose (erro de
-- digitação na origem) e `Tranexamico` → Ácido tranexâmico (nome incompleto).
-- A troca é por nome EXATO; nome que não bate não muda.
--
-- Onde muda:
--   * medicamento.principio_ativo (cadastro canônico);
--   * medicamento.principio_ativo_norm só nos dois que mudam de palavra
--     (lactulose, acido tranexamico) e só se não houver outra linha com a
--     mesma chave (principio_ativo_norm, apresentacao);
--   * medicamento_bula.principio_ativo;
--   * diluicao.principio_ativo das linhas em rascunho/revisado/descartado.
--     Diluição publicada ou substituída NÃO muda: é imutável por regra
--     (private.diluicao_publicada_imutavel); a próxima versão já nasce com o
--     nome novo, copiado do cadastro.
--
-- Os CSVs do ETL (data/medicamento.csv, padronizacao.csv,
-- alta_vigilancia_ismp.csv) foram corrigidos junto, para um ETL rodado de novo
-- não desfazer a troca.
--
-- A tabela private.correcao_nome_medicamento guarda o pedido de mudança e
-- private.aplicar_correcoes_nome_medicamento() aplica (idempotente).
--
-- DOWN: DROP FUNCTION/TABLE acima e rodar os UPDATE com as colunas trocadas (nome_corrigido → nome_na_base;
-- norm 'lactulose' → 'laculose', 'acido tranexamico' → 'tranexamico').
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS private.correcao_nome_medicamento (
  nome_na_base   text PRIMARY KEY,
  nome_corrigido text NOT NULL,
  norm_novo      text          -- só quando a palavra muda
);
REVOKE ALL ON private.correcao_nome_medicamento FROM PUBLIC;

INSERT INTO private.correcao_nome_medicamento (nome_na_base, nome_corrigido, norm_novo) VALUES
  ('Nitroprussiato de sodio', 'Nitroprussiato de sódio', NULL),
  ('Lidocaina', 'Lidocaína', NULL),
  ('Cloreto de potassio 10%', 'Cloreto de potássio 10%', NULL),
  ('Cloreto de potassio 19,1%', 'Cloreto de potássio 19,1%', NULL),
  ('Fosfato de potassio', 'Fosfato de potássio', NULL),
  ('Sulfato de magnesio 50%', 'Sulfato de magnésio 50%', NULL),
  ('Gluconato de calcio 10%', 'Gluconato de cálcio 10%', NULL),
  ('Cloreto de calcio 10%', 'Cloreto de cálcio 10%', NULL),
  ('Bicarbonato de sodio 8,4%', 'Bicarbonato de sódio 8,4%', NULL),
  ('Cloreto de sodio 20%', 'Cloreto de sódio 20%', NULL),
  ('Soro fisiologico 0,9%', 'Soro fisiológico 0,9%', NULL),
  ('Soro glicofisiologico', 'Soro glicofisiológico', NULL),
  ('Heparina nao fracionada', 'Heparina não fracionada', NULL),
  ('Acetilcisteina', 'Acetilcisteína', NULL),
  ('Codeina', 'Codeína', NULL),
  ('Rocuronio', 'Rocurônio', NULL),
  ('Atracurio', 'Atracúrio', NULL),
  ('Cisatracurio', 'Cisatracúrio', NULL),
  ('Vecuronio', 'Vecurônio', NULL),
  ('Fenitoina', 'Fenitoína', NULL),
  ('Valproato de sodio', 'Valproato de sódio', NULL),
  ('Ipratropio', 'Ipratrópio', NULL),
  ('Acido folico', 'Ácido fólico', NULL),
  ('Laculose', 'Lactulose', 'lactulose'),
  ('Tranexamico', 'Ácido tranexâmico', 'acido tranexamico'),
  ('Acido aminocaproico', 'Ácido aminocaproico', NULL),
  ('Fenitoina (comprimido)', 'Fenitoína (comprimido)', NULL),
  ('Valproato de sodio (comprimido)', 'Valproato de sódio (comprimido)', NULL),
  ('Acido folico (comprimido)', 'Ácido fólico (comprimido)', NULL),
  ('Nitrofurantoina', 'Nitrofurantoína', NULL)
ON CONFLICT (nome_na_base) DO NOTHING;

-- Aplica as correções; devolve quantas linhas do cadastro mudaram. Fica
-- no banco para rodar de novo depois de uma carga do ETL com CSV antigo.
CREATE OR REPLACE FUNCTION private.aplicar_correcoes_nome_medicamento()
RETURNS integer
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.medicamento m
     SET principio_ativo = c.nome_corrigido,
         principio_ativo_norm = CASE
           WHEN c.norm_novo IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.medicamento o
              WHERE o.principio_ativo_norm = c.norm_novo
                AND o.apresentacao IS NOT DISTINCT FROM m.apresentacao
                AND o.id <> m.id)
           THEN c.norm_novo ELSE m.principio_ativo_norm END
    FROM private.correcao_nome_medicamento c
   WHERE m.principio_ativo = c.nome_na_base;
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.medicamento_bula b
     SET principio_ativo = c.nome_corrigido
    FROM private.correcao_nome_medicamento c
   WHERE b.principio_ativo = c.nome_na_base;

  UPDATE public.diluicao d
     SET principio_ativo = c.nome_corrigido
    FROM private.correcao_nome_medicamento c
   WHERE d.principio_ativo = c.nome_na_base
     AND d.status NOT IN ('publicado', 'substituido');
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.aplicar_correcoes_nome_medicamento() FROM PUBLIC;

SELECT private.aplicar_correcoes_nome_medicamento();
