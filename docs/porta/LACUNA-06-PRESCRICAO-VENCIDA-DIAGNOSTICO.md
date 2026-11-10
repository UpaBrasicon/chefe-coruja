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
