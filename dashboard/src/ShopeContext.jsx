import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { ext } from './ext.js'

const Ctx = createContext(null)
export const useShope = () => useContext(Ctx)

let _toastSeq = 0

export function ShopeProvider({ children }) {
  const [s, setS] = useState(null)
  const [connected, setConnected] = useState(false)
  const [toasts, setToasts] = useState([])
  const triedConnect = useRef(false)

  const notify = useCallback((color, message) => {
    const id = ++_toastSeq
    setToasts(t => [...t, { id, color, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  const refresh = useCallback(async () => {
    const r = await ext({ type: 'GET_STATE' })
    if (r?.ok) { setConnected(true); setS(r) } else setConnected(false)
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 4000)
    const onReady = (e) => { if (e.source === window && e.data?.__shopeReady) refresh() }
    window.addEventListener('message', onReady)
    return () => { clearInterval(t); window.removeEventListener('message', onReady) }
  }, [refresh])

  const connectFb = useCallback(async (silent) => {
    const r = await ext({ type: 'CONNECT_FB' }, 20000)
    if (!silent) {
      if (r?.ok && r.conn?.connected) notify('green', `Đã kết nối: ${r.conn.name || r.conn.id}`)
      else notify('red', r?.conn?.note || r?.error || 'Chưa kết nối được Facebook')
    }
    refresh()
    return r
  }, [refresh, notify])

  useEffect(() => {
    if (connected && !triedConnect.current) {
      triedConnect.current = true
      connectFb(true)
      ext({ type: 'CHECK_LICENSE' }).then(() => refresh())   // nạp trạng thái gói/hạn mức
    }
  }, [connected, connectFb, refresh])

  const call = useCallback(async (payload, { okMsg, errMsg, timeout } = {}) => {
    const r = await ext(payload, timeout)
    if (!r?.ok) {
      // Hiện LÝ DO THẬT (kèm nhãn nếu có) để dễ chẩn đoán
      const real = r?.error || 'Lỗi'
      notify('red', errMsg ? `${errMsg}: ${real}` : real)
    } else if (okMsg) notify('green', okMsg)
    refresh()
    return r
  }, [refresh, notify])

  const setCfg = useCallback((cfg) => call({ type: 'SET_CFG', cfg }, { okMsg: 'Đã lưu' }), [call])

  const provider = s?.cfg?.provider || 'anthropic'
  const hasKey = !!((s?.cfg?.apiKeys || {})[provider] || '').trim()

  const value = { s, connected, hasKey, refresh, connectFb, call, setCfg, notify, toasts }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function Toaster() {
  const { toasts } = useShope()
  const C = { green: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', red: 'border-red-500/40 bg-red-500/10 text-red-300', blue: 'border-blue-500/40 bg-blue-500/10 text-blue-300' }
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`max-w-md rounded-lg border px-4 py-2.5 text-sm shadow-xl backdrop-blur ${C[t.color] || C.blue}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
