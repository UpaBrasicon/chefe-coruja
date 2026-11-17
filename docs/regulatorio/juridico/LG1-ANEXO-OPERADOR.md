# Anexo de Tratamento de Dados Pessoais (contrato de operador)

> **Rascunho técnico para revisão do advogado.** Não é parecer. Decisões do RT de 17/11/2026: J1 a J4 = A (`docs/regulatorio/LG1-LG2-LG3-LG5-PECAS-JURIDICAS-DIAGNOSTICO.md`). Os campos entre colchetes são preenchidos por contrato.

Este anexo faz parte do Contrato de Prestação de Serviços da plataforma Chefe Coruja, firmado entre:
- **[RAZÃO SOCIAL DO CLIENTE], CNPJ [ ]**, doravante **Controlador**;
- **[RAZÃO SOCIAL DO CHEFE CORUJA], CNPJ [ ]**, doravante **Operador**.

## 1. Objeto e papéis

1.1. O Operador trata dados pessoais em nome do Controlador, para prestar o serviço da plataforma: prontuário, leitos, prescrição, escala, regulação, faturamento e funções de apoio clínico. Segue as instruções documentadas do Controlador (LGPD, art. 39).

1.2. O Controlador decide sobre o tratamento dos dados dos seus pacientes e da sua equipe na plataforma.

1.3. O Operador é controlador apenas dos dados que trata para si: cadastro e login dos profissionais na plataforma, cobrança, suporte e o site comercial. Para esses dados vale a Política de Privacidade do Operador.

1.4. São instruções do Controlador este Anexo, o Contrato e as configurações que o Controlador faz na plataforma (papéis, vínculos, camada da unidade, integrações). Instrução que, na avaliação do Operador, viole a lei é comunicada ao Controlador antes de ser cumprida.

## 2. Dados, titulares e finalidade

2.1. **Titulares:** pacientes, acompanhantes e responsáveis; profissionais e colaboradores do Controlador.

2.2. **Dados:**
- identificação e contato;
- documentos (CPF, CNS);
- dados de saúde: registros clínicos, prescrições, exames, anexos, sinais vitais e classificação de risco;
- dados de uso e de auditoria.

Dados de saúde são dados pessoais sensíveis (art. 5º, II).

2.3. **Finalidade:** prestação da assistência e gestão da unidade do Controlador. A base legal é do Controlador, em especial a tutela da saúde (art. 11, II, "f").

2.4. **Proibição:** o Operador não usa os dados para finalidade própria, não os vende e não os usa para treinar modelos de inteligência artificial.

## 3. Segurança (art. 46)

3.1. O Operador mantém, no mínimo, as medidas descritas no documento "Segurança da informação e LGPD", em sua versão vigente, entre elas:
- controle de acesso no banco, por papel, unidade e plantão (RLS);
- segundo fator de autenticação;
- trilha de auditoria encadeada por hash;
- cifra em trânsito e em repouso;
- guarda cifrada de 20 anos em cofre com bloqueio de apagamento (Object Lock);
- cópia de segurança fora do servidor, cifrada com chave exclusiva do Operador;
- inteligência artificial só por gateway que retira identificadores, com o texto enviado apagado em 30 dias.

3.2. O Operador não reduz o nível de proteção dessas medidas durante o Contrato. Mudança que reduza a proteção depende de aviso prévio ao Controlador.

3.3. Quem acessa os dados em nome do Operador está obrigado a sigilo.

## 4. Suboperadores

4.1. O Controlador autoriza os suboperadores do Apêndice A. Cada um está obrigado, por contrato, a nível de proteção equivalente ao deste Anexo.

4.2. Antes de incluir ou trocar um suboperador, o Operador avisa o Controlador com **30 dias de antecedência**. Nesse prazo, o Controlador pode se opor por motivo fundamentado. Sem acordo, o Controlador pode encerrar o serviço afetado sem multa.

4.3. O Operador responde perante o Controlador pelos atos dos seus suboperadores.

## 5. Transferência internacional

5.1. Os dados clínicos ficam no Brasil.

5.2. Só ocorre transferência internacional nos casos do Apêndice A, cada um com a sua base no art. 33 da LGPD: país com adequação reconhecida pela ANPD, cláusulas-padrão contratuais da ANPD (Resolução CD/ANPD 19/2024) ou outra hipótese legal.

5.3. Dado cifrado com chave que só o Operador tem é tratado como medida adicional de proteção. [Advogado: avaliar se afasta a caracterização de transferência.]

## 6. Direitos dos titulares

