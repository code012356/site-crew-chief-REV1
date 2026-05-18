import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataContext } from '@/contexts/DataContext';
import { useAppContext } from '@/contexts/AppContext';
import { Personnel } from '@/lib/types';
import { exportPersonnel, importPersonnel } from '@/lib/excel-utils';
import { Plus, Search, Edit2, Trash2, Download, Upload, ArrowRightLeft, AlertTriangle, UserCog, UserPlus, RotateCcw, Undo2, FilterX, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { pageTitles, fieldLabels, actionLabels, filterLabels, roleLabels, personnelStatusLabels, messages } from '@/lib/i18n';

type UndoAction = {
  type: 'add' | 'update' | 'delete' | 'batch_add';
  ids: string[];
  previousData?: Personnel[];
  description: string;
};

type ImportCandidate = {
  data: Omit<Personnel, 'id'>;
  isDuplicate: boolean;
  matchedId?: string;
  matchReason?: string;
};

export default function PersonnelPage() {
  const {
    personnel, teamAssignments, engineerAssignments,
    addPersonnel, updatePersonnel, deletePersonnel: dbDeletePersonnel,
    batchDeletePersonnel, batchAddPersonnel,
    updateTeamAssignment, setTeamAssignmentsBatch, setEngineerAssignmentsBatch,
  } = useDataContext();
  const { accounts, currentRole } = useAppContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterForeman, setFilterForeman] = useState<string>('all');
  const [filterEngineer, setFilterEngineer] = useState<string>('all');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all');
  const [filterNationality, setFilterNationality] = useState<string>('all');
  const [filterWorkLine, setFilterWorkLine] = useState<string>('all');
  const [filterProjectDept, setFilterProjectDept] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Personnel | null>(null);
  const [form, setForm] = useState({
    name: '', laborId: '', codeNo: '', passportNo: '', visaExpiryDate: '',
    role: 'worker' as Personnel['role'], phone: '',
    status: 'active' as Personnel['status'],
    specialty: '', nationality: '', joinDate: '',
    projectDept: '', assignedTo: '', workLine: '', leaveDate: '', leaveCount: '', seqNo: '' as string,
  });

  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignWorker, setReassignWorker] = useState<Personnel | null>(null);
  const [targetForemanId, setTargetForemanId] = useState<string>('none');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchReassignOpen, setBatchReassignOpen] = useState(false);
  const [batchTargetForeman, setBatchTargetForeman] = useState<string>('none');
  const [batchAssignEngineerOpen, setBatchAssignEngineerOpen] = useState(false);
  const [batchTargetEngineer, setBatchTargetEngineer] = useState<string>('none');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [assignEngineerOpen, setAssignEngineerOpen] = useState(false);
  const [assignTargetForeman, setAssignTargetForeman] = useState<Personnel | null>(null);
  const [targetEngineerId, setTargetEngineerId] = useState<string>('none');

  // Undo stack
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack(prev => [...prev.slice(-19), action]);
  }, []);

  const getErrorMessage = (err: unknown) => err instanceof Error ? err.message : 'Unknown error';

  // Import preview state
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [importSelectAll, setImportSelectAll] = useState(true);
  const [importSelected, setImportSelected] = useState<Set<number>>(new Set());

  const foremen = useMemo(() => personnel.filter(p => p.role === 'foreman' && p.status !== 'resigned'), [personnel]);
  const engineers = useMemo(() => personnel.filter(p => p.role === 'engineer' && p.status !== 'resigned'), [personnel]);

  // Distinct filter options
  const specialtyOptions = useMemo(() => [...new Set(personnel.map(p => p.specialty).filter(Boolean))].sort() as string[], [personnel]);
  const nationalityOptions = useMemo(() => [...new Set(personnel.map(p => p.nationality).filter(Boolean))].sort() as string[], [personnel]);
  const workLineOptions = useMemo(() => [...new Set(personnel.map(p => p.workLine).filter(Boolean))].sort() as string[], [personnel]);
  const projectDeptOptions = useMemo(() => [...new Set(personnel.map(p => p.projectDept).filter(Boolean))].sort() as string[], [personnel]);

  const personnelById = useMemo(() => new Map(personnel.map(p => [p.id, p])), [personnel]);
  const linkedAccountIds = useMemo(() => new Set(accounts.filter(a => a.enabled && a.linkedPersonnelId).map(a => a.linkedPersonnelId as string)), [accounts]);
  const foremanAssignmentMap = useMemo(() => new Map(teamAssignments.map(a => [a.foremanId, a])), [teamAssignments]);
  const engineerAssignmentMap = useMemo(() => new Map(engineerAssignments.map(a => [a.engineerId, a])), [engineerAssignments]);
  const workerForemanIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const assignment of teamAssignments) {
      for (const workerId of assignment.workerIds) map.set(workerId, assignment.foremanId);
    }
    return map;
  }, [teamAssignments]);
  const foremanEngineerIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const assignment of engineerAssignments) {
      for (const foremanId of assignment.foremanIds) map.set(foremanId, assignment.engineerId);
    }
    return map;
  }, [engineerAssignments]);

  // Scrollbar sync refs
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);

  

  const syncScroll = (source: 'top' | 'bottom') => {
    const top = topScrollRef.current;
    const bottom = tableWrapperRef.current;
    if (!top || !bottom) return;
    if (source === 'top') bottom.scrollLeft = top.scrollLeft;
    else top.scrollLeft = bottom.scrollLeft;
  };

  const hasLinkedAccount = (personnelId: string) => {
    return linkedAccountIds.has(personnelId);
  };

  const getWorkerForeman = (workerId: string) => {
    const foremanId = workerForemanIdMap.get(workerId);
    return foremanId ? personnelById.get(foremanId) || null : null;
  };

  const getForemanEngineer = (foremanId: string) => {
    const engineerId = foremanEngineerIdMap.get(foremanId);
    return engineerId ? personnelById.get(engineerId) || null : null;
  };

  const filtered = useMemo(() => {
    return personnel.filter(p => {
      if (search && !p.name.includes(search) && !(p.laborId || '').includes(search) && !(p.codeNo || '').includes(search) && !(p.nationality || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (filterRole !== 'all' && p.role !== filterRole) return false;
      if (filterSpecialty !== 'all' && (p.specialty || '') !== filterSpecialty) return false;
      if (filterNationality !== 'all' && (p.nationality || '') !== filterNationality) return false;
      if (filterWorkLine !== 'all' && (p.workLine || '') !== filterWorkLine) return false;
      if (filterProjectDept !== 'all' && (p.projectDept || '') !== filterProjectDept) return false;
      // Foreman filter: show only workers under that foreman (not the foreman itself)
      if (filterForeman !== 'all') {
        if (p.role === 'worker') {
          if (filterForeman === 'none') {
            if (workerForemanIdMap.has(p.id)) return false;
          } else {
            const assignment = foremanAssignmentMap.get(filterForeman);
            if (!assignment || !assignment.workerIds.includes(p.id)) return false;
          }
        } else {
          // Hide foremen and engineers when filtering by foreman - only show workers
          return false;
        }
      }
      // Engineer filter: show only foremen under that engineer (not the engineer itself)
      if (filterEngineer !== 'all') {
        if (p.role === 'foreman') {
          const assignment = engineerAssignmentMap.get(filterEngineer);
          if (!assignment || !assignment.foremanIds.includes(p.id)) return false;
        } else {
          // Hide workers and engineers when filtering by engineer - only show foremen
          return false;
        }
      }
      return true;
    });
  }, [personnel, search, filterRole, filterForeman, filterEngineer, filterSpecialty, filterNationality, filterWorkLine, filterProjectDept, workerForemanIdMap, foremanAssignmentMap, engineerAssignmentMap]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterRole, filterForeman, filterEngineer, filterSpecialty, filterNationality, filterWorkLine, filterProjectDept, pageSize]);

  // ResizeObserver for top scrollbar sync
  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => {
      const table = wrapper.querySelector('table');
      if (table) setTableWidth(table.scrollWidth);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [filtered.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);
  const pageBatchable = paginated.filter(p => p.role === 'worker' || p.role === 'foreman');
  const batchableFiltered = filtered.filter(p => p.role === 'worker' || p.role === 'foreman');
  const selectedBatchable = batchableFiltered.filter(p => selectedIds.has(p.id));
  const allBatchableSelected = pageBatchable.length > 0 && pageBatchable.every(p => selectedIds.has(p.id));
  const someBatchableSelected = selectedBatchable.length > 0;

  const showForemanFilter = filterRole === 'all' || filterRole === 'worker';
  const showEngineerFilter = filterRole === 'all' || filterRole === 'foreman';

  const hasActiveFilters = search || filterRole !== 'all' || filterForeman !== 'all' || filterEngineer !== 'all' || filterSpecialty !== 'all' || filterNationality !== 'all' || filterWorkLine !== 'all' || filterProjectDept !== 'all';

  const resetFilters = () => {
    setSearch(''); setFilterRole('all'); setFilterForeman('all');
    setFilterEngineer('all'); setFilterSpecialty('all'); setFilterNationality('all');
    setFilterWorkLine('all'); setFilterProjectDept('all'); setSelectedIds(new Set());
  };

  const getNextSeqNo = useCallback(() => {
    const maxSeqNo = personnel.reduce((max, person) => Math.max(max, person.seqNo || 0), 0);
    return maxSeqNo + 1;
  }, [personnel]);

  const handleUndo = async () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack(prev => prev.slice(0, -1));
    try {
      if (last.type === 'add' || last.type === 'batch_add') {
        await batchDeletePersonnel(last.ids);
        toast.success(`已撤销: ${last.description}`);
      } else if (last.type === 'delete' && last.previousData) {
        await batchAddPersonnel(last.previousData.map(({ id, ...rest }) => rest));
        toast.success(`已撤销: ${last.description}`);
      } else if (last.type === 'update' && last.previousData) {
        for (const p of last.previousData) await updatePersonnel(p.id, p);
        toast.success(`已撤销: ${last.description}`);
      }
    } catch { toast.error('撤销失败 Undo failed'); }
  };

  // Helper: get engineer for a worker (via foreman chain)
  const getWorkerEngineer = (workerId: string) => {
    const foremanId = workerForemanIdMap.get(workerId);
    if (!foremanId) return null;
    const engineerId = foremanEngineerIdMap.get(foremanId);
    return engineerId ? personnelById.get(engineerId) || null : null;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allBatchableSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const person of pageBatchable) next.delete(person.id);
        return next;
      });
    } else {
      setSelectedIds(prev => new Set([...prev, ...pageBatchable.map(p => p.id)]));
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', laborId: '', codeNo: '', passportNo: '', visaExpiryDate: '', role: 'worker', phone: '', status: 'active', specialty: '', nationality: '', joinDate: '', projectDept: '', assignedTo: '', workLine: '', leaveDate: '', leaveCount: '', seqNo: String(getNextSeqNo()) });
    setDialogOpen(true);
  };
  const openEdit = (p: Personnel) => {
    setEditing(p);
    setForm({
      name: p.name, laborId: p.laborId || '', codeNo: p.codeNo || '', passportNo: p.passportNo || '',
      visaExpiryDate: p.visaExpiryDate || '', role: p.role, phone: p.phone, status: p.status,
      specialty: p.specialty || '', nationality: p.nationality || '', joinDate: p.joinDate,
      projectDept: p.projectDept || '', assignedTo: p.assignedTo || '', workLine: p.workLine || '',
      leaveDate: p.leaveDate || '', leaveCount: p.leaveCount?.toString() || '', seqNo: p.seqNo?.toString() || '',
    });
    setDialogOpen(true);
  };

  const openReassign = (worker: Personnel) => {
    setReassignWorker(worker);
    const currentTeam = teamAssignments.find(a => a.workerIds.includes(worker.id));
    setTargetForemanId(currentTeam?.foremanId || 'none');
    setReassignOpen(true);
  };

  const openAssignEngineer = (foreman: Personnel) => {
    setAssignTargetForeman(foreman);
    const currentAssign = engineerAssignments.find(a => a.foremanIds.includes(foreman.id));
    setTargetEngineerId(currentAssign?.engineerId || 'none');
    setAssignEngineerOpen(true);
  };

  const handleAssignEngineer = async () => {
    if (!assignTargetForeman) return;
    const foremanId = assignTargetForeman.id;
    let updated = engineerAssignments.map(a => ({ ...a, foremanIds: a.foremanIds.filter(id => id !== foremanId) }));
    if (targetEngineerId !== 'none') {
      const exists = updated.find(a => a.engineerId === targetEngineerId);
      if (exists) {
        updated = updated.map(a => a.engineerId === targetEngineerId ? { ...a, foremanIds: [...a.foremanIds, foremanId] } : a);
      } else {
        updated.push({ engineerId: targetEngineerId, foremanIds: [foremanId] });
      }
    }
    await setEngineerAssignmentsBatch(updated);
    const targetName = targetEngineerId === 'none' ? '未分配 Unassigned' : (personnel.find(p => p.id === targetEngineerId)?.name || '');
    toast.success(`${assignTargetForeman.name} 已分配至 assigned to ${targetName}`);
    setAssignEngineerOpen(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(messages.fillComplete); return; }
    if (form.laborId) {
      const { validateLaborId } = await import('@/lib/utils');
      const err = validateLaborId(form.laborId, form.role);
      if (err) { toast.error(err); return; }
    }
    const payload = {
      ...form,
      laborId: form.laborId || undefined,
      codeNo: form.codeNo || undefined,
      passportNo: form.passportNo || undefined,
      visaExpiryDate: form.visaExpiryDate || undefined,
      specialty: form.specialty || undefined,
      nationality: form.nationality || undefined,
      joinDate: form.joinDate || new Date().toISOString().split('T')[0],
      status: form.status,
      projectDept: form.projectDept || undefined,
      assignedTo: form.assignedTo || undefined,
      workLine: form.workLine || undefined,
      leaveDate: form.leaveDate || undefined,
      leaveCount: form.leaveCount ? parseInt(form.leaveCount, 10) || 0 : 0,
      seqNo: editing ? (form.seqNo ? parseInt(form.seqNo) || undefined : undefined) : (parseInt(form.seqNo, 10) || getNextSeqNo()),
    };
    try {
      if (editing) {
        pushUndo({ type: 'update', ids: [editing.id], previousData: [{ ...editing }], description: `Edit ${editing.name}` });
        await updatePersonnel(editing.id, payload);
        toast.success(messages.saved);
      } else {
        const newId = await addPersonnel({ ...payload, joinDate: payload.joinDate || new Date().toISOString().split('T')[0] });
        pushUndo({ type: 'add', ids: [newId], description: `Add ${form.name}` });
        toast.success(messages.saved);
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(`Save failed: ${getErrorMessage(err)}`);
    }
  };

  const handleDelete = async (id: string) => {
    const p = personnel.find(pp => pp.id === id);
    try {
      await dbDeletePersonnel(id);
      if (p) pushUndo({ type: 'delete', ids: [id], previousData: [{ ...p }], description: `Delete ${p.name}` });
      toast.success(messages.deleted);
    } catch (err) {
      toast.error(`Delete failed: ${getErrorMessage(err)}`);
    }
  };

  const handleReassign = async () => {
    if (!reassignWorker) return;
    const workerId = reassignWorker.id;
    let updated = teamAssignments.map(a => ({ ...a, workerIds: a.workerIds.filter(id => id !== workerId) }));
    if (targetForemanId !== 'none') {
      const exists = updated.find(a => a.foremanId === targetForemanId);
      if (exists) {
        updated = updated.map(a => a.foremanId === targetForemanId ? { ...a, workerIds: [...a.workerIds, workerId] } : a);
      } else {
        updated.push({ foremanId: targetForemanId, workerIds: [workerId], equipmentIds: [] });
      }
    }
    await setTeamAssignmentsBatch(updated);
    const targetName = targetForemanId === 'none' ? '未分配 Unassigned' : (personnel.find(p => p.id === targetForemanId)?.name || '');
    toast.success(`${reassignWorker.name} 已调配至 Reassigned to ${targetName}`);
    setReassignOpen(false);
  };

  const handleBatchReassign = async () => {
    const workerIds = selectedBatchable.filter(p => p.role === 'worker').map(p => p.id);
    if (workerIds.length === 0) { toast.error('请选择工人 Please select workers'); return; }
    let updated = teamAssignments.map(a => ({ ...a, workerIds: a.workerIds.filter(id => !workerIds.includes(id)) }));
    if (batchTargetForeman !== 'none') {
      const exists = updated.find(a => a.foremanId === batchTargetForeman);
      if (exists) {
        updated = updated.map(a => a.foremanId === batchTargetForeman ? { ...a, workerIds: [...a.workerIds, ...workerIds] } : a);
      } else {
        updated.push({ foremanId: batchTargetForeman, workerIds, equipmentIds: [] });
      }
    }
    await setTeamAssignmentsBatch(updated);
    const targetName = batchTargetForeman === 'none' ? '未分配 Unassigned' : (personnel.find(p => p.id === batchTargetForeman)?.name || '');
    toast.success(`${workerIds.length} 名工人已调配至 workers reassigned to ${targetName}`);
    setBatchReassignOpen(false);
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    const ids = [...selectedIds];
    const previousData = personnel.filter(p => ids.includes(p.id));
    try {
      await batchDeletePersonnel(ids);
      pushUndo({ type: 'delete', ids, previousData, description: `Batch delete ${ids.length} personnel` });
      toast.success(`${ids.length} personnel deleted`);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(`Batch delete failed: ${getErrorMessage(err)}`);
    }
  };

  const handleBatchAssignEngineer = async () => {
    const foremanIds = selectedBatchable.filter(p => p.role === 'foreman').map(p => p.id);
    if (foremanIds.length === 0) { toast.error('请选择工长 Please select foremen'); return; }
    let updated = engineerAssignments.map(a => ({ ...a, foremanIds: a.foremanIds.filter(id => !foremanIds.includes(id)) }));
    if (batchTargetEngineer !== 'none') {
      const exists = updated.find(a => a.engineerId === batchTargetEngineer);
      if (exists) {
        updated = updated.map(a => a.engineerId === batchTargetEngineer ? { ...a, foremanIds: [...a.foremanIds, ...foremanIds] } : a);
      } else {
        updated.push({ engineerId: batchTargetEngineer, foremanIds });
      }
    }
    await setEngineerAssignmentsBatch(updated);
    const targetName = batchTargetEngineer === 'none' ? '未分配 Unassigned' : (personnel.find(p => p.id === batchTargetEngineer)?.name || '');
    toast.success(`${foremanIds.length} 名工长已分配至 foremen assigned to ${targetName}`);
    setBatchAssignEngineerOpen(false);
    setSelectedIds(new Set());
  };

  // Auto-link selected workers to foremen by matching their assignedTo text
  // against existing foreman laborId or name. Useful after import, or after
  // foremen are added/edited later.
  const handleBatchAutoLinkForeman = async () => {
    const workers = selectedBatchable.filter(p => p.role === 'worker');
    if (workers.length === 0) { toast.error('请选择工人 Please select workers'); return; }
    const allFm = personnel.filter(p => p.role === 'foreman' && p.status !== 'resigned');
    const matchForeman = (tag: string) => {
      const t = (tag || '').trim();
      if (!t) return null;
      const byLabor = allFm.find(fm => fm.laborId && t.toUpperCase().includes(fm.laborId.toUpperCase()));
      if (byLabor) return byLabor;
      const parts = t.split(/[\/\s,，]+/).map(s => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (part.length < 2) continue;
        const m = allFm.find(fm => fm.name && (fm.name.includes(part) || part.includes(fm.name)));
        if (m) return m;
      }
      return null;
    };
    // Strip the chosen workers from every team first
    const workerIdSet = new Set(workers.map(w => w.id));
    let updated = teamAssignments.map(a => ({
      ...a,
      workerIds: a.workerIds.filter(id => !workerIdSet.has(id)),
      equipmentIds: [...a.equipmentIds],
    }));
    let linked = 0;
    let unmatched = 0;
    const fmToWorkerIds = new Map<string, string[]>();
    for (const w of workers) {
      const fm = matchForeman(w.assignedTo || '');
      if (!fm) { unmatched++; continue; }
      if (!fmToWorkerIds.has(fm.id)) fmToWorkerIds.set(fm.id, []);
      fmToWorkerIds.get(fm.id)!.push(w.id);
      linked++;
    }
    for (const [fmId, wIds] of fmToWorkerIds) {
      const exists = updated.find(a => a.foremanId === fmId);
      if (exists) exists.workerIds = [...new Set([...exists.workerIds, ...wIds])];
      else updated.push({ foremanId: fmId, workerIds: wIds, equipmentIds: [] });
    }
    await setTeamAssignmentsBatch(updated);
    toast.success(`已关联 ${linked} 人，未匹配 ${unmatched} 人 Linked ${linked}, unmatched ${unmatched}`);
    setSelectedIds(new Set());
  };

  const [importGuideOpen, setImportGuideOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importPersonnel(file);
      if (imported.length === 0) {
        toast.error('未检测到有效数据，请检查文件格式是否正确 No valid data detected, please check file format');
        return;
      }
      // Deduplicate: compare against existing personnel
      const candidates: ImportCandidate[] = imported.map(p => {
        let isDuplicate = false;
        let matchedId: string | undefined;
        let matchReason: string | undefined;
        // Match by laborId (most reliable)
        if (p.laborId) {
          const match = personnel.find(ex => ex.laborId && ex.laborId === p.laborId);
          if (match) { isDuplicate = true; matchedId = match.id; matchReason = `胸卡号匹配 Labor ID: ${p.laborId}`; }
        }
        // Match by codeNo
        if (!isDuplicate && p.codeNo) {
          const match = personnel.find(ex => ex.codeNo && ex.codeNo === p.codeNo);
          if (match) { isDuplicate = true; matchedId = match.id; matchReason = `工号匹配 Code No: ${p.codeNo}`; }
        }
        // Match by name + nationality
        if (!isDuplicate && p.name) {
          const match = personnel.find(ex => ex.name === p.name && ex.nationality === p.nationality && ex.joinDate === p.joinDate);
          if (match) { isDuplicate = true; matchedId = match.id; matchReason = `姓名+国籍+入场日期匹配`; }
        }
        return { data: p, isDuplicate, matchedId, matchReason };
      });
      setImportCandidates(candidates);
      const nonDupIndices = new Set(candidates.map((c, i) => (!c.isDuplicate ? i : -1)).filter(i => i >= 0));
      setImportSelected(nonDupIndices);
      setImportSelectAll(nonDupIndices.size === candidates.length);
      setImportPreviewOpen(true);
    } catch { toast.error(messages.importFailed); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    const toImport = importCandidates.filter((_, i) => importSelected.has(i));
    if (toImport.length === 0) { toast.error('未选择任何数据 No data selected'); return; }
    const addedIds = await batchAddPersonnel(toImport.map(c => c.data));
    pushUndo({ type: 'batch_add', ids: addedIds, description: `导入 ${addedIds.length} 人` });

    // Auto-link imported workers to foremen by matching assignedTo text
    // against foreman laborId or name parts. Includes BOTH existing foremen
    // and foremen just imported in this batch (so a one-shot import that
    // contains both foremen and workers still wires up assignments).
    const newlyAddedFm = addedIds
      .map((id, idx) => ({ id, data: toImport[idx].data }))
      .filter(x => x.data.role === 'foreman')
      .map(x => ({ ...x.data, id: x.id } as Personnel));
    const allFm = [
      ...personnel.filter(p => p.role === 'foreman' && p.status !== 'resigned'),
      ...newlyAddedFm,
    ];
    const matchForeman = (tag: string) => {
      const t = (tag || '').trim();
      if (!t) return null;
      // Try labor id substring (e.g. "LQ-0815 PYARE LAL")
      const byLabor = allFm.find(fm => fm.laborId && t.toUpperCase().includes(fm.laborId.toUpperCase()));
      if (byLabor) return byLabor;
      // Try name parts split by / or space
      const parts = t.split(/[\/\s,，]+/).map(s => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (part.length < 2) continue;
        const m = allFm.find(fm => fm.name && (fm.name.includes(part) || part.includes(fm.name)));
        if (m) return m;
      }
      return null;
    };
    let linkCount = 0;
    const fmToWorkerIds = new Map<string, string[]>();
    addedIds.forEach((id, idx) => {
      const cand = toImport[idx];
      if (cand.data.role !== 'worker') return;
      const fm = matchForeman(cand.data.assignedTo || '');
      if (!fm) return;
      if (!fmToWorkerIds.has(fm.id)) fmToWorkerIds.set(fm.id, []);
      fmToWorkerIds.get(fm.id)!.push(id);
      linkCount++;
    });
    if (fmToWorkerIds.size > 0) {
      let updated = teamAssignments.map(a => ({ ...a, workerIds: [...a.workerIds], equipmentIds: [...a.equipmentIds] }));
      for (const [fmId, wIds] of fmToWorkerIds) {
        const exists = updated.find(a => a.foremanId === fmId);
        if (exists) exists.workerIds = [...new Set([...exists.workerIds, ...wIds])];
        else updated.push({ foremanId: fmId, workerIds: wIds, equipmentIds: [] });
      }
      await setTeamAssignmentsBatch(updated);
    }
    toast.success(`成功导入 ${addedIds.length} 人，自动关联工长 ${linkCount} 人 Imported, ${linkCount} auto-linked`);
    setImportPreviewOpen(false);
    setImportCandidates([]);
  };

  const handleDownloadTemplate = () => {
    exportPersonnel([]);
    toast.success('模板已下载 Template downloaded');
  };

  return (
    <div>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{pageTitles.personnel.title}</h1>
          <p className="page-subtitle">{pageTitles.personnel.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {undoStack.length > 0 && (
            <Button variant="outline" onClick={handleUndo} className="gap-2 text-amber-600 hover:text-amber-700">
              <Undo2 size={16} /> 撤销 Undo
            </Button>
          )}
          <Button variant="outline" onClick={() => setImportGuideOpen(true)} className="gap-2"><Upload size={16} /> {actionLabels.import}</Button>
          <Button variant="outline" onClick={() => exportPersonnel(personnel)} className="gap-2"><Download size={16} /> {actionLabels.export}</Button>
          <Button onClick={openCreate} className="gap-2"><Plus size={16} /> {actionLabels.add}</Button>
        </div>
      </div>

      {/* Primary filter */}
      <div className="flex flex-wrap gap-3 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索姓名/工号 Search name/ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterRole} onValueChange={v => { setFilterRole(v); setFilterForeman('all'); setFilterEngineer('all'); setSelectedIds(new Set()); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{filterLabels.allRoles}</SelectItem>
            <SelectItem value="worker">{roleLabels.worker}</SelectItem>
            <SelectItem value="foreman">{roleLabels.foreman}</SelectItem>
            <SelectItem value="engineer">{roleLabels.engineer}</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 text-muted-foreground hover:text-foreground h-10">
            <FilterX size={16} /> 重置 Reset
          </Button>
        )}
      </div>

      {/* Secondary hierarchical filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        {showForemanFilter && (
          <Select value={filterForeman} onValueChange={setFilterForeman}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="所属工长 Foreman" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部工长 All Foremen</SelectItem>
              <SelectItem value="none">未分配 Unassigned</SelectItem>
              {foremen.map(fm => (
                <SelectItem key={fm.id} value={fm.id}>{fm.laborId ? `[${fm.laborId}] ` : ''}{fm.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {showEngineerFilter && (
          <Select value={filterEngineer} onValueChange={setFilterEngineer}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="所属工程师 Engineer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部工程师 All Engineers</SelectItem>
              {engineers.map(eng => (
                <SelectItem key={eng.id} value={eng.id}>{eng.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {specialtyOptions.length > 0 && (
          <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="工种 Specialty" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部工种 All</SelectItem>
              {specialtyOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {nationalityOptions.length > 0 && (
          <Select value={filterNationality} onValueChange={setFilterNationality}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="国籍 Nationality" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部国籍 All</SelectItem>
              {nationalityOptions.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {workLineOptions.length > 0 && (
          <Select value={filterWorkLine} onValueChange={setFilterWorkLine}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="一线/二线" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部线别 All</SelectItem>
              {workLineOptions.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {projectDeptOptions.length > 0 && (
          <Select value={filterProjectDept} onValueChange={setFilterProjectDept}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="项目/部门" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部项目 All Depts</SelectItem>
              {projectDeptOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Batch action bar */}
      {someBatchableSelected && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">已选 Selected {selectedBatchable.length} 人</span>
          {selectedBatchable.some(p => p.role === 'worker') && (
            <Button variant="outline" size="sm" onClick={() => { setBatchTargetForeman('none'); setBatchReassignOpen(true); }} className="gap-1.5">
              <ArrowRightLeft size={14} /> 批量调配工长 Batch Reassign
            </Button>
          )}
          {selectedBatchable.some(p => p.role === 'worker') && (
            <Button variant="outline" size="sm" onClick={handleBatchAutoLinkForeman} className="gap-1.5">
              <UserPlus size={14} /> 按所属工长字段自动关联 Auto-link by Field
            </Button>
          )}
          {selectedBatchable.some(p => p.role === 'foreman') && (
            <Button variant="outline" size="sm" onClick={() => { setBatchTargetEngineer('none'); setBatchAssignEngineerOpen(true); }} className="gap-1.5">
              <UserCog size={14} /> 批量分配工程师 Batch Assign Engineer
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleBatchDelete} className="gap-1.5 text-destructive hover:text-destructive">
            <Trash2 size={14} /> 批量删除 Batch Delete
          </Button>
        </div>
      )}

      {/* Top scrollbar */}
      <div
        ref={topScrollRef}
        className="bg-card rounded-t-lg border border-b-0 overflow-x-auto"
        style={{ height: 12 }}
        onScroll={() => syncScroll('top')}
      >
        <div style={{ width: tableWidth, height: 1 }} />
      </div>
      <div ref={tableWrapperRef} className="bg-card rounded-b-lg border shadow-sm overflow-x-auto" onScroll={() => syncScroll('bottom')}>
        <table className="w-full text-sm min-w-[1380px]">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-3 w-10">
                <Checkbox checked={allBatchableSelected} onCheckedChange={toggleSelectAll} />
              </th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.seqNo}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.laborId}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.codeNo}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.name}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.role}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.status}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.specialty}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.nationality}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.projectDept}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">所属工长 Foreman</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">所属工程师 Engineer</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.workLine}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.leaveDate}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.leaveCount}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.passportNo}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.visaExpiryDate}</th>
              <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.joinDate}</th>
              <th className="text-right px-3 py-3 font-medium text-muted-foreground text-xs">{fieldLabels.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginated.map((p, idx) => {
              const isBatchable = p.role === 'worker' || p.role === 'foreman';
              const fm = p.role === 'worker' ? getWorkerForeman(p.id) : null;
              const eng = p.role === 'foreman' ? getForemanEngineer(p.id) : (p.role === 'worker' ? getWorkerEngineer(p.id) : null);
              const needsAccount = (p.role === 'foreman' || p.role === 'engineer') && !hasLinkedAccount(p.id);
              return (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2">
                    {isBatchable && <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.seqNo || pageStart + idx + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.laborId || '-'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.codeNo || '-'}</td>
                  <td className="px-3 py-2 font-medium text-xs">
                    <div className="flex items-center gap-1">
                      {p.name}
                      {needsAccount && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger><AlertTriangle size={13} className="text-warning" /></TooltipTrigger>
                            <TooltipContent><p>未关联有效账号 No linked active account</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {needsAccount && currentRole === 'admin' && (
                        <Button variant="ghost" size="sm" className="h-5 px-1 text-xs gap-0.5 text-warning hover:text-warning/80" onClick={() => navigate('/accounts')} title="创建账号">
                          <UserPlus size={11} />
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">{roleLabels[p.role as keyof typeof roleLabels]}</td>
                  <td className="px-3 py-2 text-xs">{p.status === 'active' ? '在班 Active' : p.status === 'leave' ? '休假 On Leave' : '离职 Resigned'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.specialty || '-'}</td>
                  <td className="px-3 py-2 text-xs">{p.nationality || '-'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[100px] truncate" title={p.projectDept}>{p.projectDept || '-'}</td>
                  <td className="px-3 py-2 text-xs">
                    {p.role === 'worker' ? (
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[80px]" title={fm ? `${fm.laborId ? `[${fm.laborId}] ` : ''}${fm.name}` : ''}>{fm ? fm.name : <span className="text-muted-foreground">未分配</span>}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => openReassign(p)} title="调配工长"><ArrowRightLeft size={12} /></Button>
                      </div>
                    ) : <span className="text-muted-foreground">N/A</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {(p.role === 'foreman') ? (
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[80px]" title={eng?.name}>{eng ? eng.name : <span className="text-muted-foreground">未分配</span>}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => openAssignEngineer(p)} title="分配工程师"><UserCog size={12} /></Button>
                      </div>
                    ) : p.role === 'worker' ? (
                      <span className="text-muted-foreground truncate max-w-[80px]" title={eng?.name}>{eng ? eng.name : '-'}</span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs">{p.workLine || '-'}</td>
                  <td className="px-3 py-2 text-xs">{p.leaveDate || '-'}</td>
                  <td className="px-3 py-2 text-xs">{p.leaveCount ?? 0}</td>
                  <td className="px-3 py-2 text-xs max-w-[120px] truncate" title={p.passportNo}>{p.passportNo || '-'}</td>
                  <td className="px-3 py-2 text-xs">{p.visaExpiryDate || '-'}</td>
                  <td className="px-3 py-2 text-xs">{p.joinDate || '-'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Edit2 size={14} /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(p.id)}><Trash2 size={14} className="text-destructive" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="px-4 py-12 text-center text-muted-foreground">{messages.noMatch}</div>}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 text-sm text-muted-foreground">
        <div>
          Showing {filtered.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + pageSize, filtered.length)} of {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <span>Rows</span>
          <Select value={String(pageSize)} onValueChange={value => setPageSize(Number(value))}>
            <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-9 w-9" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))}>
            <ChevronLeft size={16} />
          </Button>
          <span className="min-w-[84px] text-center">{safeCurrentPage} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-9 w-9" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? '编辑人员 Edit Personnel' : '添加人员 Add Personnel'}</DialogTitle></DialogHeader>
          <DialogDescription className="sr-only">{editing ? 'Edit personnel info' : 'Add new personnel'}</DialogDescription>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div><Label>{fieldLabels.seqNo}</Label><Input type="number" min={1} placeholder="Auto" value={form.seqNo} onChange={e => setForm(f => ({ ...f, seqNo: e.target.value }))} /></div>
            <div><Label>{fieldLabels.laborId}</Label><Input placeholder="e.g. LQ-7306" value={form.laborId} onChange={e => setForm(f => ({ ...f, laborId: e.target.value }))} /></div>
            <div><Label>{fieldLabels.codeNo}</Label><Input placeholder="e.g. L58827" value={form.codeNo} onChange={e => setForm(f => ({ ...f, codeNo: e.target.value }))} /></div>
            <div className="col-span-2"><Label>{fieldLabels.name} *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label>{fieldLabels.role}</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Personnel['role'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="worker">{roleLabels.worker}</SelectItem>
                  <SelectItem value="foreman">{roleLabels.foreman}</SelectItem>
                  <SelectItem value="engineer">{roleLabels.engineer}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{fieldLabels.status}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Personnel['status'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{personnelStatusLabels.active}</SelectItem>
                  <SelectItem value="leave">{personnelStatusLabels.leave}</SelectItem>
                  <SelectItem value="resigned">{personnelStatusLabels.resigned}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{fieldLabels.specialty}</Label><Input placeholder="e.g. Carpenter, Electrician" value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} /></div>
            <div><Label>{fieldLabels.nationality}</Label><Input placeholder="e.g. India, Bangladesh" value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} /></div>
            <div><Label>{fieldLabels.phone}</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>{fieldLabels.projectDept}</Label><Input placeholder="e.g. Structure Team" value={form.projectDept} onChange={e => setForm(f => ({ ...f, projectDept: e.target.value }))} /></div>
            <div>
              <Label>{fieldLabels.assignedTo} (原始文本 Raw)</Label>
              <Input
                placeholder="e.g. LQ-0815 PYARE LAL / 单士友"
                value={form.assignedTo}
                onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                list="foreman-suggestions"
              />
              <datalist id="foreman-suggestions">
                {foremen.map(fm => (
                  <option key={fm.id} value={fm.laborId ? `${fm.laborId} ${fm.name}` : fm.name} />
                ))}
              </datalist>
              <p className="text-[11px] text-muted-foreground mt-1">用于自动匹配工长 Used to auto-link to a foreman on import</p>
            </div>
            <div><Label>{fieldLabels.workLine}</Label><Input placeholder="e.g. site / Indirect" value={form.workLine} onChange={e => setForm(f => ({ ...f, workLine: e.target.value }))} /></div>
            <div><Label>{fieldLabels.leaveDate}</Label><Input placeholder="YYYY-MM-DD or date range" value={form.leaveDate} onChange={e => setForm(f => ({ ...f, leaveDate: e.target.value }))} /></div>
            <div><Label>{fieldLabels.leaveCount}</Label><Input type="number" min={0} placeholder="0" value={form.leaveCount} onChange={e => setForm(f => ({ ...f, leaveCount: e.target.value }))} /></div>
            <div><Label>{fieldLabels.passportNo}</Label><Input value={form.passportNo} onChange={e => setForm(f => ({ ...f, passportNo: e.target.value }))} /></div>
            <div><Label>{fieldLabels.visaExpiryDate}</Label><Input placeholder="YYYY-MM-DD" value={form.visaExpiryDate} onChange={e => setForm(f => ({ ...f, visaExpiryDate: e.target.value }))} /></div>
            <div><Label>{fieldLabels.joinDate}</Label><Input placeholder="YYYY-MM-DD" value={form.joinDate} onChange={e => setForm(f => ({ ...f, joinDate: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={handleSave}>{editing ? actionLabels.save : actionLabels.add}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>调配工人 Reassign Worker</DialogTitle></DialogHeader>
          <DialogDescription className="sr-only">Reassign worker to a different foreman</DialogDescription>
          <p className="text-sm text-muted-foreground mb-3">{reassignWorker?.name}</p>
          <Select value={targetForemanId} onValueChange={setTargetForemanId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{fieldLabels.unassigned}</SelectItem>
              {foremen.map(fm => <SelectItem key={fm.id} value={fm.id}>{fm.laborId ? `[${fm.laborId}] ` : ''}{fm.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={handleReassign}>{actionLabels.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Engineer Dialog */}
      <Dialog open={assignEngineerOpen} onOpenChange={setAssignEngineerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>分配工程师 Assign Engineer</DialogTitle></DialogHeader>
          <DialogDescription className="sr-only">Assign engineer to foreman</DialogDescription>
          <p className="text-sm text-muted-foreground mb-3">{assignTargetForeman?.name}</p>
          <Select value={targetEngineerId} onValueChange={setTargetEngineerId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{fieldLabels.unassigned}</SelectItem>
              {engineers.map(eng => <SelectItem key={eng.id} value={eng.id}>{eng.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignEngineerOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={handleAssignEngineer}>{actionLabels.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Reassign Dialog */}
      <Dialog open={batchReassignOpen} onOpenChange={setBatchReassignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>批量调配工人 Batch Reassign Workers</DialogTitle></DialogHeader>
          <DialogDescription className="sr-only">Batch reassign selected workers</DialogDescription>
          <p className="text-sm text-muted-foreground mb-3">已选 {selectedBatchable.filter(p => p.role === 'worker').length} 名工人</p>
          <Select value={batchTargetForeman} onValueChange={setBatchTargetForeman}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{fieldLabels.unassigned}</SelectItem>
              {foremen.map(fm => <SelectItem key={fm.id} value={fm.id}>{fm.laborId ? `[${fm.laborId}] ` : ''}{fm.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchReassignOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={handleBatchReassign}>{actionLabels.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Assign Engineer Dialog */}
      <Dialog open={batchAssignEngineerOpen} onOpenChange={setBatchAssignEngineerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>批量分配工程师 Batch Assign Engineer</DialogTitle></DialogHeader>
          <DialogDescription className="sr-only">Batch assign engineer to foremen</DialogDescription>
          <p className="text-sm text-muted-foreground mb-3">已选 {selectedBatchable.filter(p => p.role === 'foreman').length} 名工长</p>
          <Select value={batchTargetEngineer} onValueChange={setBatchTargetEngineer}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{fieldLabels.unassigned}</SelectItem>
              {engineers.map(eng => <SelectItem key={eng.id} value={eng.id}>{eng.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchAssignEngineerOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={handleBatchAssignEngineer}>{actionLabels.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Format Guide Dialog */}
      <Dialog open={importGuideOpen} onOpenChange={setImportGuideOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>导入格式说明 Import Format Guide</DialogTitle>
            <DialogDescription className="sr-only">Personnel import format instructions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              请使用 Excel 文件（.xlsx / .xls）导入，文件第一行为表头，需包含以下列名：
            </p>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2 font-medium">列名 Column</th>
                    <th className="px-3 py-2 font-medium">必填 Required</th>
                    <th className="px-3 py-2 font-medium">说明 Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="px-3 py-1.5 font-mono text-xs">Full_Name/姓名</td><td className="px-3 py-1.5">✅</td><td className="px-3 py-1.5">人员姓名</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">胸卡号/Labor No.</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">e.g. LQ-7306</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">工号/code No.</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">e.g. L58827</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">等级/Grade</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">FOREMAN / Labor</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">工种/Position</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">Carpenter, Mason...</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">国籍/Nationality</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">India, Bangladesh...</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">所属项目/部门</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">Structure Team...</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">所属工长</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">Foreman/Officer</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">一线/二线</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">site / Indirect</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">休假日期/Leave Date</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">YYYY-MM-DD or date range</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">休假次数/Leave Count</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">Number of leave records</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">护照号码/Passport</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">护照号码</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">签证有效期/Visa</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">YYYYMMDD</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">入场日期</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">YYYY.MM.DD</td></tr>
                  <tr><td className="px-3 py-1.5 font-mono text-xs">归属(入/退)</td><td className="px-3 py-1.5">—</td><td className="px-3 py-1.5">来源/去向</td></tr>
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <AlertTriangle size={16} className="text-warning shrink-0" />
              <p className="text-muted-foreground text-xs">
                提示：可先导出现有人员列表作为模板参考。只有"姓名"列为必填项，空行将被自动跳过。
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
              <Download size={16} /> 下载模板 Download Template
            </Button>
            <Button onClick={() => { setImportGuideOpen(false); fileInputRef.current?.click(); }} className="gap-2">
              <Upload size={16} /> 选择文件导入 Select File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview / Dedup Dialog */}
      <Dialog open={importPreviewOpen} onOpenChange={setImportPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>导入数据预览 Import Preview</DialogTitle>
            <DialogDescription>
              共 {importCandidates.length} 条记录，其中 {importCandidates.filter(c => c.isDuplicate).length} 条疑似重复。重复项默认不勾选，可手动选择覆盖导入。
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-auto max-h-[50vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 sticky top-0">
                  <th className="px-3 py-2 w-10">
                    <Checkbox
                      checked={importSelected.size === importCandidates.length}
                      onCheckedChange={checked => {
                        if (checked) setImportSelected(new Set(importCandidates.map((_, i) => i)));
                        else setImportSelected(new Set());
                      }}
                    />
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-xs">状态</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">姓名 Name</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">胸卡号 Labor ID</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">工号 Code</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">工种 Position</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">匹配原因 Match</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {importCandidates.map((c, i) => (
                  <tr key={i} className={c.isDuplicate ? 'bg-destructive/5' : ''}>
                    <td className="px-3 py-1.5">
                      <Checkbox checked={importSelected.has(i)} onCheckedChange={() => {
                        setImportSelected(prev => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        });
                      }} />
                    </td>
                    <td className="px-3 py-1.5">
                      {c.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
                          <AlertTriangle size={12} /> 重复
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium">新增</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-xs font-medium">{c.data.name}</td>
                    <td className="px-3 py-1.5 text-xs font-mono">{c.data.laborId || '-'}</td>
                    <td className="px-3 py-1.5 text-xs font-mono">{c.data.codeNo || '-'}</td>
                    <td className="px-3 py-1.5 text-xs">{c.data.specialty || '-'}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{c.matchReason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>已选 {importSelected.size} / {importCandidates.length} 条</span>
            <span className="text-xs">重复项将作为新记录添加，不会覆盖已有数据</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPreviewOpen(false)}>取消 Cancel</Button>
            <Button onClick={handleConfirmImport} disabled={importSelected.size === 0}>
              确认导入 Import ({importSelected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
