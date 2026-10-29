-- ─────────────────────────────────────────────────────────────────────────────
-- Teste ponta a ponta da 5.4b: o certificado sai do cofre.
--
-- Usa a "Rede RNDS E2E (teste)" da 5.3c (e2e-homolog.sql), só na HOMOLOGAÇÃO.
-- 1. Este arquivo cria a credencial da UPA E2E e devolve a chave pública ativa.
-- 2. No VPS, o .pfx do simulador é cifrado com simulador/cifrar.ts, como o
--    navegador faria, e gravado na credencial (infra/rnds-envio.md, 5.4b).
-- 3. O serviço lê o certificado no ciclo seguinte e o usa no envio.
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.rnds_credenciais (id, nome, unidade_principal_id, ambiente, identificador_solicitante)
VALUES ('00000000-0000-4000-8000-00000000e511', 'Credencial E2E (teste)', '00000000-0000-4000-8000-00000000e502',
        'homologacao', '99999')
ON CONFLICT (id) DO NOTHING;
UPDATE public.rnds_config_unidade SET credencial_id = '00000000-0000-4000-8000-00000000e511', atualizado_em = now()
 WHERE unidade_id = '00000000-0000-4000-8000-00000000e502';

SELECT jsonb_build_object('id', id, 'jwk', jwk) AS chave_publica FROM public.rnds_chaves_publicas WHERE ativa;
