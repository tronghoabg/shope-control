import { useState } from 'react'
import { IconUpload, IconFileImport } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Section, Btn, Textarea, Badge, Card, Empty, Hint } from '../ui.jsx'

const SAMPLE = `id,name,keywords,category,price,link
sp001,Tai nghe Bluetooth chống ồn,"tai nghe,bluetooth,nghe nhạc",Phụ kiện,299000,https://shopee.vn/...
sp002,Áo thun nam form rộng,"áo thun,áo nam,thời trang",Thời trang,129000,https://shopee.vn/...`

export default function Catalog() {
  const { s, call } = useShope()
  const [csv, setCsv] = useState('')
  const catalog = s?.catalog || []
  const cfg = s?.cfg || {}
  const needed = (cfg.mode || 'affiliate') === 'affiliate' && (cfg.productSource || 'catalog') === 'catalog'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Catalog sản phẩm</h1>
        <Badge color="indigo">{catalog.length} sản phẩm</Badge>
      </div>

      <Hint id="catalog">
        Danh sách sản phẩm để AI chọn link khớp bài (dùng cho chế độ <b>Rải link + nguồn Catalog CSV</b>).
        Dán CSV theo cột <code className="rounded bg-slate-800 px-1 text-slate-300">id,name,keywords,category,price,link</code> rồi bấm <b>Nhập catalog</b>. Bấm <b>Dán mẫu</b> để xem ví dụ.
      </Hint>

      {!needed && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3 text-sm text-slate-400">
          Chế độ hiện tại <b>không dùng catalog</b> ({(cfg.mode || 'affiliate') === 'social' ? 'Comment dạo' : 'nguồn Shopee tự động'}). Catalog chỉ cần cho <b>Rải link + nguồn Catalog CSV</b>.
        </div>
      )}

      <Section title="Nhập CSV">
        <Textarea rows={5} placeholder={SAMPLE} value={csv} onChange={(e) => setCsv(e.target.value)} className="font-mono text-xs" />
        <div className="mt-3 flex gap-2">
          <Btn variant="primary" icon={IconUpload} disabled={!csv.trim()} onClick={() => call({ type: 'IMPORT_CSV', csv }, { okMsg: 'Đã nhập catalog' })}>Nhập catalog</Btn>
          <Btn variant="ghost" icon={IconFileImport} onClick={() => setCsv(SAMPLE)}>Dán mẫu</Btn>
        </div>
      </Section>

      <Card>
        {catalog.length === 0 ? <Empty icon={IconUpload}>Chưa có sản phẩm. Nhập CSV để bắt đầu.</Empty> : (
          <div className="max-h-[26rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-2.5 text-left font-semibold">Tên</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Danh mục</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Từ khoá</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Giá</th>
                </tr>
              </thead>
              <tbody>
                {catalog.map(p => (
                  <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 text-slate-200">{p.name}</td>
                    <td className="px-4 py-2.5 text-slate-400">{p.category}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-xs text-slate-500">{(p.keywords || []).join(', ')}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{p.price?.toLocaleString('vi')}đ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
