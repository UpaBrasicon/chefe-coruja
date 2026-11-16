# Unidade de demonstração (pedido 8, J4)

Roteiros da "Rede de Demonstração": a UPA 24h Jardim Primavera, com equipe e pacientes fictícios, para as telas da página de entrada e para a demonstração ao vivo. Diagnóstico e decisões do RT (G1–G4, 12/11/2026): `docs/landing/J4-UNIDADE-DEMONSTRACAO-DIAGNOSTICO.md`.

**Só na homologação. Nunca na produção.** Todo roteiro começa com uma trava: se o banco não tiver a "UPA Homologação" (`31000000-…-0001`), ele para sem gravar nada.

## Ordem

| Arquivo | O que faz | Quando |
|---|---|---|
| `01_rede_demonstracao.sql` | Organização, unidade, setores, leitos, 24 pessoas fictícias sem senha, vínculos e a escala 12x36 do mês corrente e do seguinte, publicada pela coordenadora | Uma vez, e de novo quando virar o mês |
| `02_plantao_agora.sql` | Apaga os pacientes da unidade, faz o check-in dos plantões já começados e cria o plantão de agora pelas funções do banco, como cada pessoa de plantão | Antes de cada captura ou apresentação |
| `03_acesso_conta.sql` | Dá à conta indicada os papéis gestor, plantonista, recepção e enfermeiro na unidade e a escala de hoje no Pronto Socorro (roteiro da demo: `docs/comercial/demo/`) | Uma vez por conta (troque o e-mail antes) |
| `04_ubs_regulacao.sql` | Cria a UBS Vila Esperança, o Hospital Regional Santa Aurora e a Central de Regulação da rede, com equipe, escala e agenda. Apaga o que ele mesmo gravou antes e grava de novo os pacientes da UBS (hiperdia, pré-natal, puericultura), a agenda de hoje e dos próximos dias, os envios à UPA e os pedidos de regulação | Depois do `02`, entre 7h e 18h50, e de novo depois de cada `02` |
| `05_video_acesso.sql` | Vídeo de venda: dá à coordenadora fictícia plantonista, enfermeiro e recepção na UPA, a escala de hoje no Pronto Socorro com check-in, e dois cuidados prescritos (sem dose) para os pacientes em atendimento, um já checado | No dia da gravação, depois do `02` e do `04` |
| `gravar-video.mjs` | Vídeo de venda: entra como a coordenadora fictícia por um link de acesso único e grava as cenas de `docs/comercial/video/cenas.json` pelos quadros do navegador, em MP4 1920 × 1080; a página pública é gravada sem login | Depois do `05` (precisa de `HOMOLOG_SHARE` e `FFMPEG`) |
| `montar-video.mjs` | Vídeo de venda: corta as cenas, põe legendas, selo e cartelas e monta o MP4 final com o ffmpeg | Depois do `gravar-video.mjs` |
| `capturar-telas.mjs` | Entra como a coordenadora fictícia por um link de acesso único e tira a porta, o painel do gestor e a escala em 1424 × 749, em JPG | Logo depois do `02`, para as telas da página de entrada |
| `99_limpar_rede_demonstracao.sql` | Apaga a rede inteira, inclusive os acessos dados pelo 03 | Só quando a unidade não for mais usada |

## Como rodar

1. Confira que o projeto ligado é a homologação (`kswurfyxxvfydpjfrivy`). Num worktree, copie antes a pasta `supabase/.temp` do checkout principal.
2. Rode cada arquivo pelo CLI:

   ```bash
   npx supabase db query --linked -f scripts/demo/01_rede_demonstracao.sql
   npx supabase db query --linked -f scripts/demo/02_plantao_agora.sql
   npx supabase db query --linked -f scripts/demo/04_ubs_regulacao.sql
   ```

   O `04` vem sempre depois do `02`: os dois pedidos de regulação da UPA são dos pacientes da Sala Vermelha que o `02` cria, e o `02` apaga os pacientes da UPA, com os pedidos deles. A UBS funciona das 7h às 19h, e o `04` recusa rodar fora das 7h–18h50.

3. No `03`, troque `TROQUE-PELO-SEU-EMAIL@exemplo.com` pelo e-mail da conta numa cópia local (não suba o e-mail no git) e rode a cópia do mesmo jeito.

