import { useState, useEffect, useCallback } from 'react';
import { useAppContext, UserAccount } from '@/contexts/AppContext';
import { useDataContext } from '@/contexts/DataContext';
import { UserRole } from '@/lib/types';
import { roleLabels } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';
import { Plus, Pencil, Trash2, KeyRound, ShieldCheck, ShieldOff, CheckCircle, XCircle, Phone, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type FormData = {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  laborId: string;
  phone: string;
};

const emptyForm: FormData = { username: '', password: '', displayName: '', role: 'foreman', laborId: '', phone: '' };

const normalizeText = (value?: string) => (value || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');

const getNameTokens = (name?: string) => (name || '')
  .split(/[\/\s,，]+/)
  .map(normalizeText)
  .filter(Boolean);

const nameMatches = (left?: string, right?: string) => {
  const leftTokens = getNameTokens(left);
  const rightTokens = getNameTokens(right);
  if (!leftTokens.length || !rightTokens.length) return false;
  const leftJoined = leftTokens.join('');
  const rightJoined = rightTokens.join('');
  return leftJoined === rightJoined || leftTokens.every(token => rightTokens.includes(token)) || rightTokens.every(token => leftTokens.includes(token));
};

export default function AccountManagePage() {
  const { accounts, addAccount, updateAccount, deleteAccount, accountRequests, approveRequest, rejectRequest, currentUserId, currentRole } = useAppContext();
  const { personnel, teamAssignments, engineerAssignments, addPersonnel, updatePersonnel, updateTeamAssignment, setEngineerAssignmentsBatch, refreshAll } = useDataContext();

  // Online status tracking
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});

  const fetchOnlineStatus = useCallback(async () => {
    const { data } = await supabase.from('accounts').select('id, last_active_at') as any;
    if (data) {
      const now = Date.now();
      const map: Record<string, boolean> = {};
      for (const row of data) {
        map[row.id] = row.last_active_at ? (now - new Date(row.last_active_at).getTime()) < 120000 : false;
      }
      setOnlineMap(map);
    }
  }, []);

  useEffect(() => {
    fetchOnlineStatus();
    const interval = setInterval(fetchOnlineStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchOnlineStatus]);

  const initializePersonnel = async (displayName: string, role: UserRole, laborId: string, phone: string, existingPersonnelId?: string): Promise<string> => {
    // If explicitly linking to an existing personnel record, use it directly
    if (existingPersonnelId) {
      return existingPersonnelId;
    }
    // Check if personnel with this laborId or phone already exists
    const personnelRole = role === 'admin' ? 'engineer' : role;
    const existing = personnel.find(p => 
      (p.role === 'foreman' || p.role === 'engineer') && (
        (laborId && p.laborId === laborId) ||
        (phone && p.phone === phone)
      )
    );
    if (existing) {
      return existing.id;
    }
    const personnelId = await addPersonnel({
      laborId: laborId || undefined,
      name: displayName,
      role: personnelRole,
      phone: phone || '',
      status: 'active',
      joinDate: new Date().toISOString().split('T')[0],
    });
    if (role === 'foreman') {
      await updateTeamAssignment(personnelId, [], []);
    } else if (role === 'engineer') {
      await setEngineerAssignmentsBatch([...engineerAssignments, { engineerId: personnelId, foremanIds: [] }]);
    }
    return personnelId;
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [newPassword, setNewPassword] = useState('');
  const [passwordTargetId, setPasswordTargetId] = useState<string | null>(null);
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null);
  const [approvePassword, setApprovePassword] = useState('');
  const [approvePhone, setApprovePhone] = useState('');
  const [linkPersonnelId, setLinkPersonnelId] = useState<string | undefined>(undefined);

  const findAccountForPersonnel = useCallback((person: typeof personnel[number]) => {
    if (person.role !== 'foreman' && person.role !== 'engineer') return undefined;
    const laborId = normalizeText(person.laborId);
    const phone = normalizeText(person.phone);
    const name = person.name;
    const nameAsUsername = getNameTokens(name).join('');

    return accounts.find(account => {
      if (!account.enabled) return false;
      if (account.linkedPersonnelId && account.linkedPersonnelId === person.id) return true;
      if (laborId && normalizeText(account.laborId) === laborId) return true;
      if (phone && normalizeText(account.phone) === phone) return true;
      if (nameMatches(account.displayName, name)) return true;
      if (nameAsUsername && normalizeText(account.username) === nameAsUsername) return true;
      return false;
    });
  }, [accounts]);

  const openAdd = () => { setEditingId(null); setLinkPersonnelId(undefined); setForm(emptyForm); setDialogOpen(true); };

  // Open add with pre-filled data from personnel
  const openAddFromPersonnel = (personnelId: string) => {
    const p = personnel.find(pp => pp.id === personnelId);
    if (!p) return;
    const existingAccount = findAccountForPersonnel(p);
    if (existingAccount) {
      toast.error(`Existing account: ${existingAccount.username}`);
      return;
    }
    setEditingId(null);
    setLinkPersonnelId(personnelId);
    setForm({
      username: '',
      password: '',
      displayName: p.name,
      role: p.role === 'worker' ? 'foreman' : p.role as UserRole,
      laborId: p.laborId || '',
      phone: p.phone || '',
    });
    setDialogOpen(true);
  };

  const openEdit = (account: UserAccount) => {
    setEditingId(account.id);
    setForm({ username: account.username, password: account.password, displayName: account.displayName, role: account.role, laborId: account.laborId || '', phone: account.phone || '' });
    setDialogOpen(true);
  };

  const openPasswordReset = (id: string) => { setPasswordTargetId(id); setNewPassword(''); setPasswordDialogOpen(true); };
  const openApprove = (id: string) => {
    setApproveTargetId(id);
    setApprovePassword('');
    // Try to find matching personnel phone
    const req = accountRequests.find(r => r.id === id);
    if (req) {
      const matchedPersonnel = personnel.find(p => p.laborId === req.laborId && (p.role === 'foreman' || p.role === 'engineer'));
      setApprovePhone(matchedPersonnel?.phone || '');
    }
    setApproveDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.displayName.trim()) { toast.error('请填写完整信息 Please fill in all fields'); return; }
    if (!editingId && !form.password.trim()) { toast.error('请设置密码 Please set a password'); return; }
    // Validate labor ID format
    if (form.laborId.trim()) {
      const { validateLaborId } = await import('@/lib/utils');
      const err = validateLaborId(form.laborId, form.role);
      if (err) { toast.error(err); return; }
    }
    const duplicate = accounts.find(a => normalizeText(a.username) === normalizeText(form.username) && a.id !== editingId);
    if (duplicate) { toast.error('用户名已存在 Username already exists'); return; }
    if (!editingId && linkPersonnelId) {
      const linkedPerson = personnel.find(p => p.id === linkPersonnelId);
      const existingAccount = linkedPerson ? findAccountForPersonnel(linkedPerson) : undefined;
      if (existingAccount) {
        toast.error(`Existing account: ${existingAccount.username}`);
        return;
      }
    }
    // Check phone uniqueness if provided
    if (form.phone.trim()) {
      const phoneDup = accounts.find(a => normalizeText(a.phone) === normalizeText(form.phone) && a.id !== editingId);
      if (phoneDup) { toast.error('该手机号已关联其他账号 Phone already linked to another account'); return; }
    }
    if (form.laborId.trim()) {
      const laborDup = accounts.find(a => normalizeText(a.laborId) === normalizeText(form.laborId) && a.id !== editingId);
      if (laborDup) { toast.error(`Existing account: ${laborDup.username}`); return; }
    }

    if (editingId) {
      await updateAccount(editingId, { username: form.username, displayName: form.displayName, role: form.role, laborId: form.laborId || undefined, phone: form.phone || undefined });
      // Sync phone to linked personnel
      const account = accounts.find(a => a.id === editingId);
      if (account?.linkedPersonnelId && form.phone) {
        await updatePersonnel(account.linkedPersonnelId, { phone: form.phone });
      }
      toast.success('账号已更新 Account updated');
    } else {
      const linkedPersonnelId = form.role !== 'admin' ? await initializePersonnel(form.displayName, form.role, form.laborId, form.phone, linkPersonnelId) : undefined;
      await addAccount({ ...form, enabled: true, laborId: form.laborId || undefined, linkedPersonnelId, phone: form.phone || undefined });
      toast.success('账号已创建并初始化 Account created and initialized');
    }
    setDialogOpen(false);
    await refreshAll();
  };

  const handlePasswordReset = async () => {
    if (!newPassword.trim() || newPassword.length < 6) { toast.error('密码至少6位 Password must be at least 6 characters'); return; }
    if (passwordTargetId) { await updateAccount(passwordTargetId, { password: newPassword }); toast.success('密码已重置 Password reset'); setPasswordDialogOpen(false); }
  };

  const handleToggleEnabled = async (account: UserAccount) => {
    if (account.id === currentUserId) {
      toast.error('不能禁用自己的账号 Cannot disable your own account');
      return;
    }
    await updateAccount(account.id, { enabled: !account.enabled });
    toast.success(account.enabled ? '账号已禁用 Account disabled' : '账号已启用 Account enabled');
  };

  const handleDelete = async (id: string) => {
    if (id === currentUserId) {
      toast.error('不能删除自己的账号 Cannot delete your own account');
      return;
    }
    await deleteAccount(id);
    toast.success('账号已删除 Account deleted');
    await refreshAll();
  };

  const handleApprove = async () => {
    if (!approvePassword.trim() || approvePassword.length < 6) { toast.error('请设置初始密码（至少6位）Set initial password (min 6 chars)'); return; }
    const req = accountRequests.find(r => r.id === approveTargetId);
    if (approveTargetId && req) {
      const linkedPersonnelId = await initializePersonnel(req.displayName, req.role, req.laborId, approvePhone);
      // If phone provided, sync to personnel
      if (approvePhone) {
        await updatePersonnel(linkedPersonnelId, { phone: approvePhone });
      }
      await approveRequest(approveTargetId, approvePassword, linkedPersonnelId);
      // Update the new account with phone
      if (approvePhone) {
        const newAccount = accounts.find(a => a.linkedPersonnelId === linkedPersonnelId);
        if (newAccount) {
          await updateAccount(newAccount.id, { phone: approvePhone });
        }
      }
      toast.success('申请已通过，人员记录已初始化 Approved and personnel initialized');
      setApproveDialogOpen(false);
      await refreshAll();
    }
  };

  const handleReject = async (id: string) => { await rejectRequest(id); toast.success('申请已拒绝 Application rejected'); };

  // Find personnel without accounts (foreman/engineer only)
  const unlinkedPersonnel = personnel.filter(p =>
    (p.role === 'foreman' || p.role === 'engineer') &&
    !findAccountForPersonnel(p)
  );

  // Only admin can access this page
  if (currentRole !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">⛔ 仅管理员可访问此页面 Admin access only</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-foreground">账号管理 Account Management</h2>
          <p className="text-sm text-muted-foreground">管理系统用户账号，通过手机号关联人员 Manage accounts, link personnel via phone</p>
        </div>
        <Button onClick={openAdd} size="sm" className="gap-1.5 self-start">
          <Plus size={16} /> 添加账号 Add Account
        </Button>
      </div>

      {/* Unlinked personnel alert */}
      {unlinkedPersonnel.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
            ⚠️ {unlinkedPersonnel.length} 名工长/工程师尚未关联账号 {unlinkedPersonnel.length} foremen/engineers without accounts
          </p>
          <div className="flex flex-wrap gap-2">
            {unlinkedPersonnel.map(p => (
              <Button
                key={p.id}
                variant="outline"
                size="sm"
                className="gap-1.5 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                onClick={() => openAddFromPersonnel(p.id)}
              >
                <Plus size={14} />
                {p.name} ({roleLabels[p.role]})
                {p.phone && <span className="text-xs opacity-70">· {p.phone}</span>}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">账号列表 Accounts</TabsTrigger>
          <TabsTrigger value="requests" className="relative">
            申请审批 Requests
            {accountRequests.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-destructive text-destructive-foreground">
                {accountRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="table-responsive">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户名 Username</TableHead>
                    <TableHead>显示名 Name</TableHead>
                    <TableHead>手机号 Phone</TableHead>
                    <TableHead>工号 Labor ID</TableHead>
                    <TableHead>角色 Role</TableHead>
                    <TableHead>状态 Status</TableHead>
                    <TableHead className="text-right">操作 Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map(account => {
                    const linkedPerson = personnel.find(p => p.id === account.linkedPersonnelId);
                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.username}</TableCell>
                        <TableCell>{account.displayName}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {account.phone ? (
                            <span className="flex items-center gap-1"><Phone size={12} className="text-muted-foreground" />{account.phone}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{account.laborId || '-'}</TableCell>
                        <TableCell><Badge variant="outline">{roleLabels[account.role] || account.role}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={account.enabled ? 'default' : 'secondary'}>
                              {account.enabled ? '启用 Enabled' : '禁用 Disabled'}
                            </Badge>
                            {account.enabled && (
                              <span className="flex items-center gap-1 text-xs">
                                <Circle size={8} className={onlineMap[account.id] ? 'fill-green-500 text-green-500' : 'fill-muted-foreground/40 text-muted-foreground/40'} />
                                <span className={onlineMap[account.id] ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                                  {onlineMap[account.id] ? '在线 Online' : '离线 Offline'}
                                </span>
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(account)} title="编辑 Edit"><Pencil size={15} /></Button>
                            <Button variant="ghost" size="icon" onClick={() => openPasswordReset(account.id)} title="重置密码 Reset Password"><KeyRound size={15} /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggleEnabled(account)} title={account.enabled ? '禁用 Disable' : '启用 Enable'}>
                              {account.enabled ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(account.id)} title="删除 Delete" className="text-destructive hover:text-destructive"><Trash2 size={15} /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="requests">
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            {accountRequests.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">暂无待审批申请 No pending requests</div>
            ) : (
              <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>工号 Labor ID</TableHead>
                      <TableHead>用户名 Username</TableHead>
                      <TableHead>姓名 Name</TableHead>
                      <TableHead>申请角色 Role</TableHead>
                      <TableHead>申请原因 Reason</TableHead>
                      <TableHead>时间 Time</TableHead>
                      <TableHead className="text-right">操作 Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountRequests.map(req => (
                      <TableRow key={req.id}>
                        <TableCell className="font-mono text-xs">{req.laborId}</TableCell>
                        <TableCell className="font-medium">{req.username}</TableCell>
                        <TableCell>{req.displayName}</TableCell>
                        <TableCell><Badge variant="outline">{roleLabels[req.role] || req.role}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">{req.reason || '-'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleString('zh-CN')}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openApprove(req.id)} title="通过 Approve" className="text-primary hover:text-primary">
                              <CheckCircle size={16} />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleReject(req.id)} title="拒绝 Reject" className="text-destructive hover:text-destructive">
                              <XCircle size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑账号 Edit Account' : '添加账号 Add Account'}</DialogTitle>
            {!editingId && <DialogDescription>新建账号将自动初始化人员记录，手机号用于关联人员和登录。New account auto-initializes personnel. Phone links to personnel and enables phone login.</DialogDescription>}
          </DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium mb-1 block">用户名 Username</label><Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="请输入用户名 Enter username" /></div>
            <div><label className="text-sm font-medium mb-1 block">显示名称 Display Name</label><Input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="请输入显示名称 Enter display name" /></div>
            <div>
              <label className="text-sm font-medium mb-1 block">手机号 Phone <span className="text-xs text-muted-foreground">(可用于登录 Can be used for login)</span></label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="请输入手机号 Enter phone number" className="pl-9" />
              </div>
            </div>
            <div><label className="text-sm font-medium mb-1 block">工号 Labor ID</label><Input value={form.laborId} onChange={e => setForm(f => ({ ...f, laborId: e.target.value }))} placeholder={form.role === 'engineer' || form.role === 'admin' ? '纯数字 e.g. 20240009' : '以LQ开头 e.g. LQ-2024-003'} /></div>
            {!editingId && (<div><label className="text-sm font-medium mb-1 block">密码 Password</label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="请设置密码（至少6位）Set password (min 6 chars)" /></div>)}
            <div>
              <label className="text-sm font-medium mb-1 block">角色 Role</label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                  <SelectItem value="foreman">{roleLabels.foreman}</SelectItem>
                  <SelectItem value="engineer">{roleLabels.engineer}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>取消 Cancel</Button><Button onClick={handleSave}>保存 Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>重置密码 Reset Password</DialogTitle></DialogHeader>
          <div><label className="text-sm font-medium mb-1 block">新密码 New Password</label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="请输入新密码（至少6位）Enter new password (min 6 chars)" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>取消 Cancel</Button><Button onClick={handlePasswordReset}>确认重置 Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Request Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>审批通过 Approve Request</DialogTitle>
            <DialogDescription>通过后将自动创建人员记录，设置手机号用于关联和登录。Upon approval, personnel will be initialized. Phone links to personnel and enables login.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">手机号 Phone</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={approvePhone} onChange={e => setApprovePhone(e.target.value)} placeholder="请输入手机号 Enter phone" className="pl-9" />
              </div>
            </div>
            <div><label className="text-sm font-medium mb-1 block">设置初始密码 Set Initial Password</label><Input type="password" value={approvePassword} onChange={e => setApprovePassword(e.target.value)} placeholder="请设置初始密码（至少6位）Set initial password (min 6 chars)" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setApproveDialogOpen(false)}>取消 Cancel</Button><Button onClick={handleApprove}>确认通过 Approve</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
