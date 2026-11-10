# Lacuna 2: pulseira de identificação (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 2 (P1), aprovada pelo RT em
10/11/2026. Origem: relatório do teste de ponta a ponta de 11/10/2026, seção 3,
passo `1.pulseira`.

## 1. Fonte

**Protocolo de Identificação do Paciente** (Anexo 02 da Portaria MS/GM nº
2.095/2013; Ministério da Saúde, Anvisa e Fiocruz, 2013). PDF:
https://proqualis.fiocruz.br/sites/proqualis.fiocruz.br/files/Protocolo%20de%20Identifica%C3%A7%C3%A3o%20do%20Paciente.pdf

O que o protocolo diz, resumido:

- **Identificadores (4.1):** pelo menos dois, numa pulseira branca
  padronizada, conferida antes do cuidado.
  - Adulto: em geral no punho.
  - Recém-nascido: de preferência no tornozelo.
- **Quais identificadores (5.1.1):** nome completo do paciente, nome completo
  da mãe, data de nascimento e número do prontuário.
- **Recém-nascido (5.1):** no mínimo, o nome da mãe e o número do prontuário
  do RN.
- **Desconhecido (5.1.1 e 5.1.2):**
  - o prontuário e as características físicas mais relevantes, incluindo
    sexo e raça;
  - quando chega de ambulância, também o local e o horário do resgate e o
    número do atendimento.
- **O que não usar:**
  - o leito, o quarto ou a enfermaria nunca servem de identificador (5.1.2);
  - pulseiras coloridas de alerta ou etiquetas não servem como identificador
    (Apêndice I.b).
- **Impressão (5.1.1, 5.2.10 e Apêndice V):**
  - pode ser impressa ou escrita à mão;
  - a etiqueta precisa caber na pulseira e ser durável;
  - mesma disposição e ordem em toda a unidade;
  - nascimento em DD/MM/AAAA, nome completo sem abreviatura;
  - letra comum de 12 a 14 pt no mínimo, sem itálico.
- **Reposição (5.1):** o serviço define o que fazer quando a pulseira cai,
  fica ilegível ou é removida.
- **Confirmação (4.3 e 5.2):** antes de medicamento, sangue, coleta, dieta e
  procedimento invasivo, perguntar o nome completo e o nascimento e conferir
  com a pulseira.

## 2. Estado atual (master em 10/11/2026)

- **Pulseira:** não há rota, função nem folha. Também não há biblioteca de
  código de barras ou QR no app.
- **Folhas:** toda impressão é A4 (`src/lib/folhas.ts`). O cabeçalho do
  paciente traz o leito, que o protocolo proíbe como identificador.
- **Registro da impressão:** `registrar_impressao` grava em
  `log_acesso_prontuario` e devolve um protocolo IMP-. Pela regra do
  projeto, papel sem protocolo não saiu do sistema.
- **Dados disponíveis:**
  - nome, nome social, nascimento (real ou estimado), sexo, raça/cor,
    prontuário, CNS e nome da mãe;
  - marca e sinais do não identificado (lacuna 1);
  - RN ligado à mãe;
  - estado de alergia.
- **Onde caberia o botão:**
  - recepção, logo depois da ficha, do não identificado e do RN;
  - reimpressão na triagem, no PS e na lista de internados.
  - A UBS já esconde o fluxo do não identificado.

## 3. Pontos para o RT decidir (recomendação em A)

### P1. O que vai na pulseira do adulto e da criança
- **A:** nesta ordem fixa:
  1. nome completo, sem abreviar;
  2. nome social, se houver, numa linha abaixo, sem tirar o nome civil;
  3. data de nascimento DD/MM/AAAA;
  4. prontuário;
  5. nome da mãe, quando cadastrado.
  - Sem leito, diagnóstico ou setor.
- **B:** só nome completo, nascimento e prontuário.

### P2. Pulseira do não identificado
- **A:** nome provisório ("Não identificado <prontuário>"), prontuário, sexo
  aparente, raça/cor se registrada e "idade estimada: N anos" no lugar da
  data. Não se imprime data estimada como se fosse real.
  - Os sinais, que podem ter até 500 letras, entram resumidos no espaço da
    etiqueta.
  - Depois de "Identificar paciente", o app avisa para trocar a pulseira.
- **B:** só o nome provisório e o prontuário.

### P3. Pulseira do recém-nascido
- **A:** nome da mãe ("RN de <mãe>", com a ordem dos gêmeos), prontuário do
  RN, nascimento DD/MM/AAAA e sexo, em tamanho de RN.
  - O botão aparece logo depois do cadastro do RN.
