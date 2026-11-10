# Lacuna 5: declaração de óbito e comunicação do óbito (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 5 (P1), aprovada pelo RT em
10/11/2026. Origem: relatório do teste de ponta a ponta de 11/10/2026, seção 3,
passo `5.declaracao_obito` (paciente #13).

## 1. Fontes (conferidas no texto em 10/11/2026)

- **Portaria SVS/MS nº 116/2009**, que regulamenta a coleta de dados do SIM:
  https://bvsms.saude.gov.br/bvs/saudelegis/svs/2009/prt0116_11_02_2009.html
  - A D.O. é um formulário de 3 vias numeradas, distribuído pela Secretaria
    Municipal de Saúde (SMS). A unidade responde junto pela série recebida
    (art. 13).
  - O médico assistente ou um substituto emite a D.O. Nas causas externas,
    quem emite é o IML (art. 17).
  - No óbito natural no estabelecimento (art. 20), a 1ª via vai para a SMS, a
    2ª para a família (cartório) e a 3ª fica no prontuário.
  - Os arts. 22 (SVO), 25 (IML) e 26 tratam dos outros casos.
  - A portaria não prevê D.O. eletrônica.
- **Ministério da Saúde, "Declaração de Óbito: manual de instruções para
  preenchimento", 1ª ed., 2022:**
  http://bvsms.saude.gov.br/bvs/publicacoes/declaracao_obito_manual_preenchimento.pdf
  - O número tem 9 algarismos. O último é dígito verificador, mas o manual não
    traz o algoritmo.
  - As vias são branca, amarela e rosa.
  - As causas vão nas Partes I (a a d) e II. Quem codifica pela CID são os
    codificadores, não o médico.
  - Morte por causa externa vai ao IML. Morte natural sem assistência vai ao
    SVO; onde não há SVO, a D.O. sai com "causa da morte desconhecida".
- **MS/CFM, "A Declaração de Óbito: documento necessário e importante", 3ª
  ed., 2009:** https://bvsms.saude.gov.br/bvs/publicacoes/declaracao_obito_3ed.pdf
  - O médico não preenche a D.O. sem examinar o corpo pessoalmente.
  - Termos vagos como "parada cardiorrespiratória" não servem como causa.
- **Resolução CFM nº 1.779/2005:**
  - Art. 1º: o médico que atesta responde pelos dados.
  - Art. 2º: morte natural sem assistência vai ao SVO, ou ao serviço público
    mais próximo onde não houver SVO. Morte natural com assistência é atestada
    pelo médico assistente ou por um substituto da instituição. Morte violenta
    vai aos serviços médico-legais.
- **Código de Ética Médica (Res. CFM 2.217/2018), art. 83:** é vedado atestar
  óbito sem ter verificado pessoalmente.
- **Comunicação à família:** não há norma do CFM, do COFEN nem do MS. O
  Parecer COREN-SP 003/2016 admite que o enfermeiro comunique depois da
  constatação médica e recomenda um protocolo da instituição.
- **D.O. eletrônica:** o SIM (gov.br/saude) descreve só a D.O. impressa. Não
  há módulo oficial para integração.
- Os textos extraídos estão no scratchpad da sessão (`obito-fontes.txt`).

## 2. Estado atual (master em 10/11/2026)

**Três telas com três conjuntos de dados diferentes:**
- **Porta (`registrar_desfecho`):** hora do óbito, CID do óbito, relato e
  número da D.O. com 6 a 12 dígitos.
- **Observação (`finalizar_observacao`):** hora, relato e um número da D.O.
  com 3 caracteres ou mais. Sem CID.
- **Internação (`dar_alta`):** só o número da D.O., com 3 caracteres ou mais.
  A hora do óbito é a hora da alta.

**Documentos:** o tipo `sumario_obito` existe e tem folha impressa
(`src/lib/folhas.ts`), mas nenhum fluxo o emite.

**O que não existe:**
- a decisão entre atestar na unidade, SVO e IML;
- o registro da comunicação à família;
- a conferência e a liberação do corpo;
- passos para a enfermagem e para a recepção.

**Ao registrar o óbito:**
- Fecham sozinhos: prescrições, exames sem resultado, pareceres, pendências,
  isolamento e contenção.
- O leito vai na hora para higienização, mesmo com o corpo ainda nele.
- O óbito pode ser desfeito em até 24 h.

**Painel:** só o painel do administrador conta óbitos, e só os da porta. Os
da observação e da internação ficam de fora. Isso é a lacuna 10.

## 3. Pontos para o RT decidir (recomendação em A)

### O1. Dados da D.O., iguais nas três telas
- **A:** os mesmos campos na porta, na observação e na internação:
  - número da D.O. com 9 dígitos (o dígito verificador não é conferido,
    porque o manual não traz o algoritmo);
  - hora do óbito;
  - médico que atesta (o login) e condição: assistente ou substituto;
  - causas em texto, como na D.O.: Parte I (a a d) e Parte II. Termos vagos,
    como "parada cardiorrespiratória", geram aviso.
  - O CID interno continua para faturamento e indicadores, sem substituir as
    causas em texto.
  - Destino das vias: a branca fica guardada para a SMS, a amarela vai à
    família e a rosa vai ao prontuário (confirmação de cada uma).
  - D.O. anulada ou rasurada: registra o número anulado e o motivo, e o novo
    número.
- **B:** só o número, como hoje.

### O2. Documento do óbito
- **A:** ao registrar o óbito, emite-se o "Sumário de óbito" (o tipo que já
  existe), com os dados acima.
  - A D.O. em si nunca sai do sistema: é formulário numerado da SMS.
- **B:** sem documento.

### O3. Quem atesta: unidade, SVO ou IML
- **A:** o médico escolhe o tipo de morte, e o app orienta pela Res. CFM
  1.779/2005, art. 2º, e pela Portaria 116/2009:
  - **natural com assistência:** o médico da unidade atesta, e a D.O. é
    obrigatória no registro;
  - **natural sem assistência ou causa a esclarecer:** encaminha ao SVO; onde
    não há SVO, a D.O. sai com "causa da morte desconhecida";
  - **violenta ou suspeita:** encaminha ao IML. Registra-se a comunicação à
    autoridade policial (quem, quando e número da ocorrência, se houver), e a
    unidade não emite a D.O.
- **B:** sem orientação; só o número.

### O4. Comunicação à família
- **A:** registro com quem comunicou (o login, médico ou enfermeiro), a quem
  (nome e parentesco), quando, como (presencial ou telefone) e testemunha
  (opcional). O nome e o parentesco ficam em tabela protegida, não na
  auditoria.
- **B:** sem registro.

### O5. Corpo e leito
- **A:**
  - conferência da identificação do corpo (pulseira ou documento);
  - liberação: para funerária, SVO ou IML, com hora e quem liberou;
  - entrega da via amarela à família.
  - **O leito só vai para higienização quando o corpo é liberado.** Até lá,
    aparece como "aguardando liberação do corpo".
- **B:** o leito continua indo para higienização na hora.

### O6. Papéis
- **A:**
  - o médico atesta e decide entre unidade, SVO e IML;
  - o médico ou o enfermeiro registra a comunicação à família;
  - a enfermagem ou a recepção registra a conferência e a liberação do corpo.
- **B:** tudo com o médico.

### O7. Onde aparece
- **A:** na linha do tempo do prontuário e nos documentos do episódio, com
  uma pendência visível enquanto faltar a comunicação ou a liberação do
  corpo. O painel do gestor fica para a lacuna 10, que corrige também a
  contagem.

### O8. O que fecha sozinho
- **A:** fica como está, e o óbito continua podendo ser desfeito em 24 h. Os
  registros novos ficam anulados junto.

## 4. Fora do escopo
- D.O. eletrônica: não há módulo oficial.
- Controle do estoque de formulários de D.O. da unidade.
- Óbito fetal e Declaração de Nascido Vivo.
- SVO e IML como unidades dentro do sistema.

## 5. Decisão do RT (10/11/2026)

"A em todos": A em O1 a O8. O RT lembrou que o registro no app é **só para o prontuário**: a D.O. que vale é o formulário do Ministério da Saúde, nas vias branca, amarela e rosa. O app não imprime nada com cara de D.O. O "Sumário de óbito" é documento do prontuário e diz isso no próprio texto.

## 6. Implementação (10/11/2026, branch `lacunas/obito`)

### Banco: `supabase/migrations/20270326000001_obito.sql`
- **O1.** Tabela `public.obitos`, um registro por óbito (um vigente por
  paciente; o número da D.O. não se repete entre os vigentes). Guarda hora,
  tipo de morte, caminho (`unidade`, `svo`, `causa_desconhecida`, `iml`),
  número da D.O. (9 dígitos, só quando a unidade emite), atestante (o login) e
  condição (assistente ou substituto), causas em texto (Parte I, a a d, e
  Parte II), CID interno, avisos, polícia, vias (branca, amarela, rosa, com
  quem e quando), identificação e liberação do corpo, o sumário e a anulação.
  - Um validador só, `private.obito_validado`, e um registro só,
    `private.registrar_obito`. `registrar_desfecho` (porta) e `dar_alta`
    (internação, e observação pela `finalizar_observacao`) chamam os dois. Os
    dados novos vão no jsonb que já existia, na chave `obito`; `hora_obito` e
    `numero_do` continuam no primeiro nível.
  - `desfecho_detalhes` e `alta_detalhes` continuam com hora e número, como
    antes, e ganham `obito_id`, `tipo_morte` e `encaminhamento`.
  - A porta continua pedindo o CID do óbito: vira o CID interno.
  - Termos vagos (só os citados no MS/CFM 2009: parada cardíaca, parada
    respiratória, parada cardiorrespiratória, falência de múltiplos órgãos)
    geram aviso gravado no registro. Não bloqueiam.
  - `public.conferir_obito` devolve o erro e os avisos para a tela, sem gravar.
  - D.O. anulada ou rasurada: `public.anular_do` (médico) guarda o número
    velho e o motivo em `public.obito_do_anuladas`; as vias recomeçam.
- **O2.** O "Sumário de óbito" (`sumario_obito`) sai sozinho no registro, com
  a frase "Registro para o prontuário. A Declaração de Óbito é o formulário
  oficial do Ministério da Saúde." A folha (`src/lib/folhas.ts`) tem modelo
  próprio para ele e nunca mostra vias nem título de D.O.
- **O3.** Natural com assistência: a unidade atesta e o número é obrigatório.
  Sem assistência ou a esclarecer: SVO (sem número da unidade) ou, sem SVO,
  número da unidade e Parte I "Causa da morte desconhecida". Violenta ou
  suspeita: IML, sem número da unidade; a polícia pode ser registrada no ato
  ou depois (`public.comunicar_obito_policia`), e fica pendente até lá.
- **O4.** `public.obito_comunicacoes` (nome, parentesco, quando, como,
  testemunha), pela `public.comunicar_obito_familia`. A auditoria leva só ids e
  códigos.
- **O5.** `public.conferir_identificacao_corpo` e `public.liberar_corpo`
  (destino conforme o caminho; liberação só depois da identificação; a via
  amarela pode ser marcada junto). `public.registrar_via_do` marca cada via.
- **O5, o leito.** O leito do óbito **fica "ocupado"** com a marca
  `leitos.obito_aguardando_id` ("aguardando liberação do corpo") e só vai para
  a higienização na liberação. Não é um valor novo do enum `status_leito`:
  o Postgres não deixa usar um valor de enum na mesma transação em que nasce
  (a migration e o teste rodam numa transação só) e todas as contas e telas
  que leem `ocupado` já tratam o leito como indisponível (censo, mapa,
  NIR, box livre, leitos para ocupar). Mudou:
  - `registrar_evento_adt` não manda para a higienização o leito marcado;
  - `situacao_leitos` devolve `motivo = 'aguardando_corpo'`;
  - `mapa_leitos_gestor` devolve `aguardando_corpo` no leito;
  - `liberar_leito_sem_paciente` recusa o leito marcado;
  - `eventos_leito.tipo_evento` aceita `aguardando_corpo` (CHECK maior).
  - A taxa de ocupação conta o leito com o corpo como ocupado.
- **O6.** Médico atesta e escolhe o tipo de morte; médico ou enfermeiro
  comunicam à família e à polícia (o técnico e a recepção não); enfermagem
  (enfermeiro ou técnico) ou recepção conferem e liberam o corpo; vias:
  médico, enfermagem ou recepção; D.O. anulada: médico. Quem age tem de estar
  de plantão na unidade.
- **O7.** `prontuario_leitura` ganha a chave `obitos` (sem nome de
  familiar); `public.obito_do_paciente` traz o óbito inteiro para a tela;
  `public.obitos_pendentes` lista os óbitos com algo por fazer.
- **O8.** `cancelar_alta` anula o óbito, as comunicações e o sumário (estado
  `cancelado`, nada é apagado) e devolve o paciente ao leito que esperava o
  corpo.
- Funções trocadas trecho a trecho (mesma assinatura): `registrar_desfecho`,
  `dar_alta`, `registrar_evento_adt`, `cancelar_alta`, `situacao_leitos`,
  `liberar_leito_sem_paciente`, `mapa_leitos_gestor`, `prontuario_leitura`.
  O rollback (bloco no fim da migration) volta o md5 de todas.

### Telas
- `src/components/obito/DadosObito.tsx`: o mesmo formulário na porta
  (`AbaDesfecho`), na observação (`PaineisCartao`) e na internação (`Alta`),
  com a orientação e a fonte de cada tipo de morte.
- `src/components/obito/PainelObito.tsx` (o óbito e as ações) e
  `ObitosPendentes.tsx` (a lista com as pendências): na fila da porta, na
  recepção, nas telas da enfermagem e no caderno da internação depois do óbito.
- "Leitos para liberar" da enfermagem mostra o leito "Aguardando liberação do
  corpo"; Setores e Mapa de leitos do gestor também.
- Linha do tempo do prontuário: entrada "Óbito", sempre à vista, com as
  pendências ou "desfeito".
- Regras puras em `src/lib/obito.ts` (teste `src/lib/obito.test.ts`).

### Testes e evidência
- `supabase/tests/obito.sql` na homologação, em transação desfeita: as três
  portas de entrada gravam o mesmo registro; validação por tipo de morte;
  D.O. de 9 dígitos; aviso de termo vago; sumário com a frase; polícia;
  família pelo médico e pelo enfermeiro, recusada à recepção e ao técnico;
  identificação e liberação; leito aguardando até a liberação e depois na
  higienização; `cancelar_alta` anula e devolve o leito; linha do tempo;
  privilégios; auditoria sem dado de pessoa.
- Testes antigos ajustados (regra nova, não defeito): `fase2_atendimento`,
  `porte_atendimento_ps` e `porte_observacao` passam a mandar o tipo de morte
  e as causas, a D.O. com 9 dígitos e a hora do óbito não antes da chegada.
- E2E: os óbitos de `14`, `17`, `19`, `33` e `86` mandam os dados novos; o
  passo `5.declaracao_obito` do #13 vira conferência; `99_limpar_rede_e2e`
  limpa a marca do leito e as D.O. anuladas antes do laço.

### Antes de publicar
- A edge function `folha` precisa de deploy (o `_shared/folhas.ts` foi
  copiado com `npm run folhas:copiar`).
- A migration vai antes do frontend: com o banco novo e a tela antiga, o
  óbito é recusado ("escolha o tipo de morte") até a tela nova subir.
