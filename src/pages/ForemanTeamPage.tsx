import { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useDataContext } from '@/contexts/DataContext';
import { Personnel, Equipment, PersonnelStatus, EquipmentStatus } from '@/lib/types';
import { Users, Wrench, Plus, Trash2, Edit2, UserCheck, UserX, Clock } from 'lucide-react';
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

export default function ForemanTeamPage() {
  const { currentRole, currentPersonnelId } = useAppContext();
  const {
    teamAssignments, personnel, equipment, engineerAssignments,
    updatePersonnel, updateEquipment,
    addWorkerToTeam, removeWorkerFromTeam, addEquipmentToTeam, removeEquipmentFromTeam,
    getTeamWorkers, getTeamEquipment, getAvailableWorkers, getAvailableEquipment,
  } = useDataContext();

  const foremanId = currentPersonnelId;

  // Find engineer managing this foreman
  const myEngineer = (() => {
    const ea = engineerAssignments.find(a => a.foremanIds.includes(foremanId));
    if (!ea) return null;
    return personnel.find(p => p.id === ea.engineerId)?.name || null;
  })();
  const teamWorkers = getTeamWorkers(foremanId);
  const teamEquip = getTeamEquipment(foremanId);
  const availableWorkers = getAvailableWorkers(foremanId);
  const availableEquipment = getAvailableEquipment(foremanId);

  const [addWorkerOpen, setAddWorkerOpen] = useState(false);
  const [addEquipOpen, setAddEquipOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedEquipId, setSelectedEquipId] = useState('');

  const [editWorkerOpen, setEditWorkerOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Personnel | null>(null);
  const [workerForm, setWorkerForm] = useState({ name: '', phone: '', specialty: '', status: 'active' as PersonnelStatus });

  const openEditWorker = (w: Personnel) => {
    setEditingWorker(w);
    setWorkerForm({ name: w.name, phone: w.phone, specialty: w.specialty || '', status: w.status });
    setEditWorkerOpen(true);
  };
  const saveWorker = async () => {
    if (!workerForm.name.trim()) { toast.error(messages.fillComplete); return; }
    if (editingWorker) {
      await updatePersonnel(editingWorker.id, workerForm);
      toast.success('工人信息已更新 Worker info updated');
    }
    setEditWorkerOpen(false);
  };

  const [editEqOpen, setEditEqOpen] = useState(false);
  const [editingEq, setEditingEq] = useState<Equipment | null>(null);
  const [eqForm, setEqForm] = useState({ name: '', equipmentNo: '', model: '', status: 'available' as EquipmentStatus, location: '' });

  const openEditEq = (eq: Equipment) => {
    setEditingEq(eq);
    setEqForm({ name: eq.name, equipmentNo: eq.equipmentNo || '', model: eq.model, status: eq.status, location: eq.location || '' });
    setEditEqOpen(true);
  };
  const saveEq = async () => {
    if (editingEq) {
      // Foreman can only update status and location
      await updateEquipment(editingEq.id, { status: eqForm.status, location: eqForm.location });
      toast.success('设备状态已更新 Equipment status updated');
    }
    setEditEqOpen(false);
  };

  const handleAddWorker = async () => {
    if (!selectedWorkerId) return;
    await addWorkerToTeam(foremanId, selectedWorkerId);
    toast.success('工人已加入班组 Worker added to team');
    setSelectedWorkerId('');
    setAddWorkerOpen(false);
  };

  const handleRemoveWorker = async (workerId: string) => {
    await removeWorkerFromTeam(foremanId, workerId);
    toast.success('工人已移出班组 Worker removed from team');
  };

  const handleUpdateWorkerStatus = async (workerId: string, status: PersonnelStatus) => {
    await updatePersonnel(workerId, { status });
    toast.success('状态已更新 Status updated');
  };

  const handleAddEquip = async () => {
    if (!selectedEquipId) return;
    await addEquipmentToTeam(foremanId, selectedEquipId);
    toast.success('设备已分配到班组 Equipment assigned to team');
    setSelectedEquipId('');
    setAddEquipOpen(false);
  };

  const handleRemoveEquip = async (equipId: string) => {
    await removeEquipmentFromTeam(foremanId, equipId);
    toast.success('设备已移出班组 Equipment removed from team');
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{pageTitles.team.title}</h1>
        <p className="page-subtitle">{pageTitles.team.subtitle}</p>
      </div>

      {/* Workers Section */}
      <div className="mb-8">
        <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-primary" />
            <h2 className="text-lg font-semibold">班组工人 Team Workers</h2>
            <span className="text-sm text-muted-foreground">({teamWorkers.length})</span>
          </div>
          <span className="text-xs text-muted-foreground">工人分配由管理员管理 Worker assignment managed by admin</span>
        </div>

        <div className="bg-card rounded-lg border shadow-sm overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.laborId}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.name}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.specialty}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.phone}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.status}</th>
                <th className="sticky right-0 bg-muted/50 text-right px-4 py-3 font-medium text-muted-foreground shadow-[-8px_0_12px_-12px_hsl(var(--foreground))]">{fieldLabels.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {teamWorkers.map(w => (
                <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm font-semibold">{w.laborId || '-'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.specialty || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{w.phone}</td>
                  <td className="px-4 py-3">
                    <Select value={w.status} onValueChange={(v) => handleUpdateWorkerStatus(w.id, v as PersonnelStatus)}>
                      <SelectTrigger className="h-8 w-full min-w-[140px] text-xs">
                        <div className="flex items-center gap-1.5">
                          {statusIcons[w.status]}
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{personnelStatusLabels.active}</SelectItem>
                        <SelectItem value="leave">{personnelStatusLabels.leave}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="sticky right-0 bg-card px-4 py-3 text-right shadow-[-8px_0_12px_-12px_hsl(var(--foreground))]">
                    <Button variant="ghost" size="icon" onClick={() => openEditWorker(w)} title={actionLabels.edit}>
                      <Edit2 size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveWorker(w.id)} title="移出班组 Remove from team">
                      <Trash2 size={15} className="text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {teamWorkers.length === 0 && (
            <div className="px-4 py-12 text-center text-muted-foreground">
              {messages.noWorkers}，工人分配由管理员管理 Worker assignment managed by admin
            </div>
          )}
        </div>
      </div>

      {/* Equipment Section */}
      <div>
        <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-primary" />
            <h2 className="text-lg font-semibold">班组设备 Team Equipment</h2>
            <span className="text-sm text-muted-foreground">({teamEquip.length})</span>
          </div>
          <span className="text-xs text-muted-foreground">设备分配由管理员管理 Equipment assignment managed by admin</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamEquip.map(eq => (
            <div key={eq.id} className="bg-card rounded-lg border shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{eq.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  eq.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                  eq.status === 'in_use' ? 'bg-amber-100 text-amber-700' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {equipmentStatusLabels[eq.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-1">{fieldLabels.equipmentNo}：{eq.equipmentNo || '-'}</p>
              <p className="text-xs text-muted-foreground mb-1">{fieldLabels.model}：{eq.model}</p>
              <p className="text-xs text-muted-foreground mb-1">{fieldLabels.location}：{eq.location || fieldLabels.unassigned}</p>
              {myEngineer && <p className="text-xs text-muted-foreground mb-1">工程师 Engineer：{myEngineer}</p>}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditEq(eq)} className="gap-1 flex-1">
                  <Edit2 size={13} /> 编辑信息 Edit Info
                </Button>
              </div>
            </div>
          ))}
        </div>
        {teamEquip.length === 0 && (
          <div className="bg-card rounded-lg border shadow-sm px-4 py-12 text-center text-muted-foreground">
            {messages.noEquipment}，设备分配由管理员管理 Equipment assignment managed by admin
          </div>
        )}
      </div>

      {/* Add Worker Dialog */}
      <Dialog open={addWorkerOpen} onOpenChange={setAddWorkerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加工人到班组 Add Worker to Team</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">从管理员已录入的工人中选择 Select from registered workers</p>
          {availableWorkers.length > 0 ? (
            <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
              <SelectTrigger><SelectValue placeholder="请选择工人 Select Worker" /></SelectTrigger>
              <SelectContent>
                {availableWorkers.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name} - {w.specialty || '未指定工种 N/A'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">暂无可添加的工人 No available workers</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddWorkerOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={handleAddWorker} disabled={!selectedWorkerId}>{actionLabels.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Equipment Dialog */}
      <Dialog open={addEquipOpen} onOpenChange={setAddEquipOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>分配设备到班组 Assign Equipment to Team</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">从管理员已录入的设备中选择 Select from registered equipment</p>
          {availableEquipment.length > 0 ? (
            <Select value={selectedEquipId} onValueChange={setSelectedEquipId}>
              <SelectTrigger><SelectValue placeholder="请选择设备 Select Equipment" /></SelectTrigger>
              <SelectContent>
                {availableEquipment.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name} ({e.model})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">暂无可分配的设备 No available equipment</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEquipOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={handleAddEquip} disabled={!selectedEquipId}>{actionLabels.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Worker Dialog */}
      <Dialog open={editWorkerOpen} onOpenChange={setEditWorkerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑工人信息 Edit Worker Info</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>{fieldLabels.name}</Label><Input value={workerForm.name} onChange={e => setWorkerForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{fieldLabels.phone}</Label><Input value={workerForm.phone} onChange={e => setWorkerForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>{fieldLabels.specialty}</Label><Input value={workerForm.specialty} onChange={e => setWorkerForm(f => ({ ...f, specialty: e.target.value }))} /></div>
            <div>
              <Label>{fieldLabels.status}</Label>
              <Select value={workerForm.status} onValueChange={v => setWorkerForm(f => ({ ...f, status: v as PersonnelStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{personnelStatusLabels.active}</SelectItem>
                  <SelectItem value="leave">{personnelStatusLabels.leave}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWorkerOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={saveWorker}>{actionLabels.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Equipment Dialog */}
      <Dialog open={editEqOpen} onOpenChange={setEditEqOpen}>
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
            <Button variant="outline" onClick={() => setEditEqOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={saveEq}>{actionLabels.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
