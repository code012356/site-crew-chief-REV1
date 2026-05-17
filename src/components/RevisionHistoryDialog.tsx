import { DailyLog } from '@/lib/types';
import { History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const formatDT = (dt: string) => dt ? dt.replace('T', ' ') : '-';

interface Props {
  log: DailyLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RevisionHistoryDialog({ log, open, onOpenChange }: Props) {
  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History size={18} /> 修改历史 Revision History · {log.foremanName} · {log.date}
          </DialogTitle>
        </DialogHeader>
        {log.revisions?.map((rev, idx) => (
          <div key={idx} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">第 {idx + 1} 版 Ver.{idx + 1}（{idx === 0 ? '原始提交 Original' : '修改 Revised'}）</h4>
              <span className="text-xs text-muted-foreground">{new Date(rev.timestamp).toLocaleString('zh-CN')}</span>
            </div>
            {rev.reviewComment && (
              <div className="p-2 bg-destructive/5 rounded text-sm text-destructive">审核意见 Review Comment：{rev.reviewComment}</div>
            )}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">工人记录 Worker Entries</p>
              {rev.entries.map(e => (
                <div key={e.id} className="flex items-center gap-3 px-3 py-1.5 rounded bg-muted/30 text-sm">
                  <span className="font-medium w-14">{e.workerName}</span>
                  <span className="text-muted-foreground">{formatDT(e.startTime)}–{formatDT(e.endTime)}</span>
                  <span className="text-muted-foreground">{e.hours}h</span>
                  <span className="text-muted-foreground">{e.area}</span>
                  <span className="font-mono text-xs text-muted-foreground ml-auto">{e.workCodeName}</span>
                </div>
              ))}
            </div>
            {rev.equipmentUsage.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">设备使用 Equipment Usage</p>
                {rev.equipmentUsage.map(eu => (
                  <div key={eu.id} className="flex items-center gap-3 px-3 py-1.5 rounded bg-muted/30 text-sm">
                    <span className="font-medium">{eu.equipmentName}</span>
                    <span className="text-muted-foreground">{formatDT(eu.startTime)}–{formatDT(eu.endTime)}</span>
                    <span className="text-muted-foreground">{eu.hours}h</span>
                    <span className="text-muted-foreground">{eu.area}</span>
                    <span className="font-mono text-xs text-muted-foreground ml-auto">{eu.workCodeName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="border rounded-lg p-4 space-y-3 border-primary/30 bg-primary/5">
          <h4 className="text-sm font-semibold text-primary">当前版本 Current Version</h4>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">工人记录 Worker Entries</p>
            {log.entries.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-1.5 rounded bg-muted/30 text-sm">
                <span className="font-medium w-14">{e.workerName}</span>
                <span className="text-muted-foreground">{formatDT(e.startTime)}–{formatDT(e.endTime)}</span>
                <span className="text-muted-foreground">{e.hours}h</span>
                <span className="text-muted-foreground">{e.area}</span>
                <span className="font-mono text-xs text-muted-foreground ml-auto">{e.workCodeName}</span>
              </div>
            ))}
          </div>
          {log.equipmentUsage.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">设备使用 Equipment Usage</p>
              {log.equipmentUsage.map(eu => (
                <div key={eu.id} className="flex items-center gap-3 px-3 py-1.5 rounded bg-muted/30 text-sm">
                  <span className="font-medium">{eu.equipmentName}</span>
                  <span className="text-muted-foreground">{formatDT(eu.startTime)}–{formatDT(eu.endTime)}</span>
                  <span className="text-muted-foreground">{eu.hours}h</span>
                  <span className="text-muted-foreground">{eu.area}</span>
                  <span className="font-mono text-xs text-muted-foreground ml-auto">{eu.workCodeName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
