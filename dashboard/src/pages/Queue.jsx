import { useState, useEffect } from 'react'
import {
  IconDeviceFloppy, IconCheck, IconSend, IconTrash, IconChecks, IconExternalLink,
  IconListCheck, IconRadar, IconAdjustments, IconChevronDown,
} from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Btn, Badge, Field, Input, Textarea, Toggle, Card, Empty, Hint } from '../ui.jsx'

const NUM = [
  { k: 'dailyCap', l: 'Cap/ngày' }, { k: 'minDelaySec', l: 'Delay min (s)' },
  { k: 'maxDelaySec', l: 'Delay max (s)' }, { k: 'minScore', l: 'Ngưỡng điểm bài' },
  { k: 'postsPerScan', l: 'Số bài/nhóm mỗi lần quét' },
]

function QueueItem({ it, onAct }) {
  const [comment, setComment] = useState(it.comment || '')
  const dirty = comment !== it.comment
  return (
    <Card className={`p-4 ${it.approved ? 'border-emerald-700/50 bg-emerald-500/[0.04]' : ''}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge color="yellow">điểm {it.score}</Badge>
        {it.productName && <Badge color="blue">{it.productName}</Badge>}
        {it.approved && <Badge color="green">đã duyệt</Badge>}
        {it.permalink && <a href={it.permalink} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline"><IconExternalLink size={13} /> xem bài</a>}
      </div>
      <p className="mb-2 line-clamp-2 text-xs text-slate-500">📄 {it.text || '(không có nội dung)'}</p>
      <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="mt-2 flex flex-wrap gap-2">
        {dirty && <Btn size="sm" icon={IconDeviceFloppy} onClick={() => onAct('EDIT_ITEM', it.postId, { comment })}>Lưu sửa</Btn>}
        {!it.approved && <Btn size="sm" variant="success" icon={IconCheck} onClick={() => onAct('APPROVE_ITEM', it.postId)}>Duyệt</Btn>}
        <Btn size="sm" variant="primary" icon={IconSend} onClick={() => onAct('POST_ITEM', it.postId, null, 60000)}>Đăng ngay</Btn>
        <Btn size="sm" variant="ghost" icon={IconTrash} className="text-red-400" onClick={() => onAct('REJECT_ITEM', it.postId)}>Bỏ</Btn>
      </div>
    </Card>
  )
}

export default function Queue() {
  const { s, call, setCfg } = useShope()
  const [cfg, setLocal] = useState(null)
  const [showCfg, setShowCfg] = useState(false)
  useEffect(() => { if (s?.cfg && !cfg) setLocal(s.cfg) }, [s, cfg])
  // Tự mở cấu hình lần đầu khi chưa chọn nhóm (chưa setup xong)
  useEffect(() => { if (cfg && !(cfg.groupIds || []).length) setShowCfg(true) }, [cfg?.groupIds?.length])
  if (!s || !cfg) return <p className="text-slate-500">Đang tải…</p>

  const queue = s.queue || []
  const pending = queue.filter(q => !q.approved).length
  const setNum = (k) => (e) => setLocal({ ...cfg, [k]: +e.target.value })
  const saveCfg = () => setCfg({ mode: cfg.mode, dailyCap: cfg.dailyCap, minDelaySec: cfg.minDelaySec, maxDelaySec: cfg.maxDelaySec, minScore: cfg.minScore, postsPerScan: cfg.postsPerScan, requireApproval: cfg.requireApproval, productSource: cfg.productSource, subId: cfg.subId, shopeeLimit: cfg.shopeeLimit })
  const act = (type, postId, extra, timeout) => call({ type, postId, ...(extra || {}) }, { timeout })
  const nGroups = (cfg.groupIds || []).length
  const mode = cfg.mode || 'affiliate'
  const source = cfg.productSource || 'catalog'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Hàng chờ duyệt</h1>
        <Btn icon={IconAdjustments} onClick={() => setShowCfg(v => !v)}>
          Cấu hình <IconChevronDown size={14} className={showCfg ? 'rotate-180 transition' : 'transition'} />
        </Btn>
      </div>

      <Hint id="queue">
        Nơi duyệt &amp; đăng comment. <b>1)</b> Bấm <b>Quét thêm bài</b> → AI đọc bài trong nhóm mục tiêu &amp; soạn comment.
        {' '}<b>2)</b> Xem/sửa nội dung → <b>Duyệt</b> (hoặc <b>Duyệt tất cả</b>) → <b>Đăng ngay</b>. Hoặc bật <b>Auto</b> ở Tổng quan để tự chạy.
        {' '}Đổi chế độ/nguồn/giới hạn ở nút <b>Cấu hình</b>.
      </Hint>

      {/* Tóm tắt cấu hình hiện tại */}
      <Card className="flex flex-wrap items-center gap-2 p-3 text-sm">
        <Badge color={mode === 'social' ? 'blue' : 'orange'}>{mode === 'social' ? 'Comment dạo' : 'Rải link'}</Badge>
        {mode === 'affiliate' && <Badge color="indigo">nguồn: {source === 'shopee' ? 'Shopee tự động' : 'Catalog'}</Badge>}
        <Badge color={nGroups ? 'green' : 'red'}>{nGroups} nhóm mục tiêu</Badge>
        <span className="text-slate-400">cap {cfg.dailyCap}/ngày · delay {cfg.minDelaySec}-{cfg.maxDelaySec}s · ngưỡng {cfg.minScore}đ · {cfg.postsPerScan} bài/nhóm</span>
        <Badge className="ml-auto" color={cfg.requireApproval !== false ? 'gray' : 'red'}>{cfg.requireApproval !== false ? 'Duyệt tay' : 'Tự đăng thẳng'}</Badge>
      </Card>

      {/* Cấu hình (gập) */}
      {showCfg && (
        <div className="space-y-5 rounded-xl border border-slate-700 bg-slate-900/40 p-1">
          <Section title="Chế độ hoạt động">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { k: 'affiliate', t: 'Rải link Shopee', d: 'AI chọn SP khớp bài + comment kèm link affiliate.' },
                { k: 'social', t: 'Comment dạo', d: 'Comment tự nhiên để tăng tương tác / nuôi acc. Không link.' },
              ].map(m => (
                <button key={m.k} onClick={() => setLocal({ ...cfg, mode: m.k })}
                  className={`rounded-xl border p-3 text-left transition-colors ${mode === m.k ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-3.5 w-3.5 rounded-full border-2 ${mode === m.k ? 'border-indigo-400 bg-indigo-400' : 'border-slate-500'}`} />
                    <span className="font-medium text-slate-100">{m.t}</span>
                  </div>
                  <p className="mt-1 pl-5 text-xs text-slate-400">{m.d}</p>
                </button>
              ))}
            </div>
          </Section>

          {mode === 'affiliate' && (
            <Section title="Nguồn sản phẩm &amp; link">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { k: 'catalog', t: 'Catalog CSV', d: 'Tự nạp danh sách SP + link sẵn. Không cần mở tab Shopee.' },
                  { k: 'shopee', t: 'Shopee tự động', d: 'AI tự nghĩ SP → tìm Shopee → dựng link hoa hồng. Cần tab shopee.vn + affiliate.shopee.vn đăng nhập.' },
                ].map(m => (
                  <button key={m.k} onClick={() => setLocal({ ...cfg, productSource: m.k })}
                    className={`rounded-xl border p-3 text-left transition-colors ${source === m.k ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-3.5 w-3.5 rounded-full border-2 ${source === m.k ? 'border-indigo-400 bg-indigo-400' : 'border-slate-500'}`} />
                      <span className="font-medium text-slate-100">{m.t}</span>
                    </div>
                    <p className="mt-1 pl-5 text-xs text-slate-400">{m.d}</p>
                  </button>
                ))}
              </div>
              {source === 'shopee' && (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <Field label="sub_id (tracking, tuỳ chọn)">
                        <Input value={cfg.subId || ''} onChange={(e) => setLocal({ ...cfg, subId: e.target.value })} placeholder="vd: fbauto-sub2 (tối đa 5, cách nhau '-')" />
                      </Field>
                    </div>
                    <Field label="Số SP/lần tìm">
                      <Input type="number" value={cfg.shopeeLimit ?? 10} onChange={(e) => setLocal({ ...cfg, shopeeLimit: +e.target.value })} />
                    </Field>
                  </div>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                    Link hoa hồng tạo bằng công cụ Custom Link chính thức (gắn đúng tài khoản qua phiên đăng nhập — không cần nhập Affiliate ID).
                    Mở sẵn <b>1 tab shopee.vn</b> + <b>1 tab affiliate.shopee.vn</b>, cả hai đã đăng nhập.
                  </div>
                </div>
              )}
            </Section>
          )}

          <Section title="Cấu hình an toàn">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {NUM.map(f => (
                <Field key={f.k} label={f.l}><Input type="number" value={cfg[f.k]} onChange={setNum(f.k)} /></Field>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Toggle checked={cfg.requireApproval !== false} onChange={(v) => setLocal({ ...cfg, requireApproval: v })}
                label="Yêu cầu duyệt tay trước khi đăng (an toàn)" />
              <Btn variant="primary" icon={IconDeviceFloppy} onClick={saveCfg}>Lưu cấu hình</Btn>
            </div>
            {!nGroups && <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-2.5 text-sm text-orange-300">Chưa chọn nhóm mục tiêu — vào trang <b>Nhóm của tôi</b> để quét &amp; chọn.</div>}
          </Section>
        </div>
      )}

      {/* Thanh thao tác hàng chờ */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-slate-100">Hàng chờ ({queue.length}{pending ? ` · ${pending} chờ duyệt` : ''})</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          <Btn variant="primary" icon={IconRadar} onClick={() => call({ type: 'SCAN_NOW' }, { okMsg: 'Đã quét xong', timeout: 180000 })} disabled={!nGroups}>Quét thêm bài</Btn>
          {pending > 0 && <Btn variant="success" icon={IconChecks} onClick={() => call({ type: 'APPROVE_ALL' }, { okMsg: 'Đã duyệt tất cả' })}>Duyệt tất cả</Btn>}
        </div>
      </div>

      {queue.length === 0
        ? <Card><Empty icon={IconListCheck}>Chưa có bài. Bấm <b>Quét thêm bài</b> ở trên để AI tìm bài &amp; soạn comment{nGroups ? '' : ' (chọn nhóm mục tiêu trước)'}.</Empty></Card>
        : <div className="space-y-3">{queue.map(it => <QueueItem key={it.postId} it={it} onAct={act} />)}</div>}
    </div>
  )
}
