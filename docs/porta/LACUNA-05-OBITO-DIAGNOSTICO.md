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
