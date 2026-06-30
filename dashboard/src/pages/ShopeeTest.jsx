import { useState } from 'react'
import { IconSearch, IconExternalLink, IconShoppingCart, IconBolt, IconEyeOff } from '@tabler/icons-react'
import { ext } from '../ext.js'
import { Card, Btn, Badge, Empty, Hint, Input } from '../ui.jsx'

const fmtP = (n) => n ? n.toLocaleString('vi') + '₫' : '—'

export default function ShopeeTest() {
  const [keyword, setKeyword] = useState('')
  const [busy, setBusy] = useState('')   // 'focus' | 'nofocus' | ''
  const [res, setRes] = useState(null)

  const run = async (focus) => {
    const kw = keyword.trim()
    if (!kw) return
    setBusy(focus ? 'focus' : 'nofocus'); setRes(null)
    const r = await ext({ type: 'TEST_SHOPEE_SEARCH', keyword: kw, focus, limit: 10 }, 60000)
    setBusy(''); setRes(r || { ok: false, error: 'extension không phản hồi' })
  }

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-bold text-slate-100">Lấy link (test) — tìm SP Shopee</h1>

      <Hint id="shopeetest">
        Test bước <b>tìm sản phẩm trên Shopee</b> (scrape trang search). So sánh 2 chế độ:
        {' '}<b>CÓ focus</b> = hiện tab Shopee 1 nhịp cho render (nháy màn hình) · <b>KHÔNG focus</b> = chạy ngầm (êm nhưng tab nền có thể bị Chrome "đóng băng" → 0 SP).
        {' '}Mở sẵn <b>1 tab shopee.vn đã đăng nhập</b> trước khi test.
      </Hint>

      <Card className="space-y-3 p-4">
        <Input placeholder="Từ khoá SP (vd: dép đúc, tai nghe bluetooth…)" value={keyword}
          onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && run(true)} />
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" icon={IconBolt} loading={busy === 'focus'} disabled={!!busy || !keyword.trim()} onClick={() => run(true)}>Tìm (CÓ focus)</Btn>
          <Btn variant="default" icon={IconEyeOff} loading={busy === 'nofocus'} disabled={!!busy || !keyword.trim()} onClick={() => run(false)}>Tìm (KHÔNG focus)</Btn>
        </div>
      </Card>

      {res && (
        res.ok ? (
          <Card className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3 text-sm">
              <Badge color={res.items.length ? 'green' : 'red'}>{res.items.length} SP</Badge>
              <Badge color={res.focus ? 'orange' : 'gray'}>{res.focus ? 'CÓ focus' : 'KHÔNG focus'}</Badge>
              <span className="text-slate-400">{res.ms}ms</span>
              {res.items.length === 0 && <span className="text-red-400">→ không scrape được SP (tab có thể bị đóng băng / Shopee chặn)</span>}
            </div>
            {res.items.length === 0
              ? <Empty icon={IconShoppingCart}>0 sản phẩm. Thử lại với <b>CÓ focus</b>, hoặc kiểm tra tab shopee.vn đã đăng nhập.</Empty>
              : <div className="max-h-[26rem] divide-y divide-slate-800 overflow-y-auto">
                {res.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 text-sm">
                    <span className="w-5 shrink-0 text-center text-xs text-slate-600">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-slate-200">{it.name}</div>
                      <div className="truncate text-xs text-slate-500">{it.productUrl}</div>
                    </div>
                    <span className="shrink-0 font-medium text-orange-400">{fmtP(it.price)}</span>
                    <a href={it.productUrl} target="_blank" rel="noreferrer" className="shrink-0 text-slate-500 hover:text-indigo-400"><IconExternalLink size={15} /></a>
                  </div>
                ))}
              </div>}
          </Card>
        ) : (
          <Card className="border-red-500/30 bg-red-500/[0.06] p-4 text-sm text-red-300">✗ Lỗi: {res.error} {res.ms ? `(${res.ms}ms)` : ''}</Card>
        )
      )}
    </div>
  )
}
