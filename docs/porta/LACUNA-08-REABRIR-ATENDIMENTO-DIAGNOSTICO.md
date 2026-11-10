# Lacuna 8: reabrir o atendimento depois do desfecho (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 8 (P2). O RT liberou esta
lacuna em paralelo com a lacuna 9. Origem: relatório do teste de ponta a ponta
de 11/10/2026, passo `3.reabrir_atendimento` ("Não há RPC. Depois do
desfecho, o atendimento fica bloqueado").

## 1. Fontes (conferidas em 10/11/2026)

- **Res. CFM 1.638/2002 (prontuário):** pede o registro com data, hora e
  identificação de quem fez (art. 5º, I, c). Não trata de corrigir nem de
  reabrir.
- **Res. CFM 1.821/2007 (prontuário eletrônico):** guarda permanente e
  certificação. Não trata de corrigir.
- **Código de Ética Médica, art. 87, §1º:** registro em ordem cronológica,
  com data, hora, assinatura e CRM.
- **Lei 13.787/2018, art. 4º:** o prontuário digital deve ser protegido de
  alteração não autorizada.
- **Res. COFEN 754/2024:** revogou a 429/2012. Não trata de corrigir.
- **Conclusão:** nenhuma norma define a reabertura nem um prazo para ela.
  - A regra "acrescentar sem sobrescrever, com quem, quando e por quê" vem do
    CEM e da Lei 13.787.
  - O projeto já segue essa regra desde a Fase 1: "retificação, nunca
    apagamento".

## 2. Estado atual (master em 10/11/2026)

**Na porta:**
- O desfecho registrado pela porta fecha:
  - as prescrições;
  - os pareceres;
  - o rascunho do SOAP;
  - na transferência e no óbito, os exames sem resultado;
  - por gatilho: isolamento, contenção e contrarreferência à UBS.
- O desfecho também dispara para fora do sistema:
  - a fila da RNDS;
  - o webhook `atendimento.encerrado`.
- **Na porta não há como desfazer o desfecho.** As colunas do desfecho são
  sobrescritas, e não existe histórico.

**Na observação e na internação:** já existe `cancelar_alta`.
- Quem pode usar: o autor ou o gestor.
- Prazo: até 24 h.
- Justificativa obrigatória.
- O que volta: o status, o leito e as prescrições.
- O que fica anulado: o pacote de alta, o óbito e a contrarreferência.

**Casos que travam a reabertura:**
- o paciente tem outro atendimento aberto (só um por paciente);
- a conta está fechada ou a competência do BPA está fechada;
- o RAC já está na fila da RNDS;
- a transferência já chegou ao destino;
- o óbito da porta (não há anulação para a porta).

**Achado à parte:** `cancelar_alta` confere o gestor com
`papel_na_unidade(...) = 'gestor'`. A regra do projeto é usar
`tenho_papel`.

## 3. Pontos para o RT decidir (recomendação em A)

### R1. Quem reabre
- **A:** o médico que registrou o desfecho ou o gestor da unidade, com
  segundo fator, como no `cancelar_alta`.

### R2. Prazo
- **A:** até 24 h depois do desfecho, igual à alta.
  - Depois disso, o paciente volta por uma ficha nova.
  - A mensagem de erro passa a dizer isso. Hoje ela manda "falar com o
    gestor", que também não consegue.

### R3. Motivo
- **A:** obrigatório, escolhido numa lista:
  - erro de registro;
  - paciente voltou;
  - desfecho errado;
  - outro, com texto de 10 letras ou mais.

### R4. Quais desfechos reabrem
- **A:**
  - **Reabrem:** alta, alta após medicação, alta a pedido e evasão.
  - **Transferência:** reabre só se a saída ainda não foi marcada na
    regulação.
  - **Não reabrem:**
    - óbito (a anulação do óbito na porta fica para depois);
    - "cancelado" (retirado da fila);
    - observação e internação, que já usam o `cancelar_alta`.

### R5. Reabrir o mesmo atendimento
- **A:** o atendimento volta à etapa "atendimento".
  - O desfecho anterior fica guardado numa tabela nova de eventos do
    atendimento, com quem, quando e o motivo. Nada é apagado.
  - A reabertura é recusada se o paciente já tem outro atendimento aberto.
- **B:** só corrigir o tipo do desfecho, sem reabrir.

### R6. O que volta
- **A:**
  - **Prescrições:** voltam só os itens ainda dentro da validade de 24 h. Os
    vencidos ficam fechados (lacuna 6).
  - **Não voltam:** exames e pareceres cancelados (o médico pede de novo),
    isolamento, contenção e o rascunho do SOAP.
  - A tela avisa o que não volta antes de confirmar.

### R7. Efeitos fora do atendimento
- **A:**
  - **Conta fechada, faturada ou competência do BPA fechada:** a reabertura
    é recusada até o faturamento ou o gestor reabrir a conta.
  - **RNDS:** o RAC ainda pendente é descartado. Se já foi enviado, fica
    registrado.
  - **Webhook:** evento novo `atendimento.reaberto`.
  - **Contrarreferência à UBS:** cancelada; a UBS vê como cancelada.
  - **Documentos já emitidos:** continuam valendo. A tela avisa o médico de
    que pode cancelá-los.

### R8. Registro e onde aparece
- **A:**
  - selo "reaberto" em "Finalizados" e na linha do tempo do prontuário, com
    o desfecho anterior visível;
  - auditoria só com ids e códigos.

### R9. Tela
- **A:** ação "Reabrir" na linha de "Finalizados" da porta, para o autor do
  desfecho e o gestor. Depois de reaberto, o atendimento abre de novo na
  janela.

### R10. Achado do `cancelar_alta`
- **A:** trocar `papel_na_unidade(...) = 'gestor'` por `tenho_papel`, na
  mesma migration.

## 4. Fora do escopo
- Anulação do óbito da porta.
- Reabrir depois de 24 h.
- Desfazer a chegada no destino de uma transferência.

## 5. Decisão do RT (10/11/2026)

"Sim": A em R1 a R10.

## 6. Implementação (10/11/2026, branch `lacunas/reabrir-atendimento`)

### Banco: `supabase/migrations/20270330000001_reabrir_atendimento.sql`
- **R5, tabela nova `public.episodio_eventos`** (só expande):
  - uma linha por reabertura, com a fotografia do desfecho desfeito
    (desfecho, relato, detalhes, hora, autor e encerramento), quem reabriu
    (o login), quando, o motivo e o detalhe;
  - `efeitos` guarda o que voltou e o que não voltou, o RAC e a
    contrarreferência;
  - RLS: lê quem vê o atendimento (a política consulta `episodios` pelo RLS
    de quem lê), com o segundo fator; `authenticated` só tem SELECT;
  - só inserção: um gatilho recusa UPDATE até do dono, e o DELETE cai na
    guarda de 20 anos.
- **R1 a R7, `public.reabrir_atendimento(episódio, motivo, detalhe)`:**
  segundo fator. As recusas vêm de `private.reabertura_recusa`, nesta ordem:
  - ainda aberto: "O atendimento não está encerrado.";
  - quem: o autor do desfecho (`desfecho_por`) ou o gestor da unidade
    (`tenho_papel`). Outro médico, a enfermagem e a recepção não reabrem;
  - só a porta. A consulta da UBS encerra pela conduta e mexe na agenda, no
    Hiperdia e no pré-natal, e esses gatilhos não se desfazem aqui;
  - observação e internação ("use o Cancelar alta"), óbito, "cancelado" e
    quem saiu da fila sem desfecho médico (ficha nova);
  - mais de 24 h do encerramento: "o paciente volta por uma ficha nova";
  - outro atendimento aberto, ou internação ou observação ativa do paciente;
  - conta fechada ou faturada; competência do BPA fechada (a do início do
    atendimento ou a do desfecho);
  - transferência com a saída marcada ou a chegada registrada na regulação
    (a regulação do desfecho, a do episódio ou a do paciente nesta origem
    depois da chegada). Sem regulação, ou com a regulação antes da saída,
    reabre.
- **R3:** motivo `erro_registro`, `paciente_voltou`, `desfecho_errado` ou
  `outro` (este com 10 letras ou mais). O detalhe vai até 500 letras.
- **R5:** o mesmo episódio volta à etapa "atendimento" e as colunas do
  desfecho ficam vazias (a fotografia está no evento). O médico que abriu o
  atendimento e a hora de início não mudam. O atendimento fecha de novo pelo
  `registrar_desfecho` de sempre, e os gatilhos valem outra vez: RAC novo,
  webhook de encerrado, prescrição encerrada, contrarreferência nova.
- **R6:** volta a prescrição encerrada por este desfecho que tem item na
  validade (`valida_ate`; o "Agora", sem validade, vale 24 h da prescrição).
  Na prescrição que volta, o item vencido e o de contenção ficam suspensos
  com o motivo. A prescrição só com item vencido fica encerrada. Não voltam:
  exames e pareceres cancelados, isolamento, contenção e o rascunho do SOAP.
- **R7:**
  - RAC pendente, retido ou com erro: descartado. O já enviado fica, e o
    evento registra (`rac_enviado`);
  - webhook novo `atendimento.reaberto`, enxuto (só ids), emitido pela RPC.
    Entrou no catálogo `private.webhook_tipos`, em `src/lib/webhooks.ts`, em
    `docs/api/openapi.yaml` (e na página gerada) e em `infra/webhooks.md`.
    Não foi pelo gatilho `trg_webhook_episodio` para não disparar também
    quando o `cancelar_alta` da observação devolve o episódio;
  - a contrarreferência à UBS deste episódio é cancelada, como na alta
    desfeita da internação;
  - os documentos emitidos continuam valendo. A prévia e a resposta os
    listam.
- **R9, `public.reabrir_atendimento_previa(episódio)`:** diz se pode (ou a
  recusa) e, para quem pode, o que volta, o que não volta, os documentos, o
  RAC e a contrarreferência. Quem não pode recebe só a recusa.
- **R8:** `prontuario_leitura` ganhou a chave `reaberturas`, lida pelo RLS de
  quem lê. Nela, `medico_id` é quem deu o desfecho desfeito, para o nome vir
  em `nomes`. A auditoria (`reabrir_atendimento` e `reabrir_prescricao`) leva
  só `status`, `tipo`, `motivo_codigo`, `anterior` (id do evento) e
  `quantidade`.
- **R10:** `cancelar_alta` confere o gestor com
  `private.tenho_papel(unidade, 'gestor')`. Só isso muda nela.

### Funções trocadas trecho a trecho (homologação, 10/11/2026)

O texto atual de cada uma foi conferido na homologação antes da troca. As três
estão gravadas com LF, então o md5 com e sem CR é o mesmo.

| Função | md5 antes | md5 depois |
|---|---|---|
| `public.cancelar_alta(uuid, text)` | `303804dcccc97db4690c5948fc24e72c` | `28adabcfd3394d5e40d6b84f14db9428` |
| `public.prontuario_leitura(uuid, timestamptz, integer)` | `ce8a4005880c859aeb3eccd58043960f` | `d40a2e3a3eac44a5d029ecb1fefeead3` |
| `private.webhook_tipos()` | `01d2944a28bde810fccea189239c46fd` | `f8e1aa3a52c17136b901cdd740917c8c` |

O rollback (bloco comentado no fim da migration) devolveu os três md5 de
antes e tirou as funções novas, em transação desfeita. A tabela fica (dado
clínico) até uma janela declarada.

### Tela
- `src/components/porta/ReabrirAtendimento.tsx`: o diálogo, com o motivo em
  lista, o detalhe ("Outro" pede 10 letras), "O que não volta", o que volta a
  valer e os documentos já emitidos. Lê a prévia do servidor.
- `src/pages/plantao/porta/FilaPS.tsx`:
  - botão "Reabrir" na linha de "Saídas do plantão", para o autor do
    desfecho e o gestor, até 24 h, nos desfechos que reabrem (fora da UBS);
  - reaberto, o atendimento abre de novo na janela para quem é plantonista.
    O gestor sem plantão vê o aviso de que ele voltou para "Em atendimento";
  - selo "Reaberto · antes: Alta" na linha de "Em atendimento" e na de
    "Saídas", quando fechar de novo.
- Linha do tempo do prontuário (`src/lib/prontuarioLinhaTempo.ts` e
  `src/pages/prontuario/LinhaDoTempo.tsx`): registro "Atendimento reaberto"
  com o desfecho anterior, quem o deu e o motivo, e selo "reaberto" no cartão
  do atendimento.
- `src/lib/reabrirAtendimento.ts`: motivos, a regra do botão e os textos do
  aviso. `src/types/database.ts` editado à mão (a tabela e as duas RPCs).

### Testes
- `supabase/tests/reabrir_atendimento.sql`: 57 verificações, todas ok na
  homologação (seed + migration + teste, em transação desfeita). Ok também
  com a migration aplicada duas vezes.
- Testes existentes rodados na homologação com a migration: 16 de 17 ok (`obito`, `obitos_painel`, `porte_caderno_leito`,
  `fase5c_webhooks`, `fase5c_webhooks_motor`, `fase8_outbox`,
  `5a_contrarreferencia`, `5a_retorno_ponta_a_ponta`, `fase5c_erp_contas`,
  `fase3_bpa_i`, `fase3_bpa_c`, `depois_prontuario_leitura`, `contencao`,
  `transferencia`, `prescricao_vencida` e o novo). Nenhuma expectativa
  mudou. `fase3_observacao_internacao_alta` para em `classificar_risco`
  ("Informe o fluxograma e o discriminador do protocolo.") com e sem a
  migration: falha antiga do teste, antes de chegar ao `cancelar_alta`.
- Node: `src/lib/reabrirAtendimento.test.ts` (4 testes), um teste novo na
  linha do tempo e uma asserção nova nos webhooks. `src/domain` e `src/lib`
  inteiros passam (585).
- `tsc -p tsconfig.app.json`, eslint dos arquivos tocados,
  `padrao-frontend --ci`, `migrations-destrutivas` e `redocly lint`: ok.

### O que não foi conferido
- A tela no navegador: o login é necessário e a migration não está aplicada
  na homologação.
- A ordem de publicação importa: a fila da porta passa a ler
  `episodio_eventos` e, sem a migration no banco, falha. Migration antes do
  frontend, como sempre.

### Pontos para o RT
- `cancelar_alta` e a tela da internação ainda dizem "fale com o gestor" e
  "o cancelamento é com o gestor" depois de 24 h, mas o servidor recusa
  também o gestor. Na porta a mensagem nova já diz "ficha nova". Trocar
  também na internação? Fora desta lacuna, não mexido.
- RAC já enviado à RNDS: o atendimento reaberto e fechado de novo não manda
  RAC novo, porque a fila não aceita outro item da mesma referência enquanto
  há um enviado. A retificação na RNDS fica para quando o envio existir.
- A anulação do óbito da porta e reabrir depois de 24 h seguem fora
  (seção 4).
