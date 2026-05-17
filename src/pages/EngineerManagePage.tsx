import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useDataContext } from '@/contexts/DataContext';
import { Personnel, Equipment, PersonnelStatus, EquipmentStatus } from '@/lib/types';
import { Users, Wrench, Edit2, Plus, Trash2, UserCheck, Clock, UserX, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { personnelStatusLabels, equipmentStatusLabels, pageTitles, fieldLabels, actionLabels, messages } from '@/lib/i18n';

const statusIcons: Record<PersonnelStatus, React.ReactNode> = {
  active: <UserCheck size={14} className="text-emerald-600" />,
  leave: <Clock size={14} className="text-amber-500" />,
  resigned: <UserX size={14} className="text-destructive" />,
};

export default function EngineerManagePage() {
  const { currentPersonnelId } = useAppContext();
  const { personnel, equipment, teamAssignments, getEngineerForemen, updatePersonnel, addPersonnel, deletePersonnel: dbDeletePersonnel, addEquipment: dbAddEquipment, updateEquipment: dbUpdateEquipment, deleteEquipment: dbDeleteEquipment, updateTeamAssignment, setTeamAssignmentsBatch } = useDataContext();
  
  const engineerId = currentPersonnelId;
  const managedForemanIds = getEngineerForemen(engineerId);
  const foremen = personnel.filter(p => managedForemanIds.includes(p.id));

  // ─── Foreman dialog ───
  const [fmDialogOpen, setFmDialogOpen] = useState(false);
  const [editingFm, setEditingFm] = useState<Personnel | null>(null);
  const [fmForm, setFmForm] = useState({ name: '', laborId: '', phone: '', status: 'active' as PersonnelStatus });

  const openCreateForeman = () => {
    setEditingFm(null);
    setFmForm({ name: '', laborId: '', phone: '', status: 'active' });
    setFmDialogOpen(true);
  };
  const openEditForeman = (fm: Personnel) => {
    setEditingFm(fm);
    setFmForm({ name: fm.name, laborId: fm.laborId || '', phone: fm.phone, status: fm.status });
    setFmDialogOpen(true);
  };
  const saveForeman = async () => {
    if (editingFm) {
      await updatePersonnel(editingFm.id, { status: fmForm.status });
      toast.success('工长状态已更新 Foreman status updated');
    }
    setFmDialogOpen(false);
  };
  const deleteForeman = async (id: string) => {
    await dbDeletePersonnel(id);
    toast.success('工长已删除 Foreman deleted');
  };

  // ─── Equipment dialog ───
  const [eqDialogOpen, setEqDialogOpen] = useState(false);
  const [editingEq, setEditingEq] = useState<Equipment | null>(null);
  const [eqForm, setEqForm] = useState({ name: '', equipmentNo: '', model: '', status: 'available' as EquipmentStatus, location: '' });

  const openCreateEq = () => {
    setEditingEq(null);
    setEqForm({ name: '', equipmentNo: '', model: '', status: 'available', location: '' });
    setEqDialogOpen(true);
  };
  const openEditEq = (eq: Equipment) => {
    setEditingEq(eq);
    setEqForm({ name: eq.name, equipmentNo: eq.equipmentNo || '', model: eq.model, status: eq.status, location: eq.location || '' });
    setEqDialogOpen(true);
  };
  const saveEq = async () => {
    if (editingEq) {
      // Engineer can only update status and location
      await dbUpdateEquipment(editingEq.id, { status: eqForm.status, location: eqForm.location });
      toast.success('设备状态已更新 Equipment status updated');
    }
    setEqDialogOpen(false);
  };
  const deleteEq = async (id: string) => {
    await dbDeleteEquipment(id);
    toast.success('设备已删除 Equipment deleted');
  };

  // ─── Equipment assignment ───
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningEqId, setAssigningEqId] = useState('');
  const [assignToForemanId, setAssignToForemanId] = useState('');

  const openAssignDialog = (eqId: string) => {
    setAssigningEqId(eqId);
    const currentAssignment = teamAssignments.find(a => a.equipmentIds.includes(eqId));
    setAssignToForemanId(currentAssignment?.foremanId || 'unassigned');
    setAssignDialogOpen(true);
  };

  const saveAssignment = async () => {
    // Remove equipment from managed foremen, then assign to target
    let updated = teamAssignments.map(a => {
      if (!managedForemanIds.includes(a.foremanId)) return a;
      return { ...a, equipmentIds: a.equipmentIds.filter(id => id !== assigningEqId) };
    });
    if (assignToForemanId && assignToForemanId !== 'unassigned') {
      updated = updated.map(a =>
        a.foremanId === assignToForemanId ? { ...a, equipmentIds: [...a.equipmentIds.filter(id => id !== assigningEqId), assigningEqId] } : a
      );
      const fmName = personnel.find(p => p.id === assignToForemanId)?.name;
      await setTeamAssignmentsBatch(updated);
      toast.success(`设备已分配给 Assigned to ${fmName}`);
    } else {
      await setTeamAssignmentsBatch(updated);
      toast.success('设备分配已取消 Equipment unassigned');
    }
    setAssignDialogOpen(false);
  };

  const managedEquipmentIds = useMemo(() => {
    const ids = new Set<string>();
    managedForemanIds.forEach(fid => {
      const a = teamAssignments.find(t => t.foremanId === fid);
      a?.equipmentIds.forEach(eid => ids.add(eid));
    });
    return ids;
  }, [teamAssignments, managedForemanIds]);

  const managedEquipment = useMemo(() => {
    return equipment.filter(eq => managedEquipmentIds.has(eq.id));
  }, [equipment, managedEquipmentIds]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{pageTitles.engineerManage.title}</h1>
        <p className="page-subtitle">{pageTitles.engineerManage.subtitle}</p>
      </div>

      {/* Warning: foremen on leave/resigned with workers */}
      {(() => {
        const warnForemen = foremen.filter(fm => {
          if (fm.status !== 'leave' && fm.status !== 'resigned') return false;
          const ta = teamAssignments.find(t => t.foremanId === fm.id);
          return ta && ta.workerIds.length > 0;
        });
        if (warnForemen.length === 0) return null;
        return (
          <div className="mb-6 space-y-2">
            {warnForemen.map(fm => {
              const ta = teamAssignments.find(t => t.foremanId === fm.id);
              return (
                <div key={fm.id} className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-destructive">
                      工长 Foreman：{fm.laborId && <span className="font-mono text-xs mr-1">{fm.laborId}</span>}{fm.name}
                    </p>
                    <p className="text-muted-foreground">
                      {fm.status === 'leave' ? '休假 On Leave' : '离职 Resigned'} — {ta?.workerIds.length || 0} 名工人需要重新分配 worker(s) need reassignment
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Foremen */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-primary" />
            <h2 className="text-lg font-semibold">工长管理 Foreman Management</h2>
            <span className="text-sm text-muted-foreground">({foremen.length})</span>
          </div>
          
        </div>

        <div className="space-y-4">
          {foremen.map(fm => {
            const assignment = teamAssignments.find(a => a.foremanId === fm.id);
            const workers = assignment ? personnel.filter(p => assignment.workerIds.includes(p.id)) : [];
            const eqs = assignment ? equipment.filter(e => assignment.equipmentIds.includes(e.id)) : [];

            return (
              <div key={fm.id} className="bg-card rounded-lg border shadow-sm overflow-hidden">
                <div className="px-4 md:px-5 py-3 bg-muted/50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold">
                      {fm.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{fm.name}</p>
                        <span className="font-mono text-xs text-muted-foreground">{fm.laborId || '-'}</span>
                        <div className="flex items-center gap-1">
                          {statusIcons[fm.status]}
                          <span className="text-xs text-muted-foreground">{personnelStatusLabels[fm.status]}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{fm.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{workers.length} 工人 Workers · {eqs.length} 设备 Equipment</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEditForeman(fm)}><Edit2 size={14} /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => deleteForeman(fm.id)}><Trash2 size={14} className="text-destructive" /></Button>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">班组工人 Team Workers</h4>
                    {workers.length > 0 ? (
                      <div className="space-y-1.5">
                        {workers.map(w => (
                          <div key={w.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/30 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">{w.laborId || '-'}</span>
                              <span className="font-medium">{w.name}</span>
                              <span className="text-muted-foreground text-xs">({w.specialty || '未指定 N/A'})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {statusIcons[w.status]}
                              <span className="text-xs">{personnelStatusLabels[w.status]}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{messages.noWorkers}</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">班组设备 Team Equipment</h4>
                    {eqs.length > 0 ? (
                      <div className="space-y-1.5">
                        {eqs.map(eq => (
                          <div key={eq.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/30 text-sm">
                            <div>
                              <span className="font-mono text-xs text-muted-foreground mr-2">{eq.equipmentNo || '-'}</span>
                              <span className="font-medium">{eq.name}</span>
                              <span className="text-muted-foreground text-xs ml-2">({eq.model})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                eq.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                                eq.status === 'in_use' ? 'bg-amber-100 text-amber-700' :
                                eq.status === 'maintenance' ? 'bg-muted text-muted-foreground' :
                                'bg-destructive/10 text-destructive'
                              }`}>
                                {equipmentStatusLabels[eq.status]}
                              </span>
                              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-1.5" onClick={() => openAssignDialog(eq.id)}>
                                <ArrowRight size={12} /> 调配 Reassign
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{messages.noEquipment}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Managed Equipment */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-primary" />
            <h2 className="text-lg font-semibold">管辖设备 Managed Equipment</h2>
            <span className="text-sm text-muted-foreground">({managedEquipment.length})</span>
          </div>
          <span className="text-xs text-muted-foreground">仅显示您管辖的设备 Only equipment under your management</span>
        </div>

        <div className="bg-card rounded-lg border shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.equipmentNo}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.equipmentName}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.model}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.status}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.location}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.assignedTeam}</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">{fieldLabels.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {managedEquipment.map(eq => {
                const assignedTo = teamAssignments.find(a => a.equipmentIds.includes(eq.id));
                const foremanName = assignedTo ? personnel.find(p => p.id === assignedTo.foremanId)?.name : null;
                return (
                  <tr key={eq.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{eq.equipmentNo || '-'}</td>
                    <td className="px-4 py-3 font-medium">{eq.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{eq.model}</td>
                    <td className="px-4 py-3">
                      <Select value={eq.status} onValueChange={async (v) => {
                        await dbUpdateEquipment(eq.id, { status: v as EquipmentStatus });
                        toast.success(`设备状态已更新 Equipment status updated`);
                      }}>
                        <SelectTrigger className="h-7 w-[130px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">{equipmentStatusLabels.available}</SelectItem>
                          <SelectItem value="in_use">{equipmentStatusLabels.in_use}</SelectItem>
                          <SelectItem value="maintenance">{equipmentStatusLabels.maintenance}</SelectItem>
                          <SelectItem value="retired">{equipmentStatusLabels.retired}</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{eq.location || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{foremanName || fieldLabels.unassigned}</span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-1.5" onClick={() => openAssignDialog(eq.id)}>
                          <ArrowRight size={12} /> 调配 Reassign
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openEditEq(eq)}>
                        <Edit2 size={12} /> {actionLabels.edit}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {managedEquipment.length === 0 && (
            <div className="px-4 py-12 text-center text-muted-foreground">
              暂无管辖设备 No managed equipment
            </div>
          )}
        </div>
      </div>

      {/* Foreman Dialog */}
      <Dialog open={fmDialogOpen} onOpenChange={setFmDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingFm ? '修改工长状态 Edit Foreman Status' : '添加工长 Add Foreman'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {editingFm ? (
              <>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  <div><span className="text-muted-foreground">{fieldLabels.laborId}：</span><span className="font-medium">{editingFm.laborId || '-'}</span></div>
                  <div><span className="text-muted-foreground">{fieldLabels.name}：</span><span className="font-medium">{editingFm.name}</span></div>
                  <div><span className="text-muted-foreground">{fieldLabels.phone}：</span><span className="font-medium">{editingFm.phone}</span></div>
                </div>
                <div>
                  <Label>{fieldLabels.status}</Label>
                  <Select value={fmForm.status} onValueChange={v => setFmForm(f => ({ ...f, status: v as PersonnelStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{personnelStatusLabels.active}</SelectItem>
                      <SelectItem value="leave">{personnelStatusLabels.leave}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div><Label>{fieldLabels.laborId}</Label><Input placeholder="以LQ开头 e.g. LQ-2024-003" value={fmForm.laborId} onChange={e => setFmForm(f => ({ ...f, laborId: e.target.value }))} /></div>
                <div><Label>{fieldLabels.name}</Label><Input value={fmForm.name} onChange={e => setFmForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>{fieldLabels.phone}</Label><Input value={fmForm.phone} onChange={e => setFmForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div>
                  <Label>{fieldLabels.status}</Label>
                  <Select value={fmForm.status} onValueChange={v => setFmForm(f => ({ ...f, status: v as PersonnelStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{personnelStatusLabels.active}</SelectItem>
                      <SelectItem value="leave">{personnelStatusLabels.leave}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFmDialogOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={saveForeman}>{editingFm ? actionLabels.save : actionLabels.add}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Equipment Dialog - Engineer can only edit status & location */}
      <Dialog open={eqDialogOpen} onOpenChange={setEqDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>修改设备状态 Update Equipment Status</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>{fieldLabels.equipmentNo}</Label><Input value={eqForm.equipmentNo} disabled className="opacity-60" /></div>
            <div><Label>{fieldLabels.equipmentName}</Label><Input value={eqForm.name} disabled className="opacity-60" /></div>
            <div><Label>{fieldLabels.model}</Label><Input value={eqForm.model} disabled className="opacity-60" /></div>
            <div><Label>{fieldLabels.location}</Label><Input value={eqForm.location} onChange={e => setEqForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div>
              <Label>{fieldLabels.status}</Label>
              <Select value={eqForm.status} onValueChange={v => setEqForm(f => ({ ...f, status: v as EquipmentStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">{equipmentStatusLabels.available}</SelectItem>
                  <SelectItem value="in_use">{equipmentStatusLabels.in_use}</SelectItem>
                  <SelectItem value="maintenance">{equipmentStatusLabels.maintenance}</SelectItem>
                  <SelectItem value="retired">{equipmentStatusLabels.retired}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEqDialogOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={saveEq}>{actionLabels.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Equipment Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>分配设备到班组 Assign Equipment to Team</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{fieldLabels.equipmentName}</Label>
              <p className="text-sm font-medium mt-1">{equipment.find(e => e.id === assigningEqId)?.name || '-'}</p>
            </div>
            <div>
              <Label>分配给工长 Assign to Foreman</Label>
              <Select value={assignToForemanId} onValueChange={setAssignToForemanId}>
                <SelectTrigger><SelectValue placeholder="选择工长 Select foreman" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">不分配 Unassigned</SelectItem>
                  {foremen.map(fm => (
                    <SelectItem key={fm.id} value={fm.id}>{fm.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={saveAssignment}>{actionLabels.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}