- **B:** só o mínimo do protocolo: nome da mãe e prontuário do RN.

### P4. Código de barras ou QR
- **A:** sem código por enquanto. Não há leitor no app nem processo que use
  o código; dá para entrar depois.
- **B:** código com o prontuário.

### P5. Alergia e risco
- **A:** nada na pulseira branca de identificação. A alergia continua no
  sistema e nas folhas, que já têm a faixa de alergia.
  - Pulseira de alerta colorida depende de uma regra da unidade: fica para
    depois, se a unidade adotar.
- **B:** texto "ALERGIA" na pulseira branca quando houver alergia registrada.

### P6. Formato da impressão
- **A:** etiqueta do tamanho da pulseira (cerca de 2,5 × 10 cm), com letra de
  12 pt ou mais.
  - Sai numa folha comum, para recortar e prender na pulseira branca, e
    serve em qualquer impressora.
  - Se a unidade tiver impressora térmica de pulseira, ganha um modo próprio
    depois, sem mudar o conteúdo.
- **B:** só impressora térmica de pulseira (rolo de 25 × 280 mm).

### P7. Onde fica o botão
- **A:** "Imprimir pulseira" na recepção, logo depois da ficha, do não
  identificado e do RN.
  - "Reimprimir pulseira" na triagem, no PS e na lista de internados.
  - Não aparece na UBS.
- **B:** só na recepção.

### P8. Registro e reimpressão
- **A:** toda impressão grava pelo `registrar_impressao`, com protocolo
  IMP-, quem imprimiu (o login) e quando.
  - A reimpressão pede o motivo: caiu, ilegível, paciente identificado,
    dados corrigidos ou outro.
- **B:** a impressão não deixa registro.

## 4. Fora do escopo
- **Lembrete de conferência:** conferir a pulseira antes de medicar ou
  coletar continua como prática da equipe. Um lembrete no app pode entrar
  depois, na checagem.
- **Pulseira de alerta colorida:** ver P5.

## 5. Decisão do RT (10/11/2026)

"A em todos": A em P1 a P8.

## 6. Implementação (10/11/2026, branch `lacunas/pulseira`)

### Banco: `supabase/migrations/20270323000001_pulseira.sql`
Só aditiva e idempotente: uma tabela, um índice, um gatilho e três funções
novas. Nenhuma função existente muda.

- **`registrar_impressao` não aceita motivo.** Por isso a função nova
  `public.registrar_impressao_pulseira(p_paciente, p_reimpressao, p_motivo,
  p_detalhe)`, que devolve `{protocolo, emitido_em, reimpressao, pulseira}`:
  - registra e entrega os dados na mesma chamada, então não sai papel sem
    protocolo;
  - grava em `log_acesso_prontuario` a mesma linha que `registrar_impressao`
    grava: tipo `impressao`, o login, a hora, o IP, o navegador e o
    protocolo `IMP-` no mesmo formato;
  - o `documento_tipo` leva só o código fixo, `Pulseira` ou
    `Pulseira (reimpressão: caiu)`, sem nome nem prontuário.
- **`public.impressoes_pulseira`** guarda o motivo (caiu, ilegível,
  paciente identificado, dados corrigidos ou outro) e o texto do "outro"
  (até 200 letras), ligados à linha do registro de acesso.
  - Só a função grava; ninguém altera nem apaga (gatilho só-inserção).
  - Lê o gestor da unidade, o super admin e quem imprimiu.
  - A tela pede o texto do "outro" sem dados do paciente.
- **`private.dados_pulseira`** monta os dados, numa função só, para toda tela
  imprimir a mesma coisa:
  - nome, nome social, nascimento só quando é real, idade estimada em
    meses quando é estimado, prontuário e mãe;
  - sexo, raça/cor e sinais (estes só do não identificado);
  - marca de RN (até 27 dias e ligado à mãe), com o nome atual da mãe e a
    ordem do gêmeo;
  - sem leito, setor, diagnóstico, alergia ou risco.
- A UBS é recusada no servidor também (P7).

### Quem imprime (`private.pode_imprimir_pulseira`)
- **Quem atua no paciente** (`pode_atuar_no_paciente`): super admin, gestor e
  plantão agora no setor do paciente com a ficha ou a internação abertas. A
  recepção e a enfermagem da porta entram por aqui depois de abrir a ficha.
