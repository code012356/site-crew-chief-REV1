import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CheckSquare,
  ClipboardList,
  HardHat,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCog,
  Users,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { UserRole } from '@/lib/types';
import { actionLabels, navLabels, roleLabels as i18nRoleLabels } from '@/lib/i18n';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { label: navLabels.dashboard, path: '/', icon: <LayoutDashboard size={20} />, roles: ['admin', 'foreman', 'engineer'] },
  { label: navLabels.personnel, path: '/personnel', icon: <Users size={20} />, roles: ['admin'] },
  { label: navLabels.equipment, path: '/equipment', icon: <Wrench size={20} />, roles: ['equipment_admin', 'foreman', 'engineer'] },
  { label: navLabels.workCodes, path: '/work-codes', icon: <ClipboardList size={20} />, roles: ['admin'] },
  { label: navLabels.accounts, path: '/accounts', icon: <UserCog size={20} />, roles: ['admin'] },
  { label: navLabels.team, path: '/team', icon: <UsersRound size={20} />, roles: ['foreman'] },
  { label: navLabels.engineerManage, path: '/engineer-manage', icon: <UsersRound size={20} />, roles: ['engineer'] },
  { label: navLabels.dailyLog, path: '/daily-log', icon: <ClipboardList size={20} />, roles: ['admin', 'foreman'] },
  { label: navLabels.review, path: '/review', icon: <CheckSquare size={20} />, roles: ['engineer'] },
  { label: navLabels.analytics, path: '/analytics', icon: <BarChart3 size={20} />, roles: ['admin', 'engineer'] },
];

const roleLabels: Record<UserRole, string> = {
  admin: i18nRoleLabels.admin,
  equipment_admin: i18nRoleLabels.equipment_admin,
  foreman: i18nRoleLabels.foreman,
  engineer: i18nRoleLabels.engineer,
};

function SidebarContent({ currentRole, currentUserName, filteredNav, onNavigate, onLogout, onChangePassword }: {
  currentRole: UserRole;
  currentUserName: string;
  filteredNav: NavItem[];
  onNavigate?: () => void;
  onLogout: () => void;
  onChangePassword: () => void;
}) {
  const location = useLocation();

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <HardHat size={20} className="text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-sidebar-foreground">施工管理平台</h1>
          <p className="text-xs text-sidebar-muted">Construction Management</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {filteredNav.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              {item.icon}
              <span className="leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary text-xs font-bold">
              {currentUserName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-sidebar-foreground">{currentUserName}</p>
              <p className="text-xs text-sidebar-muted">{roleLabels[currentRole]}</p>
            </div>
          </div>
          <button
            onClick={onChangePassword}
            className="p-1.5 rounded-md text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            title="修改密码 Change Password"
          >
            <KeyRound size={16} />
          </button>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-md text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            title={actionLabels.logout}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { currentRole, currentUserName, logout, changePassword } = useAppContext();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const filteredNav = navItems.filter(item => item.roles.includes(currentRole));

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileOpen(false);
  };

  const handleChangePassword = () => {
    setPwDialogOpen(true);
    setOldPw('');
    setNewPw('');
    setConfirmPw('');
    setMobileOpen(false);
  };

  const handlePwSubmit = async () => {
    if (!oldPw || !newPw) {
      toast.error('请填写完整信息 Please fill all fields');
      return;
    }
    if (newPw.length < 6) {
      toast.error('新密码至少 6 位 New password min 6 chars');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('两次密码不一致 Passwords do not match');
      return;
    }
    const success = await changePassword(oldPw, newPw);
    if (success) {
      toast.success('密码修改成功 Password changed');
      setPwDialogOpen(false);
    } else {
      toast.error('原密码错误 Old password incorrect');
    }
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-64 bg-sidebar flex-col shrink-0">
        <SidebarContent
          currentRole={currentRole}
          currentUserName={currentUserName}
          filteredNav={filteredNav}
          onLogout={handleLogout}
          onChangePassword={handleChangePassword}
        />
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <HardHat size={18} className="text-sidebar-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-sidebar-foreground">施工管理</span>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="p-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                <Menu size={22} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
              <div className="flex flex-col h-full">
                <SidebarContent
                  currentRole={currentRole}
                  currentUserName={currentUserName}
                  filteredNav={filteredNav}
                  onNavigate={() => setMobileOpen(false)}
                  onLogout={handleLogout}
                  onChangePassword={handleChangePassword}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in pt-[60px] md:pt-6">
          {children}
        </div>
      </main>

      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>修改密码 Change Password</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium mb-1 block">原密码 Old Password</label><Input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} placeholder="请输入原密码 Enter old password" /></div>
            <div><label className="text-sm font-medium mb-1 block">新密码 New Password</label><Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="请输入新密码 Enter new password (min 6 chars)" /></div>
            <div><label className="text-sm font-medium mb-1 block">确认密码 Confirm Password</label><Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="请再次输入新密码 Confirm new password" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialogOpen(false)}>取消 Cancel</Button>
            <Button onClick={handlePwSubmit}>确认修改 Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
