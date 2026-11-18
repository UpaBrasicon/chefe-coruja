// CMS SignedData destacado para PAdES AD-RB (LG7).
//
// O provedor de certificado em nuvem (DOC-ICP-17) assina só um hash, no
// formato RAW (PKCS#1 v1.5). Por isso o CMS é montado aqui, igual para
// qualquer provedor:
//   1. atributosAssinados(): os quatro atributos exigidos pela política;
//   2. hashParaAssinar(): SHA-256 do DER dos atributos (como SET), que vai ao provedor;
//   3. montarCms(): junta a assinatura RAW devolvida, o certificado e a cadeia.
import { createHash, webcrypto } from 'node:crypto'
import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'

import { OID, POLITICA_PADES_AD_RB } from './politica.ts'

pkijs.setEngine('node', new pkijs.CryptoEngine({ name: 'node', crypto: webcrypto as unknown as Crypto }))

const buf = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b))
const ab = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

export function lerCertificado(der: Uint8Array): pkijs.Certificate {
  return pkijs.Certificate.fromBER(ab(der))
}

function algoritmo(oid: string) {
  return new pkijs.AlgorithmIdentifier({ algorithmId: oid, algorithmParams: new asn1js.Null() })
}

/** Os atributos assinados exigidos pela PAdES AD-RB v1.1 da ICP-Brasil. */
export function atributosAssinados(digestPdf: Uint8Array, certificadoDer: Uint8Array): pkijs.Attribute[] {
  const cert = lerCertificado(certificadoDer)
  const hashCert = createHash('sha256').update(certificadoDer).digest()
  // ESSCertIDv2 { certHash, issuerSerial { issuer GeneralNames(directoryName), serialNumber } };
  // o hashAlgorithm SHA-256 é o padrão e fica de fora (DER)
  const issuerSerial = new asn1js.Sequence({
    value: [
      new asn1js.Sequence({
        value: [new asn1js.Constructed({ idBlock: { tagClass: 3, tagNumber: 4 }, value: [cert.issuer.toSchema()] })],
      }),
      cert.serialNumber,
    ],
  })
  const essCertIdV2 = new asn1js.Sequence({
    value: [new asn1js.OctetString({ valueHex: ab(hashCert) }), issuerSerial],
  })
  const signingCertificateV2 = new asn1js.Sequence({ value: [new asn1js.Sequence({ value: [essCertIdV2] })] })

  const politica = new asn1js.Sequence({
    value: [
      new asn1js.ObjectIdentifier({ value: POLITICA_PADES_AD_RB.oid }),
      new asn1js.Sequence({
        value: [
          algoritmo(POLITICA_PADES_AD_RB.hashOid).toSchema(),
          new asn1js.OctetString({ valueHex: ab(Buffer.from(POLITICA_PADES_AD_RB.hashHex, 'hex')) }),
        ],
      }),
      new asn1js.Sequence({
        value: [
          new asn1js.Sequence({
            value: [new asn1js.ObjectIdentifier({ value: OID.spqEtsUri }), new asn1js.IA5String({ value: POLITICA_PADES_AD_RB.uri })],
          }),
        ],
      }),
    ],
  })

  return [
    new pkijs.Attribute({ type: OID.contentType, values: [new asn1js.ObjectIdentifier({ value: OID.data })] }),
    new pkijs.Attribute({ type: OID.messageDigest, values: [new asn1js.OctetString({ valueHex: ab(digestPdf) })] }),
    new pkijs.Attribute({ type: OID.signingCertificateV2, values: [signingCertificateV2] }),
    new pkijs.Attribute({ type: OID.sigPolicyId, values: [politica] }),
  ]
}

/** DER dos atributos como SET OF (o que a assinatura cobre, RFC 5652 §5.4). */
export function derDosAtributos(atributos: pkijs.Attribute[]): Uint8Array {
  const assinados = new pkijs.SignedAndUnsignedAttributes({ type: 0, attributes: atributos })
  const der = new Uint8Array(assinados.toSchema().toBER(false))
  der[0] = 0x31 // [0] IMPLICIT → SET
  return der
}

/** O hash que vai ao provedor (assinatura RAW): SHA-256 do DER dos atributos. */
export function hashParaAssinar(atributos: pkijs.Attribute[]): Uint8Array {
  return createHash('sha256').update(derDosAtributos(atributos)).digest()
}

/** ContentInfo(SignedData) destacado, pronto para ir no /Contents do PDF. */
export function montarCms(p: {
  atributos: pkijs.Attribute[]
  assinaturaRaw: Uint8Array
  certificadoDer: Uint8Array
  cadeiaDer?: Uint8Array[]
}): Uint8Array {
  const cert = lerCertificado(p.certificadoDer)
  const signerInfo = new pkijs.SignerInfo({
    version: 1,
    sid: new pkijs.IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }),
    digestAlgorithm: algoritmo(OID.sha256),
    signedAttrs: new pkijs.SignedAndUnsignedAttributes({ type: 0, attributes: p.atributos }),
    signatureAlgorithm: algoritmo(OID.sha256ComRsa),
    signature: new asn1js.OctetString({ valueHex: ab(p.assinaturaRaw) }),
  })
  const signedData = new pkijs.SignedData({
    version: 1,
    digestAlgorithms: [algoritmo(OID.sha256)],
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: OID.data }),
    certificates: [cert, ...(p.cadeiaDer ?? []).map(lerCertificado)],
    signerInfos: [signerInfo],
  })
  const contentInfo = new pkijs.ContentInfo({ contentType: OID.signedData, content: signedData.toSchema(true) })
  return new Uint8Array(contentInfo.toSchema().toBER(false))
}

/**
 * Confere o CMS contra os bytes cobertos do PDF: o messageDigest bate e a
 * assinatura do certificado é válida. Não confere a cadeia até a raiz da
 * ICP-Brasil (isso é do VALIDAR); confere a validade do certificado.
 */
export async function conferirCms(cmsDer: Uint8Array, dadosCobertos: Uint8Array, agora = new Date()): Promise<{ ok: boolean; motivo?: string }> {
  const ci = pkijs.ContentInfo.fromBER(ab(cmsDer))
  if (ci.contentType !== OID.signedData) return { ok: false, motivo: 'não é SignedData' }
  const sd = new pkijs.SignedData({ schema: ci.content })
  const cert = sd.certificates?.[0]
  if (!(cert instanceof pkijs.Certificate)) return { ok: false, motivo: 'sem certificado' }
  if (agora < cert.notBefore.value || agora > cert.notAfter.value) return { ok: false, motivo: 'certificado fora da validade' }
  try {
    const ok = await sd.verify({ signer: 0, data: ab(dadosCobertos), checkChain: false })
    return ok ? { ok: true } : { ok: false, motivo: 'assinatura não confere' }
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) }
  }
}

export const hex = (b: Uint8Array | ArrayBuffer) => buf(b).toString('hex')
