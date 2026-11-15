-- ════════════════════════════════════════════════════════════════════════════
-- Trilha de segurança, S2 (contract): retira a aceitar_convite antiga, que
-- aplicava o convite sem limite de tentativas. Aplicar DEPOIS da tela nova no
-- ar (ela usa aceitar_convite_com_limite, de 20270414000057).
--
-- Reaplicável. Rollback: a aceitar_convite de 20261003000001 (seção "Quem já
-- tem conta e recebeu convite") e o nome dela de volta no portão.
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.aceitar_convite(text, text, text, text, date, text, text, text);

CREATE OR REPLACE FUNCTION public.portao_requisicao()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caminho text;
  v_metodo  text;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'authenticated' THEN
    RETURN;                                   -- anon (painel da TV) e service_role: fora
  END IF;
  IF private.segundo_fator_ok() THEN
    RETURN;                                   -- chave desligada ou 2FA válido
  END IF;
  v_caminho := coalesce(current_setting('request.path', true), '');
  v_metodo  := upper(coalesce(current_setting('request.method', true), ''));
  IF v_caminho LIKE '/rpc/%' THEN
    IF split_part(substr(v_caminho, 6), '?', 1) IN (
         'segundo_fator_status', 'segundo_fator_tentativas',
         'verificar_codigo_2fa', 'verificar_dispositivo_2fa', 'herdar_segundo_fator',
         'usar_codigo_recuperacao',
         'conferir_convite', 'aceitar_convite_com_limite',
         'horario_servidor', 'data_atual', 'registrar_erro_cliente') THEN
      RETURN;
    END IF;
  ELSIF v_metodo IN ('GET', 'HEAD', 'OPTIONS') THEN
    RETURN;                                   -- leitura de tabela: decide a RLS
  END IF;
  RAISE EXCEPTION 'SEGUNDO_FATOR: confirme o código do segundo fator para continuar.'
    USING ERRCODE = 'insufficient_privilege';
END; $$;
REVOKE ALL ON FUNCTION public.portao_requisicao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portao_requisicao() TO anon, authenticated, service_role;
