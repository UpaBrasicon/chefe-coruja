// 7. Realtime (chat) — conexões WebSocket ao Realtime do Supabase, cada uma
// assinando o mesmo canal que o front usa: channel('chat-global') com
// postgres_changes INSERT em chat_mensagens, sem filtro (src/hooks/useChat.ts:186).
// Protocolo igual ao do @supabase/supabase-js 2.106.2 do package-lock: vsn 2.0.0,
// mensagens em array [join_ref, ref, topic, event, payload], heartbeat a cada 25 s.
// Com a 2FA ligada, o join funciona mas a RLS não entrega eventos a JWT sem 2FA.
import ws from 'k6/ws'
import { check } from 'k6'
import { URL, ANON, ALVO } from '../lib/config.js'
import { usuarioDoVU } from '../lib/auth.js'
import exec from 'k6/execution'

export const options = {
  scenarios: {
    realtime: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '3m', target: 200 },
        { duration: '5m', target: 500 }, // até o limite do plano
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: { ws_connecting: ['p(95)<2000'], checks: ['rate>0.95'] },
}

export default function () {
  const vu = exec.vu.idInTest
  const token = usuarioDoVU('plantonista', vu).access_token
  const wsUrl = `${URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${ANON}&vsn=2.0.0`

  const res = ws.connect(wsUrl, {}, (socket) => {
    socket.on('open', () => {
      socket.send(
        JSON.stringify(['1', '1', 'realtime:chat-global', 'phx_join', {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: '', enabled: false },
            postgres_changes: [{ event: 'INSERT', schema: 'public', table: 'chat_mensagens' }],
            private: false,
          },
          access_token: token,
        }]),
      )
      let ref = 2
      socket.setInterval(() => {
        socket.send(JSON.stringify([null, String(ref++), 'phoenix', 'heartbeat', {}]))
      }, 25000)
      socket.setTimeout(() => socket.close(), 60000)
    })
    socket.on('message', (m) => {
      const [, r, , evento, payload] = JSON.parse(m)
      if (r === '1' && evento === 'phx_reply') check(payload, { 'join ok': (p) => p.status === 'ok' })
    })
  })
  check(res, { 'ws 101': (r) => r && r.status === 101 })
}
