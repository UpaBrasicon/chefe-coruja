# Lacuna 6: prescrição vencida e renovação (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 6 (P1), aprovada pelo RT em
10/11/2026. Origem: relatório do teste de ponta a ponta de 11/10/2026, seção 3,
passo `5.prescricao_vencida`.

## 1. Fontes (conferidas em 10/11/2026)

- **Resolução COFEN nº 689/2022, Art. 4º**
  (https://cofen.gov.br/resolucao-cofen-no-689-2022/): a enfermagem não pode
  executar prescrição fora da validade.
  - §1º, I: nos serviços hospitalares, a validade é de 24 horas.
  - §1º, II: nos demais serviços, vale o período definido pelo prescritor.
  - Não há exceção de urgência.
  - A página não mostra revogação. O Art. 6º revoga a 487/2015.
- **Protocolo de segurança na prescrição, uso e administração de
  medicamentos** (Anexo 03 da Portaria MS 2.095/2013), item 5.1 d:
  - a data é necessária para dar validade à prescrição e garantir a avaliação
    médica do dia;
  - no ambulatório, a validade é definida pelo prescritor;
  - para o hospital, o protocolo não fixa prazo.
- **Portaria MS 4.283/2010** (farmácia hospitalar): pede avaliação
  farmacêutica antes da dispensação e não fixa validade.
- **Conclusão:** o prazo de 24 h vem do COFEN e vale para a execução pela
  enfermagem nos serviços hospitalares. Nenhuma norma do MS, da ANVISA ou do
  CFM fixa outro prazo.
- Os textos extraídos estão no scratchpad da sessão
  (`prescricao-fontes.txt`).

## 2. Estado atual (master em 10/11/2026)

- **`prescricoes.valida_ate`:** existe, mas nada grava nela.
- **Prescrição ativa:** há uma por internação ou, sem internação, por
  episódio. Ela só termina com o desfecho.
- **Itens:** valem e geram horários todos os dias até serem suspensos.
- **Checagem, aprazamento, fila de validação e dispensação:** nenhum olha a
  data. Um item de 5 dias atrás continua na fila da enfermagem e pode ser
  checado.
- **Renovação ou cópia:** não existe. A exceção é a contenção (lacuna 4),
  que já tem validade de 24 h, estado calculado no servidor, aviso 2 h antes
  e no vencimento, e renovação por uma ordem nova.

## 3. Pontos para o RT decidir (recomendação em A)

### V1. Validade
- **A:** 24 h para todo item, na porta, na observação e na internação
  (COFEN 689, Art. 4º, §1º, I).
  - A contagem começa na prescrição ou na última renovação do item.
  - No dia da publicação, os itens que já estão ativos ganham 24 h a partir
    daquela hora, para nada vencer de uma vez.
- **B:** 24 h só na observação e na internação; na porta, o item vale até o
  desfecho.

### V2. Vencimento
- **A:** o item vencido aparece como "Vencido, peça renovação".
  - A checagem e a dispensação recusam o item, porque o COFEN veda executar
    prescrição vencida.
  - O aprazamento não gera horário depois do vencimento.
- **B:** só aviso, sem travar.

### V3. Enfermagem diante do item vencido
- **A:** não administra.
  - Um botão "Pedir renovação" avisa o médico de plantão do setor.
  - Na urgência, o médico prescreve "Agora", como hoje.
- **B:** administra com justificativa, e o médico confere depois.

### V4. Como renovar
- **A:** uma tela "Renovar prescrição" lista os itens vencendo ou vencidos.
  - Para cada item, o médico marca manter, alterar ou suspender, e
    confirma tudo de uma vez.
  - **Manter:** cria uma versão nova idêntica, com o autor sendo quem
    renovou (o login). O aprazamento continua, e a validação da farmácia
    também, se nada mudou.
  - **Alterar:** usa o fluxo que já existe.
  - Não há renovação "tudo sem olhar": cada item passa pela marcação.
- **B:** renovação item a item, sem a tela de revisão.

### V5. Quem renova
- **A:** o médico em cuidado do paciente, como na prescrição de hoje.

### V6. Avisos
- **A:**
  - ao médico de plantão do setor, 2 h antes e no vencimento, um aviso por
    item e por janela, como na contenção;
  - selo "vence em" e "vencido" na prescrição, no leito, no PS da enfermagem
    e na checagem.

### V7. Exceções
- **A:**
  - **"Agora" (dose única):** não vence, porque já se encerra na
    administração.
  - **"Se necessário", "Contínuo" e cuidados:** vencem em 24 h.
  - **Contenção:** continua com a regra própria, que já é de 24 h, com
    renovação pela própria ordem.
- **B:** "Se necessário" também não vence.

### V8. Itens vindos da porta
- **A:** valem 24 h desde a prescrição.
  - Na observação e na internação, entram na tela de renovação como os
    outros.
  - Assim, a passagem da porta para o leito obriga a revisão em até 24 h.

### V9. Impressão
- **A:** a folha da prescrição traz, em cada item, "válido até
  DD/MM HH:MM".

## 4. Fora do escopo
- Receitas para casa e receita de alta.
- Validade da receita de controlado (Portaria 344).
- Prescrição verbal.
- Horário fixo da prescrição do dia (ex.: tudo vence às 12h). Pode entrar
  depois como configuração da unidade.

## 5. Decisão do RT (10/11/2026)

"Sim": A em V1 a V9.

## 6. Implementação (10/11/2026, branch `lacunas/prescricao-vencida`)

Migration `supabase/migrations/20270327000001_prescricao_vencida.sql`; teste
`supabase/tests/prescricao_vencida.sql`; regras da tela em
`src/lib/validadePrescricao.ts` (com teste); componentes em
`src/components/prescricao/ValidadeItem.tsx`.

### 6.1 Banco
- **V1, validade por item:** coluna `prescricao_itens.valida_ate`.
  - O gatilho de inserção grava `now() + 24 h`. A renovação é uma versão
    nova, logo também passa por ele.
  - "Agora" fica com a validade nula (não vence).
  - Um gatilho de guarda recusa o UPDATE direto da validade e do pedido de
    renovação pela API: a tabela tem UPDATE para o médico pelo RLS.
  - `prescricoes.valida_ate` continua sem uso. A validade é do item, porque
    uma prescrição junta itens de horas diferentes.
- **Transição:** `private.prescricao_validade_transicao()` roda na migration.
  - Item ativo sem validade ganha 24 h a partir da publicação.
  - A contenção ativa fica com criação + 24 h, o prazo que ela já tinha.
  - Só toca validade nula: rodar de novo não estende nada.
- **V2, vencido:**
  - `checar` recusa o "feito" com a mensagem "Prescrição vencida às DD/MM
    HH:MM ... (Resolução COFEN 689/2022, art. 4º). Peça a renovação ao
    médico."
  - "Não feito" e "recusado" seguem permitidos: não são execução, e fecham o
    horário que ficou para trás (sem isso, a alta após medicação travaria).
  - `dispensar_item` recusa.
  - `private.doses_do_item` não gera horário a partir do vencimento.
- **Leituras com a validade:** `fila_checagem`, `fila_validacao`,
  `prescricao_vigente` e `prescricao_porta_ativa` ganham as colunas
  `valida_ate` e `validade` (`sem_prazo`, `em_dia`, `vence_logo`, `vencido`),
  e as três da enfermagem e do médico ganham também `renovacao_pedida_em`.
  - Coluna nova em RETURNS TABLE pede DROP e CREATE: mesmo nome, mesmos
    argumentos, as colunas antigas na mesma ordem e os mesmos privilégios.
  - `painel_atendimento_ps` ganha as mesmas chaves em cada item.
- **V3, pedido da enfermagem:** `public.pedir_renovacao(item)`.
  - Só a enfermagem de plantão com o paciente pede.
  - O pedido abre a 2 h do fim ou com o item vencido.
  - Avisa o médico de plantão do setor (os destinatários da contenção), uma
    vez por item e por médico.
  - Contenção e "Agora" ficam de fora.
- **V4 e V5, renovação:** `public.renovar_prescricao(paciente, decisões)`,
  com `[{item_id, acao: manter|alterar|suspender, mudancas?, motivo?}]`.
  - Grava tudo numa transação: uma decisão inválida desfaz a renovação
    inteira.
  - Quem renova é o médico de plantão com o paciente, como no `prescrever`.
  - O servidor recebe a lista do médico; não há "renovar tudo" sem a marca
    de cada item.
  - **Manter:** suspende a anterior com o motivo "Renovada: nova versão sem
    mudança" e cria a nova pelo `prescrever`, com as mesmas travas (alergia,
    peso, interação com a justificativa anterior, duplicidade).
    - O autor da nova é o login de quem renova.
    - A nova leva `substitui_item_id`, `versao + 1` e `motivo_alteracao =
      'Renovada sem mudança'`.
    - O aprazamento (`horarios`) e a ordem passam para a nova.
  - **Validação da farmácia:** passa para a nova se nada mudou (medicamento,
    dose, via, frequência, "se necessário", observação e diluição, que pode
    ter versão nova publicada).
    - É uma linha nova em `validacoes_prescricao`, com `herdada_de`
      apontando a validação anterior e o mesmo farmacêutico.
    - Assim `liberado_pela_farmacia` vale para a nova e ela não volta à fila
      de validação.
  - **Alterar:** `alterar_item_prescricao`. **Suspender:** `suspender_item`.
