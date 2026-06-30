import './globals.css'
import type { Metadata, Viewport } from 'next'

const TITLE = 'ToolMKT AI — Tìm khách & bán hàng Facebook bằng AI'
const DESC = 'Công cụ AI tự tìm nhóm Facebook tiềm năng, tìm khách đang có nhu cầu, soạn comment kèm link Shopee và đăng bài hàng loạt. An toàn, chạy ngay trong trình duyệt.'

export const metadata: Metadata = {
  metadataBase: new URL('https://toolmktai.com'),
  title: { default: TITLE, template: '%s — ToolMKT AI' },
  description: DESC,
  applicationName: 'ToolMKT AI',
  keywords: [
    'rải link shopee', 'tool facebook', 'auto comment facebook', 'tìm khách facebook',
    'marketing facebook ai', 'affiliate shopee', 'đăng bài nhóm facebook tự động',
    'comment dạo', 'tìm nhóm facebook', 'bán hàng facebook', 'ToolMKT AI', 'toolmktai',
  ],
  authors: [{ name: 'ToolMKT AI' }],
  creator: 'ToolMKT AI',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website', locale: 'vi_VN', url: 'https://toolmktai.com', siteName: 'ToolMKT AI',
    title: TITLE, description: DESC,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  icons: { icon: '/icon.svg' },
  category: 'technology',
}

export const viewport: Viewport = {
  themeColor: '#0b1220',
  width: 'device-width',
  initialScale: 1,
}

const ZALO_GROUP = 'https://zalo.me/g/fsjwncgaupa915h891zx'

const JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization', '@id': 'https://toolmktai.com/#org', name: 'ToolMKT AI',
      url: 'https://toolmktai.com', logo: 'https://toolmktai.com/icon.svg',
    },
    {
      '@type': 'SoftwareApplication', name: 'ToolMKT AI',
      applicationCategory: 'BusinessApplication', operatingSystem: 'Chrome',
      description: DESC,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'VND' },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />
        {children}
        <a href={ZALO_GROUP} target="_blank" rel="noreferrer" aria-label="Nhóm hỗ trợ Zalo"
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500">
          💬 Hỗ trợ Zalo
        </a>
      </body>
    </html>
  )
}
