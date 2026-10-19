-- Fase 5C, etapa 1.2: o resultado registrado antes das versões (só texto no
-- pedido) vira a versão 1, manual, com o autor e a hora de quando foi
-- registrado. Já conta como visto: não aparece como "novo".
INSERT INTO public.exame_resultados (exame_id, versao, origem, texto, liberado_em, registrado_por)
SELECT e.id, 1, 'manual', coalesce(nullif(btrim(e.resultado), ''), 'Resultado disponível'), coalesce(e.resolvido_em, e.pedido_em), e.resolvido_por
  FROM public.exames_pedidos e
 WHERE e.situacao = 'resultado'
   AND NOT EXISTS (SELECT 1 FROM public.exame_resultados r WHERE r.exame_id = e.id);

UPDATE public.exames_pedidos
   SET resultado_origem = 'manual', resultado_visto_em = coalesce(resolvido_em, pedido_em)
 WHERE situacao = 'resultado' AND resultado_origem IS NULL;
