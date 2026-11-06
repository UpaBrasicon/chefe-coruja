# Frequência com horário na prescrição do PS: diagnóstico

Este é o achado guardado de 07/10/2026, do ensaio da demo, aberto pelo RT em 06/11/2026 como item 2 da frente "Achados guardados". Hoje a porta só oferece "Agora" e "Se necessário", porque foi assim que o protótipo desenhou. A frequência com horário (8/8h, 12/12h) existe só na observação e na internação.

## O que acontece hoje

- **A limitação está só na tela.** Porta, observação e internação gravam pela mesma RPC (`prescrever`), na mesma tabela (`prescricao_itens`), com o mesmo campo de texto livre `posologia`. O banco aceita "8/8h" num item da porta.
  - Na porta, `PrescricaoEstruturada.tsx` troca o campo "Frequência" pelos chips "Agora" e "Se necessário" (`QUANDO_PORTA`).
  - Pelo botão "Alterar", um item da porta já pode virar "8/8h", porque `AlterarItem.tsx` tem o campo livre. A regra hoje é incoerente.
- **Funcionam para a porta sem nenhuma mudança:**
  - **Aprazamento:** `intervalo_posologia` reconhece 8/8h, "a cada 12 h", "2x ao dia" e outras formas. A checagem já sugere os horários e pede o aprazamento para os itens da porta.
  - **Dispensação:** a farmácia já calcula a quantidade pela frequência.
  - **Conta:** já conta cada administração feita.
- **O que quebraria com a frequência na porta:**
  1. **Painel da porta** (`painel_atendimento_ps`): mostra só a **última** checagem do item. Um 8/8h apareceria como "Administrado" depois da 1ª dose, escondendo as doses que ainda faltam.
  2. **Alta após medicação** (`medicacao_sem_checagem`): exige só **uma** dose feita por item. Um 8/8h liberaria a alta depois da 1ª dose.
  3. **Porta → observação ou internação:** a prescrição da porta continua ativa e aparece na checagem, mas **não aparece para o médico do leito**, porque `prescricao_vigente` mostra só a do leito. Um 8/8h da porta seguiria correndo sem o médico do leito ver.
  4. **"Agora" como dose única:** só a tela da checagem impede a 2ª dose. O servidor aceita.
  5. **Impressão:** a folha do leito imprime a coluna de aprazamento vazia. A porta não tem impressão.

## Decisões para o RT

**Decisão do RT em 06/11/2026: A em F1 a F6 ("Sim, todas A").**

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| F1 | Como o médico escolhe a frequência na porta | Chips "Agora", "Se necessário", 4/4h, 6/6h, 8/8h, 12/12h e 24/24h, mais "Outra" com campo livre (o servidor confere se é uma frequência que ele entende) | Só o campo livre, como na observação |
| F2 | Painel da porta | Mostra as doses por horário: feitas, pendentes e atrasadas | Continua mostrando só a última |
| F3 | Alta após medicação | Item com horário exige todas as doses vencidas até agora feitas, ou registradas como "não feito" com motivo | Continua bastando uma dose |
| F4 | Itens da porta quando o paciente vai para a observação ou internação | Aparecem na prescrição do leito numa lista própria, "Vindos da porta", com suspender e alterar, e o médico do leito decide se continuam | Suspensos automaticamente na conversão |
| F5 | "Agora" como dose única | O servidor (`checar`) recusa um 2º "feito" de item "Agora" | Fica só na tela |
| F6 | Impressão | A folha do leito passa a imprimir os horários aprazados na coluna de aprazamento; a impressão da porta fica para outra tarefa | Criar já a impressão da porta |

## Plano com A em tudo

1. **Migration (expand).**
   - `painel_atendimento_ps` passa a devolver os horários e as doses por horário.
   - `medicacao_sem_checagem` passa a considerar as doses vencidas (F3).
   - `checar` passa a recusar o 2º "feito" de "Agora" (F5).
   - A lista "Vindos da porta" ganha a sua leitura (F4).
   - Teste de banco e rollback na homologação. Para a produção, o "ok produção" do RT.
2. **Telas.**
   - Chips de frequência na porta (F1).
   - Doses por horário na aba Prescrição da porta (F2).
   - "Vindos da porta" na prescrição do leito (F4).
   - A frase "Dose única ou para fazer aqui" muda.
   - Horários impressos na folha do leito (F6).
3. **Testes antes** (unidade e banco). Depois, a homologação no Chrome:
   - prescrever 8/8h na porta;
   - a enfermagem apraza e checa;
   - o painel mostra as doses;
   - a alta é barrada com dose vencida;
   - na conversão para observação, o item aparece para o médico do leito.

## Riscos
- **Dose esquecida na passagem para o leito.** A F4 resolve, porque o item fica visível e com ações para o médico do leito.
- **Frequência digitada que o servidor não entende** (ex.: "de manhã"). O servidor recusa e pede um dos formatos conhecidos (F1). "Contínuo" continua aceito, sem sugestão de horário, como já é hoje.
