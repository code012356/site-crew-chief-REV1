import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useAppContext } from '@/contexts/AppContext';
import { useDataContext } from '@/contexts/DataContext';
import { DailyLog, DailyLogEntry, EquipmentUsageEntry, LogRevision } from '@/lib/types';
import { Plus, Trash2, Send, FileText, Edit2, History, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Download, RotateCcw, Archive, AlertTriangle, Undo2, CalendarIcon, Filter } from 'lucide-react';
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

type WizardStep = 1 | 2 | 3 | 4;
type CopyTarget = 'workers' | 'equipment' | null;

interface WorkItemDraft {
  id: string;
  area: string;
  areaDetail: string;
  workCodeCategory: string;
  workCodeId: string;
  workCodeName: string;
  detail: string;
  quantity: string;
  startTime: string;
  endTime: string;
}

interface MatrixTimeDraft {
  hours?: string;
  startTime: string;
  endTime: string;
}

const HALF_HOUR_TIMES = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, '0');
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour}:${minute}`;
});

function splitDateTime(value: string) {
  const [date = format(new Date(), 'yyyy-MM-dd'), time = '07:00'] = (value || '').split('T');
  const [hour = '07', minute = '00'] = time.split(':');
  const normalizedMinute = Number(minute) < 30 ? '00' : '30';
  return { date, time: `${hour.padStart(2, '0')}:${normalizedMinute}` };
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function HalfHourDateTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const current = splitDateTime(value);
  const setDate = (date: string) => onChange(`${date}T${current.time}`);
  const setTime = (time: string) => onChange(`${current.date}T${time}`);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(8.25rem,1.35fr)_0.9fr]">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full min-w-0 justify-start px-2 text-left font-normal text-xs"
          >
            <CalendarIcon size={14} className="mr-1.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{current.date}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={6} collisionPadding={16}>
          <Calendar
            mode="single"
            selected={parseLocalDate(current.date)}
            onSelect={date => date && setDate(format(date, 'yyyy-MM-dd'))}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      <Select value={current.time} onValueChange={setTime}>
        <SelectTrigger className="h-9 w-full min-w-0 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-64">
          {HALF_HOUR_TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function DailyLogPage() {
  const { currentRole, currentPersonnelId, currentUserName } = useAppContext();
  const { personnel, workCodes, workAreas, engineerAssignments, getTeamWorkers, getTeamEquipment, getEngineerForemen, dailyLogs, addDailyLog, updateDailyLog, softDeleteDailyLog, restoreDailyLog, deleteDailyLog, emptyTrash } = useDataContext();

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
  const teamEquip = isForeman ? getTeamEquipment(foremanId).filter(e => e.status !== 'retired') : [];

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
  const [bulkEdit, setBulkEdit] = useState<{ start?: string; end?: string; area?: string; areaDetail?: string; workCodeId?: string }>({});
  const [bulkPickWorkerSearch, setBulkPickWorkerSearch] = useState('');
  const [bulkPickEquipSearch, setBulkPickEquipSearch] = useState('');
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [workItems, setWorkItems] = useState<WorkItemDraft[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set());
  const [matrixTimes, setMatrixTimes] = useState<Record<string, MatrixTimeDraft>>({});
  const [activeMatrixWorkItem, setActiveMatrixWorkItem] = useState(0);
  const [copyDialogTarget, setCopyDialogTarget] = useState<CopyTarget>(null);
  const [copySourceDate, setCopySourceDate] = useState(format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));

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
      return { workerId: wid, workerName: w?.name || '', startTime: defaultStart(), endTime: defaultEnd(), hours: 8, area: '', areaDetail: '', workCodeId: '', workCodeName: '', detail: '' };
    });
    setEntries(prev => [...prev, ...newOnes]);
    setBulkPickWorkers(new Set());
    setBulkAddWorkerOpen(false);
  };
  const confirmBulkAddEq = () => {
    const newOnes = Array.from(bulkPickEquip).map(eid => {
      const eq = teamEquip.find(x => x.id === eid);
      return { equipmentId: eid, equipmentName: eq?.name || '', startTime: defaultStart(), endTime: defaultEnd(), hours: 8, area: '', areaDetail: '', workCodeId: '', workCodeName: '', detail: '' };
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
      if (bulkEdit.areaDetail !== undefined) next.areaDetail = bulkEdit.areaDetail;
      if (bulkEdit.workCodeId) {
        const wc = workCodes.find(c => c.id === bulkEdit.workCodeId);
        next.workCodeId = bulkEdit.workCodeId;
        next.workCodeName = wc ? `[${wc.code}] ${wc.name}` : '';
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
      if (bulkEdit.areaDetail !== undefined) next.areaDetail = bulkEdit.areaDetail;
      if (bulkEdit.workCodeId) {
        const wc = workCodes.find(c => c.id === bulkEdit.workCodeId);
        next.workCodeId = bulkEdit.workCodeId;
        next.workCodeName = wc ? `[${wc.code}] ${wc.name}` : '';
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

  const roundDateTimeToHalfHour = (value: string) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    const roundedMinutes = Math.round(dt.getMinutes() / 30) * 30;
    dt.setMinutes(roundedMinutes, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };

  const formatDT = (dt: string) => {
    if (!dt) return '-';
    return dt.replace('T', ' ');
  };

  const defaultStart = () => {
    const d = format(new Date(), 'yyyy-MM-dd');
    return `${d}T07:00`;
  };
  const defaultEnd = () => {
    const d = format(new Date(), 'yyyy-MM-dd');
    return `${d}T15:00`;
  };
  const endFromHours = (start: string, hours: number) => {
    const date = new Date(start);
    if (Number.isNaN(date.getTime())) return defaultEnd();
    date.setMinutes(date.getMinutes() + Math.round(hours * 60));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  const todayLocal = () => format(new Date(), 'yyyy-MM-dd');

  const createWorkItem = (overrides: Partial<WorkItemDraft> = {}): WorkItemDraft => ({
    id: `wi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    area: '',
    areaDetail: '',
    workCodeCategory: '',
    workCodeId: '',
    workCodeName: '',
    detail: '',
    quantity: '',
    startTime: defaultStart(),
    endTime: defaultEnd(),
    ...overrides,
  });

  const resetWizard = () => {
    setWizardStep(1);
    setWorkItems([createWorkItem()]);
    setSelectedWorkerIds(new Set());
    setSelectedEquipmentIds(new Set());
    setMatrixTimes({});
    setActiveMatrixWorkItem(0);
    setCopyDialogTarget(null);
    setBulkPickWorkerSearch('');
    setBulkPickEquipSearch('');
  };

  const matrixKey = (kind: 'worker' | 'equipment', resourceId: string, workItemId: string) => `${kind}:${resourceId}:${workItemId}`;

  const getCellHours = (time?: MatrixTimeDraft) => {
    if (!time) return 0;
    if (time.hours !== undefined) return parseHours(time.hours);
    return calcHours(time.startTime || '', time.endTime || '');
  };

  const parseHours = (value: string) => {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const matrixHours: Record<string, string> = {};
  const setMatrixHours = (_updater: unknown) => {};

  const setMatrixCellHours = (kind: 'worker' | 'equipment', resourceId: string, workItemId: string, hours: string) => {
    const key = matrixKey(kind, resourceId, workItemId);
    setMatrixTimes(prev => {
      const next = { ...prev };
      if (!hours.trim()) {
        delete next[key];
        return next;
      }
      next[key] = { hours, startTime: defaultStart(), endTime: endFromHours(defaultStart(), parseHours(hours) || 0) };
      return next;
    });
  };

  const setMatrixCellTime = (kind: 'worker' | 'equipment', resourceId: string, workItemId: string, updates?: Partial<MatrixTimeDraft>) => {
    const key = matrixKey(kind, resourceId, workItemId);
    setMatrixTimes(prev => {
      if (!updates) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      const current = prev[key] || { startTime: defaultStart(), endTime: defaultEnd() };
      return { ...prev, [key]: { ...current, ...updates } };
    });
  };

  const detailWithQuantity = (item: WorkItemDraft) => {
    const parts = [item.detail.trim()];
    if (item.quantity.trim()) parts.push(`Work quantity: ${item.quantity.trim()}`);
    return parts.filter(Boolean).join(' | ');
  };

  const updateWorkItem = (id: string, field: keyof WorkItemDraft, value: string) => {
    setWorkItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (field === 'workCodeCategory') {
        return { ...item, workCodeCategory: value, workCodeId: '', workCodeName: '' };
      }
      if (field === 'workCodeId') {
        const wc = workCodes.find(c => c.id === value);
        return { ...item, workCodeId: value, workCodeCategory: wc?.category || item.workCodeCategory, workCodeName: wc ? `[${wc.code}] ${wc.name}` : '' };
      }
      return { ...item, [field]: value };
    }));
  };

  const removeWorkItem = (id: string) => {
    if (workItems.length === 1) {
      toast.error('Please keep at least one work item');
      return;
    }
    setWorkItems(prev => prev.filter(item => item.id !== id));
    setMatrixTimes(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        if (key.endsWith(`:${id}`)) delete next[key];
      });
      return next;
    });
    setActiveMatrixWorkItem(prev => Math.max(0, Math.min(prev, workItems.length - 2)));
  };

  const toggleWorkerSelection = (workerId: string) => {
    setSelectedWorkerIds(prev => {
      const next = new Set(prev);
      next.has(workerId) ? next.delete(workerId) : next.add(workerId);
      return next;
    });
  };

  const toggleEquipmentSelection = (equipmentId: string) => {
    setSelectedEquipmentIds(prev => {
      const next = new Set(prev);
      next.has(equipmentId) ? next.delete(equipmentId) : next.add(equipmentId);
      return next;
    });
  };

  const copyPreviousResources = () => {
    const sourceLogs = dailyLogs.filter(log => log.foremanId === foremanId && log.date === copySourceDate && !log.deletedAt);
    if (sourceLogs.length === 0) {
      toast.error('No logs found for selected source date');
      return;
    }
    if (copyDialogTarget === 'workers') {
      const ids = sourceLogs.flatMap(log => log.entries.map(entry => entry.workerId)).filter(Boolean);
      setSelectedWorkerIds(new Set(ids));
      toast.success(`Copied ${new Set(ids).size} worker(s)`);
    }
    if (copyDialogTarget === 'equipment') {
      const ids = sourceLogs.flatMap(log => log.equipmentUsage.map(entry => entry.equipmentId)).filter(Boolean);
      setSelectedEquipmentIds(new Set(ids));
      toast.success(`Copied ${new Set(ids).size} equipment item(s)`);
    }
    setCopyDialogTarget(null);
  };

  const buildEntriesFromMatrix = () => {
    const workerRows: DailyLogEntry[] = [];
    const equipmentRows: EquipmentUsageEntry[] = [];

    selectedWorkerIds.forEach(workerId => {
      const worker = teamWorkers.find(w => w.id === workerId);
      workItems.forEach(item => {
        const time = matrixTimes[matrixKey('worker', workerId, item.id)];
        const hours = getCellHours(time);
        if (hours <= 0) return;
        const startTime = time?.startTime || defaultStart();
        workerRows.push({
          id: `e_${Date.now()}_${workerRows.length}`,
          workerId,
          workerName: worker?.name || '',
          startTime,
          endTime: time?.endTime || endFromHours(startTime, hours),
          hours,
          area: item.area,
          areaDetail: item.areaDetail,
          workCodeId: item.workCodeId,
          workCodeName: item.workCodeName,
          detail: detailWithQuantity(item),
        });
      });
    });

    selectedEquipmentIds.forEach(equipmentId => {
      const eq = teamEquip.find(e => e.id === equipmentId);
      workItems.forEach(item => {
        const time = matrixTimes[matrixKey('equipment', equipmentId, item.id)];
        const hours = getCellHours(time);
        if (hours <= 0) return;
        const startTime = time?.startTime || defaultStart();
        equipmentRows.push({
          id: `eu_${Date.now()}_${equipmentRows.length}`,
          equipmentId,
          equipmentName: eq?.name || '',
          startTime,
          endTime: time?.endTime || endFromHours(startTime, hours),
          hours,
          area: item.area,
          areaDetail: item.areaDetail,
          workCodeId: item.workCodeId,
          workCodeName: item.workCodeName,
          detail: detailWithQuantity(item),
        });
      });
    });

    return { workerRows, equipmentRows };
  };

  const validateMatrixTimes = () => {
    const issues: string[] = [];
    const collect = (kind: 'worker' | 'equipment', resources: { id: string; name: string; equipmentNo?: string; laborId?: string }[]) => {
      resources.forEach(resource => {
        const spans = workItems
          .map(item => {
            const time = matrixTimes[matrixKey(kind, resource.id, item.id)];
            if (!time) return null;
            const hours = getCellHours(time);
            return { item, time, hours };
          })
          .filter(Boolean) as { item: WorkItemDraft; time: MatrixTimeDraft; hours: number }[];

        const label = kind === 'worker'
          ? `${resource.laborId || resource.name}`
          : `${resource.equipmentNo || resource.name}`;

        spans.forEach(span => {
          if (span.time.hours?.trim() && span.hours <= 0) {
            issues.push(`${label}: hours must be greater than 0`);
          }
          if (span.hours > 24) {
            issues.push(`${label}: one task cannot exceed 24h`);
          }
        });

        const total = spans.reduce((sum, span) => sum + span.hours, 0);
        if (total > 24) issues.push(`${label}: total daily hours cannot exceed 24h`);
      });
    };

    collect('worker', selectedWorkers);
    collect('equipment', selectedEquipment);

    if (issues.length > 0) {
      toast.error(issues[0]);
      return false;
    }
    return true;
  };

  const validateWizardStep = (step: WizardStep) => {
    if (step === 1) {
      if (workItems.some(item => !item.area || !item.areaDetail.trim() || !item.workCodeId || !item.detail.trim() || !item.quantity.trim())) {
        toast.error('Please complete area, work code, work description, and work quantity');
        return false;
      }
    }
    if (step === 2 && selectedWorkerIds.size === 0) {
      toast.error('Please select at least one worker');
      return false;
    }
    if (step === 3) {
      if (!validateMatrixTimes()) return false;
      const { workerRows } = buildEntriesFromMatrix();
      if (workerRows.length === 0) {
        toast.error('Please enter worker hours in the matrix');
        return false;
      }
    }
    return true;
  };

  const goNextWizardStep = () => {
    if (!validateWizardStep(wizardStep)) return;
    setWizardStep(prev => Math.min(4, prev + 1) as WizardStep);
  };

  const initializeWizardFromLog = (log: DailyLog) => {
    const itemMap = new Map<string, WorkItemDraft>();
    const times: Record<string, MatrixTimeDraft> = {};
    const workerIds = new Set<string>();
    const equipmentIds = new Set<string>();

    const ensureItem = (entry: Pick<DailyLogEntry, 'area' | 'areaDetail' | 'workCodeId' | 'workCodeName' | 'detail' | 'startTime' | 'endTime'>) => {
      const key = [entry.area, entry.areaDetail || '', entry.workCodeId, entry.detail, entry.startTime, entry.endTime].join('|');
      if (!itemMap.has(key)) {
        itemMap.set(key, createWorkItem({
          area: entry.area,
          areaDetail: entry.areaDetail || '',
          workCodeCategory: workCodes.find(wc => wc.id === entry.workCodeId)?.category || '',
          workCodeId: entry.workCodeId,
          workCodeName: entry.workCodeName,
          detail: entry.detail?.replace(/\s*\|\s*Work quantity:.*/, '') || '',
          quantity: entry.detail?.match(/Work quantity:\s*(.*)$/)?.[1] || 'N/A',
        }));
      }
      return itemMap.get(key)!;
    };

    log.entries.forEach(entry => {
      workerIds.add(entry.workerId);
      const item = ensureItem(entry);
      times[matrixKey('worker', entry.workerId, item.id)] = { hours: String(entry.hours || calcHours(entry.startTime, entry.endTime)), startTime: entry.startTime, endTime: entry.endTime };
    });
    log.equipmentUsage.forEach(entry => {
      equipmentIds.add(entry.equipmentId);
      const item = ensureItem(entry);
      times[matrixKey('equipment', entry.equipmentId, item.id)] = { hours: String(entry.hours || calcHours(entry.startTime, entry.endTime)), startTime: entry.startTime, endTime: entry.endTime };
    });

    setWorkItems(Array.from(itemMap.values()).length ? Array.from(itemMap.values()) : [createWorkItem()]);
    setSelectedWorkerIds(workerIds);
    setSelectedEquipmentIds(equipmentIds);
    setMatrixTimes(times);
    setWizardStep(4);
  };

  const addWorkerEntry = () => setEntries(prev => [...prev, { workerId: '', workerName: '', startTime: defaultStart(), endTime: defaultEnd(), hours: 8, area: '', areaDetail: '', workCodeId: '', workCodeName: '', detail: '' }]);
  const addEqEntry = () => setEqEntries(prev => [...prev, { equipmentId: '', equipmentName: '', startTime: defaultStart(), endTime: defaultEnd(), hours: 8, area: '', areaDetail: '', workCodeId: '', workCodeName: '', detail: '' }]);

  const updateEntry = (i: number, field: string, value: string | number) => {
    setEntries(prev => prev.map((e, idx) => {
      if (idx !== i) return e;
      if (field === 'workerId') {
        const w = teamWorkers.find(w => w.id === value);
        return { ...e, workerId: value as string, workerName: w?.name || '' };
      }
      if (field === 'workCodeId') {
        const wc = workCodes.find(c => c.id === value);
        return { ...e, workCodeId: value as string, workCodeName: wc ? `[${wc.code}] ${wc.name}` : '' };
      }
      if (field === 'startTime') {
        const newStart = roundDateTimeToHalfHour(value as string);
        return { ...e, startTime: newStart, hours: calcHours(newStart, e.endTime) };
      }
      if (field === 'endTime') {
        const newEnd = roundDateTimeToHalfHour(value as string);
        return { ...e, endTime: newEnd, hours: calcHours(e.startTime, newEnd) };
      }
      return { ...e, [field]: value };
    }));
  };

  const updateEqEntry = (i: number, field: string, value: string | number) => {
    setEqEntries(prev => prev.map((e, idx) => {
      if (idx !== i) return e;
      if (field === 'equipmentId') {
        const eq = teamEquip.find(eq => eq.id === value);
        return { ...e, equipmentId: value as string, equipmentName: eq?.name || '' };
      }
      if (field === 'workCodeId') {
        const wc = workCodes.find(c => c.id === value);
        return { ...e, workCodeId: value as string, workCodeName: wc ? `[${wc.code}] ${wc.name}` : '' };
      }
      if (field === 'startTime') {
        const newStart = roundDateTimeToHalfHour(value as string);
        return { ...e, startTime: newStart, hours: calcHours(newStart, e.endTime) };
      }
      if (field === 'endTime') {
        const newEnd = roundDateTimeToHalfHour(value as string);
        return { ...e, endTime: newEnd, hours: calcHours(e.startTime, newEnd) };
      }
      return { ...e, [field]: value };
    }));
  };

  const startEditLog = (log: DailyLog) => {
    setEditingLogId(log.id);
    setEntries(log.entries.map(({ id, ...rest }) => rest));
    setEqEntries(log.equipmentUsage.map(({ id, ...rest }) => rest));
    initializeWizardFromLog(log);
    setSelectedEntryIdx(new Set());
    setSelectedEqIdx(new Set());
    setShowForm(true);
  };

  const startNewLog = () => {
    if (!requireEngineer()) return;
    setEditingLogId(null);
    setEntries([]);
    setEqEntries([]);
    setSelectedEntryIdx(new Set());
    setSelectedEqIdx(new Set());
    resetWizard();
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingLogId(null);
    setEntries([]);
    setEqEntries([]);
    setSelectedEntryIdx(new Set());
    setSelectedEqIdx(new Set());
    resetWizard();
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
      previousStatus: log.status,
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
    if (!validateWizardStep(1) || !validateWizardStep(2) || !validateWizardStep(3)) return;

    const { workerRows, equipmentRows } = buildEntriesFromMatrix();
    const newEntries: DailyLogEntry[] = workerRows;
    const newEqEntries: EquipmentUsageEntry[] = equipmentRows;

    if (editingLogId) {
      const log = dailyLogs.find(l => l.id === editingLogId);
      if (log) {
        const revision: LogRevision = {
          timestamp: new Date().toISOString(),
          entries: log.entries,
          equipmentUsage: log.equipmentUsage,
          previousStatus: log.status,
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
        date: todayLocal(),
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
  const areaNames = workAreas.map(a => a.name).sort();
  const formatArea = (entry: { area: string; areaDetail?: string }) => [entry.area, entry.areaDetail].filter(Boolean).join(' / ');
  const selectedWorkers = teamWorkers.filter(worker => selectedWorkerIds.has(worker.id));
  const selectedEquipment = teamEquip.filter(eq => selectedEquipmentIds.has(eq.id));
  const wizardTotals = buildEntriesFromMatrix();
  const workerTotalHours = wizardTotals.workerRows.reduce((sum, entry) => sum + entry.hours, 0);
  const equipmentTotalHours = wizardTotals.equipmentRows.reduce((sum, entry) => sum + entry.hours, 0);

  const renderStepIndicator = () => (
    <div className="grid grid-cols-4 gap-2">
      {[
        [1, '施工内容 Work'],
        [2, '资源 Resources'],
        [3, '工时 Hours'],
        [4, '检查 Review'],
      ].map(([step, label]) => (
        <div
          key={step}
          className={cn(
            'rounded-md border px-2 py-2 text-center text-xs font-medium',
            wizardStep === step ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground'
          )}
        >
          <span className="block">Step {step}</span>
          <span className="hidden sm:block">{label}</span>
        </div>
      ))}
    </div>
  );

  const renderWorkItemForm = (item: WorkItemDraft, index: number) => (
    <div key={item.id} className="rounded-lg border bg-muted/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">施工内容 {index + 1} Work Item {index + 1}</h3>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-destructive hover:text-destructive" onClick={() => removeWorkItem(item.id)}>
          <Trash2 size={13} /> 删除 Delete
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">大区域 Area</Label>
          <Select value={item.area} onValueChange={value => updateWorkItem(item.id, 'area', value)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="选择大区域 Select area" /></SelectTrigger>
            <SelectContent>{areaNames.map(area => <SelectItem key={area} value={area}>{area}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">具体区域 Detail Area</Label>
          <Input value={item.areaDetail} onChange={event => updateWorkItem(item.id, 'areaDetail', event.target.value)} placeholder="工长填写具体位置 Fill specific location" className="h-9" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">今日施工代码 Work Code</Label>
          <Select value={item.workCodeId} onValueChange={value => updateWorkItem(item.id, 'workCodeId', value)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="选择施工代码 Select work code" /></SelectTrigger>
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
        <div>
          <Label className="text-xs text-muted-foreground">工作量 Work Quantity</Label>
          <Input value={item.quantity} onChange={event => updateWorkItem(item.id, 'quantity', event.target.value)} placeholder="手动填写，如 35m / 12m3 / N/A" className="h-9" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">开始 Start</Label>
          <HalfHourDateTimePicker value={item.startTime} onChange={value => updateWorkItem(item.id, 'startTime', value)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">结束 End</Label>
          <HalfHourDateTimePicker value={item.endTime} onChange={value => updateWorkItem(item.id, 'endTime', value)} />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs text-muted-foreground">具体工作内容 Work Description</Label>
          <Input value={item.detail} onChange={event => updateWorkItem(item.id, 'detail', event.target.value)} placeholder="手动填写具体施工内容 Describe work content" className="h-9" />
        </div>
      </div>
    </div>
  );

  const renderWorkItemFormV2 = (item: WorkItemDraft, index: number) => (
    <div key={item.id} className="rounded-lg border bg-muted/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">施工内容 {index + 1} Work Item {index + 1}</h3>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-destructive hover:text-destructive" onClick={() => removeWorkItem(item.id)}>
          <Trash2 size={13} /> 删除 Delete
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs text-muted-foreground">大区域 Area</Label>
          <Select value={item.area} onValueChange={value => updateWorkItem(item.id, 'area', value)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="选择大区域 Select area" /></SelectTrigger>
            <SelectContent>{areaNames.map(area => <SelectItem key={area} value={area}>{area}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">具体区域 Detail Area</Label>
          <Input value={item.areaDetail} onChange={event => updateWorkItem(item.id, 'areaDetail', event.target.value)} placeholder="工长填写具体位置 Fill specific location" className="h-9" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">施工代码分类 Work Code Category</Label>
          <Select value={item.workCodeCategory} onValueChange={value => updateWorkItem(item.id, 'workCodeCategory', value)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="先选择大分类 Select category" /></SelectTrigger>
            <SelectContent className="max-h-[60vh] w-[calc(100vw-2rem)] sm:w-[32rem]">
              {Object.keys(codesByCategory).map(cat => (
                <SelectItem key={cat} value={cat} className="items-start whitespace-normal leading-snug">
                  <span className="block break-words">{cat}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">具体施工代码 Work Code</Label>
          <Select value={item.workCodeId} onValueChange={value => updateWorkItem(item.id, 'workCodeId', value)} disabled={!item.workCodeCategory}>
            <SelectTrigger className="h-9"><SelectValue placeholder="再选择具体项 Select item" /></SelectTrigger>
            <SelectContent className="max-h-[60vh] w-[calc(100vw-2rem)] sm:w-[42rem]">
              {(codesByCategory[item.workCodeCategory] || []).map(wc => (
                <SelectItem key={wc.id} value={wc.id} className="items-start whitespace-normal leading-snug">
                  <span className="block break-words"><span className="font-mono text-xs">{wc.code}</span> {wc.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">工作量 Work Quantity</Label>
          <Input value={item.quantity} onChange={event => updateWorkItem(item.id, 'quantity', event.target.value)} placeholder="手动填写，如 35m / 12m3 / N/A" className="h-9" />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs text-muted-foreground">具体工作内容 Work Description</Label>
          <Input value={item.detail} onChange={event => updateWorkItem(item.id, 'detail', event.target.value)} placeholder="手动填写具体施工内容 Describe work content" className="h-9" />
        </div>
      </div>
    </div>
  );

  const renderResourcePicker = () => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label className="text-sm font-semibold">工人 Workers</Label>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setCopyDialogTarget('workers')}>
            <RotateCcw size={14} /> 复制前一日工人
          </Button>
        </div>
        <Input placeholder="搜索 劳工号/姓名/工种 Search worker" value={bulkPickWorkerSearch} onChange={event => setBulkPickWorkerSearch(event.target.value)} className="h-9" />
        <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1">
          {teamWorkers.filter(worker => {
            const q = bulkPickWorkerSearch.trim().toLowerCase();
            return !q || `${worker.name} ${worker.laborId || ''} ${worker.specialty || ''}`.toLowerCase().includes(q);
          }).map(worker => (
            <label key={worker.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/40">
              <Checkbox checked={selectedWorkerIds.has(worker.id)} onCheckedChange={() => toggleWorkerSelection(worker.id)} />
              <span className="min-w-0 text-sm">
                <span className="font-mono font-semibold">{worker.laborId || '-'}</span>
                <span className="ml-2">{worker.name}</span>
                {worker.specialty && <span className="ml-2 text-xs text-muted-foreground">{worker.specialty}</span>}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">已选择工人：{selectedWorkerIds.size} 人</p>
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label className="text-sm font-semibold">设备 Equipment</Label>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setCopyDialogTarget('equipment')}>
            <RotateCcw size={14} /> 复制前一日设备
          </Button>
        </div>
        <Input placeholder="搜索 设备号/名称/型号 Search equipment" value={bulkPickEquipSearch} onChange={event => setBulkPickEquipSearch(event.target.value)} className="h-9" />
        <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1">
          {teamEquip.filter(eq => {
            const q = bulkPickEquipSearch.trim().toLowerCase();
            return !q || `${eq.name} ${eq.equipmentNo || ''} ${eq.model || ''}`.toLowerCase().includes(q);
          }).map(eq => (
            <label key={eq.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/40">
              <Checkbox checked={selectedEquipmentIds.has(eq.id)} onCheckedChange={() => toggleEquipmentSelection(eq.id)} />
              <span className="min-w-0 text-sm">
                {eq.equipmentNo && <span className="font-mono text-xs text-muted-foreground">{eq.equipmentNo}</span>}
                <span className="ml-2">{eq.name}</span>
                {eq.model && <span className="ml-2 text-xs text-muted-foreground">{eq.model}</span>}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">已选择设备：{selectedEquipmentIds.size} 台</p>
      </div>
    </div>
  );

  const renderHoursMatrix = () => (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-[760px] w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="sticky left-0 z-10 bg-muted px-3 py-3 text-left font-medium">人员/设备 Resource</th>
              {workItems.map((item, index) => (
                <th key={item.id} className="min-w-[160px] px-3 py-3 text-left align-top font-medium">
                  <div>施工内容 {index + 1}</div>
                  <div className="text-xs text-muted-foreground">{formatArea(item)}</div>
                  <div className="text-xs text-muted-foreground">{item.workCodeName}</div>
                  <div className="text-xs text-muted-foreground">工作量：{item.quantity}</div>
                </th>
              ))}
              <th className="px-3 py-3 text-left font-medium">合计 Total</th>
            </tr>
          </thead>
          <tbody>
            {selectedWorkers.map(worker => {
              const total = workItems.reduce((sum, item) => sum + parseHours(matrixHours[matrixKey('worker', worker.id, item.id)] || ''), 0);
              return (
                <tr key={`worker_${worker.id}`} className="border-t">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2">
                    <div className="font-medium">{worker.laborId || worker.name}</div>
                    <div className="text-xs text-muted-foreground">{worker.name}</div>
                  </td>
                  {workItems.map(item => (
                    <td key={item.id} className="px-3 py-2">
                      <Input
                        inputMode="decimal"
                        value={matrixHours[matrixKey('worker', worker.id, item.id)] || ''}
                        onChange={event => setMatrixHours(prev => ({ ...prev, [matrixKey('worker', worker.id, item.id)]: event.target.value }))}
                        placeholder="h"
                        className="h-8 w-20"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 font-medium">{Math.round(total * 10) / 10}h</td>
                </tr>
              );
            })}
            {selectedEquipment.map(eq => {
              const total = workItems.reduce((sum, item) => sum + parseHours(matrixHours[matrixKey('equipment', eq.id, item.id)] || ''), 0);
              return (
                <tr key={`equipment_${eq.id}`} className="border-t bg-muted/10">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2">
                    <div className="font-medium">{eq.equipmentNo || eq.name}</div>
                    <div className="text-xs text-muted-foreground">{eq.name}</div>
                  </td>
                  {workItems.map(item => (
                    <td key={item.id} className="px-3 py-2">
                      <Input
                        inputMode="decimal"
                        value={matrixHours[matrixKey('equipment', eq.id, item.id)] || ''}
                        onChange={event => setMatrixHours(prev => ({ ...prev, [matrixKey('equipment', eq.id, item.id)]: event.target.value }))}
                        placeholder="h"
                        className="h-8 w-20"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 font-medium">{Math.round(total * 10) / 10}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">空白表示未参与该施工内容。Blank cells are ignored during submission.</p>
    </div>
  );

  const renderMatrixTimeCell = (kind: 'worker' | 'equipment', resourceId: string, item: WorkItemDraft) => {
    const time = matrixTimes[matrixKey(kind, resourceId, item.id)];
    const hours = getCellHours(time);
    return (
      <Input
        inputMode="decimal"
        value={time?.hours || ''}
        onChange={event => setMatrixCellHours(kind, resourceId, item.id, event.target.value)}
        placeholder="h"
        className={cn('h-9 w-20 text-center', time?.hours?.trim() && hours <= 0 && 'border-destructive text-destructive')}
      />
    );
    if (!time) {
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full"
          onClick={() => setMatrixCellTime(kind, resourceId, item.id, { startTime: defaultStart(), endTime: defaultEnd() })}
        >
          设置时间 Set time
        </Button>
      );
    }
    return (
      <div className="space-y-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">开始 Start</Label>
          <HalfHourDateTimePicker value={time.startTime} onChange={value => setMatrixCellTime(kind, resourceId, item.id, { startTime: roundDateTimeToHalfHour(value) })} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">结束 End</Label>
          <HalfHourDateTimePicker value={time.endTime} onChange={value => setMatrixCellTime(kind, resourceId, item.id, { endTime: roundDateTimeToHalfHour(value) })} />
        </div>
        <div className={cn('flex items-center justify-between rounded-md px-2 py-1 text-xs', hours > 0 ? 'bg-muted/50' : 'bg-destructive/10 text-destructive')}>
          <span>{hours > 0 ? `${hours}h` : '时间冲突'}</span>
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setMatrixCellTime(kind, resourceId, item.id)}>
            清空
          </Button>
        </div>
      </div>
    );
  };

  const renderHoursMatrixV2 = () => (
    <div className="space-y-4">
      {(() => {
        const activeIndex = Math.max(0, Math.min(activeMatrixWorkItem, workItems.length - 1));
        const item = workItems[activeIndex];
        if (!item) return null;
        const resourceRows = [
          ...selectedWorkers.map(worker => ({
            id: worker.id,
            kind: 'worker' as const,
            label: worker.laborId || worker.name,
            muted: '',
            total: workItems.reduce((sum, wi) => sum + getCellHours(matrixTimes[matrixKey('worker', worker.id, wi.id)]), 0),
          })),
          ...selectedEquipment.map(eq => ({
            id: eq.id,
            kind: 'equipment' as const,
            label: eq.name,
            muted: eq.equipmentNo || '',
            total: workItems.reduce((sum, wi) => sum + getCellHours(matrixTimes[matrixKey('equipment', eq.id, wi.id)]), 0),
          })),
        ];
        return (
          <div className="space-y-3 md:hidden">
            {workItems.length > 1 && (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveMatrixWorkItem(prev => Math.max(0, prev - 1))}
                >
                  <ChevronLeft size={16} /> Prev
                </Button>
                <div className="min-w-0 flex-1 text-center">
                  <div className="text-xs text-muted-foreground">Work Item {activeIndex + 1} / {workItems.length}</div>
                  <div className="truncate text-sm font-semibold">{formatArea(item)}</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2"
                  disabled={activeIndex >= workItems.length - 1}
                  onClick={() => setActiveMatrixWorkItem(prev => Math.min(workItems.length - 1, prev + 1))}
                >
                  Next <ChevronRight size={16} />
                </Button>
              </div>
            )}
            <div className="rounded-lg border">
              <div className="border-b bg-muted/30 p-3">
                <div className="text-sm font-semibold">施工内容 {activeIndex + 1}</div>
                <div className="mt-1 text-xs text-muted-foreground">{formatArea(item)}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.workCodeName}</div>
                <div className="mt-1 text-xs text-muted-foreground">Work quantity: {item.quantity}</div>
              </div>
              <div className="divide-y">
                {resourceRows.map(row => {
                  const total = Math.round(row.total * 10) / 10;
                  return (
                    <div key={`${row.kind}_${row.id}`} className={cn('grid grid-cols-[minmax(4.5rem,1fr)_5.5rem_3.25rem] items-center gap-2 p-2', row.kind === 'equipment' && 'bg-muted/10')}>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{row.label}</div>
                        {row.muted && <div className="truncate text-[11px] text-muted-foreground">{row.muted}</div>}
                      </div>
                      {renderMatrixTimeCell(row.kind, row.id, item)}
                      <div className="text-right text-xs font-medium text-muted-foreground">{total}h</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="min-w-[960px] w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="sticky left-0 z-10 bg-muted px-3 py-3 text-left font-medium">人员/设备 Resource</th>
              {workItems.map((item, index) => (
                <th key={item.id} className="min-w-[260px] px-3 py-3 text-left align-top font-medium">
                  <div>施工内容 {index + 1}</div>
                  <div className="text-xs text-muted-foreground">{formatArea(item)}</div>
                  <div className="text-xs text-muted-foreground">{item.workCodeName}</div>
                  <div className="text-xs text-muted-foreground">工作量：{item.quantity}</div>
                </th>
              ))}
              <th className="px-3 py-3 text-left font-medium">合计 Total</th>
            </tr>
          </thead>
          <tbody>
            {selectedWorkers.map(worker => {
              const total = workItems.reduce((sum, item) => sum + getCellHours(matrixTimes[matrixKey('worker', worker.id, item.id)]), 0);
              return (
                <tr key={`worker_${worker.id}`} className="border-t">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top">
                    <div className="font-medium">{worker.laborId || worker.name}</div>
                    <div className="text-xs text-muted-foreground">{worker.name}</div>
                  </td>
                  {workItems.map(item => <td key={item.id} className="px-3 py-2 align-top">{renderMatrixTimeCell('worker', worker.id, item)}</td>)}
                  <td className="px-3 py-2 align-top font-medium">{Math.round(total * 10) / 10}h</td>
                </tr>
              );
            })}
            {selectedEquipment.map(eq => {
              const total = workItems.reduce((sum, item) => sum + getCellHours(matrixTimes[matrixKey('equipment', eq.id, item.id)]), 0);
              return (
                <tr key={`equipment_${eq.id}`} className="border-t bg-muted/10">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top">
                    <div className="font-medium">{eq.equipmentNo || eq.name}</div>
                    <div className="text-xs text-muted-foreground">{eq.name}</div>
                  </td>
                  {workItems.map(item => <td key={item.id} className="px-3 py-2 align-top">{renderMatrixTimeCell('equipment', eq.id, item)}</td>)}
                  <td className="px-3 py-2 align-top font-medium">{Math.round(total * 10) / 10}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">点击“设置时间”才会生成该单元格记录；时间以半小时为最小粒度，系统会校验重叠和 24 小时上限。</p>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">施工内容</p><p className="text-xl font-semibold">{workItems.length}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">工人</p><p className="text-xl font-semibold">{selectedWorkerIds.size}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">工人工时</p><p className="text-xl font-semibold">{workerTotalHours}h</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">设备工时</p><p className="text-xl font-semibold">{equipmentTotalHours}h</p></div>
      </div>
      {workItems.map((item, index) => {
        const itemDetail = detailWithQuantity(item);
        const workerRows = wizardTotals.workerRows.filter(row => row.area === item.area && row.areaDetail === item.areaDetail && row.workCodeId === item.workCodeId && row.detail === itemDetail);
        const equipmentRows = wizardTotals.equipmentRows.filter(row => row.area === item.area && row.areaDetail === item.areaDetail && row.workCodeId === item.workCodeId && row.detail === itemDetail);
        return (
          <div key={item.id} className="rounded-lg border p-3 space-y-2">
            <div>
              <h3 className="font-semibold">施工内容 {index + 1}: {formatArea(item)}</h3>
              <p className="text-sm text-muted-foreground">{item.workCodeName} · {formatDT(item.startTime)} - {formatDT(item.endTime)}</p>
              <p className="text-sm">{item.detail}</p>
              <p className="text-sm text-muted-foreground">工作量：{item.quantity}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">工人 Workers</p>
                {workerRows.length === 0 ? <p className="text-sm text-muted-foreground">No worker hours</p> : workerRows.map(row => <p key={row.id} className="text-sm">{row.workerName} · {row.hours}h</p>)}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">设备 Equipment</p>
                {equipmentRows.length === 0 ? <p className="text-sm text-muted-foreground">No equipment hours</p> : equipmentRows.map(row => <p key={row.id} className="text-sm">{row.equipmentName} · {row.hours}h</p>)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

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
        <div className="mobile-action-grid">
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
              onClick={startNewLog}
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
        <div className="mobile-filter-grid items-end mb-4 p-4 bg-card rounded-lg border">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter size={14} /> 筛选 Filter
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">工长 Foreman</Label>
            <Select value={filterForemanId} onValueChange={setFilterForemanId}>
              <SelectTrigger className="h-9 w-full lg:w-[180px]"><SelectValue /></SelectTrigger>
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
              <SelectTrigger className="h-9 w-full lg:w-[180px]"><SelectValue /></SelectTrigger>
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
                <Button variant="outline" className={cn("h-9 w-full justify-start text-left font-normal text-sm lg:w-[150px]", !filterDateFrom && "text-muted-foreground")}>
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
                <Button variant="outline" className={cn("h-9 w-full justify-start text-left font-normal text-sm lg:w-[150px]", !filterDateTo && "text-muted-foreground")}>
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
        <div className="mobile-filter-grid items-end mb-4 p-3 bg-card rounded-lg border">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter size={14} /> 筛选 Filter
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">状态 Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-full lg:w-[200px]"><SelectValue /></SelectTrigger>
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

      {/* Wizard form - foreman only */}
      {isForeman && showForm && (
        <div className="bg-card rounded-lg border shadow-sm p-3 mb-6 space-y-5 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold text-lg leading-snug break-words">
                {editingLogId ? '修改施工日志 Revise Log' : '今日施工日志 Today\'s Log'} · {editingLogId ? logs.find(l => l.id === editingLogId)?.date : todayLocal()}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                按施工内容、资源、工时矩阵、检查提交四步填写。Fill work items, resources, hours matrix, then review.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={cancelForm}>取消 Cancel</Button>
          </div>

          {renderStepIndicator()}

          {wizardStep === 1 && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-sm font-semibold">施工内容 Work Items</Label>
                <Button variant="outline" size="sm" onClick={() => setWorkItems(prev => [...prev, createWorkItem()])} className="gap-1">
                  <Plus size={14} /> 添加施工内容 Add Work Item
                </Button>
              </div>
              <div className="space-y-3">
                {workItems.map(renderWorkItemFormV2)}
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">选择工人和设备 Resources</Label>
                <p className="text-xs text-muted-foreground mt-1">可以手动选择，也可以从前一日复制列表。Copy buttons only ask for source date.</p>
              </div>
              {renderResourcePicker()}
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">填写工时矩阵 Hours Matrix</Label>
                <p className="text-xs text-muted-foreground mt-1">只填写工时；区域、施工代码、工作内容来自第一步。</p>
              </div>
              {renderHoursMatrixV2()}
            </div>
          )}

          {wizardStep === 4 && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">检查并提交 Review & Submit</Label>
                <p className="text-xs text-muted-foreground mt-1">提交前请确认施工内容、工人设备工时无误。</p>
              </div>
              {renderReview()}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => wizardStep === 1 ? cancelForm() : setWizardStep(prev => Math.max(1, prev - 1) as WizardStep)}>
              {wizardStep === 1 ? '取消 Cancel' : '上一步 Back'}
            </Button>
            {wizardStep < 4 ? (
              <Button onClick={goNextWizardStep}>下一步 Next</Button>
            ) : (
              <Button onClick={handleSubmit} className="gap-2"><Send size={15} /> {editingLogId ? '重新提交 Resubmit' : '提交审核 Submit for Review'}</Button>
            )}
          </div>
        </div>
      )}

      {/* Form - foreman only */}
      {false && isForeman && showForm && (
        <div className="bg-card rounded-lg border shadow-sm p-3 mb-6 space-y-6 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold text-lg leading-snug break-words">
                {editingLogId ? '修改施工日志 Revise Log' : '今日施工日志 Today\'s Log'} · {editingLogId ? logs.find(l => l.id === editingLogId)?.date : todayLocal()}
              </h2>
              {editingLogId && (
                <p className="text-sm text-muted-foreground mt-1">修改后将重新提交审核 Will be resubmitted after revision</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={cancelForm}>取消 Cancel</Button>
          </div>

          {/* Worker entries */}
          <div>
            <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
              <Label className="text-sm font-semibold">工人工时记录 Worker Hours</Label>
              <div className="mobile-action-grid sm:justify-end">
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
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[24px_1fr_1fr_1fr_60px_1fr_40px] md:gap-2 md:items-end">
                    <div className="flex h-9 items-center justify-start sm:justify-center">
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
                      <HalfHourDateTimePicker value={entry.startTime} onChange={v => updateEntry(i, 'startTime', v)} />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">结束 End</Label>}
                      <HalfHourDateTimePicker value={entry.endTime} onChange={v => updateEntry(i, 'endTime', v)} />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">工时 h</Label>}
                      <div className="h-9 flex items-center justify-center text-sm font-medium text-muted-foreground bg-muted/50 rounded-md">{entry.hours}h</div>
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">施工区域 Area</Label>}
                      <Select value={entry.area} onValueChange={v => updateEntry(i, 'area', v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="选择区域 Select area" /></SelectTrigger>
                        <SelectContent>{areaNames.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-full justify-start text-destructive sm:w-9 sm:justify-center md:w-9" onClick={() => setEntries(prev => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">二级区域 Detail Area</Label>
                      <Input value={entry.areaDetail || ''} onChange={e => updateEntry(i, 'areaDetail', e.target.value)} placeholder="由工长填写 Fill by foreman" className="h-9" />
                    </div>
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
            <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
              <Label className="text-sm font-semibold">设备使用记录 Equipment Usage</Label>
              <div className="mobile-action-grid sm:justify-end">
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
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[24px_1fr_1fr_1fr_60px_1fr_40px] md:gap-2 md:items-end">
                    <div className="flex h-9 items-center justify-start sm:justify-center">
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
                      <HalfHourDateTimePicker value={entry.startTime} onChange={v => updateEqEntry(i, 'startTime', v)} />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">结束 End</Label>}
                      <HalfHourDateTimePicker value={entry.endTime} onChange={v => updateEqEntry(i, 'endTime', v)} />
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">工时 h</Label>}
                      <div className="h-9 flex items-center justify-center text-sm font-medium text-muted-foreground bg-muted/50 rounded-md">{entry.hours}h</div>
                    </div>
                    <div>
                      {i === 0 && <Label className="text-xs text-muted-foreground">施工区域 Area</Label>}
                      <Select value={entry.area} onValueChange={v => updateEqEntry(i, 'area', v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="选择区域 Select area" /></SelectTrigger>
                        <SelectContent>{areaNames.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-full justify-start text-destructive sm:w-9 sm:justify-center md:w-9" onClick={() => setEqEntries(prev => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">二级区域 Detail Area</Label>
                      <Input value={entry.areaDetail || ''} onChange={e => updateEqEntry(i, 'areaDetail', e.target.value)} placeholder="由工长填写 Fill by foreman" className="h-9" />
                    </div>
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
                              <span className="text-sm text-muted-foreground">{formatArea(e)}</span>
                            <span className="font-mono text-xs text-muted-foreground ml-auto">{e.workCodeName}</span>
                          </div>
                          {isExpanded && (
                            <div className="px-4 py-3 bg-muted/20 border-t space-y-2 text-sm">
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                                  <div><span className="text-muted-foreground">劳工号 Labor ID：</span><span className="font-mono font-medium">{getWorkerLaborId(e)}</span></div>
                                  <div><span className="text-muted-foreground">开始时间 Start：</span><span className="font-medium">{formatDT(e.startTime)}</span></div>
                                  <div><span className="text-muted-foreground">结束时间 End：</span><span className="font-medium">{formatDT(e.endTime)}</span></div>
                                  <div><span className="text-muted-foreground">工时 Hours：</span><span className="font-medium">{e.hours}h</span></div>
                                  <div><span className="text-muted-foreground">施工区域 Area：</span><span className="font-medium">{formatArea(e)}</span></div>
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
                              <span className="text-sm text-muted-foreground">{formatArea(eu)}</span>
                              <span className="font-mono text-xs text-muted-foreground ml-auto">{eu.workCodeName}</span>
                            </div>
                            {isExpanded && (
                              <div className="px-4 py-3 bg-muted/20 border-t space-y-1 text-sm">
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                                  <div><span className="text-muted-foreground">设备名称 Equipment：</span><span className="font-medium">{eu.equipmentName}</span></div>
                                  <div><span className="text-muted-foreground">开始时间 Start：</span><span className="font-medium">{formatDT(eu.startTime)}</span></div>
                                  <div><span className="text-muted-foreground">结束时间 End：</span><span className="font-medium">{formatDT(eu.endTime)}</span></div>
                                  <div><span className="text-muted-foreground">使用时长 Duration：</span><span className="font-medium">{eu.hours}h</span></div>
                                  <div><span className="text-muted-foreground">使用区域 Area：</span><span className="font-medium">{formatArea(eu)}</span></div>
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

      <Dialog open={!!copyDialogTarget} onOpenChange={open => !open && setCopyDialogTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {copyDialogTarget === 'workers' ? '复制前一日工人 Copy Workers' : '复制前一日设备 Copy Equipment'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">来源日期 Source Date</Label>
              <Input type="date" value={copySourceDate} onChange={event => setCopySourceDate(event.target.value)} className="h-9" />
            </div>
            <p className="text-sm text-muted-foreground">
              {copyDialogTarget === 'workers'
                ? '将复制该日期提交过的工人列表，复制后仍可手动增删。'
                : '将复制该日期使用过的设备列表，复制后仍可手动增删。'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogTarget(null)}>取消 Cancel</Button>
            <Button onClick={copyPreviousResources}>复制 Copy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div><Label className="text-xs">开始 Start</Label><HalfHourDateTimePicker value={bulkEdit.start || defaultStart()} onChange={v => setBulkEdit(p => ({ ...p, start: v }))} /></div>
              <div><Label className="text-xs">结束 End</Label><HalfHourDateTimePicker value={bulkEdit.end || defaultEnd()} onChange={v => setBulkEdit(p => ({ ...p, end: v }))} /></div>
            </div>
            <div><Label className="text-xs">区域 Area</Label>
              <Select value={bulkEdit.area || ''} onValueChange={v => setBulkEdit(p => ({ ...p, area: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="不修改 Keep" /></SelectTrigger>
                <SelectContent>{areaNames.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div><Label className="text-xs">开始 Start</Label><HalfHourDateTimePicker value={bulkEdit.start || defaultStart()} onChange={v => setBulkEdit(p => ({ ...p, start: v }))} /></div>
              <div><Label className="text-xs">结束 End</Label><HalfHourDateTimePicker value={bulkEdit.end || defaultEnd()} onChange={v => setBulkEdit(p => ({ ...p, end: v }))} /></div>
            </div>
            <div><Label className="text-xs">区域 Area</Label>
              <Select value={bulkEdit.area || ''} onValueChange={v => setBulkEdit(p => ({ ...p, area: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="不修改 Keep" /></SelectTrigger>
                <SelectContent>{areaNames.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
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
