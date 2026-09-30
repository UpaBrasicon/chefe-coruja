-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend — NOTIFICAÇÃO COMPULSÓRIA (catálogo LNNC, detecção por CID
-- e lista de agravos). Protótipo: index.html, `LNNC` (~21631), `notifVals`
-- (~30800) e a tela da enfermagem (`sinanVals`, ~30105; ESTADO.md 24/09 e
-- 26/09).
--
-- FONTE do catálogo, como o protótipo cita: "Lista Nacional de Notificação
-- Compulsória, Portaria GM/MS nº 10.175, de 23/01/2026 (Anexo 1 do Anexo V da
-- PRC 4/2017)" — Portaria de Consolidação GM/MS nº 4/2017. O texto do agravo,
-- a periodicidade (imediata/semanal), o destino da imediata e a condição
-- ("imediata se óbito") vêm de lá. A PORTARIA NÃO TRAZ CID: o mapeamento
-- agravo → CID-10 é do protótipo (códigos usados no SINAN) e precisa de
-- aprovação da vigilância (pedido do usuário na fase 4: "Agravos por CID:
-- preencher automaticamente… Precisa de um mapeamento aprovado pela
-- vigilância"). Por isso:
--   * catálogo e mapeamento entram com `conferido_por`/`conferido_em` NULOS
--     ("a conferir pela vigilância"); reaplicar esta migration não apaga uma
--     conferência feita, mas a anula se o conteúdo do item mudar;
--   * a detecção por CID só SUGERE: nada é registrado sozinho. O caso
--     sugerido aparece na lista; vira agravo (que impede a alta) quando uma
--     pessoa abre a notificação.
--
-- Contrato com o caderno do leito (src/components/internacao/caderno/
-- notificacao.ts): public.notificacao_compulsoria_dos_cids(p_cids text[])
-- RETURNS TABLE (cid, item int, agravo, imediata, destino, condicao) — uma
-- linha por CID notificável. `item` é o NÚMERO do item na portaria (os itens
-- "14a"/"14b" saem como 14); o código com a letra está em lnnc_agravos.item.
--
-- Registro: amplia public.agravos_notificacao (fase 4.7) com o item da LNNC,
-- a origem, a Ficha Individual de Notificação do SINAN (campos 7 a 33 do
-- protótipo, em jsonb) e a reabertura para correção com motivo. Notificador =
-- quem está logado (resolvido_por). O envio ao SINAN continua fora do sistema.
--
-- Quem vê a lista e preenche a ficha: gestor da unidade e super admin sempre;
-- plantonista e enfermeiro da unidade enquanto estão na escala agora. "Abrir o
-- paciente" só aparece para quem pode atuar nele (private.pode_atuar_no_paciente).
--
-- DOWN:
--   DROP FUNCTION public.notificacao_compulsoria_dos_cids(text[]);
--   DROP FUNCTION public.notificacao_compulsoria_periodo(uuid, date, date, text[]);
--   DROP FUNCTION public.notificacao_ficha(uuid);
--   DROP FUNCTION public.abrir_notificacao(uuid, text, text, uuid, uuid);
--   DROP FUNCTION public.salvar_ficha_notificacao(uuid, jsonb);
--   DROP FUNCTION public.registrar_notificacao(uuid, jsonb, text);
--   DROP FUNCTION public.reabrir_notificacao(uuid, text);
--   DROP FUNCTION private.pode_notificar(uuid), private.lnnc_item_do_cid(text),
--     private.lnnc_bate(text, text), private.cid_do_texto(text),
--     private.ficha_sinan_pendencias(jsonb), private.data_iso_valida(text),
--     private.ficha_sinan_limpa(jsonb);
--   ALTER TABLE public.agravos_notificacao DROP COLUMN lnnc_item, DROP COLUMN origem,
--     DROP COLUMN ficha, DROP COLUMN reaberto_por, DROP COLUMN reaberto_em,
--     DROP COLUMN motivo_reabertura;
--   DROP TABLE public.lnnc_cids, public.lnnc_agravos;
-- ════════════════════════════════════════════════════════════════════════════

-- ── catálogo ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lnnc_agravos (
  item          text PRIMARY KEY,                 -- código do item na portaria: '1a', '17b', '64'
  numero        int  NOT NULL,                    -- número do item: 1, 17, 64
  ordem         int  NOT NULL UNIQUE,             -- ordem da portaria; desempata CID que cai em dois itens
  agravo        text NOT NULL,
  imediata      boolean NOT NULL,                 -- imediata (até 24 h) ou semanal
  destino       text,                             -- destino da imediata: MS, SES, SMS
  condicao      text,                             -- "imediata se …" (ex.: dengue, óbito)
  fonte         text NOT NULL,
  conferido_por uuid REFERENCES public.perfis(id),
  conferido_em  timestamptz,
  CHECK ((conferido_por IS NULL) = (conferido_em IS NULL))
);
COMMENT ON TABLE public.lnnc_agravos IS
  'Lista Nacional de Notificação Compulsória (Portaria GM/MS nº 10.175, de 23/01/2026, conforme o protótipo). conferido_* nulo = a conferir pela vigilância.';

CREATE TABLE IF NOT EXISTS public.lnnc_cids (
  item          text NOT NULL REFERENCES public.lnnc_agravos(item),
  regra         text NOT NULL CHECK (regra ~ '^[A-Z][0-9]{2}(\.[0-9])?(-[A-Z][0-9]{2}(\.[0-9])?)?$'),
  fonte         text NOT NULL,
  conferido_por uuid REFERENCES public.perfis(id),
  conferido_em  timestamptz,
  PRIMARY KEY (item, regra),
  CHECK ((conferido_por IS NULL) = (conferido_em IS NULL))
);
COMMENT ON TABLE public.lnnc_cids IS
  'Mapeamento item da LNNC → CID-10 ("A90" cobre A90 e A90.x; "X20-X29" é faixa). A portaria não traz CID: mapeamento do protótipo, a conferir pela vigilância.';

ALTER TABLE public.lnnc_agravos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lnnc_cids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lnnc_agravos_select ON public.lnnc_agravos;
CREATE POLICY lnnc_agravos_select ON public.lnnc_agravos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS lnnc_cids_select ON public.lnnc_cids;
CREATE POLICY lnnc_cids_select ON public.lnnc_cids FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.lnnc_agravos, public.lnnc_cids FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.lnnc_agravos, public.lnnc_cids FROM authenticated;
GRANT SELECT ON public.lnnc_agravos, public.lnnc_cids TO authenticated;

-- Carga: gerada do array LNNC do protótipo (70 itens). Reaplicável.
DO $$
DECLARE
  v_fonte   constant text := 'Portaria GM/MS nº 10.175, de 23/01/2026 (Anexo 1 do Anexo V da Portaria de Consolidação GM/MS nº 4/2017), conforme o protótipo';
  v_fonte_c constant text := 'Mapeamento do protótipo pelos códigos usados no SINAN; a portaria não traz CID. A conferir pela vigilância.';
BEGIN
  CREATE TEMP TABLE _lnnc (ordem int, item text, numero int, agravo text, imediata boolean, destino text, condicao text, cids text[]) ON COMMIT DROP;
  INSERT INTO _lnnc VALUES
  (1, '1a', 1, 'Acidente de trabalho com exposição a material biológico', false, NULL, NULL, ARRAY['Z20.9']::text[]),
  (2, '1b', 1, 'Acidente de trabalho', true, 'SMS', NULL, ARRAY['Y96']::text[]),
  (3, '2', 2, 'Acidente por animal peçonhento', true, 'SMS', NULL, ARRAY['T63', 'X20-X29']::text[]),
  (4, '3', 3, 'Acidente por animal potencialmente transmissor da raiva', true, 'SMS', NULL, ARRAY['W64', 'W54']::text[]),
  (5, '4', 4, 'Anomalias congênitas', false, NULL, NULL, ARRAY['Q00-Q99']::text[]),
  (6, '5', 5, 'Botulismo', true, 'MS, SES e SMS', NULL, ARRAY['A05.1']::text[]),
  (7, '6', 6, 'Câncer relacionado ao trabalho', false, NULL, NULL, ARRAY[]::text[]),
  (8, '7', 7, 'Cólera', true, 'MS, SES e SMS', NULL, ARRAY['A00']::text[]),
  (9, '8', 8, 'Coqueluche', true, 'SES e SMS', NULL, ARRAY['A37']::text[]),
  (10, '9', 9, 'Covid-19', true, 'MS, SES e SMS', NULL, ARRAY['U07.1', 'U07.2']::text[]),
  (11, '10', 10, 'Dengue', false, 'MS, SES e SMS', 'óbito', ARRAY['A90', 'A91', 'A97']::text[]),
  (12, '11', 11, 'Dermatose ocupacionais', false, NULL, NULL, ARRAY[]::text[]),
  (13, '12', 12, 'Difteria', true, 'SES e SMS', NULL, ARRAY['A36']::text[]),
  (14, '13', 13, 'Distúrbio de voz relacionado ao trabalho', false, NULL, NULL, ARRAY[]::text[]),
  (15, '14a', 14, 'Doença de Chagas Aguda', true, 'SES e SMS', NULL, ARRAY['B57.0', 'B57.1']::text[]),
  (16, '14b', 14, 'Doença de Chagas Crônica', false, NULL, NULL, ARRAY['B57.2-B57.5']::text[]),
  (17, '15', 15, 'Doença de Creutzfeldt-Jakob (DCJ)', false, NULL, NULL, ARRAY['A81.0']::text[]),
  (18, '16', 16, 'Doença Falciforme', false, NULL, NULL, ARRAY['D57']::text[]),
  (19, '17a', 17, 'Doença Invasiva por "Haemophilus Influenza"', true, 'SES e SMS', NULL, ARRAY['G00.0', 'A41.3']::text[]),
  (20, '17b', 17, 'Doença Meningocócica e outras meningites', true, 'SES e SMS', NULL, ARRAY['A39', 'G00-G03']::text[]),
  (21, '18', 18, 'Doenças com suspeita de disseminação intencional: antraz pneumônico, tularemia, varíola', true, 'MS, SES e SMS', NULL, ARRAY['A22', 'A21', 'B03']::text[]),
  (22, '19', 19, 'Doenças febris hemorrágicas emergentes/reemergentes: arenavírus, Ebola, Marburg, Lassa, febre purpúrica brasileira', true, 'MS, SES e SMS', NULL, ARRAY['A96', 'A98.3', 'A98.4', 'A48.4']::text[]),
  (23, '20', 20, 'Doença aguda pelo vírus Zika', false, 'MS, SES e SMS', 'gestante (SES e SMS) ou óbito (MS, SES e SMS)', ARRAY['A92.8', 'U06.9']::text[]),
  (24, '20d', 20, 'Síndrome congênita associada à infecção pelo vírus Zika', false, NULL, NULL, ARRAY['P35.4']::text[]),
  (25, '21', 21, 'Esporotricose humana', false, NULL, NULL, ARRAY['B42']::text[]),
  (26, '22', 22, 'Esquistossomose', false, NULL, NULL, ARRAY['B65']::text[]),
  (27, '23', 23, 'Evento de Saúde Pública (ESP) que se constitua ameaça à saúde pública', true, 'MS, SES e SMS', NULL, ARRAY[]::text[]),
  (28, '24', 24, 'Eventos adversos graves ou óbitos pós vacinação', true, 'MS, SES e SMS', NULL, ARRAY['T88.0', 'T88.1']::text[]),
  (29, '25', 25, 'Febre Amarela', true, 'MS, SES e SMS', NULL, ARRAY['A95']::text[]),
  (30, '26', 26, 'Febre de Chikungunya', false, 'MS, SES e SMS', 'área sem transmissão ou óbito', ARRAY['A92.0']::text[]),
  (31, '27', 27, 'Febre do Nilo Ocidental e outras arboviroses de importância em saúde pública', true, 'MS, SES e SMS', NULL, ARRAY['A92.3']::text[]),
  (32, '28', 28, 'Febre Maculosa e outras Riquetisioses', true, 'MS, SES e SMS', NULL, ARRAY['A77', 'A79']::text[]),
  (33, '29', 29, 'Febre Tifoide', true, 'SES e SMS', NULL, ARRAY['A01.0']::text[]),
  (34, '30', 30, 'Hanseníase', false, NULL, NULL, ARRAY['A30']::text[]),
  (35, '31', 31, 'Hantavirose', true, 'MS, SES e SMS', NULL, ARRAY['A98.5', 'B33.4']::text[]),
  (36, '32', 32, 'Hepatites virais', false, NULL, NULL, ARRAY['B15-B19']::text[]),
  (37, '33', 33, 'Infecção pelo vírus da hepatite B em gestante, parturiente ou puérpera e criança exposta', false, NULL, NULL, ARRAY['O98.4']::text[]),
  (38, '34', 34, 'HIV/AIDS', false, NULL, NULL, ARRAY['B20-B24']::text[]),
  (39, '35', 35, 'Infecção pelo HIV em gestante, parturiente ou puérpera e criança exposta', false, NULL, NULL, ARRAY['O98.7', 'Z20.6']::text[]),
  (40, '36', 36, 'Infecção pelo Vírus da Imunodeficiência Humana (HIV)', false, NULL, NULL, ARRAY['Z21']::text[]),
  (41, '37', 37, 'Infecção pelo Vírus Linfotrópico de Células T Humanas (HTLV)', false, NULL, NULL, ARRAY['B33.3']::text[]),
  (42, '38', 38, 'Infecção pelo HTLV em gestante, parturiente ou puérpera e criança exposta', false, NULL, NULL, ARRAY[]::text[]),
  (43, '39', 39, 'Influenza humana produzida por novo subtipo viral', true, 'MS, SES e SMS', NULL, ARRAY['J09']::text[]),
  (44, '40', 40, 'Intoxicação Exógena', false, NULL, NULL, ARRAY['T36-T65']::text[]),
  (45, '41', 41, 'Leishmaniose Tegumentar Americana', false, NULL, NULL, ARRAY['B55.1', 'B55.2']::text[]),
  (46, '42', 42, 'Leishmaniose Visceral', false, NULL, NULL, ARRAY['B55.0']::text[]),
  (47, '43', 43, 'Leptospirose', true, 'SMS', NULL, ARRAY['A27']::text[]),
  (48, '44', 44, 'LER/DORT', false, NULL, NULL, ARRAY[]::text[]),
  (49, '45', 45, 'Malária', false, 'MS, SES e SMS', 'região extra-Amazônica', ARRAY['B50-B54']::text[]),
  (50, '46', 46, 'Monkeypox (varíola dos macacos)', true, 'MS, SES e SMS', NULL, ARRAY['B04']::text[]),
  (51, '47', 47, 'Óbito infantil e materno', false, NULL, NULL, ARRAY[]::text[]),
  (52, '48', 48, 'Perda Auditiva relacionada ao trabalho', false, NULL, NULL, ARRAY['H83.3']::text[]),
  (53, '49', 49, 'Pneumoconioses relacionadas ao trabalho', false, NULL, NULL, ARRAY['J60-J65']::text[]),
  (54, '50', 50, 'Peste', true, 'MS, SES e SMS', NULL, ARRAY['A20']::text[]),
  (55, '51', 51, 'Poliomielite por poliovírus selvagem', true, 'MS, SES e SMS', NULL, ARRAY['A80']::text[]),
  (56, '52', 52, 'Raiva humana', true, 'MS, SES e SMS', NULL, ARRAY['A82']::text[]),
  (57, '53', 53, 'Síndrome da Rubéola Congênita', true, 'MS, SES e SMS', NULL, ARRAY['P35.0']::text[]),
  (58, '54', 54, 'Doenças Exantemáticas: sarampo, rubéola', true, 'MS, SES e SMS', NULL, ARRAY['B05', 'B06']::text[]),
  (59, '55', 55, 'Sífilis: adquirida, congênita, em gestante', false, NULL, NULL, ARRAY['A50-A53', 'O98.1']::text[]),
  (60, '56', 56, 'Síndrome da Paralisia Flácida Aguda', true, 'MS, SES e SMS', NULL, ARRAY[]::text[]),
  (61, '57', 57, 'Síndrome Inflamatória Multissistêmica (SIM-A/SIM-P) associada à covid-19', true, 'MS, SES e SMS', NULL, ARRAY['U10.9']::text[]),
  (62, '59', 59, 'Síndrome Respiratória Aguda Grave (SRAG) associada a Coronavírus', true, 'MS, SES e SMS', NULL, ARRAY['U04.9']::text[]),
  (63, '60', 60, 'Síndrome Gripal suspeita de covid-19', true, 'MS, SES e SMS', NULL, ARRAY[]::text[]),
  (64, '61', 61, 'Tétano: acidental, neonatal', true, 'SMS', NULL, ARRAY['A33', 'A34', 'A35']::text[]),
  (65, '62', 62, 'Toxoplasmose gestacional e congênita', false, NULL, NULL, ARRAY['O98.6', 'P37.1']::text[]),
  (66, '63', 63, 'Transtornos mentais relacionados ao trabalho', false, NULL, NULL, ARRAY[]::text[]),
  (67, '64', 64, 'Tuberculose', false, NULL, NULL, ARRAY['A15-A19']::text[]),
  (68, '65', 65, 'Varicela - caso grave internado ou óbito', true, 'SES e SMS', NULL, ARRAY['B01']::text[]),
  (69, '66a', 66, 'Violência doméstica e/ou outras violências', false, NULL, NULL, ARRAY['Y09', 'T74.0', 'T74.1', 'T74.8', 'T74.9']::text[]),
  (70, '66b', 66, 'Violência sexual e tentativa de suicídio', true, 'SMS', NULL, ARRAY['T74.2', 'X60-X84']::text[])
  ;
  INSERT INTO public.lnnc_agravos AS a (item, numero, ordem, agravo, imediata, destino, condicao, fonte)
  SELECT item, numero, ordem, agravo, imediata, destino, condicao, v_fonte FROM _lnnc
  ON CONFLICT (item) DO UPDATE
     SET numero = EXCLUDED.numero, ordem = EXCLUDED.ordem, agravo = EXCLUDED.agravo, imediata = EXCLUDED.imediata,
         destino = EXCLUDED.destino, condicao = EXCLUDED.condicao, fonte = EXCLUDED.fonte,
         -- conteúdo mudou: a conferência anterior não vale mais
         conferido_por = CASE WHEN (a.agravo, a.imediata, a.destino, a.condicao) IS DISTINCT FROM
                                   (EXCLUDED.agravo, EXCLUDED.imediata, EXCLUDED.destino, EXCLUDED.condicao)
                              THEN NULL ELSE a.conferido_por END,
         conferido_em  = CASE WHEN (a.agravo, a.imediata, a.destino, a.condicao) IS DISTINCT FROM
                                   (EXCLUDED.agravo, EXCLUDED.imediata, EXCLUDED.destino, EXCLUDED.condicao)
                              THEN NULL ELSE a.conferido_em END;
  INSERT INTO public.lnnc_cids (item, regra, fonte)
  SELECT l.item, r, v_fonte_c FROM _lnnc l, unnest(l.cids) r
  ON CONFLICT (item, regra) DO NOTHING;
  -- regra que saiu do protótipo sai do banco (só se ninguém a conferiu)
  DELETE FROM public.lnnc_cids c
   WHERE c.conferido_em IS NULL
     AND NOT EXISTS (SELECT 1 FROM _lnnc l WHERE l.item = c.item AND c.regra = ANY (l.cids));
  DROP TABLE _lnnc;
END $$;

-- ── detecção por CID ────────────────────────────────────────────────────────
-- "A90 — Dengue", "a90", "A900" → "A90" / "A90.0"; sem código → NULL.
CREATE OR REPLACE FUNCTION private.cid_do_texto(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT private.cid_normalizado(substring(upper(coalesce(p, '')) FROM '[A-Z][0-9]{2}(?:\.?[0-9A-Z]{1,2})?'))
$$;

-- "A90" cobre A90 e A90.x; "X20-X29" e "B57.2-B57.5" são faixas, comparadas
-- no comprimento da ponta (como no protótipo, `lnncDe`).
CREATE OR REPLACE FUNCTION private.lnnc_bate(p_cid text, p_regra text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_cid IS NULL OR p_regra IS NULL THEN false
    WHEN position('-' IN p_regra) > 0 THEN
      (left(p_cid, length(split_part(p_regra, '-', 1))) COLLATE "C") >= (split_part(p_regra, '-', 1) COLLATE "C")
      AND (left(p_cid, length(split_part(p_regra, '-', 1))) COLLATE "C") <= (split_part(p_regra, '-', 2) COLLATE "C")
    ELSE p_cid = p_regra OR starts_with(p_cid, CASE WHEN length(p_regra) = 3 THEN p_regra || '.' ELSE p_regra END)
  END
$$;

-- Item da LNNC que o CID dispara (o primeiro na ordem da portaria), ou NULL.
CREATE OR REPLACE FUNCTION private.lnnc_item_do_cid(p_cid text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT a.item
    FROM public.lnnc_cids r JOIN public.lnnc_agravos a ON a.item = r.item
   WHERE private.lnnc_bate(private.cid_do_texto(p_cid), r.regra)
   ORDER BY a.ordem
   LIMIT 1
$$;

-- CONTRATO (caderno do leito): uma linha por CID notificável.
CREATE OR REPLACE FUNCTION public.notificacao_compulsoria_dos_cids(p_cids text[])
RETURNS TABLE (cid text, item int, agravo text, imediata boolean, destino text, condicao text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT x.cid, a.numero, a.agravo, a.imediata, nullif(a.destino, ''), nullif(a.condicao, '')
    FROM (SELECT DISTINCT private.cid_do_texto(c) AS cid FROM unnest(coalesce(p_cids, '{}'::text[])) c) x
    JOIN public.lnnc_agravos a ON a.item = private.lnnc_item_do_cid(x.cid)
   WHERE x.cid IS NOT NULL
   ORDER BY a.ordem, x.cid
$$;
COMMENT ON FUNCTION public.notificacao_compulsoria_dos_cids(text[]) IS
  'Uma linha por CID notificável (LNNC, Portaria GM/MS nº 10.175/2026; mapeamento CID a conferir pela vigilância). Só sugere: não registra nada.';

-- ── registro: agravo ampliado ───────────────────────────────────────────────
ALTER TABLE public.agravos_notificacao
  ADD COLUMN IF NOT EXISTS lnnc_item text REFERENCES public.lnnc_agravos(item),
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'suspeita_medica',
  ADD COLUMN IF NOT EXISTS ficha jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reaberto_por uuid REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS reaberto_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_reabertura text;
ALTER TABLE public.agravos_notificacao DROP CONSTRAINT IF EXISTS agravos_notificacao_origem_check;
ALTER TABLE public.agravos_notificacao ADD CONSTRAINT agravos_notificacao_origem_check
  CHECK (origem IN ('suspeita_medica', 'cid', 'manual'));
COMMENT ON COLUMN public.agravos_notificacao.origem IS
  'suspeita_medica: marcada pelo médico (marcar_agravo); cid: aberta a partir do CID sugerido; manual: aberta na tela (ex.: acidente de trabalho).';
COMMENT ON COLUMN public.agravos_notificacao.ficha IS
  'Ficha Individual de Notificação do SINAN, campos 7 a 33 (chaves em private.ficha_sinan_limpa).';
CREATE INDEX IF NOT EXISTS agravos_notificacao_unidade ON public.agravos_notificacao (unidade_id, suspeito_em DESC);

-- Quem cuida da notificação na unidade.
CREATE OR REPLACE FUNCTION private.pode_notificar(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin()
      OR private.tenho_papel(p_unidade, 'gestor') IS TRUE
      OR ((private.tenho_papel(p_unidade, 'plantonista') IS TRUE OR private.tenho_papel(p_unidade, 'enfermeiro') IS TRUE)
          AND private.na_escala_agora(p_unidade))
$$;

CREATE OR REPLACE FUNCTION private.data_iso_valida(p text)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  IF p IS NULL OR p !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN false; END IF;
  RETURN p::date <= private.data_atual() AND p::date >= date '1900-01-01';
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;

-- Só as chaves da ficha, texto aparado, vazio fora.
CREATE OR REPLACE FUNCTION private.ficha_sinan_limpa(p jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(k, left(btrim(v), 200)), '{}'::jsonb)
    FROM jsonb_each_text(CASE WHEN jsonb_typeof(p) = 'object' THEN p ELSE '{}'::jsonb END) AS e(k, v)
   WHERE k IN ('data_sintomas', 'nome', 'nascimento', 'idade', 'sexo', 'gestante', 'raca', 'escolaridade', 'cns', 'mae',
               'uf', 'municipio', 'ibge', 'distrito', 'bairro', 'logradouro', 'numero', 'complemento', 'referencia',
               'cep', 'telefone', 'zona', 'pais')
     AND btrim(coalesce(v, '')) <> ''
$$;

-- "Falta para registrar" (as mesmas regras da tela; protótipo `sinanConferir`).
CREATE OR REPLACE FUNCTION private.ficha_sinan_pendencias(f jsonb)
RETURNS text[] LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN coalesce(f ->> 'nome', '') = '' THEN 'Campo 8: nome do paciente.' END,
    CASE WHEN coalesce(f ->> 'data_sintomas', '') = '' THEN 'Campo 7: data dos primeiros sintomas.'
         WHEN NOT private.data_iso_valida(f ->> 'data_sintomas') THEN 'Campo 7: data dos primeiros sintomas inválida ou no futuro.' END,
    CASE WHEN coalesce(f ->> 'nascimento', '') = '' AND coalesce(f ->> 'idade', '') = '' THEN 'Campos 9 e 10: data de nascimento ou idade.' END,
    CASE WHEN coalesce(f ->> 'nascimento', '') <> '' AND NOT private.data_iso_valida(f ->> 'nascimento') THEN 'Campo 9: data de nascimento inválida ou no futuro.' END,
    CASE WHEN coalesce(f ->> 'sexo', '') NOT IN ('M', 'F', 'I') THEN 'Campo 11: sexo.' END,
    CASE WHEN f ->> 'sexo' = 'F' AND coalesce(f ->> 'gestante', '') = '' THEN 'Campo 12: gestante (obrigatório para o sexo feminino).' END
  ], NULL)
$$;

-- Abre a notificação (vira agravo suspeito, que impede a alta). Com o item da
-- LNNC ou com o CID; se já há uma aberta do mesmo agravo no mesmo
-- atendimento, devolve a existente. A ficha já sai com o que o cadastro tem.
CREATE OR REPLACE FUNCTION public.abrir_notificacao(
  p_paciente uuid, p_item text DEFAULT NULL, p_cid text DEFAULT NULL, p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pa public.pacientes;
  v_cid text := private.cid_do_texto(p_cid);
  v_item text;
  v_lnnc public.lnnc_agravos;
  v_ep uuid := p_episodio;
  v_int uuid := p_internacao;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND OR NOT private.pode_notificar(pa.unidade_id) THEN
    RAISE EXCEPTION 'A notificação é aberta pela equipe de plantão da unidade ou pela gestão.';
  END IF;
  v_item := coalesce(nullif(btrim(p_item), ''), private.lnnc_item_do_cid(v_cid));
  SELECT * INTO v_lnnc FROM public.lnnc_agravos WHERE item = v_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agravo fora da lista de notificação compulsória (LNNC).'; END IF;
  IF p_cid IS NOT NULL AND v_cid IS NULL THEN RAISE EXCEPTION 'CID fora do formato (ex.: A90).'; END IF;

  IF v_ep IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios e WHERE e.id = v_ep AND e.paciente_id = pa.id) THEN
    RAISE EXCEPTION 'Atendimento não é deste paciente.';
  END IF;
  IF v_int IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.id = v_int AND i.paciente_id = pa.id) THEN
    RAISE EXCEPTION 'Internação não é deste paciente.';
  END IF;
  -- sem atendimento informado: o atual (caso aberto na hora, ex.: acidente de trabalho)
  IF v_ep IS NULL AND v_int IS NULL THEN
    IF NOT private.pode_atuar_no_paciente(pa.id) THEN
      RAISE EXCEPTION 'Paciente fora do seu cuidado agora: abra a notificação a partir do atendimento na lista.';
    END IF;
    v_ep := private.episodio_aberto(pa.id);
    v_int := private.internacao_ativa(pa.id);
  END IF;
  v_ep := coalesce(v_ep, (SELECT i.episodio_id FROM public.internacoes i WHERE i.id = v_int));
  v_int := coalesce(v_int, (SELECT i.id FROM public.internacoes i WHERE i.episodio_id = v_ep));

  SELECT a.id INTO v_id FROM public.agravos_notificacao a
   WHERE a.paciente_id = pa.id AND a.situacao IN ('suspeito', 'notificado')
     AND coalesce(a.lnnc_item, private.lnnc_item_do_cid(a.cid)) = v_item
     AND (a.episodio_id IS NOT DISTINCT FROM v_ep OR (v_int IS NOT NULL AND a.internacao_id = v_int))
   ORDER BY a.situacao = 'suspeito' DESC, a.suspeito_em DESC
   LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.agravos_notificacao
    (unidade_id, paciente_id, episodio_id, internacao_id, agravo, cid, suspeito_por, lnnc_item, origem, ficha)
  VALUES (pa.unidade_id, pa.id, v_ep, v_int, v_lnnc.agravo, v_cid, private.meu_perfil_id(), v_item,
          CASE WHEN v_cid IS NOT NULL THEN 'cid' ELSE 'manual' END,
          private.ficha_sinan_limpa(jsonb_build_object(
            'nome', pa.nome,
            'nascimento', to_char(pa.data_nascimento, 'YYYY-MM-DD'),
            'sexo', CASE WHEN upper(left(pa.sexo, 1)) IN ('M', 'F') THEN upper(left(pa.sexo, 1)) END,
            'gestante', CASE WHEN upper(left(pa.sexo, 1)) = 'M' THEN '6' END,
            'raca', CASE pa.raca_cor WHEN 'branca' THEN '1' WHEN 'preta' THEN '2' WHEN 'amarela' THEN '3'
                                     WHEN 'parda' THEN '4' WHEN 'indigena' THEN '5' WHEN 'sem_informacao' THEN '9' END,
            'cns', pa.cns, 'mae', pa.nome_mae, 'uf', pa.uf, 'municipio', pa.municipio,
            'logradouro', pa.endereco, 'telefone', pa.telefone)))
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('notificacao_aberta', 'agravos_notificacao', v_id, pa.unidade_id,
    jsonb_build_object('item', v_item, 'cid', v_cid));
  RETURN v_id;
END $$;

-- A ficha, para a tela: agravo, catálogo, paciente, unidade, notificador e o
-- que falta para registrar.
CREATE OR REPLACE FUNCTION public.notificacao_ficha(p_agravo uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.agravos_notificacao; v jsonb;
BEGIN
  SELECT * INTO a FROM public.agravos_notificacao WHERE id = p_agravo;
  IF NOT FOUND OR NOT private.pode_notificar(a.unidade_id) THEN RAISE EXCEPTION 'Notificação não encontrada.'; END IF;
  SELECT jsonb_build_object(
    'id', a.id, 'paciente_id', a.paciente_id, 'paciente_nome', pa.nome, 'episodio_id', a.episodio_id, 'internacao_id', a.internacao_id,
    'agravo', a.agravo, 'cid', a.cid, 'situacao', a.situacao, 'origem', a.origem, 'ficha', a.ficha,
    'numero_sinan', a.numero_sinan, 'suspeito_em', a.suspeito_em,
    'registrado_em', CASE WHEN a.situacao = 'notificado' THEN a.resolvido_em END,
    'registrado_por', CASE WHEN a.situacao = 'notificado' THEN rp.nome_completo END,
    'reaberto_em', a.reaberto_em, 'reaberto_por', rb.nome_completo, 'motivo_reabertura', a.motivo_reabertura,
    'motivo_descarte', a.motivo_descarte,
    'item', l.item, 'imediata', l.imediata, 'destino', l.destino, 'condicao', l.condicao, 'conferido', l.conferido_em IS NOT NULL,
    'unidade', jsonb_build_object('nome', u.nome, 'cnes', u.cnes, 'municipio', u.municipio, 'uf', u.uf),
    'notificador', jsonb_build_object('nome', eu.nome_completo, 'conselho', eu.conselho, 'registro', eu.registro_numero, 'registro_uf', eu.registro_uf),
    'pendencias', to_jsonb(private.ficha_sinan_pendencias(a.ficha)),
    'pode_abrir_paciente', private.pode_atuar_no_paciente(a.paciente_id))
  INTO v
  FROM public.pacientes pa
  JOIN public.unidades u ON u.id = a.unidade_id
  LEFT JOIN public.lnnc_agravos l ON l.item = coalesce(a.lnnc_item, private.lnnc_item_do_cid(a.cid))
  LEFT JOIN public.perfis rp ON rp.id = a.resolvido_por
  LEFT JOIN public.perfis rb ON rb.id = a.reaberto_por
  LEFT JOIN public.perfis eu ON eu.id = private.meu_perfil_id()
  WHERE pa.id = a.paciente_id;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.salvar_ficha_notificacao(p_agravo uuid, p_ficha jsonb)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.agravos_notificacao; v_ficha jsonb := private.ficha_sinan_limpa(p_ficha);
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.agravos_notificacao WHERE id = p_agravo FOR UPDATE;
  IF NOT FOUND OR NOT private.pode_notificar(a.unidade_id) THEN RAISE EXCEPTION 'Notificação não encontrada.'; END IF;
  IF a.situacao <> 'suspeito' THEN RAISE EXCEPTION 'Notificação já registrada: reabra para corrigir.'; END IF;
  UPDATE public.agravos_notificacao SET ficha = v_ficha WHERE id = a.id;
  RETURN private.ficha_sinan_pendencias(v_ficha);
END $$;

-- Registrar: grava a ficha, confere o que falta e marca notificado pelo login.
CREATE OR REPLACE FUNCTION public.registrar_notificacao(p_agravo uuid, p_ficha jsonb, p_numero_sinan text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a public.agravos_notificacao;
  v_ficha jsonb := private.ficha_sinan_limpa(p_ficha);
  v_falta text[];
  v_num text := nullif(regexp_replace(coalesce(p_numero_sinan, ''), '\s', '', 'g'), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.agravos_notificacao WHERE id = p_agravo FOR UPDATE;
  IF NOT FOUND OR NOT private.pode_notificar(a.unidade_id) THEN RAISE EXCEPTION 'Notificação não encontrada.'; END IF;
  IF a.situacao <> 'suspeito' THEN RAISE EXCEPTION 'Notificação já registrada ou descartada.'; END IF;
  v_falta := private.ficha_sinan_pendencias(v_ficha);
  IF cardinality(v_falta) > 0 THEN
    RAISE EXCEPTION 'Falta para registrar: %', array_to_string(v_falta, ' ');
  END IF;
  IF v_num IS NOT NULL AND v_num !~ '^[0-9]{1,20}$' THEN
    RAISE EXCEPTION 'Nº da notificação no SINAN: só números.';
  END IF;
  UPDATE public.agravos_notificacao
     SET ficha = v_ficha, situacao = 'notificado', numero_sinan = coalesce(v_num, a.numero_sinan),
         motivo_descarte = NULL, resolvido_por = private.meu_perfil_id(), resolvido_em = now()
   WHERE id = a.id;
  PERFORM private.registrar_auditoria('notificacao_registrada', 'agravos_notificacao', a.id, a.unidade_id,
    jsonb_build_object('item', a.lnnc_item, 'numero_sinan', coalesce(v_num, a.numero_sinan)));
END $$;

-- Reabrir para correção: volta a "a registrar" (e volta a impedir a alta de
-- quem ainda está no serviço). O motivo e quem reabriu ficam na linha e na
-- auditoria.
CREATE OR REPLACE FUNCTION public.reabrir_notificacao(p_agravo uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.agravos_notificacao;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.agravos_notificacao WHERE id = p_agravo FOR UPDATE;
  IF NOT FOUND OR NOT private.pode_notificar(a.unidade_id) THEN RAISE EXCEPTION 'Notificação não encontrada.'; END IF;
  IF a.situacao <> 'notificado' THEN RAISE EXCEPTION 'Só a notificação registrada pode ser reaberta.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Reabrir para correção exige motivo (mínimo de 10 letras).';
  END IF;
  UPDATE public.agravos_notificacao
     SET situacao = 'suspeito', reaberto_por = private.meu_perfil_id(), reaberto_em = now(),
         motivo_reabertura = btrim(p_motivo), resolvido_por = NULL, resolvido_em = NULL
   WHERE id = a.id;
  PERFORM private.registrar_auditoria('notificacao_reaberta', 'agravos_notificacao', a.id, a.unidade_id,
    jsonb_build_object('motivo', btrim(p_motivo), 'registrada_em', a.resolvido_em, 'registrada_por', a.resolvido_por));
END $$;

-- ── lista por período (tela e folha 08) ─────────────────────────────────────
-- Atendimentos da unidade com CID notificável (diagnóstico da porta ou do
-- leito, CID do atendimento, CID da alta) e as notificações abertas. O
-- período é o da DATA DO ATENDIMENTO (chegada do episódio; sem episódio, a
-- admissão), não o do registro do CID. `situacao`:
--   sugerido     CID notificável, ninguém abriu a notificação ainda
--   a_registrar  notificação aberta, sem registro (impede a alta)
--   reaberto     registrada e reaberta para correção (impede a alta)
--   notificado   registrada
--   descartado   suspeita descartada com motivo
CREATE OR REPLACE FUNCTION public.notificacao_compulsoria_periodo(
  p_unidade uuid, p_de date DEFAULT NULL, p_ate date DEFAULT NULL, p_cids text[] DEFAULT NULL)
RETURNS TABLE (
  chave text, atendimento_em timestamptz, paciente_id uuid, paciente_nome text, local text, origem text,
  episodio_id uuid, internacao_id uuid, cid text, cid_descricao text,
  item text, item_numero int, agravo text, imediata boolean, destino text, condicao text, conferido boolean,
  agravo_id uuid, situacao text, numero_sinan text, registrado_por text, registrado_em timestamptz,
  reaberto_em timestamptz, motivo_reabertura text, pendencias text[], no_acesso boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_ate date := coalesce(p_ate, private.data_atual());
  v_filtro text[];
BEGIN
  IF NOT private.pode_notificar(p_unidade) THEN
    RAISE EXCEPTION 'A lista de notificação compulsória é da equipe de plantão da unidade e da gestão.';
  END IF;
  IF p_de IS NOT NULL AND p_de > v_ate THEN RAISE EXCEPTION 'Período: a data inicial é depois da final.'; END IF;
  SELECT array_agg(DISTINCT private.cid_do_texto(c)) FILTER (WHERE private.cid_do_texto(c) IS NOT NULL)
    INTO v_filtro FROM unnest(coalesce(p_cids, '{}'::text[])) c;

  RETURN QUERY
  WITH det AS (
    SELECT d.paciente_id AS pac, d.episodio_id AS ep, d.internacao_id AS it, d.cid AS cid, d.descricao AS descr, d.registrado_em AS em,
           CASE WHEN d.internacao_id IS NOT NULL THEN 'Diagnóstico do leito' ELSE 'Diagnóstico da porta' END AS org
      FROM public.diagnosticos_episodio d
     WHERE d.unidade_id = p_unidade AND d.encerramento IS DISTINCT FROM 'retirado'
    UNION ALL
    SELECT r.paciente_id, r.episodio_id, NULL::uuid, private.cid_normalizado(r.cid), NULL::text, r.criado_em, 'CID do atendimento'
      FROM public.atendimento_registros r
     WHERE r.unidade_id = p_unidade AND r.cid IS NOT NULL
    UNION ALL
    SELECT i.paciente_id, i.episodio_id, i.id, private.cid_normalizado(i.cid_alta), NULL::text, coalesce(i.alta_registrada_em, i.data_alta, i.updated_at), 'CID da alta'
      FROM public.internacoes i
     WHERE i.unidade_id = p_unidade AND i.cid_alta IS NOT NULL
  ),
  det2 AS (
    SELECT x.*, private.lnnc_item_do_cid(x.cid) AS itm,
           coalesce(x.ep, (SELECT i.episodio_id FROM public.internacoes i WHERE i.id = x.it)) AS ep2,
           coalesce(x.it, (SELECT i.id FROM public.internacoes i WHERE i.episodio_id = x.ep)) AS it2
      FROM det x
  ),
  agr AS (
    SELECT a.*, coalesce(a.lnnc_item, private.lnnc_item_do_cid(a.cid)) AS itm,
           coalesce(a.episodio_id, (SELECT i.episodio_id FROM public.internacoes i WHERE i.id = a.internacao_id)) AS ep2,
           coalesce(a.internacao_id, (SELECT i.id FROM public.internacoes i WHERE i.episodio_id = a.episodio_id)) AS it2
      FROM public.agravos_notificacao a
     WHERE a.unidade_id = p_unidade
  ),
  casos AS (
    -- notificações abertas (qualquer situação)
    SELECT 'agravo:' || a.id AS chv, a.paciente_id AS pac, a.ep2, a.it2, a.cid, NULL::text AS descr, a.itm, a.agravo AS nome_agravo,
           CASE a.origem WHEN 'manual' THEN 'Aberta na notificação' WHEN 'cid' THEN 'Aberta pelo CID' ELSE 'Suspeita marcada pelo médico' END AS org,
           a.id AS agr_id, a.suspeito_em AS em,
           CASE WHEN a.situacao = 'notificado' THEN 'notificado' WHEN a.situacao = 'descartado' THEN 'descartado'
                WHEN a.reaberto_em IS NOT NULL THEN 'reaberto' ELSE 'a_registrar' END AS sit,
           a.numero_sinan AS num, a.resolvido_por AS reg_por, CASE WHEN a.situacao = 'notificado' THEN a.resolvido_em END AS reg_em,
           a.reaberto_em AS reab_em, a.motivo_reabertura AS reab_mot,
           CASE WHEN a.situacao = 'suspeito' THEN private.ficha_sinan_pendencias(a.ficha) END AS pend
      FROM agr a
    UNION ALL
    -- CID notificável sem notificação aberta do mesmo agravo no mesmo atendimento: só sugestão
    (SELECT DISTINCT ON (coalesce(d.ep2, d.it2), d.itm)
           'cid:' || coalesce(d.ep2, d.it2) || ':' || d.itm, d.pac, d.ep2, d.it2, d.cid, d.descr, d.itm, NULL::text, d.org,
           NULL::uuid, d.em, 'sugerido', NULL::text, NULL::uuid, NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::text[]
      FROM det2 d
     WHERE d.itm IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM agr a
                        WHERE a.itm = d.itm AND a.paciente_id = d.pac
                          AND (a.ep2 = d.ep2 OR a.it2 = d.it2))
     ORDER BY coalesce(d.ep2, d.it2), d.itm, d.em)
  )
  SELECT c.chv,
         coalesce(e.chegada_em, i.data_admissao, c.em) AS quando,
         c.pac, pa.nome,
         CASE WHEN i.id IS NOT NULL AND i.status IN ('admitido', 'em_observacao', 'internado')
              THEN concat_ws(' · ', si.nome, CASE WHEN le.identificador IS NOT NULL THEN 'Leito ' || le.identificador END)
              WHEN e.id IS NOT NULL THEN concat_ws(' · ', se.nome, CASE WHEN e.etapa = 'encerrado' OR e.desfecho IS NOT NULL THEN 'atendimento encerrado' END)
              ELSE si.nome END,
         c.org, c.ep2, c.it2, c.cid,
         coalesce(c.descr, (SELECT t.descricao FROM terminologia.cid10 t WHERE t.codigo IN (c.cid, replace(c.cid, '.', '')) LIMIT 1)),
         l.item, l.numero, coalesce(l.agravo, c.nome_agravo), coalesce(l.imediata, false), l.destino, l.condicao, l.conferido_em IS NOT NULL,
         c.agr_id, c.sit, c.num, rp.nome_completo, c.reg_em, c.reab_em, c.reab_mot, c.pend,
         private.pode_atuar_no_paciente(c.pac)
    FROM casos c
    JOIN public.pacientes pa ON pa.id = c.pac
    LEFT JOIN public.episodios e ON e.id = c.ep2
    LEFT JOIN public.internacoes i ON i.id = c.it2
    LEFT JOIN public.setores se ON se.id = e.setor_id
    LEFT JOIN public.setores si ON si.id = i.setor_atual_id
    LEFT JOIN public.leitos le ON le.id = i.leito_atual_id
    LEFT JOIN public.lnnc_agravos l ON l.item = c.itm
    LEFT JOIN public.perfis rp ON rp.id = c.reg_por
   WHERE (p_de IS NULL OR (coalesce(e.chegada_em, i.data_admissao, c.em) AT TIME ZONE 'America/Sao_Paulo')::date >= p_de)
     AND (coalesce(e.chegada_em, i.data_admissao, c.em) AT TIME ZONE 'America/Sao_Paulo')::date <= v_ate
     AND (v_filtro IS NULL OR EXISTS (SELECT 1 FROM unnest(v_filtro) f WHERE c.cid = f OR starts_with(c.cid, f || CASE WHEN length(f) = 3 THEN '.' ELSE '' END)))
   ORDER BY (c.sit IN ('sugerido', 'a_registrar', 'reaberto')) DESC, coalesce(l.imediata, false) DESC, 2 DESC;
END $$;
COMMENT ON FUNCTION public.notificacao_compulsoria_periodo(uuid, date, date, text[]) IS
  'Atendimentos da unidade com CID notificável e notificações abertas, pelo período da data do atendimento. Tela Notificação compulsória e folha 08 (atendimentos notificáveis).';

-- ── permissões ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.notificacao_compulsoria_dos_cids(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notificacao_compulsoria_periodo(uuid, date, date, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notificacao_ficha(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.abrir_notificacao(uuid, text, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.salvar_ficha_notificacao(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_notificacao(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reabrir_notificacao(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.pode_notificar(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.lnnc_item_do_cid(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notificacao_compulsoria_dos_cids(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notificacao_compulsoria_periodo(uuid, date, date, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notificacao_ficha(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.abrir_notificacao(uuid, text, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_ficha_notificacao(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_notificacao(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reabrir_notificacao(uuid, text) TO authenticated;
