# LG7: assinatura qualificada ICP-Brasil (diagnóstico, 17/11/2026)

Trilha de obrigatórios legais e regulatórios, item LG7 (P1). Este documento não muda código nem banco e não é parecer jurídico. As fontes foram lidas em 17/11/2026, só fontes primárias. O que não foi confirmado vem marcado.

## Como está hoje

- **Tabela pronta, sem uso.** `public.assinaturas` existe desde 08/2026, com serial e CPF do certificado, hash e id da assinatura. Mas é presa à prescrição (`prescricao_id`) e tem **0 linhas** na produção.
- **Documento vale pela emissão numerada.** `documentos_clinicos` guarda o hash do conteúdo, e o estado `assinado` existe no CHECK como gancho. Nada o grava: o documento emitido fica `ativo`.
- **Prova de conceito do VIDaaS (Valid) parada.** `spikes/vidaas/vidaas-poc.ts` espera o manual e as credenciais de homologação, sem previsão (`docs/vidaas/OBSERVACOES.md`).
- **Controlados.** A Portaria 344 está mapeada: a lista de cada substância e a receita que ela exige (lacuna 3, decisão do RT de 10/11/2026). Receita e notificação saem para impressão.
- **Produção:** nenhum documento emitido ainda, porque não há equipe usando. É o melhor momento para mudar.
- **Vendas:** "Tem assinatura ICP-Brasil?" é uma objeção registrada, e a matriz comercial diz "em construção".

## O que a norma pede

| Documento | Exigência | Fonte |
|---|---|---|
| Receita de controle especial e atestado eletrônico | assinatura **qualificada** (ICP-Brasil) | Lei 14.063/2020, art. 13 |
| Atos internos do hospital | dispensados do nível qualificado | Lei 14.063/2020, art. 13, parágrafo único |
| Demais documentos do profissional de saúde | avançada ou qualificada | Lei 14.063/2020, art. 14 |
| Todo documento médico eletrônico (prescrição, atestado, relatório, pedido de exame, laudo, parecer) | ICP-Brasil, nível NGS2 | Res. CFM 2.299/2021, art. 4º; Res. CFM 2.381/2024, art. 2º |
| Plataforma de prescrição | inscrita no CRM, com diretor técnico médico; confere se quem prescreve é médico regular | Res. CFM 2.299/2021, arts. 5º e 8º |
| Notificação de Receita A, B e B2 eletrônica | numeração da vigilância local e integração da plataforma ao **SNCR** (ANVISA) por API. O papel continua valendo | RDC 1.000/2025; SNCR desde 30/09/2026 |
| Receita de Controle Especial no SNCR | transição prorrogada até 03/03/2027 (Diretoria Colegiada, 29/10/2026). Número da RDC: não confirmado | notícia da ANVISA |
| Controlado da Portaria 344 | ICP-Brasil "sem exceções"; a assinatura gov.br não vale | Perguntas e Respostas da RDC 1.000/2025, perguntas 40 e 41 |
| Atestado pela plataforma Atesta CFM | Res. CFM 2.382/2024 a torna obrigatória, mas está **suspensa por decisão judicial** (processo 1087770-91.2024.4.01.3400) | PDF oficial do CFM |
| Eliminar o papel do prontuário | sistema no nível NGS2, com ICP-Brasil, e comissão de revisão | Res. CFM 1.821/2007; Lei 13.787/2018 |

**Padrão técnico:**
- **Formato:** PAdES (assinatura dentro do PDF), política AD-RB ou AD-RT, com os OIDs de documento de saúde. Sem os OIDs, o VALIDAR do ITI não reconhece o documento como de saúde: CFM 2.16.76.1.4.2.2; prescrição 2.16.76.1.12.1.1; atestado .2; pedido de exame .3; relatório .11.
- **QR code:** no padrão do VALIDAR (validar.iti.gov.br).
- **Certificado em nuvem:** DOC-ICP-17.01 v2.3, padrão comum a todos os provedores.
  - OAuth 2.0 com PKCE.
  - O sistema manda só o **hash** e recebe a assinatura.
  - O médico autoriza no celular. O sistema nunca vê senha nem código.
  - A sessão de assinatura (`signature_session`) permite assinar vários documentos com uma autorização.

**Provedores credenciados com API:** 8 na lista do ITI.

