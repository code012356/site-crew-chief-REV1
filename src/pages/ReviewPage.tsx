import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useDataContext } from '@/contexts/DataContext';
import { DailyLog } from '@/lib/types';
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, ChevronRight, History, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { logStatusLabels, pageTitles, fieldLabels, actionLabels, messages } from '@/lib/i18n';
import RevisionHistoryDialog from '@/components/RevisionHistoryDialog';

const formatDT = (dt: string) => dt ? dt.replace('T', ' ') : '-';

export default function ReviewPage() {
  const { currentPersonnelId } = useAppContext();
  const { personnel, getEngineerForemen, dailyLogs, updateDailyLog } = useDataContext();
  const engineerId = currentPersonnelId;
  const managedForemanIds = getEngineerForemen(engineerId);
  const logs = useMemo(() => dailyLogs.filter(l => managedForemanIds.includes(l.foremanId) && !l.deletedAt), [dailyLogs, managedForemanIds]);

  const getForemanLabel = (log: DailyLog) => {
    const fm = personnel.find(p => p.id === log.foremanId);
    return fm?.laborId || log.foremanName;
  };
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [historyLogId, setHistoryLogId] = useState<string | null>(null);
  const historyLog = historyLogId ? logs.find(l => l.id === historyLogId) : null;

  const handleApprove = async (id: string) => {
    await updateDailyLog(id, { status: 'approved' });
    toast.success(messages.logApproved);
  };

  const handleConditional = async (id: string) => {
    if (!comment.trim()) { toast.error(messages.requiredComment); return; }
    await updateDailyLog(id, { status: 'conditional', reviewComment: comment });
    setComment('');
    toast.success(messages.logConditional);
  };

  const handleReject = async (id: string) => {
    if (!comment.trim()) { toast.error(messages.requiredRejectComment); return; }
    await updateDailyLog(id, { status: 'rejected', reviewComment: comment });
    setComment('');
    toast.success(messages.logRejected);
  };

  const handleApproveWithdraw = async (id: string) => {
    const log = logs.find(l => l.id === id);
    const revision = {
      timestamp: new Date().toISOString(),
      entries: log?.entries || [],
      equipmentUsage: log?.equipmentUsage || [],
      reviewComment: '[撤回已批准 Withdraw Approved]',
    };
    await updateDailyLog(id, {
      status: 'withdrawn' as any,
      revisions: [...(log?.revisions || []), revision],
    });
    toast.success(messages.withdrawApproved);
  };

  const handleRejectWithdraw = async (id: string) => {
    const log = logs.find(l => l.id === id);
    // Find the previous status from the last revision's comment
    const revisions = log?.revisions || [];
    const lastRev = revisions[revisions.length - 1];
    const prevComment = lastRev?.reviewComment || '';
    const prevStatus = prevComment.includes('Pending') || prevComment.includes('待审核') ? 'pending' : 'conditional';
    const revision = {
      timestamp: new Date().toISOString(),
      entries: log?.entries || [],
      equipmentUsage: log?.equipmentUsage || [],
      reviewComment: '[撤回被拒绝 Withdraw Rejected]',
    };
    await updateDailyLog(id, {
      status: prevStatus as any,
      revisions: [...(log?.revisions || []), revision],
    });
    toast.success(messages.withdrawRejected);
  };

  const toggleEntry = (entryId: string) => {
    setExpandedEntryId(prev => prev === entryId ? null : entryId);
  };

  const pending = logs.filter(l => l.status === 'pending');
  const withdrawRequests = logs.filter(l => l.status === 'withdraw_requested');
  const reviewed = logs.filter(l => !['pending', 'withdraw_requested'].includes(l.status));

  const statusClass = (s: string) =>
    s === 'approved' ? 'status-approved' : s === 'conditional' ? 'status-approved'
    : s === 'withdraw_requested' ? 'status-pending' : s === 'withdrawn' ? 'status-rejected' : 'status-rejected';

  const toggleExpand = (logId: string) => {
    setExpandedId(expandedId === logId ? null : logId);
    setExpandedEntryId(null);
  };

  // Shared log detail renderer
  const renderLogEntries = (log: DailyLog) => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">工人记录 Worker Entries</h3>
        <div className="space-y-1">
          {log.entries.map(e => {
            const isExpanded = expandedEntryId === e.id;
            return (
              <div key={e.id} className="rounded-md border overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleEntry(e.id)}>
                  <ChevronRight size={14} className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  <span className="font-medium text-sm w-16">{e.workerName}</span>
                  <span className="text-sm text-muted-foreground">{formatDT(e.startTime)}–{formatDT(e.endTime)}</span>
                  <span className="text-sm text-muted-foreground">{e.hours}h</span>
                  <span className="text-sm text-muted-foreground">{e.area}</span>
                  <span className="font-mono text-xs text-muted-foreground ml-auto">{e.workCodeName}</span>
                </div>
                {isExpanded && (
                  <div className="px-4 py-3 bg-muted/20 border-t space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      <div><span className="text-muted-foreground">{fieldLabels.worker}：</span><span className="font-medium">{e.workerName}</span></div>
                      <div><span className="text-muted-foreground">开始时间 Start：</span><span className="font-medium">{formatDT(e.startTime)}</span></div>
                      <div><span className="text-muted-foreground">结束时间 End：</span><span className="font-medium">{formatDT(e.endTime)}</span></div>
                      <div><span className="text-muted-foreground">{fieldLabels.hours}：</span><span className="font-medium">{e.hours}h</span></div>
                      <div><span className="text-muted-foreground">{fieldLabels.area}：</span><span className="font-medium">{e.area}</span></div>
                      <div><span className="text-muted-foreground">{fieldLabels.workCode}：</span><span className="font-mono font-medium">{e.workCodeName}</span></div>
                    </div>
                    {e.detail && (
                      <div className="pt-1.5 border-t">
                        <span className="text-muted-foreground">{fieldLabels.detail}：</span>
                        <p className="mt-0.5 font-medium">{e.detail}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {log.equipmentUsage.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">设备使用 Equipment Usage</h3>
          <div className="space-y-1">
            {log.equipmentUsage.map(eu => {
              const euKey = `eq_${eu.id}`;
              const isExpanded = expandedEntryId === euKey;
              return (
                <div key={eu.id} className="rounded-md border overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleEntry(euKey)}>
                    <ChevronRight size={14} className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <span className="font-medium text-sm">{eu.equipmentName}</span>
                    <span className="text-sm text-muted-foreground">{formatDT(eu.startTime)}–{formatDT(eu.endTime)}</span>
                    <span className="text-sm text-muted-foreground">{eu.hours}h</span>
                    <span className="text-sm text-muted-foreground">{eu.area}</span>
                    <span className="font-mono text-xs text-muted-foreground ml-auto">{eu.workCodeName}</span>
                  </div>
                  {isExpanded && (
                    <div className="px-4 py-3 bg-muted/20 border-t space-y-1 text-sm">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        <div><span className="text-muted-foreground">{fieldLabels.equipmentName}：</span><span className="font-medium">{eu.equipmentName}</span></div>
                        <div><span className="text-muted-foreground">开始时间 Start：</span><span className="font-medium">{formatDT(eu.startTime)}</span></div>
                        <div><span className="text-muted-foreground">结束时间 End：</span><span className="font-medium">{formatDT(eu.endTime)}</span></div>
                        <div><span className="text-muted-foreground">{fieldLabels.hours}：</span><span className="font-medium">{eu.hours}h</span></div>
                        <div><span className="text-muted-foreground">{fieldLabels.area}：</span><span className="font-medium">{eu.area}</span></div>
                        <div><span className="text-muted-foreground">施工内容 Work Code：</span><span className="font-medium">{eu.workCodeName}</span></div>
                      </div>
                      {eu.detail && <div><span className="text-muted-foreground">详细描述 Description：</span><p className="mt-0.5 font-medium">{eu.detail}</p></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderHistoryButton = (log: DailyLog) => (
    (log.revisions?.length || 0) > 0 && (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setHistoryLogId(log.id); }} className="gap-1 text-xs h-7">
        <History size={12} /> 修改历史 History
      </Button>
    )
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{pageTitles.review.title}</h1>
        <p className="page-subtitle">{pageTitles.review.subtitle}</p>
      </div>

      {/* Withdraw Requests */}
      {withdrawRequests.length > 0 && (
        <>
          <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Undo2 size={14} /> 撤回申请 Withdraw Requests ({withdrawRequests.length})
          </h2>
          <div className="space-y-4 mb-8">
            {withdrawRequests.map(log => (
              <div key={log.id} className="bg-card rounded-lg border border-amber-500/30 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(log.id)}>
                  <div>
                    <p className="font-medium"><span className="font-mono text-xs text-muted-foreground mr-1.5">{getForemanLabel(log)}</span>{log.foremanName} · {log.date}</p>
                    <p className="text-sm text-muted-foreground">{log.entries.length} 条工人记录 Worker Entries · {log.equipmentUsage.length} 条设备记录 Eq. Entries · 总工时 Total {log.entries.reduce((s, e) => s + e.hours, 0)}h</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="status-badge status-pending">{logStatusLabels.withdraw_requested}</span>
                    {renderHistoryButton(log)}
                    {expandedId === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {expandedId === log.id && (
                  <div className="border-t">
                    <div className="p-5 space-y-4">
                      {renderLogEntries(log)}
                      <div className="flex flex-wrap gap-2 justify-end pt-2">
                        <Button onClick={() => handleApproveWithdraw(log.id)} className="gap-1 bg-success hover:bg-success/90 text-success-foreground">
                          <CheckCircle size={15} /> {actionLabels.approveWithdraw}
                        </Button>
                        <Button variant="destructive" onClick={() => handleRejectWithdraw(log.id)} className="gap-1">
                          <XCircle size={15} /> {actionLabels.rejectWithdraw}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pending */}
      <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">待审核 Pending ({pending.length})</h2>
      <div className="space-y-4 mb-8">
        {pending.length === 0 && <p className="text-muted-foreground text-sm py-8 text-center">{messages.noPending}</p>}
        {pending.map(log => (
          <div key={log.id} className="bg-card rounded-lg border shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(log.id)}>
              <div>
                <p className="font-medium"><span className="font-mono text-xs text-muted-foreground mr-1.5">{getForemanLabel(log)}</span>{log.foremanName} · {log.date}</p>
                <p className="text-sm text-muted-foreground">{log.entries.length} 条工人记录 Worker Entries · {log.equipmentUsage.length} 条设备记录 Eq. Entries · 总工时 Total {log.entries.reduce((s, e) => s + e.hours, 0)}h</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="status-badge status-pending">{logStatusLabels.pending}</span>
                {renderHistoryButton(log)}
                {expandedId === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
            {expandedId === log.id && (
              <div className="border-t">
                <div className="p-5 space-y-4">
                  {renderLogEntries(log)}
                  {/* Actions */}
                  <div className="space-y-3 pt-2">
                    <Textarea placeholder="意见/条件 Comments / Conditions（有条件通过或拒绝时必填 Required for conditional/reject）" value={comment} onChange={e => setComment(e.target.value)} rows={2} />
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button onClick={() => handleApprove(log.id)} className="gap-1 bg-success hover:bg-success/90 text-success-foreground">
                        <CheckCircle size={15} /> {actionLabels.approve}
                      </Button>
                      <Button onClick={() => handleConditional(log.id)} variant="outline" className="gap-1 border-amber-500 text-amber-600 hover:bg-amber-50">
                        <AlertTriangle size={15} /> {actionLabels.conditionalApprove}
                      </Button>
                      <Button variant="destructive" onClick={() => handleReject(log.id)} className="gap-1">
                        <XCircle size={15} /> {actionLabels.reject}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reviewed */}
      <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">已审核 Reviewed ({reviewed.length})</h2>
      <div className="space-y-3">
        {reviewed.map(log => (
          <div key={log.id} className="bg-card rounded-lg border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(log.id)}>
              <div>
                <p className="text-sm font-medium"><span className="font-mono text-xs text-muted-foreground mr-1.5">{getForemanLabel(log)}</span>{log.foremanName} · {log.date}</p>
                <p className="text-xs text-muted-foreground">{log.entries.length} 条记录 entries · {log.entries.reduce((s, e) => s + e.hours, 0)}h</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-badge ${statusClass(log.status)}`}>
                  {logStatusLabels[log.status] || log.status}
                </span>
                {renderHistoryButton(log)}
                {expandedId === log.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </div>
            {expandedId === log.id && (
              <div className="border-t p-5 space-y-3">
                {log.reviewComment && (
                  <div className={`p-2.5 rounded text-sm ${log.status === 'conditional' ? 'bg-amber-500/10 text-amber-700' : 'bg-destructive/5 text-destructive'}`}>
                    {log.status === 'conditional' ? `${fieldLabels.condition}：` : `${fieldLabels.reviewComment}：`}{log.reviewComment}
                  </div>
                )}
                {renderLogEntries(log)}
              </div>
            )}
          </div>
        ))}
      </div>

      <RevisionHistoryDialog log={historyLog || null} open={!!historyLogId} onOpenChange={() => setHistoryLogId(null)} />
    </div>
  );
}
