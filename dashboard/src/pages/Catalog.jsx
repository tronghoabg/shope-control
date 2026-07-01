import { useState } from 'react'
import { IconUpload, IconFileImport, IconShoppingCart } from '@tabler/icons-react'
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
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/65 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Catalog sản phẩm</h1>
          <p className="text-sm text-slate-400">Quản lý kho hàng sản phẩm Shopee Affiliate được dùng làm nguồn bài rải tin.</p>
        </div>
        <div>
          <Badge color="indigo" className="px-3.5 py-1 text-xs font-extrabold">{catalog.length} sản phẩm</Badge>
        </div>
      </div>

      <Hint id="catalog">
        Nhập danh sách sản phẩm từ catalog của bạn để AI tự động đối chiếu, tìm kiếm sản phẩm khớp nhất với nội dung bài viết Facebook nhằm rải link có tỷ lệ click tối ưu nhất.
      </Hint>

      {!needed && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4 text-xs text-slate-400 leading-normal">
          💡 Chế độ hiện tại <b>không sử dụng nguồn Catalog</b> (bạn đang đặt chế độ {(cfg.mode || 'affiliate') === 'social' ? 'Comment dạo' : 'cào Shopee tự động'}). Tuy nhiên bạn vẫn có thể nạp sẵn Catalog tại đây để sử dụng sau.
        </div>
      )}

      <Section title="Nhập danh sách sản phẩm bằng CSV">
        <div className="space-y-4">
          <Textarea rows={6} placeholder={SAMPLE} value={csv} onChange={(e) => setCsv(e.target.value)} className="font-mono text-[11px] bg-slate-950/60" />
          <div className="flex flex-wrap gap-2.5">
            <Btn variant="primary" icon={IconUpload} disabled={!csv.trim()} onClick={() => call({ type: 'IMPORT_CSV', csv }, { okMsg: 'Đã nhập danh sách sản phẩm thành công' })}>Nhập dữ liệu Catalog</Btn>
            <Btn variant="ghost" icon={IconFileImport} onClick={() => setCsv(SAMPLE)}>Dán dữ liệu mẫu</Btn>
          </div>
        </div>
      </Section>

      <Card className="p-0 overflow-hidden">
        <div className="border-b border-slate-850 px-5 py-4 bg-slate-900/20">
          <h3 className="font-bold text-slate-200 text-sm">Danh mục hàng hóa hiện có ({catalog.length} sản phẩm)</h3>
        </div>

        {catalog.length === 0 ? (
          <Empty icon={IconShoppingCart}>Kho sản phẩm trống. Vui lòng dán dữ liệu mẫu CSV và nhấn nhập để tải dữ liệu.</Empty>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 bg-slate-950/10">
                  {catalog.map(p => (
                    <tr key={p.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="px-5 py-3 font-mono text-[10px] text-slate-500 font-semibold">{p.id}</td>
                      <td className="px-5 py-3 font-bold text-slate-200">{p.name}</td>
                      <td className="px-5 py-3 text-slate-400 font-medium">{p.category}</td>
                      <td className="px-5 py-3 text-slate-500">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(p.keywords || []).slice(0, 4).map((k, idx) => (
                            <span key={idx} className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">{k}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-extrabold text-emerald-400 text-sm">{p.price?.toLocaleString('vi')}đ</td>
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
