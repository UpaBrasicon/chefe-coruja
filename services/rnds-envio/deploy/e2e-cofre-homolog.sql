-- ─────────────────────────────────────────────────────────────────────────────
-- Teste ponta a ponta da 5.4b: o certificado sai do cofre.
--
-- Usa a "Rede RNDS E2E (teste)" da 5.3c (e2e-homolog.sql), só na HOMOLOGAÇÃO.
-- 1. Este arquivo cria a credencial da UPA E2E e devolve a chave pública ativa.
-- 2. No VPS, o .pfx do simulador é cifrado com simulador/cifrar.ts, como o
--    navegador faria, e gravado na credencial (infra/rnds-envio.md, 5.4b).
-- 3. O serviço lê o certificado no ciclo seguinte e o usa no envio. Para ter o
--    que enviar, um atendimento novo da porta, com alta, entra na fila.
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.rnds_credenciais (id, nome, unidade_principal_id, ambiente, identificador_solicitante)
VALUES ('00000000-0000-4000-8000-00000000e511', 'Credencial E2E (teste)', '00000000-0000-4000-8000-00000000e502',
        'homologacao', '99999')
ON CONFLICT (id) DO NOTHING;
UPDATE public.rnds_config_unidade SET credencial_id = '00000000-0000-4000-8000-00000000e511', atualizado_em = now()
 WHERE unidade_id = '00000000-0000-4000-8000-00000000e502';

-- um atendimento novo da porta, com alta, para o envio com o certificado do cofre
DO $$
DECLARE
  un    uuid := '00000000-0000-4000-8000-00000000e502';
  setor uuid := '00000000-0000-4000-8000-00000000e503';
  pac   uuid := '00000000-0000-4000-8000-00000000e504';
  med   uuid := '00000000-0000-4000-8000-00000000e505';
  ep    uuid := '00000000-0000-4000-8000-00000000e512';
  h0 timestamptz := date_trunc('hour', now()) - interval '3 hours';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = ep) THEN
    INSERT INTO public.episodios (id, unidade_id, paciente_id, setor_id, queixa, aberto_por, etapa, chegada_em,
      atendimento_medico_id, atendimento_iniciado_em, desfecho, desfecho_em, desfecho_por, encerrado_em, encerrado_por)
    VALUES (ep, un, pac, setor, 'Dor lombar', med, 'encerrado', h0, med, h0 + interval '10 minutes',
      'alta', h0 + interval '1 hour', med, h0 + interval '1 hour', med);
    INSERT INTO public.diagnosticos_episodio (unidade_id, paciente_id, episodio_id, tipo, cid, status, registrado_por, registrado_em)
    VALUES (un, pac, ep, 'primario', 'M54.5', 'confirmado', med, h0 + interval '20 minutes');
    INSERT INTO public.procedimentos_realizados (unidade_id, paciente_id, episodio_id, procedimento, quantidade, realizado_em,
      profissional_id, cbo, via, registrado_por)
    VALUES (un, pac, ep, '0301060096', 1, h0 + interval '10 minutes', med, '225125', 'quem_fez', med);
  END IF;
  PERFORM private.enfileirar_documento(un, 'rac', ep,
    jsonb_build_object('resourceType', 'Bundle', 'marcador', true, 'tipo_provisorio', 'rac'));
END $$;

SELECT jsonb_build_object('id', id, 'jwk', jwk) AS chave_publica FROM public.rnds_chaves_publicas WHERE ativa;
