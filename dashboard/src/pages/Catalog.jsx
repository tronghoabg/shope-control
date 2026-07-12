import { useState } from 'react'
import { IconUpload, IconFileImport, IconShoppingCart, IconSearch, IconPlus, IconPencil, IconTrash, IconX, IconDeviceFloppy, IconTrashX } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Btn, Textarea, Badge, Card, Empty, Hint, Input, Field } from '../ui.jsx'

const SAMPLE = `id,name,keywords,category,price,link
sp001,Tai nghe Bluetooth chống ồn,"tai nghe,bluetooth,nghe nhạc",Phụ kiện,299000,https://shopee.vn/...
sp002,Áo thun nam form rộng,"áo thun,áo nam,thời trang",Thời trang,129000,https://shopee.vn/...`

const BLANK = { id: '', name: '', category: '', price: '', keywords: '', link: '' }

export default function Catalog() {
  const { s, call, notify } = useShope()
  const [csv, setCsv] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)   // null | { id, name, category, price, keywords(string), link, _new }
  const catalog = s?.catalog || []
  const cfg = s?.cfg || {}
  const needed = (cfg.mode || 'affiliate') === 'affiliate' && (cfg.productSource || 'catalog') === 'catalog'

  const qq = q.trim().toLowerCase()
  const shown = !qq ? catalog : catalog.filter(p =>
    (p.id || '').toLowerCase().includes(qq) ||
    (p.name || '').toLowerCase().includes(qq) ||
    (p.category || '').toLowerCase().includes(qq) ||
    (p.keywords || []).some(k => k.includes(qq)))

  const openNew = () => setEditing({ ...BLANK, _new: true })
  const openEdit = (p) => setEditing({ id: p.id, name: p.name || '', category: p.category || '', price: p.price || '', keywords: (p.keywords || []).join(', '), link: p.link || '', _new: false })
  const save = async () => {
    const it = editing
    if (!it.id.trim()) return notify('red', 'Nhập Mã SP (ID)')
    if (!it.link.trim()) return notify('red', 'Nhập Link sản phẩm')
    if (it._new && catalog.some(p => p.id === it.id.trim())) return notify('red', 'Mã SP đã tồn tại')
    const r = await call({ type: 'SAVE_CATALOG_ITEM', item: { id: it.id.trim(), name: it.name, category: it.category, price: it.price, keywords: it.keywords, link: it.link } },
      { okMsg: it._new ? 'Đã thêm sản phẩm' : 'Đã cập nhật sản phẩm', errMsg: 'Lưu sản phẩm lỗi' })
    if (r?.ok) setEditing(null)
  }
  const del = (p) => { if (window.confirm(`Xoá sản phẩm "${p.name || p.id}"?`)) call({ type: 'DELETE_CATALOG_ITEM', id: p.id }, { okMsg: 'Đã xoá sản phẩm' }) }
  const clearAll = () => { if (window.confirm(`Xoá TOÀN BỘ ${catalog.length} sản phẩm trong catalog? Không thể hoàn tác.`)) call({ type: 'CLEAR_CATALOG' }, { okMsg: 'Đã xoá toàn bộ catalog' }) }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/65 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Catalog sản phẩm</h1>
          <p className="text-sm text-slate-400">Quản lý kho sản phẩm Shopee Affiliate — AI đối chiếu để rải link khớp nội dung bài viết.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge color="indigo" className="px-3.5 py-1 text-xs font-extrabold">{catalog.length} sản phẩm</Badge>
          <Btn variant="primary" icon={IconPlus} onClick={openNew}>Thêm sản phẩm</Btn>
        </div>
      </div>

      <Hint id="catalog">
        Thêm sản phẩm để AI tự động đối chiếu, tìm sản phẩm khớp nhất với nội dung bài Facebook nhằm rải link có tỷ lệ click cao. Bạn có thể **thêm từng sản phẩm**, **nhập hàng loạt bằng CSV**, tìm kiếm, sửa và xoá.
      </Hint>

      {!needed && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4 text-xs text-slate-400 leading-normal">
          💡 Chế độ hiện tại <b>không dùng nguồn Catalog</b> (đang đặt {(cfg.mode || 'affiliate') === 'social' ? 'Comment dạo' : 'cào Shopee tự động'}). Bạn vẫn có thể nạp sẵn Catalog tại đây để dùng sau.
        </div>
      )}

      {/* Form thêm/sửa 1 sản phẩm */}
      {editing && (
        <Card className="p-5 space-y-4 border border-indigo-500/20">
          <div className="flex items-center justify-between border-b border-slate-850 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
              {editing._new ? <IconPlus size={18} className="text-indigo-400" /> : <IconPencil size={18} className="text-indigo-400" />}
              <span>{editing._new ? 'Thêm sản phẩm mới' : `Sửa sản phẩm: ${editing.id}`}</span>
            </div>
            <button onClick={() => setEditing(null)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"><IconX size={16} /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Mã SP (ID) *"><Input value={editing.id} disabled={!editing._new} onChange={e => setEditing({ ...editing, id: e.target.value })} placeholder="vd: sp001" /></Field>
            <Field label="Danh mục"><Input value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} placeholder="vd: Phụ kiện" /></Field>
            <div className="sm:col-span-2"><Field label="Tên sản phẩm"><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Tên hiển thị" /></Field></div>
            <Field label="Giá (đ)"><Input type="number" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} placeholder="299000" /></Field>
            <Field label="Từ khóa (cách nhau bởi dấu phẩy)"><Input value={editing.keywords} onChange={e => setEditing({ ...editing, keywords: e.target.value })} placeholder="tai nghe, bluetooth, nghe nhạc" /></Field>
            <div className="sm:col-span-2"><Field label="Link Shopee *"><Input value={editing.link} onChange={e => setEditing({ ...editing, link: e.target.value })} placeholder="https://shopee.vn/..." /></Field></div>
          </div>
          <div className="flex gap-2.5">
            <Btn variant="primary" icon={IconDeviceFloppy} onClick={save}>{editing._new ? 'Thêm vào catalog' : 'Lưu thay đổi'}</Btn>
            <Btn variant="ghost" onClick={() => setEditing(null)}>Hủy</Btn>
          </div>
        </Card>
      )}

      {/* Nhập CSV hàng loạt (thu gọn) */}
      <Section title="Nhập hàng loạt bằng CSV" right={<Btn size="sm" variant="ghost" icon={IconFileImport} onClick={() => setShowImport(v => !v)}>{showImport ? 'Ẩn' : 'Mở nhập CSV'}</Btn>}>
        {showImport && (
          <div className="space-y-4">
            <Textarea rows={6} placeholder={SAMPLE} value={csv} onChange={(e) => setCsv(e.target.value)} className="font-mono text-[11px] bg-slate-950/60" />
            <div className="flex flex-wrap gap-2.5">
              <Btn variant="primary" icon={IconUpload} disabled={!csv.trim()} onClick={() => call({ type: 'IMPORT_CSV', csv }, { okMsg: 'Đã nhập danh sách sản phẩm (ghi đè catalog cũ)' })}>Nhập & ghi đè Catalog</Btn>
              <Btn variant="ghost" icon={IconFileImport} onClick={() => setCsv(SAMPLE)}>Dán dữ liệu mẫu</Btn>
            </div>
            <p className="text-[11px] text-amber-400/80">⚠️ Nhập CSV sẽ <b>ghi đè toàn bộ</b> catalog hiện tại.</p>
          </div>
        )}
      </Section>

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-850 px-5 py-3.5 bg-slate-900/20">
          <h3 className="font-bold text-slate-200 text-sm">Danh mục hàng hóa ({shown.length}{qq && `/${catalog.length}`})</h3>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input className="w-56 h-8.5 pl-8 text-xs rounded-lg" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên / mã / từ khóa…" />
            </div>
            {catalog.length > 0 && <Btn size="sm" variant="ghost" icon={IconTrashX} className="text-red-400 hover:bg-red-500/5 border border-red-500/10" onClick={clearAll}>Xoá tất cả</Btn>}
          </div>
        </div>

        {catalog.length === 0 ? (
          <Empty icon={IconShoppingCart}>Kho sản phẩm trống. Bấm <b>Thêm sản phẩm</b> để thêm từng món, hoặc mở nhập CSV để nạp hàng loạt.</Empty>
        ) : shown.length === 0 ? (
          <Empty icon={IconSearch}>Không tìm thấy sản phẩm khớp "{q}".</Empty>
        ) : (
          <div className="overflow-x-auto">
            <div className="max-h-[26rem] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-[#0d1222] text-[10px] uppercase font-bold tracking-widest text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Mã SP</th>
                    <th className="px-5 py-3">Tên sản phẩm</th>
                    <th className="px-5 py-3">Danh mục</th>
                    <th className="px-5 py-3">Từ khóa gợi ý</th>
                    <th className="px-5 py-3 text-right">Đơn giá</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 bg-slate-950/10">
                  {shown.map(p => (
                    <tr key={p.id} className="hover:bg-slate-900/20 transition-colors group">
                      <td className="px-5 py-3 font-mono text-[10px] text-slate-500 font-semibold">{p.id}</td>
                      <td className="px-5 py-3 font-bold text-slate-200">
                        {p.link ? <a href={p.link} target="_blank" rel="noreferrer" className="hover:text-indigo-400">{p.name}</a> : p.name}
                      </td>
                      <td className="px-5 py-3 text-slate-400 font-medium">{p.category}</td>
                      <td className="px-5 py-3 text-slate-500">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(p.keywords || []).slice(0, 4).map((k, idx) => (
                            <span key={idx} className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">{k}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-extrabold text-emerald-400 text-sm">{p.price?.toLocaleString('vi')}đ</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(p)} className="inline-grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-indigo-400" title="Sửa"><IconPencil size={14} /></button>
                        <button onClick={() => del(p)} className="inline-grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400" title="Xoá"><IconTrash size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
