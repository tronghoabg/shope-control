import { IconTrash, IconHistory } from '@tabler/icons-react'
import { useShope } from '../ShopeContext.jsx'
import { Card, Btn, Empty } from '../ui.jsx'

const DOT = { success: 'bg-emerald-400', error: 'bg-red-400', info: 'bg-slate-400' }

export default function Logs() {
  const { s, call } = useShope()
  const logs = [...(s?.logs || [])].reverse()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Nhật ký hoạt động</h1>
        <Btn size="sm" icon={IconTrash} disabled={!logs.length} onClick={() => call({ type: 'CLEAR_LOGS' })}>Xoá log</Btn>
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
