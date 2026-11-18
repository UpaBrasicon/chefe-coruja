# LG7, decisão A6: pedido das credenciais de homologação e inscrição no CRM

Decisão do RT em 18/11/2026: A1–A7 = A (`LG7-ASSINATURA-ICP-DIAGNOSTICO.md`). Quem manda os pedidos e faz a inscrição é o RT. Eu não contato ninguém.

**O que nunca vai no e-mail:** senha, chave, dado de paciente ou print de tela com paciente. Quando o provedor mandar `client_id` e `client_secret`, eles não vão no chat: você grava no terminal do VPS, por um comando que eu preparo, como na troca de chaves.

## 1. Valid (VIDaaS, pelo IntegraICP)

- **Para quem:** o comercial de integração da Valid, pelo formulário ou contato da página https://validcertificadora.com.br/pages/psc-integracao-via-api
- **Por que primeiro:** o CFM dá o certificado VIDaaS de graça ao médico adimplente. A equipe da unidade já pode ter um.

> **Assunto:** Integração VIDaaS (IntegraICP) para prontuário eletrônico: pedido de channel de homologação
>
> Olá,
>
> Somos a Chefe Coruja, empresa brasileira de prontuário eletrônico e gestão para UPA, hospital e UBS. Queremos que os médicos assinem com o certificado VIDaaS receitas, atestados, pedidos de exame e relatórios emitidos no nosso sistema. A assinatura será PAdES, com os OIDs de documento de saúde e conferência pelo VALIDAR do ITI.
>
> Pedimos:
> 1. o channel (chave de acesso) do ambiente de homologação do IntegraICP;
> 2. a documentação da API v3 e as condições comerciais para produção;
> 3. a confirmação de que a integração segue o DOC-ICP-17 (OAuth 2.0 com PKCE, envio só do hash) e aceita o escopo `signature_session`, para o médico autorizar uma vez por plantão.
>
> Responsável técnico: [nome], CRM [número]/[UF].
>
> Obrigado,
> [nome] · [telefone] · contato@chefecoruja.com.br

## 2. Soluti (BirdID / Vault ID)

- **Para quem:** o comercial da Soluti. A documentação é aberta (https://docs.vaultid.com.br), mas o cadastro da aplicação e o push no celular dependem do comercial.

> **Assunto:** Integração BirdID para prontuário eletrônico: cadastro da aplicação em homologação
>
> Olá,
>
> Somos a Chefe Coruja, empresa brasileira de prontuário eletrônico para UPA, hospital e UBS. Queremos integrar o BirdID para os médicos assinarem receitas, atestados e outros documentos (PAdES com OIDs de saúde).
>
> Pedimos:
> 1. o cadastro da nossa aplicação no ambiente de homologação (client_id, client_secret e o endereço de retorno https://homolog.chefecoruja.com.br/assinatura/retorno);
> 2. a liberação da notificação no celular (push) para o fluxo de autorização;
> 3. as condições para produção.
>
> Responsável técnico: [nome], CRM [número]/[UF].
>
> Obrigado,
> [nome] · [telefone] · contato@chefecoruja.com.br

## 3. Inscrição da plataforma no CRM (Res. CFM 2.299/2021, art. 5º)

A norma pede que a plataforma de prescrição eletrônica esteja inscrita no CRM, com diretor técnico médico. A conferir com o CRM do seu estado:
1. Se a empresa precisa de inscrição como pessoa jurídica no CRM, e com que documentos.
2. Quem fica como diretor técnico médico da plataforma (provavelmente você).
3. Se o CRM tem lista pública de plataformas inscritas, e como pedir a inclusão.

Este ponto é jurídico-administrativo: vale levar ao advogado junto com os rascunhos do LG1 a LG5.

## 4. O que eu faço enquanto as credenciais não chegam

1. Banco (expand): assinatura por documento, sessão de assinatura e o estado `assinado` gravado.
2. PDF do documento gerado no servidor, com o espaço da assinatura PAdES e os OIDs de saúde.
3. Módulo do DOC-ICP-17 (PKCE e envio do hash), testado contra um servidor de teste que segue o padrão. Nenhuma assinatura falsa é mostrada como válida.
4. Telas: "Iniciar sessão de assinatura", selo e QR code. Ficam desligadas até a primeira homologação real.
