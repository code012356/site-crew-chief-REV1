import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserRole } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
  enabled: boolean;
  laborId?: string;
  linkedPersonnelId?: string;
  phone?: string;
}

export interface AccountRequest {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  laborId: string;
  reason: string;
  createdAt: string;
}

interface AppContextType {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUserName: string;
  currentUserId: string;
  currentPersonnelId: string;
  currentLaborId: string;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  accounts: UserAccount[];
  addAccount: (account: Omit<UserAccount, 'id'>) => Promise<void>;
  updateAccount: (id: string, updates: Partial<Omit<UserAccount, 'id'>>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  accountRequests: AccountRequest[];
  submitAccountRequest: (req: Omit<AccountRequest, 'id' | 'createdAt'>) => Promise<boolean>;
  approveRequest: (id: string, password: string, linkedPersonnelId: string) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
  refreshAccounts: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be within AppProvider');
  return context;
};

function mapDbToAccount(row: any): UserAccount {
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    role: row.role as UserRole,
    displayName: row.display_name,
    enabled: row.enabled,
    laborId: row.labor_id || undefined,
    linkedPersonnelId: row.linked_personnel_id || undefined,
    phone: row.phone || undefined,
  };
}

function mapDbToRequest(row: any): AccountRequest {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role as UserRole,
    laborId: row.labor_id,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [accountRequests, setAccountRequests] = useState<AccountRequest[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentPersonnelId, setCurrentPersonnelId] = useState('');
  const [currentLaborId, setCurrentLaborId] = useState('');

  const fetchAccounts = useCallback(async () => {
    const { data } = await supabase.from('accounts').select('*');
    if (data) setAccounts(data.map(mapDbToAccount));
  }, []);

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase.from('account_requests').select('*').order('created_at', { ascending: false });
    if (data) setAccountRequests(data.map(mapDbToRequest));
  }, []);

  const refreshAccounts = useCallback(async () => {
    await Promise.all([fetchAccounts(), fetchRequests()]);
  }, [fetchAccounts, fetchRequests]);

  // Initial load
  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  // Realtime subscription for accounts changes
  useEffect(() => {
    const channel = supabase
      .channel('accounts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, () => {
        fetchAccounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAccounts, fetchRequests]);

  const login = async (identifier: string, password: string): Promise<boolean> => {
    // Try login by username first
    let { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', identifier)
      .eq('password', password)
      .eq('enabled', true)
      .maybeSingle();

    // If not found, try by phone number
    if (!data) {
      const phoneResult = await supabase
        .from('accounts')
        .select('*')
        .eq('phone', identifier)
        .eq('password', password)
        .eq('enabled', true)
        .maybeSingle();
      data = phoneResult.data;
    }

    if (data) {
      const account = mapDbToAccount(data);
      setCurrentRole(account.role);
      setCurrentUserName(account.displayName);
      setCurrentUserId(account.id);
      setCurrentPersonnelId(account.linkedPersonnelId || '');
      setCurrentLaborId(account.laborId || '');
      setIsLoggedIn(true);
      // Set last_active_at on login
      await supabase.from('accounts').update({ last_active_at: new Date().toISOString() } as any).eq('id', account.id);
      return true;
    }
    return false;
  };

  const logout = async () => {
    // Clear last_active_at on logout
    if (currentUserId) {
      await supabase.from('accounts').update({ last_active_at: null } as any).eq('id', currentUserId);
    }
    setIsLoggedIn(false);
    setCurrentUserName('');
    setCurrentUserId('');
    setCurrentPersonnelId('');
    setCurrentLaborId('');
  };

  // Heartbeat: update last_active_at every 60s while logged in
  useEffect(() => {
    if (!isLoggedIn || !currentUserId) return;
    const interval = setInterval(() => {
      supabase.from('accounts').update({ last_active_at: new Date().toISOString() } as any).eq('id', currentUserId);
    }, 60000);
    return () => clearInterval(interval);
  }, [isLoggedIn, currentUserId]);

  const addAccount = async (account: Omit<UserAccount, 'id'>) => {
    await supabase.from('accounts').insert({
      username: account.username,
      password: account.password,
      role: account.role,
      display_name: account.displayName,
      enabled: account.enabled,
      labor_id: account.laborId || null,
      linked_personnel_id: account.linkedPersonnelId || null,
      phone: account.phone || '',
    });
    await fetchAccounts();
  };

  const updateAccount = async (id: string, updates: Partial<Omit<UserAccount, 'id'>>) => {
    const dbUpdates: any = {};
    if (updates.username !== undefined) dbUpdates.username = updates.username;
    if (updates.password !== undefined) dbUpdates.password = updates.password;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
    if (updates.laborId !== undefined) dbUpdates.labor_id = updates.laborId;
    if (updates.linkedPersonnelId !== undefined) dbUpdates.linked_personnel_id = updates.linkedPersonnelId;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    dbUpdates.updated_at = new Date().toISOString();

    await supabase.from('accounts').update(dbUpdates).eq('id', id);
    await fetchAccounts();
  };

  const deleteAccount = async (id: string) => {
    await supabase.from('accounts').delete().eq('id', id);
    await fetchAccounts();
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
    const account = accounts.find(a => a.id === currentUserId);
    if (account && account.password === oldPassword) {
      await updateAccount(currentUserId, { password: newPassword });
      return true;
    }
    return false;
  };

  const submitAccountRequest = async (req: Omit<AccountRequest, 'id' | 'createdAt'>): Promise<boolean> => {
    // Check duplicates
    const { data: existing } = await supabase.from('accounts').select('id').eq('username', req.username).maybeSingle();
    const { data: pending } = await supabase.from('account_requests').select('id').eq('username', req.username).maybeSingle();
    if (existing || pending) return false;

    // Must exist in personnel with matching laborId and role (foreman/engineer)
    const { data: person } = await supabase
      .from('personnel')
      .select('id, role, name')
      .eq('labor_id', req.laborId)
      .eq('role', req.role)
      .maybeSingle();
    if (!person) return false;

    await supabase.from('account_requests').insert({
      username: req.username,
      display_name: req.displayName,
      role: req.role,
      labor_id: req.laborId,
      reason: req.reason,
    });
    await fetchRequests();
    return true;
  };

  const approveRequest = async (id: string, password: string, linkedPersonnelId: string) => {
    const req = accountRequests.find(r => r.id === id);
    if (req) {
      await addAccount({
        username: req.username, password, displayName: req.displayName,
        role: req.role, enabled: true, laborId: req.laborId, linkedPersonnelId,
      });
      await supabase.from('account_requests').delete().eq('id', id);
      await fetchRequests();
    }
  };

  const rejectRequest = async (id: string) => {
    await supabase.from('account_requests').delete().eq('id', id);
    await fetchRequests();
  };

  return (
    <AppContext.Provider value={{
      currentRole, setCurrentRole, currentUserName, currentUserId, currentPersonnelId, currentLaborId,
      isLoggedIn, login, logout, accounts, addAccount, updateAccount, deleteAccount,
      changePassword, refreshAccounts, accountRequests, submitAccountRequest, approveRequest, rejectRequest,
    }}>
      {children}
    </AppContext.Provider>
  );
};
