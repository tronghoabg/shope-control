import { useState } from 'react'
import { IconLink, IconCopy, IconBolt, IconExternalLink, IconSearch, IconShoppingCart, IconEyeOff, IconCheck } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Btn, Field, Input, Textarea, Badge, Card, Empty, Hint } from '../ui.jsx'
import { ext } from '../ext.js'

const SAMPLE_LINKS = `https://shopee.vn/flash_sale
https://shopee.vn/product/123456/7890123`

const fmtP = (n) => n ? n.toLocaleString('vi') + '₫' : '—'

export default function Tools() {
  const [tab, setTab] = useState('link') // 'link' | 'scrape'
  const { s, notify } = useShope()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 bg-gradient-to-r from-indigo-200 via-slate-100 to-indigo-100 bg-clip-text text-transparent">Công cụ kiểm tra (Debug Tools)</h1>
          <p className="text-sm text-slate-400">Kiểm tra cơ chế tạo link và tìm kiếm sản phẩm trên Shopee để đảm bảo hệ thống hoạt động ổn định.</p>
        </div>
        <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-800">
          <button
            onClick={() => setTab('link')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === 'link'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <IconLink size={16} />
            <span>Tạo Link Affiliate</span>
          </button>
          <button
            onClick={() => setTab('scrape')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === 'scrape'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <IconShoppingCart size={16} />
            <span>Test Scrape Shopee</span>
          </button>
        </div>
      </div>

      {tab === 'link' ? <LinkToolSection notify={notify} /> : <ScrapeToolSection notify={notify} />}
    </div>
  )
}

function LinkToolSection({ notify }) {
  const [raw, setRaw] = useState('')
  const [subId, setSubId] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState([])

  const links = raw.split('\n').map(s => s.trim()).filter(Boolean)

  const run = async () => {
    if (!links.length) { notify('red', 'Chưa nhập link nào'); return }
    setBusy(true); setRows([])
    const r = await ext({ type: 'MAKE_LINKS', links, subId }, 120000)
    setBusy(false)
    if (!r?.ok) { notify('red', r?.error || 'Lỗi tạo link'); return }
    setRows(r.results || [])
    const okN = (r.results || []).filter(x => x.ok).length
    const via = (r.results || []).find(x => x.ok)?.via
    notify(okN ? 'green' : 'red', `Tạo ${okN}/${(r.results || []).length} link${via ? ` (qua ${via})` : ''}`)
  }

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); notify('green', 'Đã copy') }
    catch { notify('red', 'Không copy được') }
  }
  const copyAll = () => {
    const all = rows.filter(x => x.ok).map(x => x.shortLink).join('\n')
    if (all) copy(all)
  }

  const okCount = rows.filter(x => x.ok).length

  return (
    <div className="space-y-5 animate-fadeIn">
      <Hint id="linktool">
        Thử nghiệm cơ chế chuyển đổi link sản phẩm Shopee sang link rút gọn có gắn mã affiliate. 
        Mã sẽ tự động dùng API affiliate hoặc tự động click qua tab Shopee nếu chạy ngầm bị lỗi.
      </Hint>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <Section title="Dán danh sách link Shopee (Mỗi dòng 1 link)">
            <Textarea 
              rows={8} 
              placeholder={SAMPLE_LINKS} 
              value={raw} 
              onChange={(e) => setRaw(e.target.value)} 
              className="font-mono text-xs" 
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Mã theo dõi sub_id (tùy chọn)">
                <Input value={subId} onChange={(e) => setSubId(e.target.value)} placeholder="vd: facebook-auto" />
              </Field>
              <div className="flex items-end">
                <Btn variant="primary" icon={IconBolt} loading={busy} disabled={!links.length} onClick={run} className="w-full">
                  Tạo {links.length ? links.length : ''} link affiliate
                </Btn>
              </div>
            </div>
          </Section>
        </div>

        <div>
          <Card className="p-5 h-full flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-100 mb-2">Thông tin lưu ý</h3>
              <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
                <li>Vui lòng đăng nhập sẵn tài khoản affiliate tại trang <a href="https://affiliate.shopee.vn" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">affiliate.shopee.vn</a>.</li>
                <li>Hệ thống ưu tiên sử dụng Service Worker chạy ngầm để tăng tốc độ.</li>
                <li>Nếu bị lỗi hoặc bị chặn, hệ thống sẽ tự động bật tab phụ của trình duyệt lên để cào và lấy link, sau đó tự đóng.</li>
              </ul>
            </div>
            {rows.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="text-xs text-slate-500 mb-1">Kết quả tạo link:</div>
                <div className="text-lg font-bold text-slate-200">{okCount} / {rows.length} thành công</div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {rows.length > 0 ? (
        <Section 
          title={`Danh sách link đã tạo (${okCount}/${rows.length})`} 
          right={okCount > 0 ? <Btn size="sm" icon={IconCopy} onClick={copyAll}>Copy toàn bộ link rút gọn</Btn> : null}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((x, i) => (
              <Card key={i} className={`p-4 border ${x.ok ? 'border-slate-800/80' : 'border-red-950/40 bg-red-950/5'}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  {x.ok ? <Badge color="green">Thành công · {x.via}</Badge> : <Badge color="red">Thất bại</Badge>}
                  <span className="truncate text-[10px] text-slate-500 max-w-[180px]" title={x.originalLink}>{x.originalLink}</span>
                </div>
                {x.ok ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2 text-xs text-emerald-400 font-mono">{x.shortLink}</code>
                    <Btn size="sm" icon={IconCopy} onClick={() => copy(x.shortLink)} className="shrink-0">Copy</Btn>
                    <a href={x.shortLink} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300">
                      <IconExternalLink size={14} />
                    </a>
                  </div>
                ) : (
                  <div className="text-xs text-red-400 bg-red-950/10 border border-red-900/30 rounded-lg p-2.5 break-words">{x.error}</div>
                )}
              </Card>
            ))}
          </div>
        </Section>
      ) : !busy && (
        <Empty icon={IconLink}>Nhập danh sách liên kết sản phẩm Shopee ở trên và bấm nút tạo để chạy thử nghiệm.</Empty>
      )}
    </div>
  )
}

function ScrapeToolSection({ notify }) {
  const [keyword, setKeyword] = useState('')
  const [busy, setBusy] = useState('') // 'focus' | 'nofocus' | ''
  const [res, setRes] = useState(null)

  const run = async (focus) => {
    const kw = keyword.trim()
    if (!kw) return
    setBusy(focus ? 'focus' : 'nofocus'); setRes(null)
    const r = await ext({ type: 'TEST_SHOPEE_SEARCH', keyword: kw, focus, limit: 10 }, 60000)
    setBusy(''); setRes(r || { ok: false, error: 'extension không phản hồi' })
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <Hint id="shopeetest">
        Kiểm tra cơ chế tự động <b>tìm kiếm sản phẩm trên Shopee</b>. Hệ thống sẽ cào dữ liệu trang kết quả tìm kiếm Shopee.<br />
        - <b>Có Focus</b>: Bật hiển thị tab Shopee 1 nhịp (đảm bảo Shopee render nội dung đầy đủ).<br />
        - <b>Không Focus</b>: Tìm chạy ngầm (tiện dụng nhưng đôi lúc bị Chrome đưa vào trạng thái đóng băng).
      </Hint>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="md:col-span-2">
          <Section title="Nhập từ khóa tìm kiếm sản phẩm">
            <div className="space-y-4">
              <Input 
                placeholder="Từ khóa sản phẩm (vd: dép bánh mì nam, tai nghe chụp tai…)" 
                value={keyword}
                onChange={e => setKeyword(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && run(true)} 
              />
              <div className="flex flex-wrap gap-3">
                <Btn variant="primary" icon={IconBolt} loading={busy === 'focus'} disabled={!!busy || !keyword.trim()} onClick={() => run(true)}>
                  Tìm kiếm (Có Focus tab)
                </Btn>
                <Btn variant="default" icon={IconEyeOff} loading={busy === 'nofocus'} disabled={!!busy || !keyword.trim()} onClick={() => run(false)}>
                  Tìm kiếm ngầm (Không Focus)
                </Btn>
              </div>
            </div>
          </Section>
        </div>

        <div>
          <Card className="p-5 h-full">
            <h3 className="font-semibold text-slate-100 mb-2">Lời khuyên vận hành</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mở sẵn <b>ít nhất 1 tab shopee.vn đã đăng nhập</b> trên cùng trình duyệt này. 
              Nếu chạy ngầm (Không Focus) trả về kết quả trống, hãy chuyển sang chế độ <b>Có Focus tab</b> để cào dữ liệu tốt hơn.
            </p>
          </Card>
        </div>
      </div>

      {res && (
        res.ok ? (
          <Section 
            title="Kết quả scrape sản phẩm" 
            right={
              <div className="flex items-center gap-2">
                <Badge color={res.items?.length ? 'green' : 'red'}>{res.items?.length || 0} sản phẩm</Badge>
                <Badge color={res.focus ? 'orange' : 'gray'}>{res.focus ? 'Có Focus' : 'Chạy ngầm'}</Badge>
                <span className="text-xs text-slate-500 font-mono">{res.ms}ms</span>
              </div>
            }
          >
            {res.items?.length === 0 ? (
              <Empty icon={IconShoppingCart}>
                Không tìm thấy sản phẩm nào. Hãy kiểm tra xem tab shopee.vn đã đăng nhập chưa, hoặc thử lại với chế độ <b>Có Focus tab</b>.
              </Empty>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/20">
                <div className="max-h-[30rem] divide-y divide-slate-800 overflow-y-auto">
                  {res.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 hover:bg-slate-800/30 transition-colors">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 font-bold font-mono">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-200 truncate">{it.name}</div>
                        <div className="text-xs text-slate-500 truncate font-mono mt-0.5">{it.productUrl}</div>
                      </div>
                      <span className="shrink-0 font-extrabold text-orange-400 text-base">{fmtP(it.price)}</span>
                      <a href={it.productUrl} target="_blank" rel="noreferrer" className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300">
                        <IconExternalLink size={14} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        ) : (
          <Card className="border-red-950 bg-red-950/10 border p-5 text-sm text-red-300">
            <div className="font-semibold mb-1">Cào dữ liệu thất bại</div>
            <div>Chi tiết lỗi: {res.error} {res.ms ? `(${res.ms}ms)` : ''}</div>
          </Card>
        )
      )}
    </div>
  )
}
