// ─────────────────────────────────────────────────────────────────────────────
// Apache Thrift, protocolo binário (TBinaryProtocol), só o que o LEDI APS usa.
//
// O LEDI APS 8.7.0 descreve cada ficha como um struct do Thrift: os campos
// levam o número (#N) dos dicionários de dados, e os tipos são String (string),
// Long (i64), Integer (i32), Boolean (bool), Double (double), Binary (binary) e
// List<…> (list). Sem dependência: o escritor monta os bytes e o leitor existe
// para os testes conferirem o que foi escrito.
// Especificação do protocolo: https://github.com/apache/thrift/blob/master/doc/specs/thrift-binary-protocol.md
// ─────────────────────────────────────────────────────────────────────────────

export const TIPO = { BOOL: 2, DOUBLE: 4, I32: 8, I64: 10, STRING: 11, STRUCT: 12, LIST: 15 } as const
export type TipoThrift = (typeof TIPO)[keyof typeof TIPO]

/** Valor de um campo: o tipo do Thrift e o conteúdo. */
export type Valor =
  | { t: typeof TIPO.BOOL; v: boolean }
  | { t: typeof TIPO.DOUBLE; v: number }
  | { t: typeof TIPO.I32; v: number }
  | { t: typeof TIPO.I64; v: number | bigint }
  | { t: typeof TIPO.STRING; v: string | Uint8Array }
  | { t: typeof TIPO.STRUCT; v: Struct }
  | { t: typeof TIPO.LIST; elem: TipoThrift; v: Valor[] }

/** Struct: número do campo e valor; o campo ausente (undefined) não é escrito. */
export type Struct = Record<number, Valor | undefined>

export const bool = (v: boolean): Valor => ({ t: TIPO.BOOL, v })
export const double = (v: number): Valor => ({ t: TIPO.DOUBLE, v })
export const i32 = (v: number): Valor => ({ t: TIPO.I32, v })
export const i64 = (v: number | bigint): Valor => ({ t: TIPO.I64, v })
export const str = (v: string | Uint8Array): Valor => ({ t: TIPO.STRING, v })
export const struct = (v: Struct): Valor => ({ t: TIPO.STRUCT, v })
export const lista = (elem: TipoThrift, v: Valor[]): Valor => ({ t: TIPO.LIST, elem, v })

class Buffer {
  private partes: Uint8Array[] = []
  private tamanho = 0
  push(b: Uint8Array) { this.partes.push(b); this.tamanho += b.length }
  u8(n: number) { this.push(Uint8Array.of(n & 0xff)) }
  i16(n: number) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, n); this.push(b) }
  i32(n: number) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n); this.push(b) }
  i64(n: number | bigint) { const b = new Uint8Array(8); new DataView(b.buffer).setBigInt64(0, BigInt(n)); this.push(b) }
  f64(n: number) { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, n); this.push(b) }
  bytes(): Uint8Array {
    const out = new Uint8Array(this.tamanho)
    let p = 0
    for (const b of this.partes) { out.set(b, p); p += b.length }
    return out
  }
}

function escreverValor(b: Buffer, x: Valor) {
  switch (x.t) {
    case TIPO.BOOL: b.u8(x.v ? 1 : 0); break
    case TIPO.DOUBLE: b.f64(x.v); break
    case TIPO.I32: b.i32(x.v); break
    case TIPO.I64: b.i64(x.v); break
    case TIPO.STRING: {
      const bytes = typeof x.v === 'string' ? new TextEncoder().encode(x.v) : x.v
      b.i32(bytes.length); b.push(bytes); break
    }
    case TIPO.STRUCT: escreverStruct(b, x.v); break
    case TIPO.LIST:
      b.u8(x.elem); b.i32(x.v.length)
      for (const e of x.v) {
        if (e.t !== x.elem) throw new Error(`lista de tipo ${x.elem} com elemento de tipo ${e.t}`)
        escreverValor(b, e)
      }
      break
  }
}

function escreverStruct(b: Buffer, s: Struct) {
  for (const id of Object.keys(s).map(Number).sort((a, c) => a - c)) {
    const x = s[id]
    if (x === undefined) continue
    b.u8(x.t); b.i16(id); escreverValor(b, x)
  }
  b.u8(0) // STOP
}

/** Serializa o struct no protocolo binário do Thrift. */
export function serializar(s: Struct): Uint8Array {
  const b = new Buffer()
  escreverStruct(b, s)
  return b.bytes()
}

// ── leitor (para os testes) ──────────────────────────────────────────────────
export type Lido = boolean | number | bigint | Uint8Array | Lido[] | { [id: number]: Lido }

export function desserializar(bytes: Uint8Array): { [id: number]: Lido } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let p = 0
  const ler = (t: number): Lido => {
    switch (t) {
      case TIPO.BOOL: return dv.getUint8(p++) === 1
      case TIPO.DOUBLE: { const v = dv.getFloat64(p); p += 8; return v }
      case TIPO.I32: { const v = dv.getInt32(p); p += 4; return v }
      case TIPO.I64: { const v = dv.getBigInt64(p); p += 8; return v }
      case TIPO.STRING: { const n = dv.getInt32(p); p += 4; const v = bytes.slice(p, p + n); p += n; return v }
      case TIPO.STRUCT: return lerStruct()
      case TIPO.LIST: {
        const e = dv.getUint8(p++); const n = dv.getInt32(p); p += 4
        return Array.from({ length: n }, () => ler(e))
      }
      default: throw new Error(`tipo ${t} não suportado`)
    }
  }
  const lerStruct = (): { [id: number]: Lido } => {
    const s: { [id: number]: Lido } = {}
    for (;;) {
      const t = dv.getUint8(p++)
      if (t === 0) return s
      const id = dv.getInt16(p); p += 2
      s[id] = ler(t)
    }
  }
  const s = lerStruct()
  if (p !== bytes.length) throw new Error(`sobraram ${bytes.length - p} bytes`)
  return s
}

export const texto = (x: Lido | undefined) => (x instanceof Uint8Array ? new TextDecoder().decode(x) : undefined)
