// Política de assinatura ICP-Brasil usada nos documentos (LG7).
//
// PAdES AD-RB v1.1, lida em 18/11/2026 dos arquivos oficiais do ITI:
//   - Lista de Políticas: http://politicas.icpbrasil.gov.br/LPA_PAdES.der
//     (entrada 2.16.76.1.7.1.11.1.1, válida de 14/05/2018 a 02/03/2029,
//      SHA-256 do arquivo da política = 95752d26…3b9cb1)
//   - Política: http://politicas.icpbrasil.gov.br/PA_PAdES_AD_RB_v1_1.der
//     (campo signPolicyHash = 44fc5816…bb63f8; atributos assinados exigidos:
//      contentType, messageDigest, signingCertificateV2 e sigPolicyId;
//      algoritmos sha256WithRSAEncryption ou sha512WithRSAEncryption, RSA ≥ 2048)
// O hash que vai no atributo sigPolicyId é o signPolicyHash de dentro da
// política (como faz o Demoiselle Signer). Conferir na homologação com o VALIDAR.

export const POLITICA_PADES_AD_RB = {
  oid: '2.16.76.1.7.1.11.1.1',
  nome: 'AD-RB',
  uri: 'http://politicas.icpbrasil.gov.br/PA_PAdES_AD_RB_v1_1.der',
  hashOid: '2.16.840.1.101.3.4.2.1', // SHA-256
  hashHex: '44fc5816eb2d705d8c8f022a7f93b3fb49edfae1a7b9149ef6fab833e9bb63f8',
  validaAte: '2029-03-02T00:00:00Z',
} as const

export const OID = {
  data: '1.2.840.113549.1.7.1',
  signedData: '1.2.840.113549.1.7.2',
  contentType: '1.2.840.113549.1.9.3',
  messageDigest: '1.2.840.113549.1.9.4',
  signingCertificateV2: '1.2.840.113549.1.9.16.2.47',
  sigPolicyId: '1.2.840.113549.1.9.16.2.15',
  spqEtsUri: '1.2.840.113549.1.9.16.5.1',
  sha256: '2.16.840.1.101.3.4.2.1',
  sha256ComRsa: '1.2.840.113549.1.1.11',
  // ICP-Brasil: dados da pessoa física no certificado (data de nascimento + CPF + …)
  icpPessoaFisica: '2.16.76.1.3.1',
} as const

// Documentos de saúde (VALIDAR do ITI; ADE-ICP-04.01). O VALIDAR só trata como
// documento de saúde o PDF que traz estes OIDs nos metadados.
export const OID_SAUDE = {
  crmNumero: '2.16.76.1.4.2.2.1',
  crmUf: '2.16.76.1.4.2.2.2',
  tipo: {
    prescricao: '2.16.76.1.12.1.1',
    atestado: '2.16.76.1.12.1.2',
    solicitacao_exame: '2.16.76.1.12.1.3',
    relatorio: '2.16.76.1.12.1.11',
  },
} as const
