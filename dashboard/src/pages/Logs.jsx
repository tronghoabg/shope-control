import { IconTrash, IconHistory, IconDownload } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Card, Btn, Empty } from '../ui.jsx'

const DOT = { success: 'bg-emerald-400', error: 'bg-red-400', info: 'bg-slate-400' }

export default function Logs() {
  const { s, call } = useShope()
  const logs = [...(s?.logs || [])].reverse()
  const downloadDiagnostic = () => {
    const cfg = { ...(s?.cfg || {}) }
    for (const key of ['licenseToken', 'commentImageBase64', 'apiKey', 'accessToken']) delete cfg[key]
    const payload = {
      generatedAt: new Date().toISOString(), owner: s?.owner || '', cfg,
      state: s?.state || {}, stats: s?.stats || {}, progress: s?.progress || {},
      sessionReport: s?.sessionReport || {}, activitySyncStats: s?.activitySyncStats || {},
      queueSummary: (s?.queue || []).map(x => ({ postId: x.postId, groupId: x.groupId, groupName: x.groupName, pageId: x.pageId, addedAt: x.addedAt, approved: x.approved })),
      logs: (s?.logs || []).slice(-1000),
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `toolmkt-diagnostic-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Nhật ký hoạt động</h1>
        <div className="flex gap-2">
          <Btn size="sm" icon={IconDownload} onClick={downloadDiagnostic}>Tải báo cáo lỗi</Btn>
          <Btn size="sm" icon={IconTrash} disabled={!logs.length} onClick={() => call({ type: 'CLEAR_LOGS' })}>Xoá log</Btn>
        </div>
      </div>

      <Card>
        {logs.length === 0 ? <Empty icon={IconHistory}>Chưa có hoạt động nào.</Empty> : (
          <div className="max-h-[36rem] divide-y divide-slate-800/70 overflow-y-auto">
            {logs.map((l, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2">
                <span className="w-16 shrink-0 font-mono text-xs text-slate-500">{new Date(l.t).toLocaleTimeString('vi')}</span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[l.level] || DOT.info}`} />
                <span className="flex-1 break-words text-sm text-slate-300">{l.msg}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
