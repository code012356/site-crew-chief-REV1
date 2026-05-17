import { useState, useRef, useMemo } from 'react';
import { useDataContext } from '@/contexts/DataContext';
import { useAppContext } from '@/contexts/AppContext';
import { Equipment, EquipmentStatus, EquipmentRequestType, EquipmentRequest } from '@/lib/types';
import { exportEquipment, importEquipment } from '@/lib/excel-utils';
import { Plus, Edit2, Trash2, Download, Upload, Send, CheckCircle, XCircle, Clock, Package, PackagePlus, Undo2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { pageTitles, fieldLabels, actionLabels, equipmentStatusLabels, messages } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';

export default function EquipmentPage() {
  const { currentRole, currentPersonnelId, currentUserName } = useAppContext();
  const {
    equipment, personnel, teamAssignments, engineerAssignments,
    addEquipment: dbAddEquipment, updateEquipment: dbUpdateEquipment, deleteEquipment: dbDeleteEquipment,
    updateTeamAssignment, equipmentRequests, addEquipmentRequest, updateEquipmentRequest, deleteEquipmentRequest,
    addEquipmentToTeam,
  } = useDataContext();

  const isAdmin = currentRole === 'admin';
  const foremen = personnel.filter(p => p.role === 'foreman' && p.status !== 'resigned');
  const availableEquipment = equipment.filter(e => e.status !== 'retired');

  // Find engineer for a foreman (if any)
  const getEngineerForForeman = (foremanId: string) => {
    return engineerAssignments.find(a => a.foremanIds.includes(foremanId));
  };

  // Equipment already assigned to current user's team
  const myEquipmentIds = useMemo(() => {
    if (currentRole === 'foreman') {
      const ta = teamAssignments.find(a => a.foremanId === currentPersonnelId);
      return new Set(ta?.equipmentIds || []);
    }
    if (currentRole === 'engineer') {
      const assignment = engineerAssignments.find(a => a.engineerId === currentPersonnelId);
      const foremanIds = assignment?.foremanIds || [];
      const eqIds = new Set<string>();
      for (const fId of foremanIds) {
        const ta = teamAssignments.find(a => a.foremanId === fId);
        ta?.equipmentIds.forEach(id => eqIds.add(id));
      }
      return eqIds;
    }
    return new Set<string>();
  }, [currentRole, currentPersonnelId, teamAssignments, engineerAssignments]);

  const requestableEquipment = equipment.filter(e => e.status === 'available' && !myEquipmentIds.has(e.id));

  // ── Admin equipment CRUD dialog state ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState({ name: '', equipmentNo: '', model: '', status: 'available' as EquipmentStatus, location: '', assignedForeman: '' });

  // ── Request dialog state (for foreman/engineer) ──
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<EquipmentRequestType>('existing');
  const [requestForm, setRequestForm] = useState({ equipmentId: '', equipmentName: '', reason: '' });

  // ── Admin/Engineer approve dialog state ──
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [assignForeman, setAssignForeman] = useState('');
  const [assignEquipmentId, setAssignEquipmentId] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [engineerComment, setEngineerComment] = useState('');
  const [newEqForm, setNewEqForm] = useState({ name: '', equipmentNo: '', model: '', location: '' });

  const getAssignedForeman = (eqId: string) => {
    const assignment = teamAssignments.find(a => a.equipmentIds.includes(eqId));
    return assignment ? assignment.foremanId : '';
  };

  const getEngineerForEquipment = (eqId: string) => {
    const foremanId = getAssignedForeman(eqId);
    if (!foremanId) return null;
    const ea = engineerAssignments.find(a => a.foremanIds.includes(foremanId));
    if (!ea) return null;
    const eng = personnel.find(p => p.id === ea.engineerId);
    return eng ? eng.name : null;
  };

  // ── Admin CRUD handlers ──
  const openCreate = () => { setEditing(null); setForm({ name: '', equipmentNo: '', model: '', status: 'available', location: '', assignedForeman: '' }); setDialogOpen(true); };
  const openEdit = (e: Equipment) => {
    setEditing(e);
    setForm({ name: e.name, equipmentNo: e.equipmentNo || '', model: e.model, status: e.status, location: e.location || '', assignedForeman: getAssignedForeman(e.id) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(messages.fillComplete); return; }
    if (editing) {
      await dbUpdateEquipment(editing.id, { name: form.name, equipmentNo: form.equipmentNo || undefined, model: form.model, status: form.status, location: form.location });
      for (const a of teamAssignments) {
        if (a.equipmentIds.includes(editing.id)) {
          await updateTeamAssignment(a.foremanId, a.workerIds, a.equipmentIds.filter(id => id !== editing.id));
        }
      }
      if (form.assignedForeman && form.assignedForeman !== 'none') {
        const a = teamAssignments.find(t => t.foremanId === form.assignedForeman);
        if (a) {
          await updateTeamAssignment(form.assignedForeman, a.workerIds, [...a.equipmentIds.filter(id => id !== editing.id), editing.id]);
        }
      }
    } else {
      await dbAddEquipment({ name: form.name, equipmentNo: form.equipmentNo || undefined, model: form.model, status: form.status, location: form.location });
    }
    toast.success(messages.saved);
    setDialogOpen(false);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importEquipment(file);
      for (const eq of imported) {
        await dbAddEquipment({ name: eq.name, equipmentNo: eq.equipmentNo, model: eq.model, status: eq.status, location: eq.location });
      }
      toast.success(`${messages.imported} (${imported.length})`);
    } catch { toast.error(messages.importFailed); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Request handlers (foreman/engineer) ──
  const openRequestDialog = (eq?: Equipment) => {
    setEditingRequestId(null);
    if (eq) {
      setRequestType('existing');
      setRequestForm({ equipmentId: eq.id, equipmentName: eq.name, reason: '' });
    } else {
      setRequestType('existing');
      setRequestForm({ equipmentId: '', equipmentName: '', reason: '' });
    }
    setRequestDialogOpen(true);
  };

  const openEditRequest = (req: EquipmentRequest) => {
    setEditingRequestId(req.id);
    setRequestType(req.requestType);
    setRequestForm({
      equipmentId: req.equipmentId || '',
      equipmentName: req.equipmentName,
      reason: req.reason,
    });
    setRequestDialogOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (requestType === 'existing' && !requestForm.equipmentId) {
      toast.error(messages.fillComplete); return;
    }
    if (requestType === 'new' && !requestForm.equipmentName.trim()) {
      toast.error(messages.fillComplete); return;
    }
    if (!requestForm.reason.trim()) {
      toast.error(messages.fillComplete); return;
    }

    const selectedEq = requestType === 'existing' ? equipment.find(e => e.id === requestForm.equipmentId) : null;
    const eqName = requestType === 'existing' ? (selectedEq?.name || '') : requestForm.equipmentName;

    // Determine initial status based on role and engineer assignment
    let initialStatus: string = 'pending';
    if (currentRole === 'foreman') {
      const engineerAssignment = getEngineerForForeman(currentPersonnelId);
      if (engineerAssignment) {
        initialStatus = 'engineer_pending'; // needs engineer review first
      }
    }

    if (editingRequestId) {
      // Re-submit: determine status again
      const existingReq = equipmentRequests.find(r => r.id === editingRequestId);
      let resubmitStatus = 'pending';
      if (existingReq && existingReq.requesterRole === 'foreman') {
        const engineerAssignment = getEngineerForForeman(existingReq.requesterId);
        if (engineerAssignment) {
          resubmitStatus = 'engineer_pending';
        }
      }
      await updateEquipmentRequest(editingRequestId, {
        requestType,
        equipmentId: requestType === 'existing' ? requestForm.equipmentId : undefined,
        equipmentName: eqName,
        reason: requestForm.reason,
        status: resubmitStatus as any,
        engineerComment: undefined,
        adminComment: undefined,
      });
      toast.success(messages.saved);
    } else {
      await addEquipmentRequest({
        requesterId: currentPersonnelId,
        requesterName: currentUserName,
        requesterRole: currentRole,
        requestType,
        equipmentId: requestType === 'existing' ? requestForm.equipmentId : undefined,
        equipmentName: eqName,
        reason: requestForm.reason,
        status: initialStatus as any,
      });
      toast.success(messages.equipmentRequestSubmitted);
    }
    setRequestDialogOpen(false);
  };

  const handleWithdrawRequest = async (reqId: string) => {
    await updateEquipmentRequest(reqId, { status: 'withdrawn' as any });
    toast.success('申请已撤回 Request withdrawn');
  };

  const handleDeleteRequest = async (reqId: string) => {
    await deleteEquipmentRequest(reqId);
    toast.success(messages.deleted);
  };

  // ── Engineer approve/reject handlers ──
  const openEngineerApproveDialog = (reqId: string) => {
    setSelectedRequestId(reqId);
    setEngineerComment('');
    setApproveDialogOpen(true);
  };

  const handleEngineerApprove = async () => {
    await updateEquipmentRequest(selectedRequestId, {
      status: 'pending' as any, // now goes to admin
      engineerComment: engineerComment || undefined,
    });
    toast.success(messages.engineerApproved);
    setApproveDialogOpen(false);
  };

  const handleEngineerReject = async (reqId: string, comment?: string) => {
    await updateEquipmentRequest(reqId, {
      status: 'engineer_rejected' as any,
      engineerComment: comment || undefined,
    });
    toast.success(messages.engineerRejected);
  };

  // ── Admin approve/reject handlers ──
  const openAdminApproveDialog = (reqId: string) => {
    const req = equipmentRequests.find(r => r.id === reqId);
    setSelectedRequestId(reqId);
    setAssignForeman('');
    setAssignEquipmentId(req?.equipmentId || '');
    setAdminComment('');
    setNewEqForm({ name: req?.equipmentName || '', equipmentNo: '', model: '', location: '' });
    setApproveDialogOpen(true);
  };

  const selectedRequest = equipmentRequests.find(r => r.id === selectedRequestId);

  const handleAdminApproveRequest = async () => {
    if (!selectedRequest) return;
    
    if (selectedRequest.requestType === 'new') {
      if (!newEqForm.name.trim()) { toast.error(messages.fillComplete); return; }
      await dbAddEquipment({ name: newEqForm.name, equipmentNo: newEqForm.equipmentNo || undefined, model: newEqForm.model, status: 'available', location: newEqForm.location });
    } else if (selectedRequest.equipmentId) {
      // Auto-assign equipment to the requester
      if (selectedRequest.requesterRole === 'foreman') {
        // Assign directly to the requesting foreman
        await addEquipmentToTeam(selectedRequest.requesterId, selectedRequest.equipmentId);
      } else if (selectedRequest.requesterRole === 'engineer') {
        // Engineer requested: assign to the selected foreman if specified
        if (assignForeman && assignForeman !== 'none') {
          await addEquipmentToTeam(assignForeman, selectedRequest.equipmentId);
        }
      }
    }

    await updateEquipmentRequest(selectedRequestId, {
      status: 'approved',
      adminComment: adminComment || undefined,
      resolvedAt: new Date().toISOString(),
    });
    toast.success(messages.equipmentRequestApproved);
    setApproveDialogOpen(false);
  };

  const handleAdminRejectRequest = async (reqId: string) => {
    await updateEquipmentRequest(reqId, {
      status: 'rejected',
      resolvedAt: new Date().toISOString(),
    });
    toast.success(messages.equipmentRequestRejected);
  };

  // ── Computed ──
  const myRequests = useMemo(() =>
    equipmentRequests.filter(r => r.requesterId === currentPersonnelId),
    [equipmentRequests, currentPersonnelId]
  );

  // Requests needing engineer review (for current engineer)
  const engineerPendingRequests = useMemo(() => {
    if (currentRole !== 'engineer') return [];
    const assignment = engineerAssignments.find(a => a.engineerId === currentPersonnelId);
    if (!assignment) return [];
    return equipmentRequests.filter(r =>
      r.status === 'engineer_pending' &&
      r.requesterRole === 'foreman' &&
      assignment.foremanIds.includes(r.requesterId)
    );
  }, [currentRole, currentPersonnelId, engineerAssignments, equipmentRequests]);

  // All requests from managed foremen (for engineer to view history)
  const engineerAllRequests = useMemo(() => {
    if (currentRole !== 'engineer') return [];
    const assignment = engineerAssignments.find(a => a.engineerId === currentPersonnelId);
    if (!assignment) return [];
    return equipmentRequests.filter(r =>
      r.requesterRole === 'foreman' &&
      assignment.foremanIds.includes(r.requesterId)
    );
  }, [currentRole, currentPersonnelId, engineerAssignments, equipmentRequests]);

  // Admin pending: only 'pending' status (already passed engineer review or no engineer)
  const adminPendingRequests = useMemo(() =>
    equipmentRequests.filter(r => r.status === 'pending'),
    [equipmentRequests]
  );

  const requestStatusBadge = (status: string) => {
    switch (status) {
      case 'engineer_pending': return <Badge variant="outline" className="text-orange-600 border-orange-600"><Clock size={12} className="mr-1" />待工程师审批 Engineer Review</Badge>;
      case 'engineer_approved': return <Badge variant="outline" className="text-blue-600 border-blue-600"><CheckCircle size={12} className="mr-1" />工程师已通过 Engineer Approved</Badge>;
      case 'engineer_rejected': return <Badge variant="outline" className="text-red-500 border-red-500"><XCircle size={12} className="mr-1" />工程师已拒绝 Engineer Rejected</Badge>;
      case 'pending': return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock size={12} className="mr-1" />待管理审批 Admin Review</Badge>;
      case 'approved': return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle size={12} className="mr-1" />已批准 Approved</Badge>;
      case 'rejected': return <Badge variant="outline" className="text-red-600 border-red-600"><XCircle size={12} className="mr-1" />已拒绝 Rejected</Badge>;
      case 'withdrawn': return <Badge variant="outline" className="text-muted-foreground border-muted-foreground"><Undo2 size={12} className="mr-1" />已撤回 Withdrawn</Badge>;
      default: return null;
    }
  };

  const requestTypeBadge = (type: string) => {
    return type === 'new'
      ? <Badge variant="secondary"><PackagePlus size={12} className="mr-1" />新设备 New</Badge>
      : <Badge variant="outline"><Package size={12} className="mr-1" />已有设备 Existing</Badge>;
  };

  // ── Equipment card (shared) ──
  const renderEquipmentCard = (eq: Equipment) => {
    const fmId = getAssignedForeman(eq.id);
    const fmName = fmId ? personnel.find(p => p.id === fmId)?.name : null;
    const engName = getEngineerForEquipment(eq.id);
    return (
      <div key={eq.id} className="stat-card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">{eq.name}</h3>
          <span className={`status-badge ${eq.status === 'available' ? 'status-approved' : eq.status === 'in_use' ? 'status-pending' : eq.status === 'maintenance' ? 'status-leave' : 'status-resigned'}`}>{equipmentStatusLabels[eq.status]}</span>
        </div>
        <p className="text-sm text-muted-foreground mb-1">编号 No.：{eq.equipmentNo || '-'}</p>
        <p className="text-sm text-muted-foreground mb-1">型号 Model：{eq.model}</p>
        <p className="text-sm text-muted-foreground mb-1">位置 Location：{eq.location || fieldLabels.unassigned}</p>
        <p className="text-sm text-muted-foreground mb-1">班组 Team：{fmName || fieldLabels.unassigned}</p>
        {engName && <p className="text-sm text-muted-foreground mb-1">工程师 Engineer：{engName}</p>}
        <div className="mt-3 flex gap-2">
          {isAdmin ? (
            <>
              <Button variant="outline" size="sm" onClick={() => openEdit(eq)} className="gap-1"><Edit2 size={13} /> {actionLabels.edit}</Button>
              <Button variant="outline" size="sm" onClick={async () => {
                await dbDeleteEquipment(eq.id);
                toast.success(messages.deleted);
              }} className="gap-1 text-destructive hover:text-destructive"><Trash2 size={13} /> {actionLabels.delete}</Button>
            </>
          ) : (
            eq.status === 'available' && !myEquipmentIds.has(eq.id) && (
              <Button variant="outline" size="sm" onClick={() => openRequestDialog(eq)} className="gap-1">
                <Send size={13} /> {actionLabels.requestEquipment}
              </Button>
            )
          )}
        </div>
      </div>
    );
  };

  // ── Shared request dialog ──
  const renderRequestDialog = () => (
    <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editingRequestId ? '修改申请 Edit Request' : '申请设备 Request Equipment'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-3 block">申请类型 Request Type</Label>
            <RadioGroup value={requestType} onValueChange={v => { setRequestType(v as EquipmentRequestType); setRequestForm(f => ({ ...f, equipmentId: '', equipmentName: '' })); }} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="req-existing" />
                <Label htmlFor="req-existing" className="cursor-pointer">已有设备 Existing Equipment</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="req-new" />
                <Label htmlFor="req-new" className="cursor-pointer">新设备申请 New Equipment</Label>
              </div>
            </RadioGroup>
          </div>

          {requestType === 'existing' ? (
            <div>
              <Label>选择设备 Select Equipment</Label>
              <Select value={requestForm.equipmentId} onValueChange={v => {
                const eq = availableEquipment.find(e => e.id === v);
                setRequestForm(f => ({ ...f, equipmentId: v, equipmentName: eq?.name || '' }));
              }}>
                <SelectTrigger><SelectValue placeholder="请选择设备 Select equipment..." /></SelectTrigger>
                <SelectContent>
                  {requestableEquipment.map(eq => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.name} {eq.equipmentNo ? `(${eq.equipmentNo})` : ''} - {equipmentStatusLabels[eq.status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label>设备名称/描述 Equipment Name/Description</Label>
              <Input value={requestForm.equipmentName} onChange={e => setRequestForm(f => ({ ...f, equipmentName: e.target.value }))} placeholder="例如：挖掘机 CAT320 e.g. Excavator CAT320" />
            </div>
          )}

          <div>
            <Label>申请原因 Reason</Label>
            <Textarea value={requestForm.reason} onChange={e => setRequestForm(f => ({ ...f, reason: e.target.value }))} placeholder="请说明申请原因及用途 Please describe the reason and usage..." />
          </div>

          {/* Show flow info for foreman */}
          {currentRole === 'foreman' && !editingRequestId && (
            <div className="rounded-md border p-2 bg-muted/50 text-xs text-muted-foreground">
              {getEngineerForForeman(currentPersonnelId) ? (
                <span className="flex items-center gap-1">
                  <ArrowRight size={12} /> 审批流程：工程师审批 → 管理审批
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <ArrowRight size={12} /> 审批流程：直接提交管理审批
                </span>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>{actionLabels.cancel}</Button>
          <Button onClick={handleSubmitRequest}>{editingRequestId ? actionLabels.save : actionLabels.submit}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Engineer review dialog ──
  const renderEngineerReviewDialog = () => (
    <Dialog open={approveDialogOpen && currentRole === 'engineer'} onOpenChange={v => { if (!v) setApproveDialogOpen(false); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>审批设备申请 Review Equipment Request</DialogTitle></DialogHeader>
        {selectedRequest && (
          <div className="space-y-4 py-2">
            <div className="rounded-md border p-3 bg-muted/50 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{selectedRequest.equipmentName}</span>
                {requestTypeBadge(selectedRequest.requestType)}
              </div>
              <p className="text-sm text-muted-foreground">申请人：{selectedRequest.requesterName}（工长）</p>
              <p className="text-sm text-muted-foreground">原因：{selectedRequest.reason}</p>
            </div>
            <div>
              <Label>工程师意见 Engineer Comment</Label>
              <Textarea value={engineerComment} onChange={e => setEngineerComment(e.target.value)} placeholder="可选 Optional..." />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>{actionLabels.cancel}</Button>
          <Button variant="outline" onClick={async () => {
            await handleEngineerReject(selectedRequestId, engineerComment);
            setApproveDialogOpen(false);
          }} className="text-destructive hover:text-destructive gap-1">
            <XCircle size={14} /> 拒绝 Reject
          </Button>
          <Button onClick={handleEngineerApprove} className="gap-1">
            <CheckCircle size={14} /> 通过并提交管理 Approve & Forward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Admin approve dialog ──
  const renderAdminApproveDialog = () => (
    <Dialog open={approveDialogOpen && (isAdmin)} onOpenChange={v => { if (!v) setApproveDialogOpen(false); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>处理设备申请 Process Equipment Request</DialogTitle></DialogHeader>
        {selectedRequest && (
          <div className="space-y-4 py-2">
            <div className="rounded-md border p-3 bg-muted/50 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{selectedRequest.equipmentName}</span>
                {requestTypeBadge(selectedRequest.requestType)}
              </div>
              <p className="text-sm text-muted-foreground">申请人：{selectedRequest.requesterName}（{selectedRequest.requesterRole === 'foreman' ? '工长' : '工程师'}）</p>
              <p className="text-sm text-muted-foreground">原因：{selectedRequest.reason}</p>
              {selectedRequest.engineerComment && (
                <p className="text-sm text-blue-600">工程师意见：{selectedRequest.engineerComment}</p>
              )}
            </div>

            {selectedRequest.requestType === 'new' ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-primary">需要添加新设备后批准 Create new equipment to approve</p>
                <div><Label>{fieldLabels.equipmentName}</Label><Input value={newEqForm.name} onChange={e => setNewEqForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>{fieldLabels.equipmentNo}</Label><Input placeholder="e.g. EQ-2024-007" value={newEqForm.equipmentNo} onChange={e => setNewEqForm(f => ({ ...f, equipmentNo: e.target.value }))} /></div>
                <div><Label>{fieldLabels.model}</Label><Input value={newEqForm.model} onChange={e => setNewEqForm(f => ({ ...f, model: e.target.value }))} /></div>
                <div><Label>{fieldLabels.location}</Label><Input value={newEqForm.location} onChange={e => setNewEqForm(f => ({ ...f, location: e.target.value }))} /></div>
              </div>
            ) : selectedRequest.requesterRole === 'foreman' ? (
              <div className="rounded-md border p-3 bg-primary/5 text-sm">
                <p className="font-medium text-primary">✓ 批准后将自动分配给工长 {selectedRequest.requesterName}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {getEngineerForForeman(selectedRequest.requesterId)
                    ? `由工程师管理的工长 Managed by engineer`
                    : `无归属工程师，直接分配 No engineer, direct assignment`}
                </p>
              </div>
            ) : (
              <div>
                <Label>分配给工长 Assign to Foreman</Label>
                <Select value={assignForeman} onValueChange={setAssignForeman}>
                  <SelectTrigger><SelectValue placeholder={fieldLabels.unassigned} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{fieldLabels.unassigned}</SelectItem>
                    {foremen.map(fm => <SelectItem key={fm.id} value={fm.id}>{fm.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">工程师申请需指定分配工长 Engineer request requires foreman assignment</p>
              </div>
            )}

            <div>
              <Label>管理回复 Admin Comment</Label>
              <Textarea value={adminComment} onChange={e => setAdminComment(e.target.value)} placeholder="可选 Optional..." />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>{actionLabels.cancel}</Button>
          <Button onClick={handleAdminApproveRequest}>{actionLabels.approveRequest}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Request list card ──
  const isMyRequest = (req: EquipmentRequest) => req.requesterId === currentPersonnelId;

  // Determine if current user can withdraw/edit (pending states they own)
  const canForemanEdit = (req: EquipmentRequest) =>
    isMyRequest(req) && (req.status === 'pending' || req.status === 'engineer_pending');
  const canForemanRevise = (req: EquipmentRequest) =>
    isMyRequest(req) && (req.status === 'rejected' || req.status === 'withdrawn' || req.status === 'engineer_rejected');
  const canForemanDelete = (req: EquipmentRequest) =>
    isMyRequest(req) && req.status !== 'approved';

  const renderRequestCard = (req: EquipmentRequest, context: 'own' | 'engineer_review' | 'admin') => (
    <div key={req.id} className="stat-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold">{req.equipmentName}</span>
          {requestTypeBadge(req.requestType)}
          {requestStatusBadge(req.status)}
        </div>
        {context !== 'own' && <p className="text-sm text-muted-foreground">申请人 Requester：{req.requesterName}（{req.requesterRole === 'foreman' ? '工长' : '工程师'}）</p>}
        <p className="text-sm text-muted-foreground">原因 Reason：{req.reason}</p>
        <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleString()}</p>
        {req.engineerComment && <p className="text-sm mt-1 text-blue-600">工程师意见 Engineer：{req.engineerComment}</p>}
        {req.adminComment && <p className="text-sm mt-1">管理回复 Admin：{req.adminComment}</p>}
      </div>
      <div className="flex gap-2 shrink-0 flex-wrap">
        {/* Engineer review actions */}
        {context === 'engineer_review' && req.status === 'engineer_pending' && (
          <>
            <Button size="sm" onClick={() => openEngineerApproveDialog(req.id)} className="gap-1">
              <CheckCircle size={14} /> 审批 Review
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleEngineerReject(req.id)} className="gap-1 text-destructive hover:text-destructive">
              <XCircle size={14} /> 拒绝 Reject
            </Button>
          </>
        )}
        {/* Engineer can delete managed requests that are not approved */}
        {context === 'engineer_review' && req.status !== 'approved' && (
          <Button variant="outline" size="sm" onClick={() => handleDeleteRequest(req.id)} className="gap-1 text-destructive hover:text-destructive">
            <Trash2 size={13} /> {actionLabels.delete}
          </Button>
        )}

        {/* Admin actions */}
        {context === 'admin' && req.status === 'pending' && (
          <>
            <Button size="sm" onClick={() => openAdminApproveDialog(req.id)} className="gap-1">
              <CheckCircle size={14} /> {actionLabels.approveRequest}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAdminRejectRequest(req.id)} className="gap-1 text-destructive hover:text-destructive">
              <XCircle size={14} /> {actionLabels.rejectRequest}
            </Button>
          </>
        )}
        {context === 'admin' && (
          <Button variant="outline" size="sm" onClick={() => handleDeleteRequest(req.id)} className="gap-1 text-destructive hover:text-destructive">
            <Trash2 size={13} /> {actionLabels.delete}
          </Button>
        )}

        {/* Own request actions */}
        {context === 'own' && canForemanEdit(req) && (
          <>
            <Button variant="outline" size="sm" onClick={() => openEditRequest(req)} className="gap-1">
              <Edit2 size={13} /> {actionLabels.edit}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleWithdrawRequest(req.id)} className="gap-1">
              <Undo2 size={13} /> 撤回 Withdraw
            </Button>
          </>
        )}
        {context === 'own' && canForemanRevise(req) && (
          <Button variant="outline" size="sm" onClick={() => openEditRequest(req)} className="gap-1">
            <Edit2 size={13} /> 修改重提 Revise
          </Button>
        )}
        {context === 'own' && canForemanDelete(req) && (
          <Button variant="outline" size="sm" onClick={() => handleDeleteRequest(req.id)} className="gap-1 text-destructive hover:text-destructive">
            <Trash2 size={13} /> {actionLabels.delete}
          </Button>
        )}
      </div>
    </div>
  );

  // ── Admin view ──
  if (isAdmin) {
    return (
      <div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
        <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="page-title">{pageTitles.equipment.title}</h1>
            <p className="page-subtitle">{pageTitles.equipment.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2"><Upload size={16} /> {actionLabels.import}</Button>
            <Button variant="outline" size="sm" onClick={() => exportEquipment(equipment)} className="gap-2"><Download size={16} /> {actionLabels.export}</Button>
            <Button size="sm" onClick={openCreate} className="gap-2"><Plus size={16} /> {actionLabels.add}</Button>
          </div>
        </div>

        <Tabs defaultValue="list" className="mb-6">
          <TabsList>
            <TabsTrigger value="list">设备列表 Equipment List</TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              设备申请 Requests
              {adminPendingRequests.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-destructive text-destructive-foreground">
                  {adminPendingRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="list">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipment.map(renderEquipmentCard)}
            </div>
          </TabsContent>
          <TabsContent value="requests">
            {equipmentRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{messages.noEquipmentRequests}</p>
            ) : (
              <div className="space-y-3">
                {equipmentRequests.map(req => renderRequestCard(req, 'admin'))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Admin edit/create dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? '编辑设备 Edit Equipment' : '添加设备 Add Equipment'}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label>{fieldLabels.equipmentNo}</Label><Input placeholder="e.g. EQ-2024-007" value={form.equipmentNo} onChange={e => setForm(f => ({ ...f, equipmentNo: e.target.value }))} /></div>
              <div><Label>{fieldLabels.equipmentName}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>{fieldLabels.model}</Label><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
              <div><Label>{fieldLabels.location}</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
              <div>
                <Label>{fieldLabels.status}</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as EquipmentStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">{equipmentStatusLabels.available}</SelectItem>
                    <SelectItem value="in_use">{equipmentStatusLabels.in_use}</SelectItem>
                    <SelectItem value="maintenance">{equipmentStatusLabels.maintenance}</SelectItem>
                    <SelectItem value="retired">{equipmentStatusLabels.retired}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{fieldLabels.assignedTeam}</Label>
                <Select value={form.assignedForeman} onValueChange={v => setForm(f => ({ ...f, assignedForeman: v }))}>
                  <SelectTrigger><SelectValue placeholder={fieldLabels.unassigned} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{fieldLabels.unassigned}</SelectItem>
                    {foremen.map(fm => <SelectItem key={fm.id} value={fm.id}>{fm.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{actionLabels.cancel}</Button>
              <Button onClick={handleSave}>{editing ? actionLabels.save : actionLabels.add}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {renderAdminApproveDialog()}
      </div>
    );
  }

  // ── Engineer view ──
  if (currentRole === 'engineer') {
    return (
      <div>
        <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="page-title">{pageTitles.equipment.title}</h1>
            <p className="page-subtitle">查看设备情况，审批工长申请，提交自己的申请 View equipment, review foreman requests, submit own requests</p>
          </div>
          <Button size="sm" onClick={() => openRequestDialog()} className="gap-2">
            <Send size={16} /> {actionLabels.requestEquipment}
          </Button>
        </div>

        <Tabs defaultValue="list" className="mb-6">
          <TabsList>
            <TabsTrigger value="list">设备列表 Equipment List</TabsTrigger>
            <TabsTrigger value="review" className="relative">
              工长申请审批 Foreman Requests
              {engineerPendingRequests.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-destructive text-destructive-foreground">
                  {engineerPendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="myRequests">我的申请 My Requests ({myRequests.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="list">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipment.map(renderEquipmentCard)}
            </div>
          </TabsContent>
          <TabsContent value="review">
            {engineerAllRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{messages.noEquipmentRequests}</p>
            ) : (
              <div className="space-y-3">
                {engineerAllRequests.map(req => renderRequestCard(req, 'engineer_review'))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="myRequests">
            {myRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{messages.noEquipmentRequests}</p>
            ) : (
              <div className="space-y-3">
                {myRequests.map(req => renderRequestCard(req, 'own'))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {renderRequestDialog()}
        {renderEngineerReviewDialog()}
      </div>
    );
  }

  // ── Foreman view ──
  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{pageTitles.equipment.title}</h1>
          <p className="page-subtitle">查看设备情况并申请分配 View equipment and request allocation</p>
        </div>
        <Button size="sm" onClick={() => openRequestDialog()} className="gap-2">
          <Send size={16} /> {actionLabels.requestEquipment}
        </Button>
      </div>

      <Tabs defaultValue="list" className="mb-6">
        <TabsList>
          <TabsTrigger value="list">设备列表 Equipment List</TabsTrigger>
          <TabsTrigger value="myRequests">我的申请 My Requests ({myRequests.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipment.map(renderEquipmentCard)}
          </div>
        </TabsContent>
        <TabsContent value="myRequests">
          {myRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{messages.noEquipmentRequests}</p>
          ) : (
            <div className="space-y-3">
              {myRequests.map(req => renderRequestCard(req, 'own'))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {renderRequestDialog()}
    </div>
  );
}
