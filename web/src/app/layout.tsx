import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ToolMKT AI — Rải link Shopee bằng AI',
  description: 'Tự động tìm nhóm tiềm năng & comment rải link Shopee bằng AI. An toàn, có kiểm soát.',
  metadataBase: new URL('https://toolmktai.com'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
