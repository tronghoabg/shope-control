import { AiConfigCard } from '@/components/admin'

export default function AdminAi() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-100">Cấu hình AI</h1>
      <p className="text-sm text-slate-500">API key của bạn dùng cho mọi user (theo hạn mức gói). Chọn model rẻ để tối ưu chi phí. Bấm “Cấu hình API” để nhập key + test.</p>
      <AiConfigCard />
    </div>
  )
}