- **V6, avisos:** job `prescricao-validade-avisos` a cada 15 min
  (`private.prescricao_validade_avisar`).
  - Avisa o médico de plantão do setor a 2 h do fim (`presc_vence_<item>`) e
    no vencimento (`presc_vencida_<item>`).
  - A chave do aviso tem a data, e um NOT EXISTS segura a repetição no dia
    seguinte.
  - Só avisa de quem está na unidade (atendimento aberto ou internação
    ativa).
- **V7:** a contenção tem a mesma validade (24 h) e também não se checa
  vencida. O job, a renovação e o pedido pulam o tipo `contencao`, porque os
  avisos e a renovação são os da lacuna 4 (sem aviso em dobro).
  `private.contencao_estado` e `contencao_avisar` não mudaram.
- **V8:** o item da porta vale desde a prescrição.
  - Na observação e na internação, ele aparece na renovação junto com os do
    leito (`prescricao_porta_ativa`).
  - Mantido ou alterado, a versão nova vai para a prescrição do leito.
- **Auditoria, sem dado de pessoa:**
  - `renovacao_pedida`: situação e quantidade de avisos;
  - `prescricao_item_renovado`: anterior, versão e situação;
  - `renovar_prescricao`: quantidade.

### 6.2 Funções trocadas (md5 do `pg_get_functiondef` na homologação)
Nenhuma das oito está gravada com CRLF: o md5 cru e o sem CR são iguais.
Depois do rollback, o md5 e o ACL voltam aos de antes.