- **A recepção da unidade de plantão agora.**
  - `gravar_acesso` (o caminho de `registrar_impressao`) exige
    `pode_atuar_no_paciente`, e a recepção não passava em dois casos:
    - o RN, que `cadastrar_rn` cria sem setor;
    - a reimpressão da pulseira que caiu na enfermaria.
  - A regra segue `identificar_paciente`, que aceita a recepção da unidade,
    mas aqui exige o plantão.
  - Não abre dado novo: `buscar_pacientes` já entrega nome, nascimento, mãe
    e prontuário a quem está de plantão na unidade, e
    `pacientes_nao_identificados` já mostra os sinais à recepção.
- **RN de até 27 dias ligado à mãe:** quem atua na mãe (a enfermagem do leito
  dela imprime a do RN, que nasce sem setor).
- Passa por `exigir_segundo_fator`, como `registrar_impressao`.

### Tela
- **Regra pura em `src/domain/pulseira.ts`:**
  - as linhas na ordem fixa e o "RN N de <mãe>";
  - "Idade estimada: N anos" no lugar da data;
  - sinais resumidos em 80 letras, cortados no fim de uma palavra;
  - os motivos da reimpressão e a conferência deles.
- **A folha (`src/lib/folhaPulseira.ts`):**
  - etiqueta de 100 × 25 mm (RN, 80 × 20 mm);
  - letra de 12 pt (nome em 13 pt, negrito), sem itálico, em A4 para
    recortar;
  - orientação de punho ou tornozelo e o protocolo embaixo;
  - não usa o cabeçalho das folhas, que traz o leito.
- **A impressão (`src/lib/pulseira.ts`):** abre a janela no clique e chama a
  função; se ela falhar, a janela diz que nada foi impresso.
- **Os botões (`src/components/paciente/Pulseira.tsx`)** somem na UBS.
  - "Imprimir pulseira":
    - na recepção, no aviso depois da ficha, do não identificado e do RN
      (`Recepcao.tsx`);
    - no cadastro do RN pelo leito da mãe (`CadastroRn.tsx`).
  - "Reimprimir pulseira", que pede o motivo:
    - no diálogo da triagem (`Triagem.tsx`);
    - na fila do PS, aguardando e em atendimento (`FilaPS.tsx`);
    - na lista de internados (`ListaInternados.tsx`).
  - Depois de "Identificar paciente" (lista da recepção e seletor de
    paciente dos documentos), o aviso pede a troca da pulseira e imprime a
    nova com o motivo "paciente identificado".
- `src/types/database.ts`: entrada da função nova escrita à mão. O
  `npm run gen:tipos` a regenera junto com a tabela.

### Testes
- `src/domain/pulseira.test.ts` (15) e `src/lib/folhaPulseira.test.ts` (3):
  - adulto, nome social, mãe e nascimento ausente;
  - não identificado com e sem idade, sexo, raça/cor e sinais, e o corte
    dos sinais;
  - RN com gêmeo e com o nome atual da mãe;
  - motivos, escape do HTML, tamanho e letra da etiqueta.
- `supabase/tests/pulseira.sql` (23 conferências, 11 recusas e o bloco de
  privilégios):
  - os campos exatos da pulseira, sem leito;
  - não identificado antes e depois de identificar, e RN;
  - impressão e reimpressão com protocolo, login e motivo;
  - recusas: sem motivo, motivo fora da lista, "outro" sem texto ou longo;
  - quem não atua no paciente e a UBS são recusados;
  - RLS da tabela; anon sem EXECUTE.
- Homologação, em transação desfeita (seed 15–81 junto):
  - o teste inteiro passou;
  - a migration aplicada duas vezes seguidas passou.
- Na homologação, `paciente_em_cuidado_no_plantao` exige a ficha ou a
  internação abertas (20270306000002); o teste abre a ficha antes.

### Rollback
Está no cabeçalho da migration:
1. `DROP FUNCTION` das três funções;
2. `DROP TABLE public.impressoes_pulseira`, exportando antes se já houver
   uso real.

As linhas de `log_acesso_prontuario` ficam.

### Em aberto
- A primeira impressão não confere se já houve outra. Dois cliques em
  "Imprimir pulseira" geram duas linhas sem motivo. A reimpressão com motivo
  é a das outras telas.
- A etiqueta não foi conferida em papel. Falta imprimir uma na unidade e
  medir antes de liberar.

## 7. Pulseira opcional por unidade (RT, 10/11/2026)

O RT lembrou que a pulseira não é obrigatória em toda unidade, só nas que escolherem. A coluna `unidades.usa_pulseira` começa desligada. O gestor liga em Configuração ("Pulseira de identificação: Usa / Não usa"), pela `definir_pulseira_unidade`, com auditoria. Com ela desligada, os botões não aparecem e `registrar_impressao_pulseira` recusa a impressão. A UBS nunca usa.
