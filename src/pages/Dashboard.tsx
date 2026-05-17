import { useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useDataContext } from '@/contexts/DataContext';
import { Users, Wrench, ClipboardList, CheckSquare, Clock, FileCheck, FileX, UserCog, AlertTriangle, Package, Send } from 'lucide-react';
import { pageTitles, dashboardLabels, logStatusLabels, messages } from '@/lib/i18n';

const StatCard = ({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string }) => (
  <div className="stat-card">
    <div className="flex items-center justify-between mb-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color || 'bg-primary/10 text-primary'}`}>
        {icon}
      </div>
    </div>
    <p className="text-2xl font-bold">{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </div>
);

export default function Dashboard() {
  const { currentRole, currentPersonnelId } = useAppContext();
  const { personnel, equipment, teamAssignments, engineerAssignments, dailyLogs, equipmentRequests, getEngineerForemen } = useDataContext();

  const stats = useMemo(() => {
    const activeLogs = dailyLogs.filter(l => !l.deletedAt);
    if (currentRole === 'foreman') {
      const foremanId = currentPersonnelId;
      const assignment = teamAssignments.find(a => a.foremanId === foremanId);
      const workerIds = assignment?.workerIds || [];
      const equipmentIds = assignment?.equipmentIds || [];
      const workers = personnel.filter(p => workerIds.includes(p.id));
      const activeWorkers = workers.filter(w => w.status === 'active').length;
      const eqList = equipment.filter(e => equipmentIds.includes(e.id));
      const inUseEq = eqList.filter(e => e.status === 'in_use').length;
      const myLogs = activeLogs.filter(l => l.foremanId === foremanId);
      const totalHours = myLogs.reduce((s, l) => s + l.entries.reduce((ss, e) => ss + e.hours, 0), 0);
      const pending = myLogs.filter(l => l.status === 'pending' || l.status === 'withdraw_requested').length;
      const approved = myLogs.filter(l => l.status === 'approved' || l.status === 'conditional').length;
      const rejected = myLogs.filter(l => l.status === 'rejected').length;
      return { activeWorkers, totalWorkers: workers.length, inUseEq, totalEq: eqList.length, totalHours, pending, approved, rejected };
    }

    if (currentRole === 'engineer') {
      const engineerId = currentPersonnelId;
      const foremanIds = getEngineerForemen(engineerId);
      const foremen = personnel.filter(p => foremanIds.includes(p.id));
      const allWorkerIds = new Set<string>();
      foremanIds.forEach(fid => {
        const a = teamAssignments.find(t => t.foremanId === fid);
        a?.workerIds.forEach(wid => allWorkerIds.add(wid));
      });
      const totalWorkers = allWorkerIds.size;
      const managedLogs = activeLogs.filter(l => foremanIds.includes(l.foremanId));
      const pending = managedLogs.filter(l => l.status === 'pending' || l.status === 'withdraw_requested').length;
      const approved = managedLogs.filter(l => l.status === 'approved' || l.status === 'conditional').length;
      return { foremanCount: foremen.length, totalWorkers, pending, approved };
    }

    const workers = personnel.filter(p => p.role === 'worker');
    const activeWorkers = workers.filter(w => w.status === 'active').length;
    const pendingLogs = activeLogs.filter(l => l.status === 'pending' || l.status === 'withdraw_requested').length;
    const todayDate = new Date().toISOString().split('T')[0];
    const totalHoursToday = activeLogs.filter(l => l.date === todayDate).reduce((sum, log) => sum + log.entries.reduce((s, e) => s + e.hours, 0), 0);
    return { activeWorkers, totalWorkers: workers.length, inUseEq: equipment.filter(e => e.status === 'in_use').length, totalEq: equipment.length, totalHoursToday, pendingLogs };
  }, [currentRole, currentPersonnelId, personnel, equipment, teamAssignments, dailyLogs, getEngineerForemen]);

  const myLogs = useMemo(() => {
    const active = dailyLogs.filter(l => !l.deletedAt);
    if (currentRole === 'foreman') return active.filter(l => l.foremanId === currentPersonnelId);
    if (currentRole === 'engineer') {
      const foremanIds = getEngineerForemen(currentPersonnelId);
      return active.filter(l => foremanIds.includes(l.foremanId));
    }
    return active;
  }, [currentRole, currentPersonnelId, dailyLogs, getEngineerForemen]);

  const myRequests = useMemo(() => {
    if (currentRole === 'foreman') return equipmentRequests.filter(r => r.requesterId === currentPersonnelId);
    if (currentRole === 'engineer') {
      const foremanIds = getEngineerForemen(currentPersonnelId);
      return equipmentRequests.filter(r => r.requesterId === currentPersonnelId || foremanIds.includes(r.requesterId));
    }
    return equipmentRequests;
  }, [currentRole, currentPersonnelId, equipmentRequests, getEngineerForemen]);

  const subtitle = currentRole === 'admin'
    ? '项目概览与人员设备管理 Project overview and management'
    : currentRole === 'foreman'
    ? '我的班组施工概览 My team construction overview'
    : '管理工长与日志审核概览 Foremen management and log review';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{pageTitles.dashboard.title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      {/* Reassignment warnings */}
      {(() => {
        const warnings: { type: string; name: string; laborId?: string; detail: string }[] = [];

        if (currentRole === 'admin') {
          teamAssignments.forEach(ta => {
            const fm = personnel.find(p => p.id === ta.foremanId);
            if (fm && (fm.status === 'leave' || fm.status === 'resigned')) {
              const actualWorkers = personnel.filter(p => ta.workerIds.includes(p.id) && p.status !== 'resigned');
              if (actualWorkers.length > 0) {
                warnings.push({
                  type: 'foreman',
                  name: fm.name,
                  laborId: fm.laborId,
                  detail: `${fm.status === 'leave' ? '休假 On Leave' : '离职 Resigned'} — ${actualWorkers.length} 名工人需要重新分配 worker(s) need reassignment`,
                });
              }
            }
          });
          engineerAssignments.forEach(ea => {
            const eng = personnel.find(p => p.id === ea.engineerId);
            if (eng && (eng.status === 'leave' || eng.status === 'resigned')) {
              const actualForemen = personnel.filter(p => ea.foremanIds.includes(p.id) && p.status !== 'resigned');
              if (actualForemen.length > 0) {
                warnings.push({
                  type: 'engineer',
                  name: eng.name,
                  laborId: eng.laborId,
                  detail: `${eng.status === 'leave' ? '休假 On Leave' : '离职 Resigned'} — ${actualForemen.length} 名工长需要重新分配 foreman/foremen need reassignment`,
                });
              }
            }
          });
        }

        if (currentRole === 'engineer') {
          const foremanIds = getEngineerForemen(currentPersonnelId);
          foremanIds.forEach(fid => {
            const fm = personnel.find(p => p.id === fid);
            const ta = teamAssignments.find(t => t.foremanId === fid);
            if (fm && (fm.status === 'leave' || fm.status === 'resigned') && ta) {
              const actualWorkers = personnel.filter(p => ta.workerIds.includes(p.id) && p.status !== 'resigned');
              if (actualWorkers.length > 0) {
                warnings.push({
                  type: 'foreman',
                  name: fm.name,
                  laborId: fm.laborId,
                  detail: `${fm.status === 'leave' ? '休假 On Leave' : '离职 Resigned'} — ${actualWorkers.length} 名工人需要重新分配 worker(s) need reassignment`,
                });
              }
            }
          });
        }

        if (warnings.length === 0) return null;
        return (
          <div className="mb-6 space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-destructive">
                    {w.type === 'engineer' ? '工程师 Engineer' : '工长 Foreman'}：
                    {w.laborId && <span className="font-mono text-xs mr-1">{w.laborId}</span>}
                    {w.name}
                  </p>
                  <p className="text-muted-foreground">{w.detail}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {currentRole === 'admin' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Users size={18} />} label={dashboardLabels.activeWorkers} value={(stats as any).activeWorkers} sub={`共 Total ${(stats as any).totalWorkers} 人`} color="bg-primary/10 text-primary" />
          <StatCard icon={<Wrench size={18} />} label={dashboardLabels.equipmentInUse} value={(stats as any).inUseEq} sub={`共 Total ${(stats as any).totalEq} 台 units`} color="bg-info/10 text-info" />
          <StatCard icon={<Clock size={18} />} label={dashboardLabels.totalHoursToday} value={`${(stats as any).totalHoursToday}h`} color="bg-accent/10 text-accent" />
          <StatCard icon={<CheckSquare size={18} />} label={dashboardLabels.pendingLogs} value={(stats as any).pendingLogs} sub="需工程师审核 Awaiting review" color="bg-warning/10 text-warning" />
        </div>
      )}

      {currentRole === 'foreman' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard icon={<Users size={18} />} label={dashboardLabels.activeWorkers} value={(stats as any).activeWorkers} sub={`共 Total ${(stats as any).totalWorkers} 人`} color="bg-primary/10 text-primary" />
          <StatCard icon={<Wrench size={18} />} label={dashboardLabels.teamEquipment} value={(stats as any).inUseEq} sub={`共 Total ${(stats as any).totalEq} 台 units`} color="bg-info/10 text-info" />
          <StatCard icon={<Clock size={18} />} label={dashboardLabels.totalHours} value={`${(stats as any).totalHours}h`} color="bg-accent/10 text-accent" />
          <StatCard icon={<ClipboardList size={18} />} label={dashboardLabels.pending} value={(stats as any).pending} color="bg-warning/10 text-warning" />
          <StatCard icon={<FileCheck size={18} />} label={dashboardLabels.approved} value={(stats as any).approved} color="bg-primary/10 text-primary" />
          <StatCard icon={<FileX size={18} />} label={dashboardLabels.toRevise} value={(stats as any).rejected} color="bg-destructive/10 text-destructive" />
        </div>
      )}

      {currentRole === 'engineer' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<UserCog size={18} />} label={dashboardLabels.managedForemen} value={(stats as any).foremanCount} sub="个班组 Teams" color="bg-primary/10 text-primary" />
          <StatCard icon={<Users size={18} />} label={dashboardLabels.totalWorkerCount} value={(stats as any).totalWorkers} sub="人 Workers" color="bg-info/10 text-info" />
          <StatCard icon={<ClipboardList size={18} />} label={dashboardLabels.pending} value={(stats as any).pending} sub="含返修重提交 Incl. resubmitted" color="bg-warning/10 text-warning" />
          <StatCard icon={<FileCheck size={18} />} label={dashboardLabels.approvedLogs} value={(stats as any).approved} color="bg-primary/10 text-primary" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Logs Progress */}
        <div className="bg-card rounded-lg border shadow-sm">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <ClipboardList size={16} className="text-primary" />
            <h2 className="font-semibold">
              {currentRole === 'foreman' ? dashboardLabels.myLogs : currentRole === 'engineer' ? dashboardLabels.managedLogs : dashboardLabels.recentLogs}
            </h2>
            <span className="text-xs text-muted-foreground ml-auto">({myLogs.length})</span>
          </div>
          <div className="divide-y">
            {myLogs.slice(0, 5).map(log => (
              <div key={log.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium"><span className="font-mono text-xs text-muted-foreground mr-1.5">{personnel.find(p => p.id === log.foremanId)?.laborId || log.foremanName}</span>{log.foremanName} · {log.date}</p>
                  <p className="text-xs text-muted-foreground">{log.entries.length} 条工人记录 worker entries · {log.entries.reduce((s, e) => s + e.hours, 0)}h 总工时 total</p>
                </div>
                <span className={`status-badge ${
                  log.status === 'approved' || log.status === 'conditional' ? 'status-approved'
                  : log.status === 'pending' || log.status === 'withdraw_requested' ? 'status-pending'
                  : 'status-rejected'
                }`}>
                  {logStatusLabels[log.status] || log.status}
                </span>
              </div>
            ))}
            {myLogs.length === 0 && (
              <div className="px-5 py-8 text-center text-muted-foreground">{messages.noLogs}</div>
            )}
          </div>
        </div>

        {/* Equipment Requests Progress */}
        <div className="bg-card rounded-lg border shadow-sm">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <Package size={16} className="text-primary" />
            <h2 className="font-semibold">
              {currentRole === 'foreman' ? '我的设备申请 My Equipment Requests' : currentRole === 'engineer' ? '设备申请进展 Equipment Request Progress' : '设备申请总览 Equipment Requests Overview'}
            </h2>
            <span className="text-xs text-muted-foreground ml-auto">({myRequests.length})</span>
          </div>
          <div className="divide-y">
            {myRequests.slice(0, 5).map(req => (
              <div key={req.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {req.equipmentName}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({req.requestType === 'existing' ? '已有设备 Existing' : '新设备 New'})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {currentRole !== 'foreman' && <><span>{req.requesterName}</span> · </>}
                    {new Date(req.createdAt).toLocaleDateString()}
                    {req.reason && <> · {req.reason.length > 20 ? req.reason.slice(0, 20) + '...' : req.reason}</>}
                  </p>
                  {req.engineerComment && <p className="text-xs text-blue-600 mt-0.5">工程师：{req.engineerComment.length > 30 ? req.engineerComment.slice(0, 30) + '...' : req.engineerComment}</p>}
                  {req.adminComment && <p className="text-xs text-muted-foreground mt-0.5">管理：{req.adminComment.length > 30 ? req.adminComment.slice(0, 30) + '...' : req.adminComment}</p>}
                </div>
                <span className={`status-badge ${
                  req.status === 'approved' ? 'status-approved'
                  : req.status === 'pending' || req.status === 'engineer_pending' || req.status === 'engineer_approved' ? 'status-pending'
                  : req.status === 'rejected' || req.status === 'engineer_rejected' ? 'status-rejected'
                  : 'status-leave'
                }`}>
                  {req.status === 'pending' ? '待管理审批 Admin Pending'
                    : req.status === 'engineer_pending' ? '待工程师审批 Eng. Pending'
                    : req.status === 'engineer_approved' ? '工程师已批 Eng. Approved'
                    : req.status === 'engineer_rejected' ? '工程师拒绝 Eng. Rejected'
                    : req.status === 'approved' ? '已批准 Approved'
                    : req.status === 'rejected' ? '已拒绝 Rejected'
                    : req.status === 'withdrawn' ? '已撤回 Withdrawn'
                    : req.status}
                </span>
              </div>
            ))}
            {myRequests.length === 0 && (
              <div className="px-5 py-8 text-center text-muted-foreground">{messages.noEquipmentRequests}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
