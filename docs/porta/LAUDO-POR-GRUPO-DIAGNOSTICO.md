# Laudo por grupo: diagnóstico

**Pedido do RT (11/11/2026), P2:** anexar de uma vez um único arquivo a todos os exames de laboratório; o mesmo para ECG e para imagem. A decisão do RT foi "um anexo para o grupo" (BACKLOG, "Pedidos do RT em 11/11/2026", #580).

Este documento é só diagnóstico, sem código.

## Como é hoje

- **Tela:** cada exame tem o próprio "Registrar resultado", com texto e anexo (`src/components/clinico/ResultadoExame.tsx`). Isso aparece em duas listas: a da porta (`src/pages/plantao/porta/AbaExames.tsx:74`) e a da internação (`src/components/clinico/ExamesEAgravos.tsx:110` e `:127`). Dez exames de laboratório exigem anexar o mesmo PDF dez vezes.
- **Grupo e pedido já existem no banco.** `exames_pedidos` tem:
  - `grupo` (laboratório, imagem ou gráfico, desde o ponto 12 e o item 3a);
  - `documento_id`, que é o pedido;
  - `tipo`.
  O pedido já não mistura grupos (`pedir_exames`, `20270321000001`).
- **Arquivo:** fica no bucket privado `exames`, no caminho `<id do exame>/<marca de tempo>-<nome>`.
  - O envio só é aceito se o primeiro pedaço do caminho for um exame que a pessoa pode registrar: policy `exames_laudo_upload` e `private.exame_pode_subir_laudo`.
  - O exame de laboratório aceita só PDF; imagem e ECG aceitam também JPG e PNG (`20261208000001`).
- **Registro:** `registrar_resultado_exame` chama `private.gravar_resultado_exame`, que **recusa caminho de outro exame** ("O laudo não é deste exame.", `20261206000001_resultado_exames.sql:192`). É isso que hoje impede o arquivo único.
- **Leitura:** `exame_laudo_abrir(resultado)` dá à pessoa 2 minutos de acesso ao caminho, depois de conferir que ela pode ver aquele exame, e fica auditada. A liberação vale pelo caminho. Um arquivo usado em vários exames já pode ser aberto a partir de qualquer um deles, sem mudar a leitura.
- **Retificação, visto e ciência:** são por exame, com versão.

## Proposta

**Banco** (uma migration de expansão, sem mudar o que existe):
- RPC nova `registrar_laudo_grupo(p_exames uuid[], p_pdf_caminho text, p_pdf_nome text)`.
- Ela confere:
  - todos os exames são do mesmo paciente, da mesma unidade e do mesmo grupo;
  - cada um está aguardando resultado (pedido, coletado ou em análise, sem resultado vigente);
  - quem registra pode registrar cada um;
  - o arquivo foi enviado e está no caminho de um dos exames da lista.
- Depois grava uma versão em cada exame, com o mesmo arquivo, e uma auditoria só, com a lista.
- O envio do arquivo não muda: ele sobe no caminho do primeiro exame marcado, com a mesma regra de tipo (PDF no laboratório; PDF, JPG ou PNG em imagem e ECG).
- `gravar_resultado_exame` ganha só a exceção para o caminho de um exame da mesma lista, chamada pela RPC nova. `registrar_resultado_exame` continua igual.

**Tela:**
- Nas duas listas, o botão "Anexar laudo do grupo" aparece em cada grupo (Laboratório, ECG e gráficos, Imagem) quando há dois ou mais exames aguardando resultado.
- O diálogo lista esses exames com caixas de marcar, já marcadas, e uma área de anexo. Ao registrar, cada exame passa a mostrar "Laudo em PDF" (ou "Traçado / imagem") com o mesmo arquivo.
- O registro por exame continua como está.

**Testes:**
- teste de banco: grupo misturado, paciente diferente, exame já com resultado, arquivo de fora da lista e quem não pode registrar são recusados; registro de 3 exames com o mesmo arquivo;
- teste de unidade do diálogo;
- homologação antes.

## Perguntas para o RT

| # | Pergunta | Recomendação |
|---|---|---|
| G1 | Quais exames entram no anexo do grupo? | **A:** todos os do mesmo grupo aguardando resultado no atendimento (ou na internação), já marcados, com a opção de desmarcar. B: só os do mesmo pedido. Motivo: o laboratório costuma mandar um laudo com tudo o que saiu, e na B o hemograma da manhã e a PCR da tarde ficariam em dois anexos |
| G2 | Junto com o arquivo, um texto comum? | **A:** só o arquivo. O texto continua por exame, se quiser. Motivo: o texto de um exame não serve para os outros |
| G3 | Exame que já tem resultado | **A:** fica fora da lista. Para trocar o laudo, retificação por exame, com motivo, como hoje. Motivo: preserva as versões e evita sobrescrever resultado em lote |
| G4 | Onde aparece | **A:** porta e internação, nas duas listas que já existem |
| G5 | Visto e ciência do médico | **A:** continuam por exame. O laudo do grupo marca cada exame como tendo resultado, e o médico dá ciência em cada um, como hoje |

## Riscos

- **Arquivo errado anexado a vários exames de uma vez:** a correção é a retificação de cada um, com motivo. Por isso a lista mostra o nome de cada exame antes de registrar.
- **Arquivo órfão,** se o envio der certo e a RPC falhar: o risco é o mesmo de hoje (achado da lacuna 11), sem piorar.
- **Segundo fator:** a RPC nova segue `private.exigir_segundo_fator()`, como as outras.

## Esforço

Uma migration (função nova, mais a exceção controlada em `gravar_resultado_exame`), um componente de tela e os testes. Pela regra do projeto, vai à homologação e depois à produção com o seu ok.