6.1. O Operador apoia o Controlador no atendimento dos pedidos dos titulares (art. 18): acesso, correção, portabilidade, informação sobre compartilhamento e outros.

6.2. O apoio inclui exportar o prontuário em formato aberto. Pedido recebido diretamente pelo Operador é repassado ao Controlador em até **2 dias úteis**.

## 7. Incidentes de segurança

7.1. O Operador avisa o Controlador de incidente que envolva dados do Controlador em até **24 horas** da confirmação. O aviso traz:
- o que aconteceu e quando;
- os dados e titulares afetados, ou a melhor estimativa;
- as medidas tomadas;
- o contato do encarregado do Operador.

7.2. O Operador fornece o que o Controlador precisar para comunicar a ANPD e os titulares no prazo da Resolução CD/ANPD 15/2024.

7.3. O Operador mantém registro de todos os incidentes por **5 anos**, inclusive os não comunicados (plano em `LG5-PLANO-INCIDENTE.md`).

## 8. Auditoria e informação

8.1. O Operador disponibiliza ao Controlador:
- a política de segurança vigente;
- a lista de suboperadores;
- o relatório de impacto da plataforma (RIPD, parte do operador), para o Controlador completar.

8.2. Auditoria presencial ou por terceiro é combinada com 30 dias de antecedência, uma vez por ano, salvo incidente. O custo é do Controlador.

## 9. Fim do Contrato

9.1. Em até **30 dias** do fim do Contrato, o Operador entrega ao Controlador a exportação completa: dados estruturados em formato aberto (FHIR e CSV) e anexos com o manifesto de integridade.

9.2. **Guarda do prontuário.** A Lei 13.787/2018 manda guardar o prontuário por **20 anos** a partir do último registro. O dever é do Controlador. A cópia de guarda fica num cofre com bloqueio de apagamento até o fim desse prazo, e esse bloqueio não pode ser desfeito antes. O Controlador escolhe uma das opções:
- **(a) custódia contratada:** o Operador mantém a guarda até o fim do prazo e a entrega quando pedida, nas condições de [ ];
- **(b) guarda própria:** o Controlador recebe a cópia integral e assume a guarda. A cópia do cofre segue bloqueada até o fim do prazo, sem uso pelo Operador, e é descartada depois.

9.3. Depois que o Controlador confirmar o recebimento da exportação, o Operador apaga, em até **60 dias**, os dados do banco ativo e das cópias de trabalho. Fica só o previsto no item 9.2 e o que a lei obrigar a guardar.

## 10. Responsabilidade

[Advogado: limites de responsabilidade e solidariedade, conforme os arts. 42 a 45 da LGPD e o Contrato.]

## 11. Encarregado

Encarregado do Operador: **[NOME DO RT]**, `encarregado@chefecoruja.com.br`. O Controlador informa o seu encarregado no ato da assinatura.

---

## Apêndice A: suboperadores autorizados (versão de 17/11/2026)

| Suboperador | Serviço | Dados | Local | Base para o exterior |
|---|---|---|---|---|
| Supabase Inc. | banco, login, arquivos e funções | todos os dados da plataforma | São Paulo, Brasil | — |
| Amazon Web Services (S3) | cofre da guarda de 20 anos | cópia cifrada (sem a chave) | São Paulo, Brasil | — |
| Amazon Web Services (Bedrock) | modelo de linguagem do apoio por IA, depois da troca do LG6 | texto sem identificadores (pseudonimizado) | São Paulo, Brasil (só In-Region) | — |
| Hostinger | servidor da IA, da biblioteca, do envio à RNDS e dos backups | dados em trânsito; backups locais | Brasil [confirmar no contrato] | — |
| Backblaze | cópia de segurança fora do servidor | arquivo cifrado com chave do Operador | União Europeia (J4; hoje EUA, até a troca) | adequação UE (Res. CD/ANPD 32/2026) |
| DeepSeek | modelo de linguagem (sai com o LG6) | texto pseudonimizado | China | [sem base: substituição em andamento] |
| Vercel | entrega do site | sem dado clínico | rede global | [advogado] |
| Cloudflare | DNS, proteção do site, roteamento de e-mail | tráfego do site | rede global | [advogado] |
| Functional Software (Sentry) | registro de erros técnicos | mensagem higienizada, sem paciente e sem IP | União Europeia | adequação UE |
| Resend | e-mail do código de acesso e avisos | e-mail do profissional | EUA | [cláusulas-padrão ou outra base] |
| Telegram | assistentes da equipe (Corujinha e outros) | mensagens da equipe | rede global | [advogado; orientação de não escrever dado de paciente] |