| Função | Antes | Depois |
|---|---|---|
| `checar(uuid,text,text,text)` | 0fca707777922a50c9e40b0f428e3ba1 | 662c6e75a77cf907b8193686f42653e1 |
| `dispensar_item(uuid,integer,text)` | 0239541bfb794ece84697e59cc392a4d | 58105df0400c7c3c269b616b2114bf82 |
| `private.doses_do_item(uuid)` | 6fe3aceb3b285915d615cc4314b7e698 | a8d28abafcc421bf6e95a19f5debfa3b |
| `painel_atendimento_ps(uuid)` | 59b5ecac5eeeb1d14da7c27fcf43bc05 | 5eec12e2567b7b19913d0a0dfc91b977 |
| `fila_checagem()` | 994948ae296f45ac081d82c9e60417ce | 6211a1218240d18a0c6da807d70acd61 |
| `fila_validacao(uuid)` | c3328119a189175eaa9b6e8df46457df | 893803d59bd3b92d4fd6dea353ff94b3 |
| `prescricao_vigente(uuid,timestamptz)` | f1685f41d071e2b1ee2152f95e79e2f3 | dee8fc03baf94eb0ad19a07d08f73bd8 |
| `prescricao_porta_ativa(uuid)` | d2020152b8e17154ed0480b4fbf02c77 | 5a8401e06e1c17a08c464ee9ce2161cd |

### 6.3 Telas
- **Prescrição do leito** (`PrescricaoEstruturada`):
  - cartão "Renovar prescrição" com os itens do leito e os vindos da porta
    que vencem em até 2 h ou já venceram;
  - cada item com Manter, Alterar (só medicamento) ou Suspender; alterar e
    suspender pedem o motivo;
  - o botão "Confirmar renovação" só abre com todos os itens marcados;
  - selo "Vence em 1h20" ou "Vencido, peça renovação" e o aviso "A
    enfermagem pediu a renovação às ..." em cada item;
  - a versão renovada aparece como "Renovada sem mudança por ...", não como
    alteração.
- **Prescrição da porta** (`AbaPrescricao`): o mesmo cartão e o mesmo selo.
- **Leito** (`LeitoAberto`, Resumo e Agora): aviso "Prescrição vencida: N
  itens" ou "Prescrição vence em ...".
- **Enfermagem, PS e internação:** pílula por paciente, tirada da fila da
  Checagem.