| Provedor | Documentação | Observação |
|---|---|---|
| VIDaaS (Valid) | integração pelo IntegraICP | pede um "channel" ao comercial. O **CFM dá o certificado de graça** ao médico adimplente |
| BirdID / Vault ID (Soluti) | pública, com homologação | R$ 149,90 por ano para o médico |
| NeoID (Serpro) | pública, com homologação | |
| SafeID (Safeweb) | sim | cobra o integrador por volume (50 assinaturas por mês grátis) |
| RemoteID (Certisign) | não confirmado | |

## Decisões para o RT

**A1. O que assina com ICP-Brasil**
- **A (recomendada):** todo documento médico que sai para o paciente ou para outro serviço: receita (comum e de controle especial), atestado, pedido de exame, relatório, encaminhamento, laudo e declaração.
  - Evolução e prescrição do internado seguem com o login de cada um mais o 2FA, como hoje. A lei dispensa os atos internos, e o NGS2 completo fica para depois.
- **B:** tudo, inclusive evolução e prescrição interna (NGS2 completo). Mais assinaturas por plantão.

**A2. Provedor**
- **A (recomendada):** um módulo só, no padrão DOC-ICP-17, que serve a qualquer provedor. Começa pelo VIDaaS, grátis ao médico pelo CFM, e pelo BirdID, que tem documentação aberta. O médico escolhe o seu.
- **B:** um provedor só.

**A3. Como assina no plantão**
- **A (recomendada):** sessão de assinatura. O médico autoriza no celular uma vez no começo do plantão, e cada documento emitido sai assinado, por até 12 horas e só dentro do plantão. A autorização fica registrada.
- **B:** o médico autoriza cada documento no celular.

**A4. Formato e conferência**
- **A (recomendada):** PDF com PAdES AD-RB, os OIDs de saúde e QR code do VALIDAR. O paciente ou a farmácia confere em validar.iti.gov.br, e o link público da receita passa a mostrar o PDF assinado.
- **B:** assinatura separada do PDF (CMS). É mais simples, mas a farmácia não confere pelo VALIDAR.

**A5. Notificação de Receita (A, B e B2) e SNCR**
- **A (recomendada):** primeiro, a assinatura dos documentos (este item). A integração ao SNCR vira um item próprio depois: a ANVISA estendeu a transição até 03/03/2027 e o papel segue valendo. Até lá, a notificação continua impressa no talão da vigilância.
- **B:** integrar ao SNCR junto com a assinatura.

**A6. Credenciais e inscrição** (só o RT pode fazer)
- **A (recomendada):**
  - Você pede as credenciais de homologação à Valid (channel do IntegraICP) e à Soluti (cadastro da aplicação no BirdID). Eu preparo o texto do pedido.
  - Você confere a inscrição da plataforma no CRM, com diretor técnico médico (Res. 2.299, art. 5º).
  - Enquanto as credenciais não chegam, eu faço a parte que não depende delas.
- **B:** esperar o comercial dos provedores procurar a empresa.

**A7. Atesta CFM**
- **A (recomendada):** acompanhar e não integrar enquanto estiver suspensa. Se voltar a valer, integramos ao barramento dela; o prazo da norma é de 180 dias.
- **B:** integrar já.

## Plano depois das decisões

1. **Banco** (expand):
   - a assinatura passa a valer para qualquer documento, não só para prescrição (coluna `documento_id`);
   - o estado `assinado` passa a ser gravado;
   - registro da sessão de assinatura, com quem, quando, provedor e validade;
   - tabela só de inclusão.
2. **PDF:** o PDF do documento passa a ser gerado no servidor (Edge Function), com espaço para a assinatura PAdES e os OIDs. O hash é calculado no servidor.
3. **Módulo DOC-ICP-17:**
   - OAuth com PKCE e envio do hash;
   - nenhuma chave de provedor no navegador;
   - segredos só no servidor.
   - Os testes simulam a resposta do provedor só enquanto não houver credencial de homologação.
4. **Telas:**
   - "Iniciar sessão de assinatura" no começo do plantão;
   - selo "Assinado (ICP-Brasil)" no documento;
   - QR code e link de conferência.
5. **Homologação com o provedor real**, quando as credenciais chegarem.
6. Depois disso, homologação, CI e o seu "ok produção" para cada parte.

**Fora deste item:**
- SNCR (Notificação A e B eletrônica): item novo, se A5 = A;
- certificação SBIS/NGS2 completa;
- eliminação do papel;
- teleconsulta (LG8).