4. Para as telas da página de entrada, rode logo depois do `02`:

   ```bash
   HOMOLOG_SHARE="<link de compartilhamento do Vercel>" node scripts/demo/capturar-telas.mjs tmp/telas-demo
   ```

   - O roteiro lê a chave de serviço da homologação pelo CLI do Supabase, sem imprimir.
   - Ele tira o bloqueio da coordenadora só durante a captura. A senha dela continua vazia, então só entra quem tem o link gerado ali.
   - No fim, bloqueia a conta de novo, mesmo se algo falhar.
   - Usa o Edge instalado; para outro navegador, defina `NAVEGADOR`.
   - O link do Vercel vem do conector do Vercel ou do painel e não vai para o git.

   A captura não usa conta real: com ela aparecem o nome da conta, o menu de administrador e as unidades de outras redes (revisão do G2, 12/11/2026).

Os arquivos não usam comandos do psql (`\set`) nem senha. Por isso não passam pelo `scripts/e2e/homolog/preparar.mjs`.

## O que fica na unidade

- **Equipe:** coordenadora (gestor), farmacêutica e quatro equipes 12x36 (dia e noite, dias pares e ímpares). Cada equipe tem recepção, enfermagem da classificação, técnico da Observação Adulto, médico do Pronto Socorro e médico da Sala Vermelha. Dois pediatras cobrem o diurno da Observação Pediátrica.
- **Contas da equipe:** e-mail `@demo.local`, senha vazia e conta bloqueada até 2999. Ninguém entra com elas, exceto a coordenadora durante o `capturar-telas.mjs`.
- **Cerca do check-in:** um ponto genérico no interior de SP com raio de 200 m. O `02` faz o check-in da equipe dentro dela, e a auditoria mostra "confere".
- **Plantão do `02`:** 17 pacientes (13 adultos e 4 crianças) e 4 altas de mais cedo.
  - Porta: 2 aguardando triagem, 5 aguardando médico, 1 em atendimento e 1 em reavaliação.
  - Leitos: Observação Adulto 4 de 6, Observação Pediátrica 2 de 3, Sala Vermelha 2 de 2. São 8 de 11 leitos ocupados (73%).
  - Cada passo passa pelas funções do banco, com RLS: `registrar_ficha`, `classificar_risco`, `iniciar_atendimento`, `registrar_soap`, `pedir_exames_atendimento`, `aguardar_reavaliacao` e `registrar_desfecho`. Depois, os horários são recuados para esperas plausíveis.

## O que o `04` cria na rede

- **Unidades:** UBS Vila Esperança (`d0100000-…-0002`, CNES fictício 9998020, Consultório 1), Hospital Regional Santa Aurora (`-0003`, CNES 9998039, Clínica Médica com 10 leitos e UTI Adulto com 6) e Central de Regulação de Santa Aurora (`-0009`), que passa a ser a central da rede.
- **Equipe da UBS:** a médica de família Letícia Camargo Nogueira, a enfermeira Tatiana Brito Fonseca, a técnica Elaine Cristina Paiva e o recepcionista Márcio José Albuquerque. Escala de manhã e de tarde todos os dias, no mês corrente e no seguinte, publicada pela coordenadora. A agenda tem consultas das 7h às 12h e das 13h às 17h todos os dias: a médica de 20 em 20 minutos e a enfermeira de 30 em 30. O app não tem papel de agente comunitário de saúde.
- **Regulação e hospital:** a médica reguladora Sandra Regina Toledo, na central, e o gestor Eduardo Tavares Lins, no hospital. As mesmas regras do 01 valem para as 6 contas: `@demo.local`, sem senha e bloqueadas.
- **Coordenadora:** Simone Aparecida Prado passa a ser gestora também da UBS.
- **Mapa de vagas:** no hospital, a Clínica Médica (7 ocupados e 1 em higienização de 10) e a UTI Adulto (4 de 6). Na UPA, a Observação Adulto entra como leito clínico e a Observação Pediátrica como pediátrico. O hospital tem quatro serviços: cardiologia (restrito), oftalmologia (indisponível), ecocardiograma e ultrassom obstétrico.
- **Pacientes da UBS:** 21, com Cartão SUS fictício válido (começa com 7998).
  - Hiperdia: 8 hipertensos ou diabéticos, com consultas antigas e recentes. Alguns estão em dia e outros têm pendência (consulta, pressão, peso e altura, HbA1c ou pés). Wagner entra no hiperdia na consulta de hoje, às 9h.
  - Pré-natal: 4 gestantes, com 11, 16, 30 e 36 semanas.
  - Puericultura: 4 crianças, com 2, 7, 13 e 20 meses.
  - Envios à UPA: 3, um aguardando a chegada, um que não chegou e um cancelado.
  - Demanda: 2 pacientes.
