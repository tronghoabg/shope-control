import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { ext } from './ext.js'

const Ctx = createContext(null)
export const useShope = () => useContext(Ctx)

let _toastSeq = 0

// Bản sao dữ liệu nhóm lưu vào localStorage của WEB (bền hơn extension — cài lại extension vẫn còn).
const GROUP_CACHE_KEY = 'tmkt_groups_v1'
const GROUP_KEYS = ['discoveredGroups', 'groupsSyncedAt', 'searchResults', 'searchAt', 'savedGroupLists', 'savedPageLists', 'savedPosts']

export function ShopeProvider({ children }) {
  const [s, setS] = useState(null)
  const [connected, setConnected] = useState(false)
  const [toasts, setToasts] = useState([])
  const [account, setAccount] = useState(null)   // tài khoản web (từ /api/me)
  const triedConnect = useRef(false)
  const restoredGroups = useRef(false)
  const failCount = useRef(0)

  const notify = useCallback((color, message) => {
    const id = ++_toastSeq
    setToasts(t => [...t, { id, color, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  const refresh = useCallback(async () => {
    if (typeof window !== 'undefined' && window.location.search.includes('promo=1')) {
      setConnected(true)
      setS({
        cfg: {
          dailyCap: 30, minDelaySec: 90, maxDelaySec: 240, mode: 'comment', autoEnabled: true, autoLimit: 50, autoDelaySec: 30,
          targetType: 'all', minGroupMembers: 1000, targetGroups: ['1', '2', '3']
        },
        stats: { totalCommented: 1254, totalFound: 3820 },
        state: { doneToday: 18 },
        queue: [
          { postId: '111', groupName: 'Hội Review Đồ Gia Dụng', comment: 'Em thấy mã này bên Shopee đang Flash Sale giảm 50% rẻ hơn ngoài store nhiều lắm, các bác tham khảo thử nhé! Link đây ạ: https://shp.ee/...', score: 95, permalink: '#' },
          { postId: '222', groupName: 'Cộng đồng Affiliate Việt Nam', comment: 'Bên mình có tool hỗ trợ rải link tự động siêu nhàn, tiết kiệm thời gian mà vẫn đảm bảo an toàn. Bác nào quan tâm inbox mình share nhé!', score: 88, permalink: '#' },
          { postId: '333', groupName: 'Nghiện Mua Sắm Shopee', comment: 'Áo này chất thun gân mặc mát lắm, form lên chuẩn đẹp. Đợt trước mình mua link này uy tín nè: https://shp.ee/...', score: 92, permalink: '#' }
        ],
        discoveredGroups: [
          { id: '1', name: 'Cộng đồng Affiliate Việt Nam', member_count: 125000 },
          { id: '2', name: 'Nghiện Mua Sắm Shopee', member_count: 550000 },
          { id: '3', name: 'Review Đồ Gia Dụng', member_count: 85000 },
          { id: '4', name: 'Hội Mẹ Bỉm Sữa', member_count: 320000 }
        ]
      })
      return
    }

    let r = await ext({ type: 'GET_STATE' })
    if (!r?.ok) {
      failCount.current++
      if (failCount.current >= 3) setConnected(false)
      return
    }
    failCount.current = 0

    // Extension trống dữ liệu (vd vừa cài lại extension) nhưng web localStorage có bản sao
    // → đẩy bản sao trở lại extension MỘT lần để khôi phục nguồn dữ liệu.
    const extEmpty = !(r.discoveredGroups?.length) && !(r.savedGroupLists?.length) && !(r.savedPageLists?.length)
    if (!restoredGroups.current && extEmpty) {
      restoredGroups.current = true
      try {
        const cached = JSON.parse(localStorage.getItem(GROUP_CACHE_KEY) || 'null')
        if (cached && (cached.discoveredGroups?.length || cached.savedGroupLists?.length || cached.savedPageLists?.length)) {
          await ext({ type: 'RESTORE_GROUPS', snapshot: cached })
          const r2 = await ext({ type: 'GET_STATE' })
          if (r2?.ok) r = r2
        }
      } catch {}
    }

    // Sao lưu dữ liệu nhóm/page vào localStorage của web (bền hơn extension)
    try {
      if (r.discoveredGroups?.length || r.searchResults?.length || r.savedGroupLists?.length || r.savedPageLists?.length) {
        const snap = {}
        for (const k of GROUP_KEYS) if (r[k] != null) snap[k] = r[k]
        localStorage.setItem(GROUP_CACHE_KEY, JSON.stringify(snap))
      }
    } catch {}

    setConnected(true); setS(r)
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
    }
  }, [connected, connectFb])

  // Nạp tài khoản web NGAY khi mở (không phụ thuộc extension) → ô tài khoản không kẹt "Đang tải".
  const refreshAccount = useCallback(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { loggedIn: false })
      .then(setAccount)
      .catch(() => setAccount({ loggedIn: false }))
  }, [])
  useEffect(() => { refreshAccount() }, [refreshAccount])

  // Tự liên kết extension khi đã kết nối + đã đăng nhập (không cần dán token)
  const linkedRef = useRef(false)
  useEffect(() => {
    if (!connected || linkedRef.current || !account?.loggedIn || !account.apiToken) return
    linkedRef.current = true
    ;(async () => {
      const st = await ext({ type: 'GET_STATE' })
      if (st?.cfg?.licenseToken !== account.apiToken) {
        await ext({ type: 'SET_CFG', cfg: { licenseToken: account.apiToken, webBase: window.location.origin } })
      }
      await ext({ type: 'CHECK_LICENSE' })
      refresh()
    })()
  }, [connected, account, refresh])

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

  const setCfg = useCallback((cfg) => call({ type: 'SET_CFG', cfg }), [call])

  // AI do hệ thống cung cấp → chỉ cần đăng nhập tài khoản là dùng được (không còn API key riêng).
  const aiReady = !!account?.loggedIn || (typeof window !== 'undefined' && window.location.search.includes('promo=1'))

  const value = { s, connected, aiReady, account: account || (typeof window !== 'undefined' && window.location.search.includes('promo=1') ? { loggedIn: true, profile: { name: 'Promo Account', email: 'promo@toolmktai.com' } } : null), refresh, refreshAccount, connectFb, call, setCfg, notify, toasts }
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
