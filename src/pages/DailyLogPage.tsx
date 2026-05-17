import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useAppContext } from '@/contexts/AppContext';
import { useDataContext } from '@/contexts/DataContext';
import { DailyLog, DailyLogEntry, EquipmentUsageEntry, LogRevision } from '@/lib/types';
import { Plus, Trash2, Send, FileText, Edit2, History, ChevronDown, ChevronUp, ChevronRight, Download, RotateCcw, Archive, AlertTriangle, Undo2, CalendarIcon, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { exportDailyLogs } from '@/lib/excel-utils';
import RevisionHistoryDialog from '@/components/RevisionHistoryDialog';
import SearchableSelect from '@/components/SearchableSelect';

export default function DailyLogPage() {
  const { currentRole, currentPersonnelId, currentUserName } = useAppContext();
  const { personnel, equipment, workCodes, engineerAssignments, getTeamWorkers, getEngineerForemen, dailyLogs, addDailyLog, updateDailyLog, softDeleteDailyLog, restoreDailyLog, deleteDailyLog, emptyTrash } = useDataContext();

  const getForemanLabel = (log: DailyLog) => {
    const fm = personnel.find(p => p.id === log.foremanId);
    return fm?.laborId || log.foremanName;
  };
  const getWorker = (workerId: string) => personnel.find(p => p.id === workerId);
  const getWorkerLaborId = (entry: Pick<DailyLogEntry, 'workerId' | 'workerName'>) => (
    getWorker(entry.workerId)?.laborId || entry.workerName || '-'
  );

  const foremanId = currentPersonnelId;
  const isForeman = currentRole === 'foreman';
  const isAdmin = currentRole === 'admin';

  const teamWorkers = isForeman ? getTeamWorkers(foremanId).filter(w => w.status === 'active') : [];
  const teamEquip = isForeman ? equipment.filter(e => e.status !== 'retired') : [];

  // Foreman must have an assigned engineer before log operations
  const assignedEngineer = isForeman
    ? personnel.find(p => p.role === 'engineer' && engineerAssignments.some(a => a.engineerId === p.id && a.foremanIds.includes(foremanId)))
    : null;
  const hasEngineer = !!assignedEngineer;
  const requireEngineer = (): boolean => {
    if (!hasEngineer) {
      toast.error('您尚未分配工程师，无法进行该操作。请联系管理员分配工程师。 No engineer assigned. Please contact admin.');
      return false;
    }
    return true;
  };

  const [showTrash, setShowTrash] = useState(false);
  const [filterForemanId, setFilterForemanId] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const allLogs = useMemo(() => {
    if (isAdmin) return dailyLogs;
    if (currentRole === 'engineer') {
      const foremanIds = getEngineerForemen(currentPersonnelId);
      return dailyLogs.filter(l => foremanIds.includes(l.foremanId));
    }
    return dailyLogs.filter(l => l.foremanId === foremanId);
  }, [currentRole, dailyLogs, getEngineerForemen, isAdmin, foremanId, currentPersonnelId]);

  const logs = useMemo(() => {
    let filtered = allLogs.filter(l => !l.deletedAt);
    if (!isForeman) {
      if (filterForemanId !== 'all') filtered = filtered.filter(l => l.foremanId === filterForemanId);
      if (filterDateFrom) filtered = filtered.filter(l => l.date >= format(filterDateFrom, 'yyyy-MM-dd'));
      if (filterDateTo) filtered = filtered.filter(l => l.date <= format(filterDateTo, 'yyyy-MM-dd'));
    }
    if (filterStatus !== 'all') filtered = filtered.filter(l => l.status === filterStatus);
    return filtered;
  }, [allLogs, isForeman, filterForemanId, filterDateFrom, filterDateTo, filterStatus]);
  const trashedLogs = useMemo(() => allLogs.filter(l => !!l.deletedAt), [allLogs]);

  // Get unique foremen for filter dropdown
  const foremanOptions = useMemo(() => {
    const map = new Map<string, string>();
    allLogs.forEach(l => {
      if (!map.has(l.foremanId)) {
        const fm = personnel.find(p => p.id === l.foremanId);
        map.set(l.foremanId, fm?.laborId ? `${fm.laborId} ${l.foremanName}` : l.foremanName);
      }
    });
    return Array.from(map.entries());
  }, [allLogs, personnel]);

  const [entries, setEntries] = useState<Omit<DailyLogEntry, 'id'>[]>([]);
  const [eqEntries, setEqEntries] = useState<Omit<EquipmentUsageEntry, 'id'>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [historyLogId, setHistoryLogId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Batch selection for entries inside the form
  const [selectedEntryIdx, setSelectedEntryIdx] = useState<Set<number>>(new Set());
  const [selectedEqIdx, setSelectedEqIdx] = useState<Set<number>>(new Set());
  const [bulkAddWorkerOpen, setBulkAddWorkerOpen] = useState(false);
  const [bulkAddEqOpen, setBulkAddEqOpen] = useState(false);
  const [bulkPickWorkers, setBulkPickWorkers] = useState<Set<string>>(new Set());
  const [bulkPickEquip, setBulkPickEquip] = useState<Set<string>>(new Set());
  const [bulkEditWorkerOpen, setBulkEditWorkerOpen] = useState(false);
  const [bulkEditEqOpen, setBulkEditEqOpen] = useState(false);
  const [bulkEdit, setBulkEdit] = useState<{ start?: string; end?: string; area?: string; workCodeId?: string }>({});
  const [bulkPickWorkerSearch, setBulkPickWorkerSearch] = useState('');
  const [bulkPickEquipSearch, setBulkPickEquipSearch] = useState('');

  const toggleEntrySel = (i: number) => setSelectedEntryIdx(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const toggleEqSel = (i: number) => setSelectedEqIdx(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const toggleAllEntries = () => setSelectedEntryIdx(prev => prev.size === entries.length ? new Set() : new Set(entries.map((_, i) => i)));
  const toggleAllEq = () => setSelectedEqIdx(prev => prev.size === eqEntries.length ? new Set() : new Set(eqEntries.map((_, i) => i)));

  const batchDeleteWorkers = () => {
    setEntries(prev => prev.filter((_, i) => !selectedEntryIdx.has(i)));
    setSelectedEntryIdx(new Set());
  };
  const batchDeleteEq = () => {
    setEqEntries(prev => prev.filter((_, i) => !selectedEqIdx.has(i)));
    setSelectedEqIdx(new Set());
  };

  const confirmBulkAddWorkers = () => {
    const newOnes = Array.from(bulkPickWorkers).map(wid => {
      const w = teamWorkers.find(x => x.id === wid);
      return { workerId: wid, workerName: w?.name || '', startTime: defaultStart(), endTime: defaultEnd(), hours: 8, area: '', workCodeId: '', workCodeName: '', detail: '' };
    });
    setEntries(prev => [...prev, ...newOnes]);
    setBulkPickWorkers(new Set());
    setBulkAddWorkerOpen(false);
  };
  const confirmBulkAddEq = () => {
    const newOnes = Array.from(bulkPickEquip).map(eid => {
      const eq = equipment.find(x => x.id === eid);
      return { equipmentId: eid, equipmentName: eq?.name || '', startTime: defaultStart(), endTime: defaultEnd(), hours: 8, area: '', workCodeId: '', workCodeName: '', detail: '' };
    });
    setEqEntries(prev => [...prev, ...newOnes]);
    setBulkPickEquip(new Set());
    setBulkAddEqOpen(false);
  };

  const applyBulkEditWorkers = () => {
    setEntries(prev => prev.map((e, i) => {
      if (!selectedEntryIdx.has(i)) return e;
      const next = { ...e };
      if (bulkEdit.start) next.startTime = bulkEdit.start;
      if (bulkEdit.end) next.endTime = bulkEdit.end;
      next.hours = calcHours(next.startTime, next.endTime);
      if (bulkEdit.area) next.area = bulkEdit.area;
      if (bulkEdit.workCodeId) {
        const wc = workCodes.find(c => c.id === bulkEdit.workCodeId);
        next.workCodeId = bulkEdit.workCodeId;
        next.workCodeName = wc ? `[${wc.code}] ${wc.name}` : '';
        if (wc?.area) next.area = wc.area;
      }
      return next;
    }));
    setBulkEdit({});
    setBulkEditWorkerOpen(false);
  };
  const applyBulkEditEq = () => {
    setEqEntries(prev => prev.map((e, i) => {
      if (!selectedEqIdx.has(i)) return e;
      const next = { ...e };
      if (bulkEdit.start) next.startTime = bulkEdit.start;
      if (bulkEdit.end) next.endTime = bulkEdit.end;
      next.hours = calcHours(next.startTime, next.endTime);
      if (bulkEdit.area) next.area = bulkEdit.area;
      if (bulkEdit.workCodeId) {
        const wc = workCodes.find(c => c.id === bulkEdit.workCodeId);
        next.workCodeId = bulkEdit.workCodeId;
        next.workCodeName = wc ? `[${wc.code}] ${wc.name}` : '';
        if (wc?.area) next.area = wc.area;
      }
      return next;
    }));
    setBulkEdit({});
    setBulkEditEqOpen(false);
  };

  const calcHours = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e)) return 0;
    const diff = (e - s) / (1000 * 60 * 60);
    return Math.max(0, Math.round(diff * 10) / 10);
  };

  const formatDT = (dt: string) => {
    if (!dt) return '-';
    return dt.replace('T', ' ');
  };

  const defaultStart = () => {
    const d = new Date().toISOString().split('T')[0];
    return `${d}T07:00`;
  };
  const defaultEnd = () => {
    const d = new Date().toISOString().split('T')[0];
    return `${d}T15:00`;
  };

  const addWorkerEntry = () => setEntries(prev => [...prev, { workerId: '', workerName: '', startTime: defaultStart(), endTime: defaultEnd(), hours: 8, area: '', workCodeId: '', workCodeName: '', detail: '' }]);
  const addEqEntry = () => setEqEntries(prev => [...prev, { equipmentId: '', equipmentName: '', startTime: defaultStart(), endTime: defaultEnd(), hours: 8, area: '', workCodeId: '', workCodeName: '', detail: '' }]);

  const updateEntry = (i: number, field: string, value: string | number) => {
    setEntries(prev => prev.map((e, idx) => {
      if (idx !== i) return e;
      if (field === 'workerId') {
        const w = teamWorkers.find(w => w.id === value);
        return { ...e, workerId: value as string, workerName: w?.name || '' };
      }
      if (field === 'workCodeId') {
        const wc = workCodes.find(c => c.id === value);
        return { ...e, workCodeId: value as string, workCodeName: wc ? `[${wc.code}] ${wc.name}` : '', area: wc?.area || e.area };
      }
      if (field === 'startTime') {
        const newStart = value as string;
        return { ...e, startTime: newStart, hours: calcHours(newStart, e.endTime) };
      }
      if (field === 'endTime') {
        const newEnd = value as string;
        return { ...e, endTime: newEnd, hours: calcHours(e.startTime, newEnd) };
      }
      return { ...e, [field]: value };
    }));
  };

  const updateEqEntry = (i: number, field: string, value: string | number) => {
    setEqEntries(prev => prev.map((e, idx) => {
      if (idx !== i) return e;
      if (field === 'equipmentId') {
        const eq = equipment.find(eq => eq.id === value);
        return { ...e, equipmentId: value as string, equipmentName: eq?.name || '' };
      }
      if (field === 'workCodeId') {
        const wc = workCodes.find(c => c.id === value);
        return { ...e, workCodeId: value as string, workCodeName: wc ? `[${wc.code}] ${wc.name}` : '', area: wc?.area || e.area };
      }
      if (field === 'startTime') {
        const newStart = value as string;
        return { ...e, startTime: newStart, hours: calcHours(newStart, e.endTime) };
      }
      if (field === 'endTime') {
        const newEnd = value as string;
        return { ...e, endTime: newEnd, hours: calcHours(e.startTime, newEnd) };
      }
      return { ...e, [field]: value };
    }));
  };

  const startEditLog = (log: DailyLog) => {
    setEditingLogId(log.id);
    setEntries(log.entries.map(({ id, ...rest }) => rest));
    setEqEntries(log.equipmentUsage.map(({ id, ...rest }) => rest));
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingLogId(null);
    setEntries([]);
    setEqEntries([]);
  };

  const handleDeleteLog = async (logId: string) => {
    await softDeleteDailyLog(logId);
    toast.success('日志已移入回收站 Log moved to trash');
  };

  const handleWithdrawRequest = async (logId: string) => {
    if (!requireEngineer()) return;
    const log = dailyLogs.find(l => l.id === logId);
    if (!log) return;
    const revision: LogRevision = {
      timestamp: new Date().toISOString(),
      entries: log.entries,
      equipmentUsage: log.equipmentUsage,
      reviewComment: `[撤回申请 Withdraw Request] 原状态 Previous: ${statusLabel(log.status)}`,
    };
    await updateDailyLog(logId, {
      status: 'withdraw_requested' as any,
      revisions: [...(log.revisions || []), revision],
    });
    toast.success('撤回申请已提交 Withdraw request submitted');
  };

  const handleRestoreLog = async (logId: string) => {
    await restoreDailyLog(logId);
    toast.success('日志已恢复 Log restored');
  };

  const handlePermanentDelete = async (logId: string) => {
    await deleteDailyLog(logId);
    toast.success('日志已永久删除 Log permanently deleted');
  };

  const handleEmptyTrash = async () => {
    const ids = trashedLogs.map(l => l.id);
    await emptyTrash(ids);
    toast.success('回收站已清空 Trash emptied');
  };

  const handleSubmit = async () => {
    if (isForeman && !requireEngineer()) return;
    if (entries.length === 0) { toast.error('请至少添加一条工人记录 Please add at least one entry'); return; }
    if (entries.some(e => !e.workerId || !e.area || !e.workCodeId)) { toast.error('请填写完整工人信息 Please fill in all required fields'); return; }

    const newEntries: DailyLogEntry[] = entries.map((e, i) => ({ ...e, id: `e_${Date.now()}_${i}` }));
    const newEqEntries: EquipmentUsageEntry[] = eqEntries.map((e, i) => ({ ...e, id: `eu_${Date.now()}_${i}` }));

    if (editingLogId) {
      const log = dailyLogs.find(l => l.id === editingLogId);
      if (log) {
        const revision: LogRevision = {
          timestamp: new Date().toISOString(),
          entries: log.entries,
          equipmentUsage: log.equipmentUsage,
          reviewComment: log.reviewComment,
        };
        await updateDailyLog(editingLogId, {
          status: 'pending',
          reviewComment: undefined,
          entries: newEntries,
          equipmentUsage: newEqEntries,
          revisions: [...(log.revisions || []), revision],
        });
      }
      toast.success('日志已修改并重新提交 Log revised and resubmitted');
    } else {
      const fmPersonnel = personnel.find(p => p.id === foremanId);
      await addDailyLog({
        date: new Date().toISOString().split('T')[0],
        foremanId,
        foremanName: fmPersonnel?.name || currentUserName,
        status: 'pending',
        entries: newEntries,
        equipmentUsage: newEqEntries,
      });
      toast.success('施工日志已提交 Daily log submitted');
    }
    cancelForm();
  };

  const codesByCategory = workCodes.reduce((acc, wc) => {
    if (!acc[wc.category]) acc[wc.category] = [];
    acc[wc.category].push(wc);
    return acc;
  }, {} as Record<string, typeof workCodes>);
  const workAreas = Array.from(new Set(workCodes.map(wc => wc.area).filter(Boolean) as string[])).sort();

  const historyLog = historyLogId ? logs.find(l => l.id === historyLogId) : null;

  const toggleEntry = (entryId: string) => {
    setExpandedEntryId(prev => prev === entryId ? null : entryId);
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      approved: '已通过 Approved', pending: '待审核 Pending', conditional: '有条件通过 Conditional',
      rejected: '已拒绝 Rejected', withdraw_requested: '撤回申请中 Withdraw Requested', withdrawn: '已撤回 Withdrawn',
    };
    return map[s] || s;
  };
  const statusClass = (s: string) =>
    s === 'approved' ? 'status-approved' : s === 'pending' ? 'status-pending' : s === 'conditional' ? 'status-approved'
    : s === 'withdraw_requested' ? 'status-pending' : s === 'withdrawn' ? 'status-rejected' : 'status-rejected';

  const subtitle = isAdmin
    ? '查看所有工长提交的施工日志记录，支持导出汇总 View all daily logs, export supported'
    : currentRole === 'engineer'
    ? '查看您管理的工长提交的施工日志记录 View managed foremen daily logs'
    : '填写每日工人工时、施工区域和工作内容 Fill in daily worker hours and work content';

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">施工日志 Daily Log</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => exportDailyLogs(logs, personnel)} className="gap-2">
              <Download size={16} /> 导出Excel Export Excel
            </Button>
          )}
          {isAdmin && (
            <Button
              variant={showTrash ? 'default' : 'outline'}
              onClick={() => setShowTrash(!showTrash)}
              className="gap-2"
            >
              <Archive size={16} />
              回收站 Trash
              {trashedLogs.length > 0 && (
                <span className="ml-1 bg-destructive/20 text-destructive text-xs px-1.5 py-0.5 rounded-full">{trashedLogs.length}</span>
              )}
            </Button>
          )}
          {isForeman && !showForm && !showTrash && (
            <Button
              onClick={() => { if (!requireEngineer()) return; setShowForm(true); setEditingLogId(null); addWorkerEntry(); }}
              disabled={!hasEngineer}
              className="gap-2"
            >
              <Plus size={16} /> 新建日志 New Log
            </Button>
          )}
        </div>
      </div>

      {isForeman && !hasEngineer && (
        <div className="mb-4 flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">您尚未分配工程师 No engineer assigned</p>
            <p className="text-muted-foreground mt-0.5">请联系管理员为您分配审批工程师后，方可提交、修改或撤回日志。 Please contact admin to assign a reviewing engineer before submitting, revising, or withdrawing logs.</p>
          </div>
        </div>
      )}

      {/* Filters for admin and engineer */}
      {!isForeman && !showTrash && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-4 bg-card rounded-lg border">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter size={14} /> 筛选 Filter
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">工长 Foreman</Label>
            <Select value={filterForemanId} onValueChange={setFilterForemanId}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部工长 All Foremen</SelectItem>
                {foremanOptions.map(([id, label]) => (
                  <SelectItem key={id} value={id}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">状态 Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态 All Status</SelectItem>
                <SelectItem value="pending">待审核 Pending</SelectItem>
                <SelectItem value="approved">已通过 Approved</SelectItem>
                <SelectItem value="conditional">有条件通过 Conditional</SelectItem>
                <SelectItem value="rejected">已拒绝 Rejected</SelectItem>
                <SelectItem value="withdraw_requested">撤回申请中 Withdraw Requested</SelectItem>
                <SelectItem value="withdrawn">已撤回 Withdrawn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">起始日期 From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-9 w-[150px] justify-start text-left font-normal text-sm", !filterDateFrom && "text-muted-foreground")}>
                  <CalendarIcon size={14} className="mr-1.5" />
                  {filterDateFrom ? format(filterDateFrom, 'yyyy-MM-dd') : '不限 Any'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filterDateFrom} onSelect={setFilterDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">截止日期 To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-9 w-[150px] justify-start text-left font-normal text-sm", !filterDateTo && "text-muted-foreground")}>
                  <CalendarIcon size={14} className="mr-1.5" />
                  {filterDateTo ? format(filterDateTo, 'yyyy-MM-dd') : '不限 Any'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filterDateTo} onSelect={setFilterDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          {(filterForemanId !== 'all' || filterDateFrom || filterDateTo || filterStatus !== 'all') && (
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setFilterForemanId('all'); setFilterDateFrom(undefined); setFilterDateTo(undefined); setFilterStatus('all'); }}>
              清除 Clear
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{logs.length} 条记录 records</span>
        </div>
      )}

      {isForeman && !showTrash && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-card rounded-lg border">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter size={14} /> 筛选 Filter
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">状态 Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态 All Status</SelectItem>
                <SelectItem value="pending">待审核 Pending</SelectItem>
                <SelectItem value="approved">已通过 Approved</SelectItem>
                <SelectItem value="conditional">有条件通过 Conditional</SelectItem>
                <SelectItem value="rejected">已拒绝 Rejected</SelectItem>
                <SelectItem value="withdraw_requested">撤回申请中 Withdraw Requested</SelectItem>
                <SelectItem value="withdrawn">已撤回 Withdrawn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filterStatus !== 'all' && (
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setFilterStatus('all')}>清除 Clear</Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{logs.length} 条记录 records</span>
        </div>
      )}

      {isForeman && (() => {
        const rejectedLogs = logs.filter(l => l.status === 'rejected' || l.status === 'withdrawn');
        const conditionalLogs = logs.filter(l => l.status === 'conditional');
        const withdrawnLogs = logs.filter(l => l.status === 'withdraw_requested');
        if (rejectedLogs.length === 0 && conditionalLogs.length === 0 && withdrawnLogs.length === 0) return null;
        return (
          <div className="mb-4 space-y-2">
            {rejectedLogs.length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-destructive">您有 {rejectedLogs.length} 条日志需要重新提交 You have {rejectedLogs.length} log(s) to resubmit</p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {rejectedLogs.map(l => (
                      <li key={l.id} className="flex items-center gap-2">
                        <span>{l.date}</span>
                        <span className="text-destructive">— {l.status === 'withdrawn' ? '已撤回 Withdrawn' : l.reviewComment || '已拒绝 Rejected'}</span>
                        <Button variant="outline" size="sm" className="h-6 text-xs ml-auto gap-1" onClick={() => startEditLog(l)}>
                          <Edit2 size={10} /> 修改重提 Revise
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {conditionalLogs.length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-700">您有 {conditionalLogs.length} 条日志有条件通过 You have {conditionalLogs.length} conditionally approved log(s)</p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {conditionalLogs.map(l => (
                      <li key={l.id}>
                        <span>{l.date}</span>
                        {l.reviewComment && <span className="text-amber-600"> — {l.reviewComment}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {withdrawnLogs.length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-muted bg-muted/30">
                <Undo2 size={18} className="text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-muted-foreground">您有 {withdrawnLogs.length} 条日志撤回申请中 You have {withdrawnLogs.length} pending withdraw request(s)</p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {withdrawnLogs.map(l => (
                      <li key={l.id}>{l.date} — 等待工程师审批 Awaiting engineer approval</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Form - foreman only */}
      {isForeman && showForm && (
        <div className="bg-card rounded-lg border shadow-sm p-5 mb-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg">
                {editingLogId ? '修改施工日志 Revise Log' : '今日施工日志 Today\'s Log'} · {editingLogId ? logs.find(l => l.id === editingLogId)?.date : new Date().toISOString().split('T')[0]}
              </h2>
              {editingLogId && (
                <p className="text-sm text-muted-foreground mt-1">修改后将重新提交审核 Will be resubmitted after revision</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={cancelForm}>取消 Cancel</Button>
          </div>

          {/* Worker entries */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold">工人工时记录 Worker Hours</Label>
              <div className="flex items-center gap-2">
                {selectedEntryIdx.size > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">已选 {selectedEntryIdx.size} Selected</span>
                    <Button variant="outline" size="sm" onClick={() => setBulkEditWorkerOpen(true)} className="gap-1"><Edit2 size={14} /> 批量修改 Bulk Edit</Button>
                    <Button variant="destructive" size="sm" onClick={batchDeleteWorkers} className="gap-1"><Trash2 size={14} /> 批量删除 Bulk Delete</Button>
                  </>
                )}
                {entries.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={toggleAllEntries} className="text-xs">{selectedEntryIdx.size === entries.length ? '取消全选 Unselect' : '全选 Select All'}</Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setBulkAddWorkerOpen(true)} className="gap-1"><Plus size={14} /> 批量添加 Bulk Add</Button>
                <Button variant="outline" size="sm" onClick={addWorkerEntry} className="gap-1"><Plus size={14} /> 添加工人 Add Worker</Button>
              </div>
            </div>
            <div className="space-y-4">
              {entries.map((entry, i) => (
                <div key={i} className="space-y-2 p-3 rounded-lg border bg-muted/10">
                  <div className="grid grid-cols-2 md:grid-cols-[24px_1fr_1fr_1fr_60px_1fr_40px] gap-2 items-end">
                    <div className="flex items-center justify-center h-9">
                      <Checkbox checked={selectedEntryIdx.has(i)} onCheckedChange={() => toggleEntrySel(i)} />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">工人 Worker</Label>}
                      <SearchableSelect
                        value={entry.workerId}
                        onChange={v => updateEntry(i, 'workerId', v)}
                        placeholder="选择工人 Select worker"
                        options={teamWorkers.map(w => ({ value: w.id, label: w.laborId || w.name, hint: [w.name, w.specialty].filter(Boolean).join(' / ') }))}
                      />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">开始 Start</Label>}
                      <Input type="datetime-local" value={entry.startTime} onChange={e => updateEntry(i, 'startTime', e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">结束 End</Label>}
                      <Input type="datetime-local" value={entry.endTime} onChange={e => updateEntry(i, 'endTime', e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">工时 h</Label>}
                      <div className="h-9 flex items-center justify-center text-sm font-medium text-muted-foreground bg-muted/50 rounded-md">{entry.hours}h</div>
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">施工区域 Area</Label>}
                      <Select value={entry.area} onValueChange={v => updateEntry(i, 'area', v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="选择区域 Select area" /></SelectTrigger>
                        <SelectContent>{workAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9" onClick={() => setEntries(prev => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr] gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">施工代码 Work Code</Label>
                      <Select value={entry.workCodeId} onValueChange={v => updateEntry(i, 'workCodeId', v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="选择施工代码 Select work code" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(codesByCategory).map(([cat, codes]) => (
                            <div key={cat}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{cat}</div>
                              {codes.map(wc => (
                                <SelectItem key={wc.id} value={wc.id}>
                                  <span className="font-mono text-xs">{wc.code}</span> {wc.name}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">详细描述 Description</Label>
                      <Input value={entry.detail} onChange={e => updateEntry(i, 'detail', e.target.value)} placeholder="填写具体施工内容 Describe work details..." className="h-9" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Equipment entries */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold">设备使用记录 Equipment Usage</Label>
              <div className="flex items-center gap-2">
                {selectedEqIdx.size > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">已选 {selectedEqIdx.size} Selected</span>
                    <Button variant="outline" size="sm" onClick={() => setBulkEditEqOpen(true)} className="gap-1"><Edit2 size={14} /> 批量修改 Bulk Edit</Button>
                    <Button variant="destructive" size="sm" onClick={batchDeleteEq} className="gap-1"><Trash2 size={14} /> 批量删除 Bulk Delete</Button>
                  </>
                )}
                {eqEntries.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={toggleAllEq} className="text-xs">{selectedEqIdx.size === eqEntries.length ? '取消全选 Unselect' : '全选 Select All'}</Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setBulkAddEqOpen(true)} className="gap-1"><Plus size={14} /> 批量添加 Bulk Add</Button>
                <Button variant="outline" size="sm" onClick={addEqEntry} className="gap-1"><Plus size={14} /> 添加设备 Add Equipment</Button>
              </div>
            </div>
            <div className="space-y-3">
              {eqEntries.map((entry, i) => (
                <div key={i} className="space-y-2 p-3 rounded-lg border bg-muted/10">
                  <div className="grid grid-cols-2 md:grid-cols-[24px_1fr_1fr_1fr_60px_1fr_40px] gap-2 items-end">
                    <div className="flex items-center justify-center h-9">
                      <Checkbox checked={selectedEqIdx.has(i)} onCheckedChange={() => toggleEqSel(i)} />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">设备 Equipment</Label>}
                      <SearchableSelect
                        value={entry.equipmentId}
                        onChange={v => updateEqEntry(i, 'equipmentId', v)}
                        placeholder="选择设备 Select equipment"
                        options={teamEquip.map(eq => ({ value: eq.id, label: eq.name, code: eq.equipmentNo, hint: eq.model }))}
                      />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">开始 Start</Label>}
                      <Input type="datetime-local" value={entry.startTime} onChange={e => updateEqEntry(i, 'startTime', e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">结束 End</Label>}
                      <Input type="datetime-local" value={entry.endTime} onChange={e => updateEqEntry(i, 'endTime', e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">工时 h</Label>}
                      <div className="h-9 flex items-center justify-center text-sm font-medium text-muted-foreground bg-muted/50 rounded-md">{entry.hours}h</div>
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">施工区域 Area</Label>}
                      <Select value={entry.area} onValueChange={v => updateEqEntry(i, 'area', v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="选择区域 Select area" /></SelectTrigger>
                        <SelectContent>{workAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9" onClick={() => setEqEntries(prev => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr] gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">施工代码 Work Code</Label>
                      <Select value={entry.workCodeId} onValueChange={v => updateEqEntry(i, 'workCodeId', v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="选择施工代码 Select work code" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(codesByCategory).map(([cat, codes]) => (
                            <div key={cat}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{cat}</div>
                              {codes.map(wc => (
                                <SelectItem key={wc.id} value={wc.id}>
                                  <span className="font-mono text-xs">{wc.code}</span> {wc.name}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">详细描述 Description</Label>
                      <Input value={entry.detail} onChange={e => updateEqEntry(i, 'detail', e.target.value)} placeholder="填写设备使用详情 Describe equipment usage..." className="h-9" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} className="gap-2"><Send size={15} /> {editingLogId ? '重新提交 Resubmit' : '提交审核 Submit for Review'}</Button>
          </div>
        </div>
      )}

      {/* Trash View */}
      {showTrash ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Archive size={18} /> 回收站 Trash ({trashedLogs.length})
            </h2>
            {trashedLogs.length > 0 && isAdmin && (
              <Button variant="destructive" size="sm" onClick={handleEmptyTrash} className="gap-1">
                <Trash2 size={14} /> 清空回收站 Empty Trash
              </Button>
            )}
          </div>
          {trashedLogs.map(log => (
            <div key={log.id} className="bg-card rounded-lg border shadow-sm overflow-hidden opacity-75">
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium"><span className="font-mono text-xs text-muted-foreground mr-1.5">{getForemanLabel(log)}</span>{log.foremanName} · {log.date}</p>
                  <p className="text-sm text-muted-foreground">
                    {log.entries.length} 条工人记录 worker entries · 删除于 Deleted {new Date(log.deletedAt!).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`status-badge ${statusClass(log.status)}`}>{statusLabel(log.status)}</span>
                  <Button variant="outline" size="sm" onClick={() => handleRestoreLog(log.id)} className="gap-1 text-xs h-7">
                    <RotateCcw size={12} /> 恢复 Restore
                  </Button>
                  {isAdmin && (
                    <Button variant="destructive" size="sm" onClick={() => handlePermanentDelete(log.id)} className="gap-1 text-xs h-7">
                      <Trash2 size={12} /> 永久删除 Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {trashedLogs.length === 0 && (
            <div className="bg-card rounded-lg border shadow-sm px-4 py-12 text-center text-muted-foreground">回收站为空 Trash is empty</div>
          )}
        </div>
      ) : (
      /* Log list - all roles */
      <div className="space-y-3">
        {logs.map(log => (
          <div key={log.id} className="bg-card rounded-lg border shadow-sm overflow-hidden">
            <div
              className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => { setExpandedLogId(expandedLogId === log.id ? null : log.id); setExpandedEntryId(null); }}
            >
              <div>
                <p className="font-medium"><span className="font-mono text-xs text-muted-foreground mr-1.5">{getForemanLabel(log)}</span>{log.foremanName} · {log.date}</p>
                <p className="text-sm text-muted-foreground">
                  {log.entries.length} 条工人记录 worker entries · {log.equipmentUsage.length} 条设备记录 equip. entries · 总工时 Total {log.entries.reduce((s, e) => s + e.hours, 0)}h
                  {(log.revisions?.length || 0) > 0 && ` · 已修改 Revised ${log.revisions!.length} 次 times`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-badge ${statusClass(log.status)}`}>{statusLabel(log.status)}</span>
                {isForeman && ['rejected', 'withdrawn'].includes(log.status) && !showForm && (
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); startEditLog(log); }} className="gap-1 text-xs h-7">
                    <Edit2 size={12} /> 修改重提 Revise
                  </Button>
                )}
                {(log.revisions?.length || 0) > 0 && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setHistoryLogId(log.id); }} className="gap-1 text-xs h-7">
                    <History size={12} /> 修改历史 History
                  </Button>
                )}
                {isForeman && log.foremanId === foremanId && ['pending', 'conditional'].includes(log.status) && (
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleWithdrawRequest(log.id); }} className="gap-1 text-xs h-7">
                    <Undo2 size={12} /> 申请撤回 Withdraw
                  </Button>
                )}
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteLog(log.id); }} className="gap-1 text-xs h-7 text-destructive hover:text-destructive">
                    <Trash2 size={12} /> 删除 Delete
                  </Button>
                )}
                {expandedLogId === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {expandedLogId === log.id && (
              <div className="border-t p-5 space-y-4">
                {log.reviewComment && (
                  <div className={`p-2.5 rounded text-sm ${log.status === 'conditional' ? 'bg-amber-500/10 text-amber-700' : 'bg-destructive/5 text-destructive'}`}>
                    {log.status === 'conditional' ? '通过条件 Condition：' : '审核意见 Review Comment：'}{log.reviewComment}
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold mb-2">工人记录 Worker Entries</h3>
                  <div className="space-y-1">
                    {log.entries.map(e => {
                      const isExpanded = expandedEntryId === e.id;
                      return (
                        <div key={e.id} className="rounded-md border overflow-hidden">
                          <div
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => toggleEntry(e.id)}
                          >
                            <ChevronRight size={14} className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                             <span className="w-24 min-w-0">
                              <span className="block font-mono font-semibold text-sm truncate">{getWorkerLaborId(e)}</span>
                              <span className="block text-xs text-muted-foreground truncate">{e.workerName}</span>
                            </span>
                              <span className="text-sm text-muted-foreground">{formatDT(e.startTime)}–{formatDT(e.endTime)}</span>
                              <span className="text-sm text-muted-foreground">{e.hours}h</span>
                              <span className="text-sm text-muted-foreground">{e.area}</span>
                            <span className="font-mono text-xs text-muted-foreground ml-auto">{e.workCodeName}</span>
                          </div>
                          {isExpanded && (
                            <div className="px-4 py-3 bg-muted/20 border-t space-y-2 text-sm">
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                                  <div><span className="text-muted-foreground">劳工号 Labor ID：</span><span className="font-mono font-medium">{getWorkerLaborId(e)}</span></div>
                                  <div><span className="text-muted-foreground">开始时间 Start：</span><span className="font-medium">{formatDT(e.startTime)}</span></div>
                                  <div><span className="text-muted-foreground">结束时间 End：</span><span className="font-medium">{formatDT(e.endTime)}</span></div>
                                  <div><span className="text-muted-foreground">工时 Hours：</span><span className="font-medium">{e.hours}h</span></div>
                                  <div><span className="text-muted-foreground">施工区域 Area：</span><span className="font-medium">{e.area}</span></div>
                                  <div><span className="text-muted-foreground">施工代码 Code：</span><span className="font-mono font-medium">{e.workCodeName}</span></div>
                                </div>
                              {e.detail && (
                                <div className="pt-1.5 border-t">
                                  <span className="text-muted-foreground">详细描述 Description：</span>
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
                            <div
                              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                              onClick={() => toggleEntry(euKey)}
                            >
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
                                  <div><span className="text-muted-foreground">设备名称 Equipment：</span><span className="font-medium">{eu.equipmentName}</span></div>
                                  <div><span className="text-muted-foreground">开始时间 Start：</span><span className="font-medium">{formatDT(eu.startTime)}</span></div>
                                  <div><span className="text-muted-foreground">结束时间 End：</span><span className="font-medium">{formatDT(eu.endTime)}</span></div>
                                  <div><span className="text-muted-foreground">使用时长 Duration：</span><span className="font-medium">{eu.hours}h</span></div>
                                  <div><span className="text-muted-foreground">使用区域 Area：</span><span className="font-medium">{eu.area}</span></div>
                                  <div><span className="text-muted-foreground">施工内容 Work Code：</span><span className="font-medium">{eu.workCodeName}</span></div>
                                </div>
                                {eu.detail && (
                                  <div>
                                    <span className="text-muted-foreground">详细描述 Description：</span>
                                    <p className="mt-0.5 font-medium">{eu.detail}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {logs.length === 0 && (
          <div className="bg-card rounded-lg border shadow-sm px-4 py-12 text-center text-muted-foreground">暂无施工日志记录 No daily log records</div>
        )}
      </div>
      )}

      <RevisionHistoryDialog log={historyLog || null} open={!!historyLogId} onOpenChange={() => setHistoryLogId(null)} />

      {/* Bulk add workers dialog */}
      <Dialog open={bulkAddWorkerOpen} onOpenChange={setBulkAddWorkerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>批量添加工人 Bulk Add Workers</DialogTitle></DialogHeader>
          <Input placeholder="搜索 劳工号/姓名/工种 Search labor ID/name..." value={bulkPickWorkerSearch} onChange={e => setBulkPickWorkerSearch(e.target.value)} className="h-9" />
          <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
            {teamWorkers.filter(w => {
              const q = bulkPickWorkerSearch.trim().toLowerCase();
              if (!q) return true;
              return `${w.name} ${w.laborId || ''} ${w.specialty || ''}`.toLowerCase().includes(q);
            }).map(w => (
              <label key={w.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 cursor-pointer">
                <Checkbox checked={bulkPickWorkers.has(w.id)} onCheckedChange={() => setBulkPickWorkers(prev => { const n = new Set(prev); n.has(w.id) ? n.delete(w.id) : n.add(w.id); return n; })} />
                <span className="text-sm flex items-center gap-2 min-w-0">
                  <span className="font-mono font-semibold">{w.laborId || '-'}</span>
                  <span className="text-xs text-muted-foreground truncate">{w.name}</span>
                  <span className="text-muted-foreground text-xs">({w.specialty || '-'})</span>
                </span>
              </label>
            ))}
            {teamWorkers.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">无可用工人 No workers</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAddWorkerOpen(false)}>取消 Cancel</Button>
            <Button onClick={confirmBulkAddWorkers} disabled={bulkPickWorkers.size === 0}>添加 {bulkPickWorkers.size} 人 Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk add equipment dialog */}
      <Dialog open={bulkAddEqOpen} onOpenChange={setBulkAddEqOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>批量添加设备 Bulk Add Equipment</DialogTitle></DialogHeader>
          <Input placeholder="搜索 设备号/名称/型号 Search equipment no./name..." value={bulkPickEquipSearch} onChange={e => setBulkPickEquipSearch(e.target.value)} className="h-9" />
          <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
            {teamEquip.filter(eq => {
              const q = bulkPickEquipSearch.trim().toLowerCase();
              if (!q) return true;
              return `${eq.name} ${eq.equipmentNo || ''} ${eq.model || ''}`.toLowerCase().includes(q);
            }).map(eq => (
              <label key={eq.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 cursor-pointer">
                <Checkbox checked={bulkPickEquip.has(eq.id)} onCheckedChange={() => setBulkPickEquip(prev => { const n = new Set(prev); n.has(eq.id) ? n.delete(eq.id) : n.add(eq.id); return n; })} />
                <span className="text-sm flex items-center gap-2">
                  {eq.equipmentNo && <span className="font-mono text-xs text-muted-foreground">{eq.equipmentNo}</span>}
                  <span>{eq.name}</span>
                  <span className="text-muted-foreground text-xs">{eq.model}</span>
                </span>
              </label>
            ))}
            {teamEquip.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">无可用设备 No equipment</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAddEqOpen(false)}>取消 Cancel</Button>
            <Button onClick={confirmBulkAddEq} disabled={bulkPickEquip.size === 0}>添加 {bulkPickEquip.size} 项 Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk edit workers dialog */}
      <Dialog open={bulkEditWorkerOpen} onOpenChange={(o) => { setBulkEditWorkerOpen(o); if (!o) setBulkEdit({}); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>批量修改工人记录 Bulk Edit Workers ({selectedEntryIdx.size})</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">仅填写需要修改的字段，留空则不变 Only filled fields will be updated</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">开始 Start</Label><Input type="datetime-local" value={bulkEdit.start || ''} onChange={e => setBulkEdit(p => ({ ...p, start: e.target.value }))} className="h-9" /></div>
              <div><Label className="text-xs">结束 End</Label><Input type="datetime-local" value={bulkEdit.end || ''} onChange={e => setBulkEdit(p => ({ ...p, end: e.target.value }))} className="h-9" /></div>
            </div>
            <div><Label className="text-xs">区域 Area</Label>
              <Select value={bulkEdit.area || ''} onValueChange={v => setBulkEdit(p => ({ ...p, area: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="不修改 Keep" /></SelectTrigger>
                <SelectContent>{workAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">施工代码 Work Code</Label>
              <Select value={bulkEdit.workCodeId || ''} onValueChange={v => setBulkEdit(p => ({ ...p, workCodeId: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="不修改 Keep" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(codesByCategory).map(([cat, codes]) => (
                    <div key={cat}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{cat}</div>
                      {codes.map(wc => <SelectItem key={wc.id} value={wc.id}><span className="font-mono text-xs">{wc.code}</span> {wc.name}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditWorkerOpen(false)}>取消 Cancel</Button>
            <Button onClick={applyBulkEditWorkers}>应用 Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk edit equipment dialog */}
      <Dialog open={bulkEditEqOpen} onOpenChange={(o) => { setBulkEditEqOpen(o); if (!o) setBulkEdit({}); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>批量修改设备记录 Bulk Edit Equipment ({selectedEqIdx.size})</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">仅填写需要修改的字段，留空则不变 Only filled fields will be updated</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">开始 Start</Label><Input type="datetime-local" value={bulkEdit.start || ''} onChange={e => setBulkEdit(p => ({ ...p, start: e.target.value }))} className="h-9" /></div>
              <div><Label className="text-xs">结束 End</Label><Input type="datetime-local" value={bulkEdit.end || ''} onChange={e => setBulkEdit(p => ({ ...p, end: e.target.value }))} className="h-9" /></div>
            </div>
            <div><Label className="text-xs">区域 Area</Label>
              <Select value={bulkEdit.area || ''} onValueChange={v => setBulkEdit(p => ({ ...p, area: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="不修改 Keep" /></SelectTrigger>
                <SelectContent>{workAreas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">施工代码 Work Code</Label>
              <Select value={bulkEdit.workCodeId || ''} onValueChange={v => setBulkEdit(p => ({ ...p, workCodeId: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="不修改 Keep" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(codesByCategory).map(([cat, codes]) => (
                    <div key={cat}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{cat}</div>
                      {codes.map(wc => <SelectItem key={wc.id} value={wc.id}><span className="font-mono text-xs">{wc.code}</span> {wc.name}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditEqOpen(false)}>取消 Cancel</Button>
            <Button onClick={applyBulkEditEq}>应用 Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
