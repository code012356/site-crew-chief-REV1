import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { UserRole } from '@/lib/types';
import { HardHat, User, Lock, LogIn, UserPlus, HelpCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';
import { pageTitles, actionLabels, messages, roleLabels } from '@/lib/i18n';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState<'username' | 'phone'>('username');
  const { login, accounts, submitAccountRequest } = useAppContext();
  const navigate = useNavigate();

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regForm, setRegForm] = useState({ username: '', displayName: '', role: 'foreman' as UserRole, laborId: '', reason: '' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = loginMode === 'username' ? username : phone;
    if (!identifier.trim()) {
      toast.error(loginMode === 'username' ? '请输入用户名 Please enter username' : '请输入手机号 Please enter phone number');
      return;
    }
    // Check if account is disabled
    const account = accounts.find(a => 
      loginMode === 'username' ? a.username === identifier : a.phone === identifier
    );
    if (account && !account.enabled) {
      toast.error('该账号已被禁用 This account is disabled');
      return;
    }
    const success = await login(identifier, password);
    if (success) {
      navigate('/');
    } else {
      toast.error(messages.loginError);
    }
  };

  const handleForgotPassword = () => {
    if (!forgotUsername.trim()) { toast.error('请输入用户名 Please enter username'); return; }
    const account = accounts.find(a => a.username === forgotUsername);
    if (account) {
      toast.success('请联系管理员重置密码 Please contact admin to reset password');
    } else {
      toast.error('用户名不存在 Username not found');
    }
    setForgotOpen(false);
    setForgotUsername('');
  };

  const handleRegister = async () => {
    if (!regForm.username.trim() || !regForm.displayName.trim() || !regForm.laborId.trim()) {
      toast.error('请填写完整信息（含工号） Please fill all fields including labor ID');
      return;
    }
    if (regForm.username.trim().length < 3) {
      toast.error('用户名至少3个字符 Username must be at least 3 characters');
      return;
    }
    // Validate labor ID format based on role
    const { validateLaborId } = await import('@/lib/utils');
    const laborErr = validateLaborId(regForm.laborId, regForm.role);
    if (laborErr) { toast.error(laborErr); return; }
    const success = await submitAccountRequest({
      username: regForm.username.trim(),
      displayName: regForm.displayName.trim(),
      role: regForm.role,
      laborId: regForm.laborId.trim(),
      reason: regForm.reason.trim(),
    });
    if (success) {
      toast.success('申请已提交，请等待管理员审批 Application submitted, awaiting admin approval');
      setRegisterOpen(false);
      setRegForm({ username: '', displayName: '', role: 'foreman', laborId: '', reason: '' });
    } else {
      toast.error('申请失败：用户名已存在、已有待审批申请，或工号未在人员名单中（请联系管理员先添加人员） Failed: username exists, request pending, or labor ID not found in personnel list');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center mb-4">
            <HardHat size={32} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{pageTitles.login.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{pageTitles.login.subtitle}</p>
        </div>

        <div className="bg-card rounded-xl border shadow-sm p-6">
          <Tabs value={loginMode} onValueChange={v => setLoginMode(v as 'username' | 'phone')} className="mb-4">
            <TabsList className="w-full">
              <TabsTrigger value="username" className="flex-1 gap-1.5"><User size={14} /> 用户名 Username</TabsTrigger>
              <TabsTrigger value="phone" className="flex-1 gap-1.5"><Phone size={14} /> 手机号 Phone</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginMode === 'username' ? (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">用户名 Username</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="请输入用户名 Enter username" className="pl-9" />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">手机号 Phone Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="请输入手机号 Enter phone number" className="pl-9" />
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">密码 Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码 Enter password" className="pl-9" required />
              </div>
            </div>
            <Button type="submit" className="w-full gap-2">
              <LogIn size={16} />
              {actionLabels.login}
            </Button>
          </form>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <button type="button" onClick={() => setForgotOpen(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              <HelpCircle size={14} /> 忘记密码 Forgot Password
            </button>
            <button type="button" onClick={() => setRegisterOpen(true)} className="text-sm text-primary font-medium hover:text-primary/80 transition-colors flex items-center gap-1">
              <UserPlus size={14} /> 申请账号 Register
            </button>
          </div>
        </div>

      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>忘记密码 Forgot Password</DialogTitle>
            <DialogDescription>请输入您的用户名，系统将提示您联系管理员重置密码。Please enter your username, you will be prompted to contact admin for a password reset.</DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium mb-1 block">用户名 Username</label>
            <Input value={forgotUsername} onChange={e => setForgotUsername(e.target.value)} placeholder="请输入用户名 Enter username" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgotOpen(false)}>取消 Cancel</Button>
            <Button onClick={handleForgotPassword}>确认 Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>申请账号 Account Application</DialogTitle>
            <DialogDescription>填写以下信息提交账号申请，管理员审批后即可登录。Fill in the form below to apply for an account. You can log in after admin approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">工号 Labor ID <span className="text-destructive">*</span></label>
              <Input value={regForm.laborId} onChange={e => setRegForm(f => ({ ...f, laborId: e.target.value }))} placeholder={regForm.role === 'engineer' ? '纯数字 e.g. 20240009' : '以LQ开头 e.g. LQ-2024-003'} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">用户名 Username <span className="text-destructive">*</span></label>
              <Input value={regForm.username} onChange={e => setRegForm(f => ({ ...f, username: e.target.value }))} placeholder="请输入用户名（至少3个字符）Enter username (min 3 chars)" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">姓名 Display Name <span className="text-destructive">*</span></label>
              <Input value={regForm.displayName} onChange={e => setRegForm(f => ({ ...f, displayName: e.target.value }))} placeholder="请输入真实姓名 Enter your real name" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">申请角色 Role</label>
              <Select value={regForm.role} onValueChange={v => setRegForm(f => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="foreman">{roleLabels.foreman}</SelectItem>
                  <SelectItem value="engineer">{roleLabels.engineer}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">申请原因 Reason</label>
              <Textarea value={regForm.reason} onChange={e => setRegForm(f => ({ ...f, reason: e.target.value }))} placeholder="请简述申请原因（选填）Briefly describe reason (optional)" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>取消 Cancel</Button>
            <Button onClick={handleRegister}>提交申请 Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
