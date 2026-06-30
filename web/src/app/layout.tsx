import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ToolMKT AI — Tìm khách & bán hàng Facebook bằng AI',
  description: 'AI tự tìm nhóm tiềm năng, tìm khách, comment & đăng bài rải link Shopee. An toàn, có kiểm soát.',
  metadataBase: new URL('https://toolmktai.com'),
}

const ZALO_GROUP = 'https://zalo.me/g/fsjwncgaupa915h891zx'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {children}
        {/* Nút hỗ trợ Zalo cố định toàn site */}
        <a href={ZALO_GROUP} target="_blank" rel="noreferrer"
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500">
          💬 Hỗ trợ Zalo
        </a>
      </body>
    </html>
  )
}