- **Agenda:** 11 consultas da médica hoje e 11 consultas nos próximos 5 dias, 8 da médica e 3 da enfermeira. O que sai hoje depende da hora em que o `04` roda. O horário que já acabou fica realizado, ou falta em dois casos marcados. O que começa em até 30 minutos fica "presente". O resto fica agendado.
- **Regulação:** 6 pedidos. Da UBS: cardiologia realizada no hospital, ecocardiograma autorizado para daqui a 6 dias, oftalmologia aguardando na fila e ultrassom obstétrico em análise. Da UPA: transferência da Sala Vermelha para a UTI, autorizada pela central e aguardando o aceite do hospital, e leito de UTI aguardando na fila, com a prioridade elevada pela reguladora para emergência.
- **Pelas funções do banco, com RLS:** cadastro (`salvar_cadastro_paciente`), ficha, escuta inicial, atendimento, SOAP, HbA1c, avaliação dos pés, crescimento, conduta da atenção primária, DUM do pré-natal, agenda (marcar, chegada, falta), envio e cancelamento do envio à UPA, oferta de setor, serviços do mapa e todos os passos da regulação. O `04` grava direto só a central da rede, o check-in da equipe da UBS, a ocupação dos leitos do hospital e os horários.

## Limites

- **Primeiro atendimento na observação.** A equipe fictícia não tem médico na Observação Adulto, e `observacao_atender` exige plantão no setor. Por isso o `02` grava o evento de atendimento direto, em nome do médico que atendeu na porta, 12 min depois da entrada. Sem ele, o painel da observação mostraria "aguardando primeiro atendimento" em todos.
- **Sem prescrição.** A prescrição exige dose, via e frequência escritas, e o roteiro não inventa dose. O indicador "medicação pendente" fica em 0.
- **Autoria.** Tudo sai em nome da equipe de plantão na hora em que o `02` roda, inclusive as altas "de mais cedo". É assim porque as funções só aceitam quem está de plantão agora.
- **Check-in da conta do `03`.** Fica para quem entra, como em `supabase/homolog/demo-preparar.sql`. Sem ele, depois de 30 min a porta do médico fecha. As telas do gestor não dependem da escala.
- **`session_replication_role = replica`.** O `02` e o `99` usam esse modo para limpar e recuar horários, como `scripts/e2e/99_limpar_rede_e2e.sql`, porque as tabelas clínicas são só de inserção. A limpeza segue as chaves estrangeiras pelo catálogo.
- **Auditoria.** O `99` apaga a auditoria da unidade, e a cadeia de hash da homologação fica sem essas linhas, como na limpeza da rede E2E.
- **Central de Regulação.** `regulacao_definir_central` é só do administrador da plataforma, e a rede de demonstração não tem um. Por isso o `04` grava a central direto.
- **Hospital sem pacientes.** A ocupação dos leitos do hospital é gravada direto, só para o mapa de vagas. O hospital não tem internados na rede.
- **Horários do `04`.** As consultas antigas, os envios, os pedidos de regulação e as consultas de hoje que já passaram são recuados como postgres. A agenda só marca horário futuro: o horário de hoje que já passou é marcado na semana seguinte e trazido para hoje.
- **Testes rápidos do pré-natal.** Ficam sem registro. Para lançar, a UBS precisaria de alguém do faturamento para pôr os procedimentos na lista da unidade.

## Dependências na homologação

- Protocolo de classificação carregado (`supabase/dados/protocolo_aparecida_2025.sql`). O `01` para se não houver nenhum.
- CID-10 do DATASUS (`terminologia.cid10`). Os CIDs do `02` são os que os roteiros e2e já usaram.
- Não usa o catálogo de medicamentos, o esquema `e2e` nem os utilitários do framework e2e.
