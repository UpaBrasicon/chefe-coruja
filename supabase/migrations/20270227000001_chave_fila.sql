-- Chave da fila sem conexão vinda do servidor (achado guardado de 07/10/2026,
-- item 4 do lote de segurança; A em O1 a O5 pelo RT em 05/11/2026;
-- docs/porta/CHAVE-FILA-SERVIDOR-DIAGNOSTICO.md).
--
-- A fila sem conexão (ADR 0009) era cifrada com uma chave gerada no navegador
-- e guardada nele para sempre: num computador compartilhado, um script da
-- origem podia usá-la para ler a fila ainda não enviada de outra pessoa.
-- Agora a chave é POR PESSOA, fixa (O1), guardada aqui e entregue só depois do
-- login com segundo fator; o navegador a mantém na memória e numa cópia da aba.
--   • chave_fila(): devolve a chave da pessoa logada (cria na primeira vez);
--   • trocar_chave_fila(p_perfil): aparelho perdido (O5) — só administrador da
--     unidade da pessoa ou administrador geral; a fila que ficou no aparelho
--     vira texto ilegível de propósito. Fica na auditoria.
-- Só aditiva (expand).
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.trocar_chave_fila(uuid), public.chave_fila();
--   DROP TABLE IF EXISTS private.chave_fila;
CREATE TABLE IF NOT EXISTS private.chave_fila (
  perfil_id  uuid PRIMARY KEY REFERENCES public.perfis(id) ON DELETE CASCADE,
  chave      bytea NOT NULL DEFAULT extensions.gen_random_bytes(32),
  criada_em  timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.chave_fila FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.chave_fila()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_chave bytea;
BEGIN
  IF v_perfil IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM private.exigir_segundo_fator();
  INSERT INTO private.chave_fila (perfil_id) VALUES (v_perfil) ON CONFLICT (perfil_id) DO NOTHING;
  SELECT c.chave INTO v_chave FROM private.chave_fila c WHERE c.perfil_id = v_perfil;
  RETURN encode(v_chave, 'base64');
END; $$;
REVOKE ALL ON FUNCTION public.chave_fila() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chave_fila() TO authenticated;

CREATE OR REPLACE FUNCTION public.trocar_chave_fila(p_perfil uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  -- administrador de uma unidade onde a pessoa tem vínculo ativo, ou administrador geral
  SELECT v.unidade_id INTO v_unidade
    FROM public.vinculos v
   WHERE v.perfil_id = p_perfil AND v.ativo AND private.tenho_papel(v.unidade_id, 'admin')
   LIMIT 1;
  IF v_unidade IS NULL AND private.eh_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: só o administrador troca a chave da fila.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE private.chave_fila SET chave = extensions.gen_random_bytes(32), criada_em = now() WHERE perfil_id = p_perfil;
  PERFORM private.registrar_auditoria('chave_fila_trocada', 'perfis', p_perfil, v_unidade, NULL);
END; $$;
REVOKE ALL ON FUNCTION public.trocar_chave_fila(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trocar_chave_fila(uuid) TO authenticated;
