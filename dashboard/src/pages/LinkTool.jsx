import { useState } from 'react'
import { IconLink, IconCopy, IconBolt, IconExternalLink } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Btn, Field, Input, Textarea, Badge, Card, Empty } from '../ui.jsx'
import { ext } from '../ext.js'

const SAMPLE = `https://shopee.vn/flash_sale
https://shopee.vn/product/123456/7890123`

export default function LinkTool() {
  const { notify } = useShope()
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
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-slate-100">Tạo link Shopee (test)</h1>
        <Badge color="indigo">{links.length} link</Badge>
      </div>

      <Section title="Dán link sản phẩm — mỗi dòng 1 link">
        <Textarea rows={6} placeholder={SAMPLE} value={raw} onChange={(e) => setRaw(e.target.value)} className="font-mono text-xs" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="sub_id (tuỳ chọn — vào subId1-subId2-…)">
            <Input value={subId} onChange={(e) => setSubId(e.target.value)} placeholder="vd: fbauto-test" />
          </Field>
          <div className="flex items-end">
            <Btn variant="primary" icon={IconBolt} loading={busy} disabled={!links.length} onClick={run} className="w-full">
              Tạo {links.length || ''} link đồng thời
            </Btn>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Thử SW (headless) trước, lỗi thì tự fallback qua tab affiliate.shopee.vn. Nhớ đăng nhập affiliate.shopee.vn.
        </p>
      </Section>

      {rows.length > 0 && (
        <Section title={`Kết quả (${okCount}/${rows.length})`} right={
          okCount > 0 ? <Btn size="sm" icon={IconCopy} onClick={copyAll}>Copy tất cả link OK</Btn> : null
        }>
          <div className="space-y-2">
            {rows.map((x, i) => (
              <Card key={i} className={`p-3 ${x.ok ? '' : 'border-red-700/50 bg-red-500/[0.04]'}`}>
                <div className="mb-1 flex items-center gap-2">
                  {x.ok ? <Badge color="green">OK · {x.via}</Badge> : <Badge color="red">lỗi</Badge>}
                  <span className="truncate text-xs text-slate-500" title={x.originalLink}>{x.originalLink}</span>
                </div>
                {x.ok ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-slate-800 px-2 py-1.5 text-sm text-emerald-300">{x.shortLink}</code>
                    <Btn size="sm" icon={IconCopy} onClick={() => copy(x.shortLink)}>Copy</Btn>
                    <a href={x.shortLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
                      <IconExternalLink size={14} /> Mở
                    </a>
                  </div>
                ) : (
                  <div className="break-words text-xs text-red-300">{x.error}</div>
                )}
              </Card>
            ))}
          </div>
        </Section>
      )}

      {rows.length === 0 && !busy && (
        <Card><Empty icon={IconLink}>Dán link sản phẩm Shopee ở trên rồi bấm <b>Tạo link</b> để test API tạo link hoa hồng.</Empty></Card>
      )}
    </div>
  )
}
