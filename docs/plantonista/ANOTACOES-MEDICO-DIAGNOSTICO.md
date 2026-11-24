# Anotações pessoais do médico: diagnóstico (AN1 a AN4)

Pedido 7 da lista "Pedidos do RT em 17/11/2026" do BACKLOG ("Meu plantão: anotações pessoais do médico"). Saiu do item 6 (tela do celular, CM4 = A). Em 23/11/2026 o RT pediu para fazer o 7 e o 9 ao mesmo tempo; o 9 corre em outra sessão. Lido na master (48145cb6). Nada foi programado.

## 1. O que já existe

- **Nada parecido para o médico.** As "anotações" do app são da enfermagem e ficam no prontuário (anotação de enfermagem, com guarda de 20 anos).
- **O que é do paciente já tem lugar:**
  - a evolução e os documentos vão para o prontuário;
  - o que falta fazer vai para as pendências do leito e do passômetro (pedido 8, na produção desde hoje);
  - a passagem de plantão leva o resumo ao colega.
- **Preferências do médico** (favoritos e uso das ferramentas) já ficam no banco, por pessoa, e só ele vê (`ferramenta_uso`).

## 2. O que o pedido quer dizer

Um bloco de notas à mão no "Meu plantão", para lembretes do próprio médico durante o turno, como "ligar para o laboratório às 15h", "pedir troca do dia 30" ou "levar o carregador". Hoje isso fica no papel ou no bloco de notas do celular.

O risco é virar um prontuário paralelo: nome, diagnóstico ou conduta de paciente escritos fora do prontuário, sem autor oficial, sem guarda e sem o registro de acesso. As decisões abaixo existem para evitar isso.

## 3. Referências reais (Refero)

- **Lista de notas com fixar e apagar:**
  - Bear, lista (refero.design/screens/14bcca97-6331-4a73-8dbe-759c1d20df14);
  - Bear, deslizar para fixar ou apagar (refero.design/screens/78d98368-5a3d-4cd1-9909-42a8f208d849).
- **Seção "Privado"**, que só o dono vê: Notion (refero.design/screens/c51fd19a-5d2c-4a6b-ac62-ce609db902fc).

## 4. Decisões

### AN1. Para que servem

**A (recomendo).** Só para lembretes do próprio médico, sem dado de paciente. Um aviso fixo no topo diz isso e aponta o lugar certo: "Do paciente, use as pendências do passômetro". Quando o texto parece trazer dado de paciente (CPF, Cartão SUS ou data de nascimento), o app avisa e pede confirmação antes de salvar.

**B.** Anotação por paciente, que só o autor vê, ligada ao leito. É útil, mas cria um registro clínico fora do prontuário. As pendências já cobrem esse uso.

### AN2. Onde ficam guardadas

**A (recomendo).** No banco, por pessoa. Seguem o médico no celular e no computador. Só ele lê: nem o gestor, nem o administrador. Precisa de uma tabela nova e da entrada no inventário da LGPD.

**B.** Só no aparelho, como os "Primeiros passos". Somem se trocar de celular, e em computador compartilhado ficam na máquina da unidade.

### AN3. Quanto tempo duram

**A (recomendo).** A nota apaga sozinha 30 dias depois da última mudança, com o aviso "apaga em X dias" ao lado. O médico apaga antes quando quiser. Fixar uma nota não impede que ela se apague. É o mínimo de guarda para um lembrete (LGPD, minimização).

**B.** Ficam até o médico apagar.

### AN4. Formato

**A (recomendo).** Uma lista de notas curtas, de até 1.000 letras cada, com "feito" (risca a nota), fixar no topo e apagar. Fica no "Meu plantão" do celular e do computador. A mais nova e as fixadas vêm primeiro.

**B.** Um bloco único de texto livre, como uma folha.

## 5. O que entra se for tudo A

- **Banco:** a tabela `anotacoes_medico` (autor, texto, feita, fixada, criada e alterada em), visível só para o dono e sem acesso direto, mais as funções de criar, mudar e apagar. Uma rotina diária apaga as notas com mais de 30 dias sem mudança. A migration vai na faixa `20270419000003` a `049`, com volta escrita e testada na homologação e a operação nova no inventário LG4.
- **Tela:** um cartão "Minhas anotações" no "Meu plantão", no celular e no computador, com o aviso do AN1. Ganha teste do aviso de dado de paciente (CPF, Cartão SUS e data de nascimento).
- **Ordem:** banco → tela → homologação → PR → seu ok → produção.

## 6. Perguntas ao RT

1. AN1 a AN4: A ou B em cada um?
2. Se AN3 = A: 30 dias está bom ou prefere outro prazo?