- **Checagem:**
  - selo no item;
  - faixa "Prescrição vencida às ... Não administre" ou "vence às ...";
  - botão "Pedir renovação" (ou "Pedir de novo");
  - "Feito" fechado no item vencido.
- **Impressão (V9):** cada item sai com "válido até DD/MM HH:MM"
  (`src/lib/folhas.ts`, copiado para `supabase/functions/_shared/folhas.ts`
  por `npm run folhas:copiar`). **A edge function `folha` precisa de deploy.**

### 6.4 Evidências (homologação, transação desfeita; nada gravado)
- `prescricao_vencida.sql`: 60 chamadas, que dão 72 verificações. Rodou sem
  falha (BEGIN, seed das linhas 15 a 81, migration e teste). Sem a migration,
  o mesmo teste falha, como esperado.
- A migration rodou duas vezes seguidas: o md5 e o ACL das oito funções não
  mudaram na segunda.
- Rollback (o bloco comentado no fim da migration): as oito funções voltam
  ao md5 e ao ACL de antes; funções, gatilhos e job novos saem; as colunas
  ficam (contract).
- **Testes que já existiam, com a migration:**
  - Passaram como estão: `5a_consulta_ubs_ponta_a_ponta`, `contencao`,
    `controlados`, `depois_frequencia_ps`, `fase0_segundo_fator_servidor`,
    `fase4_farmacia`, `fase4_prescricao_diluicao`,
    `fase5_conta_medicamentos`, `fix_ataque_manutencao`,
    `fix_dispensa_enfermagem_farmaceutico`,
    `fix_prescrever_atendimento_aberto`, `porte_alergia_classe` e
    `porte_alergias`.
  - Treze falham na homologação também sem a migration. O motivo é o
    `classificar_risco` lendo o fluxograma já como `authenticated`. Numa
    cópia de trabalho (fora do repositório), com o fluxograma lido como
    dono, todos passaram com a migration: `fase2_alteracao_item_prescricao`,
    `fase2_aprazamento_assistido`, `fase2_auditoria_clinica`,
    `fase2_dupla_checagem`, `fase2_interacoes_criticas`,
    `fase2_liberacao_farmacia`, `fase2_painel_farmacia`, `fase4_checagem`,
    `fase5c_catalogo_exames`, `fase5c_imagem_sistema`,
    `fase5c_resultado_exames`, `portao2_prescricao_idade_peso` e
    `porte_atendimento_ps`.
  - `porte_atendimento_ps` falhou uma vez e passou duas. O teste compara a
    ordem de dois exames pedidos no mesmo instante; nada a ver com a
    migration.
  - `busca_medicamento`, `fase5_dispensacao` e `porte_telas_enfermagem`
    falham do mesmo jeito sem a migration (ambiente da homologação). Nenhuma
    expectativa de teste antigo precisou mudar.
- **`scripts/e2e`:** nenhum roteiro checa item prescrito há mais de 24 h no
  mesmo roteiro. Os da coorte 2 (`33` depois do `32`) e o `17` checam itens
  de roteiros anteriores. Rodados com mais de 24 h de intervalo, o "feito"
  agora é recusado, como manda o V2. Nada foi alterado.
- `npx tsc -p tsconfig.app.json --noEmit`, `eslint` nos arquivos tocados,
  `node scripts/padrao-frontend.mjs --ci`,
  `node scripts/ambiente/migrations-destrutivas.mjs` e os testes de
  `src/domain` e `src/lib` (564) passaram.

### 6.5 Pendências e perguntas
- Deploy da edge function `folha` junto com a publicação (V9).
- **Dose dada antes do vencimento e registrada depois:** o "feito" é
  recusado, porque o servidor só conhece a hora do registro. Hoje o caminho é
  o "não feito" com o motivo, e o médico renova. Se o RT quiser, dá para
  aceitar o "feito" de horário aprazado anterior ao vencimento.
- **Alta após medicação:** item sem horário que venceu sem nenhum "feito"
  segura a alta (regra de antes). O médico suspende ou renova.
- **Dispensação:** depois da renovação, a sugestão da farmácia conta a
  versão nova do zero.
- A dupla conferência da alta vigilância (`conferir_alta_vigilancia`) não
  olha a validade. Quem trava é o "feito" do `checar`.
- A tela "Renovar prescrição" mostra só o que vence em até 2 h. Renovar
  antes, por exemplo na visita da manhã, pede uma opção "mostrar todos" (o
  servidor já aceita qualquer item ativo com validade).
