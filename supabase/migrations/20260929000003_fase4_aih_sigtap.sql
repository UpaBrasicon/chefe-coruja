-- Fase 4.3 — laudo de AIH com SIGTAP e CID servidos pelo banco.
--
--  * Compatibilidade procedimento × CID do SIGTAP (DATASUS, Tabela
--    Unificada, rl_procedimento_cid) — carregada por supabase/dados/sigtap_cid.sql
--    (gerado por scripts/gerar-sigtap-cid-sql.mjs), na mesma competência da
--    tabela de procedimentos já carregada.
--  * A lista de procedimentos é filtrada pelo CID principal.
--  * conferir_aih AVISA risco de glosa e NÃO bloqueia (regra do protótipo):
--    CID e procedimento existem, são compatíveis, CID aceito como principal,
--    sexo e idade do procedimento, CID S/T com causa externa (V01–Y98).

CREATE TABLE IF NOT EXISTS terminologia.sigtap_procedimento_cid (
  procedimento text NOT NULL,
  cid          text NOT NULL,
  principal    boolean NOT NULL,
  competencia  text NOT NULL,
  PRIMARY KEY (procedimento, cid)
);
CREATE INDEX IF NOT EXISTS sigtap_procedimento_cid_cid ON terminologia.sigtap_procedimento_cid (cid);
GRANT SELECT ON terminologia.sigtap_procedimento_cid TO authenticated;

-- Procedimentos do SIGTAP para um CID (compatíveis primeiro), com busca por texto.
CREATE OR REPLACE FUNCTION public.procedimentos_do_cid(p_cid text, p_termo text DEFAULT NULL, p_limite int DEFAULT 30)
RETURNS TABLE (codigo text, nome text, compativel boolean, como_principal boolean, sexo text,
               idade_min int, idade_max int, competencia text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT sp.codigo, sp.nome, rc.procedimento IS NOT NULL, coalesce(rc.principal, false), sp.sexo,
         sp.idade_min, sp.idade_max, sp.competencia
  FROM terminologia.sigtap_procedimento sp
  LEFT JOIN terminologia.sigtap_procedimento_cid rc
    ON rc.procedimento = sp.codigo AND rc.cid = private.cid_normalizado(p_cid)
  WHERE (private.cid_normalizado(p_cid) IS NULL OR rc.procedimento IS NOT NULL)
    AND (nullif(btrim(p_termo), '') IS NULL
         OR sp.codigo LIKE regexp_replace(p_termo, '\D', '', 'g') || '%' AND regexp_replace(p_termo, '\D', '', 'g') <> ''
         OR terminologia.unaccent_text(lower(sp.nome)) LIKE '%' || terminologia.unaccent_text(lower(btrim(p_termo))) || '%')
  ORDER BY coalesce(rc.principal, false) DESC, sp.nome
  LIMIT greatest(1, least(coalesce(p_limite, 30), 100))
$$;
REVOKE ALL ON FUNCTION public.procedimentos_do_cid(text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procedimentos_do_cid(text, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.conferir_aih(
  p_paciente uuid, p_cid_principal text, p_cid_secundario text DEFAULT NULL, p_cid_causa text DEFAULT NULL,
  p_procedimento text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  avisos jsonb := '[]'::jsonb;
  v_cid text := private.cid_normalizado(p_cid_principal);
  v_sec text := private.cid_normalizado(p_cid_secundario);
  v_causa text := private.cid_normalizado(p_cid_causa);
  v_proc text := nullif(regexp_replace(coalesce(p_procedimento, ''), '\D', '', 'g'), '');
  sp terminologia.sigtap_procedimento;
  rc terminologia.sigtap_procedimento_cid;
  pa public.pacientes;
  v_meses int;
  av text;
BEGIN
  IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;

  IF v_cid IS NULL THEN
    avisos := avisos || jsonb_build_object('campo', '24', 'texto', 'CID principal ausente ou fora do formato (ex.: J18.9).');
  ELSIF NOT EXISTS (SELECT 1 FROM terminologia.cid10 WHERE codigo = v_cid) THEN
    avisos := avisos || jsonb_build_object('campo', '24', 'texto', 'CID principal ' || v_cid || ' não existe na tabela CID-10.');
  END IF;
  IF p_cid_secundario IS NOT NULL AND btrim(p_cid_secundario) <> '' AND
     (v_sec IS NULL OR NOT EXISTS (SELECT 1 FROM terminologia.cid10 WHERE codigo = v_sec)) THEN
    avisos := avisos || jsonb_build_object('campo', '25', 'texto', 'CID secundário não encontrado na tabela CID-10.');
  END IF;
  IF v_cid ~ '^[ST]' AND (v_causa IS NULL OR left(v_causa, 3) NOT BETWEEN 'V01' AND 'Y98') THEN
    avisos := avisos || jsonb_build_object('campo', '26', 'texto', 'CID principal de lesão/envenenamento (S/T): informe a causa externa (V01–Y98) no campo 26.');
  END IF;

  IF v_proc IS NULL THEN
    avisos := avisos || jsonb_build_object('campo', '28', 'texto', 'Código do procedimento ausente.');
  ELSE
    SELECT * INTO sp FROM terminologia.sigtap_procedimento WHERE codigo = v_proc;
    IF NOT FOUND THEN
      avisos := avisos || jsonb_build_object('campo', '28', 'texto', 'Procedimento ' || v_proc || ' não existe no SIGTAP carregado.');
    ELSE
      IF v_cid IS NOT NULL THEN
        SELECT * INTO rc FROM terminologia.sigtap_procedimento_cid WHERE procedimento = v_proc AND cid = v_cid;
        IF NOT FOUND THEN
          avisos := avisos || jsonb_build_object('campo', '28', 'texto', 'Procedimento não é compatível com o CID ' || v_cid || ' no SIGTAP (risco de glosa).');
        ELSIF NOT rc.principal THEN
          avisos := avisos || jsonb_build_object('campo', '24', 'texto', 'O CID ' || v_cid || ' é compatível com o procedimento só como secundário.');
        END IF;
      END IF;
      IF sp.sexo IN ('M', 'F') AND pa.sexo IN ('M', 'F') AND sp.sexo <> pa.sexo THEN
        avisos := avisos || jsonb_build_object('campo', '28', 'texto',
          'Procedimento exclusivo do sexo ' || CASE sp.sexo WHEN 'M' THEN 'masculino' ELSE 'feminino' END || '.');
      END IF;
      IF pa.data_nascimento IS NOT NULL THEN
        v_meses := (extract(year FROM age(current_date, pa.data_nascimento)) * 12 + extract(month FROM age(current_date, pa.data_nascimento)))::int;
        IF (sp.idade_min IS NOT NULL AND v_meses < sp.idade_min) OR (sp.idade_max IS NOT NULL AND v_meses > sp.idade_max) THEN
          avisos := avisos || jsonb_build_object('campo', '28', 'texto',
            'Idade do paciente fora da faixa do procedimento no SIGTAP (' || coalesce(sp.idade_min, 0) || ' a ' || coalesce(sp.idade_max, 0) || ' meses).');
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'avisos', avisos,
    'competencia', (SELECT max(competencia) FROM terminologia.sigtap_procedimento_cid),
    'nota', 'Conferência de risco de glosa: avisa, não impede. Fonte: SIGTAP (DATASUS) e CID-10 carregados no banco.');
END $$;
REVOKE ALL ON FUNCTION public.conferir_aih(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conferir_aih(uuid, text, text, text, text) TO authenticated;
