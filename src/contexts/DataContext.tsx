import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Personnel, Equipment, TeamAssignment, PersonnelStatus, EquipmentStatus, WorkCode, WorkArea, EngineerAssignment, DailyLog, DailyLogEntry, EquipmentUsageEntry, LogRevision, EquipmentRequest, EquipmentRequestStatus, DEFAULT_WORK_AREAS } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';

interface DataContextType {
  personnel: Personnel[];
  equipment: Equipment[];
  teamAssignments: TeamAssignment[];
  workCodes: WorkCode[];
  workAreas: WorkArea[];
  engineerAssignments: EngineerAssignment[];
  dailyLogs: DailyLog[];
  equipmentRequests: EquipmentRequest[];
  getTeamWorkers: (foremanId: string) => Personnel[];
  getTeamEquipment: (foremanId: string) => Equipment[];
  getAvailableWorkers: (foremanId: string) => Personnel[];
  getAvailableEquipment: (foremanId: string) => Equipment[];
  getEngineerForemen: (engineerId: string) => string[];
  // Personnel CRUD
  addPersonnel: (p: Omit<Personnel, 'id'>) => Promise<string>;
  updatePersonnel: (id: string, updates: Partial<Omit<Personnel, 'id'>>) => Promise<void>;
  deletePersonnel: (id: string) => Promise<void>;
  batchUpdatePersonnelStatus: (ids: string[], status: PersonnelStatus) => Promise<void>;
  batchDeletePersonnel: (ids: string[]) => Promise<void>;
  batchAddPersonnel: (list: Omit<Personnel, 'id'>[]) => Promise<string[]>;
  importPersonnelBatch: (list: Omit<Personnel, 'id'>[]) => Promise<{ ids: string[]; addedIds: string[]; updatedIds: string[] }>;
  // Work code CRUD
  addWorkCode: (wc: Omit<WorkCode, 'id'>) => Promise<void>;
  updateWorkCode: (id: string, updates: Partial<Omit<WorkCode, 'id'>>) => Promise<void>;
  deleteWorkCode: (id: string) => Promise<void>;
  addWorkArea: (name: string) => Promise<void>;
  updateWorkArea: (id: string, name: string) => Promise<void>;
  deleteWorkArea: (id: string) => Promise<void>;
  // Equipment CRUD
  addEquipment: (eq: Omit<Equipment, 'id'>) => Promise<string>;
  updateEquipment: (id: string, updates: Partial<Omit<Equipment, 'id'>>) => Promise<void>;
  batchUpdateEquipment: (ids: string[], updates: Partial<Omit<Equipment, 'id'>>) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
  // Team assignment CRUD
  updateTeamAssignment: (foremanId: string, workerIds: string[], equipmentIds: string[]) => Promise<void>;
  addWorkerToTeam: (foremanId: string, workerId: string) => Promise<void>;
  removeWorkerFromTeam: (foremanId: string, workerId: string) => Promise<void>;
  addEquipmentToTeam: (foremanId: string, equipmentId: string) => Promise<void>;
  removeEquipmentFromTeam: (foremanId: string, equipmentId: string) => Promise<void>;
  setTeamAssignmentsBatch: (assignments: TeamAssignment[]) => Promise<void>;
  // Engineer assignment CRUD
  setEngineerAssignmentsBatch: (assignments: EngineerAssignment[]) => Promise<void>;
  // Daily log CRUD
  addDailyLog: (log: Omit<DailyLog, 'id'>) => Promise<void>;
  updateDailyLog: (id: string, updates: Partial<Omit<DailyLog, 'id'>>) => Promise<void>;
  deleteDailyLog: (id: string) => Promise<void>;
  softDeleteDailyLog: (id: string) => Promise<void>;
  restoreDailyLog: (id: string) => Promise<void>;
  emptyTrash: (logIds: string[]) => Promise<void>;
  // Equipment request CRUD
  addEquipmentRequest: (req: Omit<EquipmentRequest, 'id' | 'createdAt' | 'resolvedAt'>) => Promise<void>;
  updateEquipmentRequest: (id: string, updates: Partial<EquipmentRequest>) => Promise<void>;
  deleteEquipmentRequest: (id: string) => Promise<void>;
  // Refresh
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const PAGE_SIZE = 1000;
const MUTATION_CHUNK_SIZE = 100;

function assertSupabaseOk(error: any, action: string) {
  if (error) {
    console.error(`${action} failed`, error);
    throw new Error(error.message || `${action} failed`);
  }
}

function isMissingAreaColumnError(error: any) {
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return text.includes('area') && (text.includes('column') || text.includes('schema cache'));
}

function isMissingLeaveColumnError(error: any) {
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return /leave_(date|count)/.test(text) && (text.includes('column') || text.includes('schema cache'));
}

function withoutLeaveFields<T extends Record<string, any>>(row: T) {
  const { leave_date, leave_count, ...fallbackRow } = row;
  return fallbackRow;
}

function stripTimeFields<T extends Record<string, any>>(entry: T) {
  const { startTime, endTime, ...rest } = entry;
  return rest;
}

function stripDailyLogTimeFields(log: Pick<DailyLog, 'entries' | 'equipmentUsage'> & { revisions?: LogRevision[] }) {
  return {
    entries: log.entries.map(stripTimeFields),
    equipmentUsage: log.equipmentUsage.map(stripTimeFields),
    revisions: log.revisions?.map(revision => ({
      ...revision,
      entries: revision.entries.map(stripTimeFields),
      equipmentUsage: revision.equipmentUsage.map(stripTimeFields),
    })),
  };
}

function toPersonnelDbRow(p: Omit<Personnel, 'id'>) {
  return {
    labor_id: p.laborId || null, code_no: p.codeNo || null,
    passport_no: p.passportNo || null, visa_expiry_date: p.visaExpiryDate || null,
    name: p.name, role: p.role, phone: p.phone,
    status: p.status, specialty: p.specialty || null,
    nationality: p.nationality || null, join_date: p.joinDate,
    project_dept: p.projectDept || null, assigned_to: p.assignedTo || null,
    work_line: p.workLine || null, actual_work: p.actualWork || null,
    leave_date: p.leaveDate || null, leave_count: p.leaveCount || 0,
    seq_no: p.seqNo || null,
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function fetchAllRows(table: string, order?: { column: string; ascending?: boolean }) {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = (supabase as any).from(table).select('*');
    if (order) query = query.order(order.column, { ascending: order.ascending ?? true });
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    assertSupabaseOk(error, `Fetch ${table}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function deleteRowsByIds(table: string, column: string, ids: string[]) {
  for (const part of chunkArray(ids, MUTATION_CHUNK_SIZE)) {
    const { error } = await (supabase as any).from(table).delete().in(column, part);
    assertSupabaseOk(error, `Delete ${table}`);
  }
}

async function updateRowsByIds(table: string, column: string, ids: string[], updates: Record<string, any>) {
  for (const part of chunkArray(ids, MUTATION_CHUNK_SIZE)) {
    const { error } = await (supabase as any).from(table).update(updates).in(column, part);
    assertSupabaseOk(error, `Update ${table}`);
  }
}

export const useDataContext = () => {
  const ctx = useContext(DataContext);
  if (!ctx) {
    // During HMR, context may temporarily be undefined — provide helpful error
    throw new Error('useDataContext must be within DataProvider. If you see this after a hot reload, please refresh the page.');
  }
  return ctx;
};

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [workCodes, setWorkCodes] = useState<WorkCode[]>([]);
  const [workAreas, setWorkAreas] = useState<WorkArea[]>([]);
  const [engineerAssignments, setEngineerAssignments] = useState<EngineerAssignment[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [equipmentRequests, setEquipmentRequests] = useState<EquipmentRequest[]>([]);

  // ── Fetch functions ──
  const fetchPersonnel = useCallback(async () => {
    const data = await fetchAllRows('personnel', { column: 'name' });
    if (data) {
      setPersonnel(data.map((r: any) => ({
        id: r.id,
        laborId: r.labor_id || undefined,
        codeNo: r.code_no || undefined,
        passportNo: r.passport_no || undefined,
        visaExpiryDate: r.visa_expiry_date || undefined,
        name: r.name,
        role: r.role as Personnel['role'],
        phone: r.phone,
        status: r.status as PersonnelStatus,
        specialty: r.specialty || undefined,
        nationality: r.nationality || undefined,
        joinDate: r.join_date,
        projectDept: r.project_dept || undefined,
        assignedTo: r.assigned_to || undefined,
        workLine: r.work_line || undefined,
        actualWork: r.actual_work || undefined,
        leaveDate: r.leave_date || undefined,
        leaveCount: r.leave_count ?? undefined,
        seqNo: r.seq_no || undefined,
      })));
    }
  }, []);

  const fetchEquipment = useCallback(async () => {
    const data = await fetchAllRows('equipment', { column: 'name' });
    if (data) {
      setEquipment(data.map((r: any) => ({
        id: r.id,
        equipmentNo: r.equipment_no || undefined,
        name: r.name,
        model: r.model,
        status: r.status as EquipmentStatus,
        location: r.location || undefined,
      })));
    }
  }, []);

  const fetchWorkCodes = useCallback(async () => {
    const data = await fetchAllRows('work_codes', { column: 'code' });
    if (data) {
      setWorkCodes(data.map((r: any) => ({ id: r.id, code: r.code, name: r.name, category: r.category, area: r.area || undefined })));
    }
  }, []);

  const fetchWorkAreas = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('work_areas')
      .select('*')
      .order('name');
    if (error) {
      console.warn('Fetch work_areas failed; using defaults until migration is applied', error);
      setWorkAreas(DEFAULT_WORK_AREAS.map((name, index) => ({ id: `default_${index}`, name })));
      return;
    }
    const rows = (data || []).map((r: any) => ({ id: r.id, name: r.name }));
    setWorkAreas(rows.length ? rows : DEFAULT_WORK_AREAS.map((name, index) => ({ id: `default_${index}`, name })));
  }, []);

  const fetchTeamAssignments = useCallback(async () => {
    const data = await fetchAllRows('team_assignments');
    if (data) {
      setTeamAssignments(data.map((r: any) => ({
        foremanId: r.foreman_id,
        workerIds: (r.worker_ids as string[]) || [],
        equipmentIds: (r.equipment_ids as string[]) || [],
      })));
    }
  }, []);

  const fetchEngineerAssignments = useCallback(async () => {
    const data = await fetchAllRows('engineer_assignments');
    if (data) {
      setEngineerAssignments(data.map((r: any) => ({
        engineerId: r.engineer_id,
        foremanIds: (r.foreman_ids as string[]) || [],
      })));
    }
  }, []);

  const fetchDailyLogs = useCallback(async () => {
    const data = await fetchAllRows('daily_logs', { column: 'created_at', ascending: false });
    if (data) {
      setDailyLogs(data.map((r: any) => ({
        id: r.id,
        date: r.date,
        foremanId: r.foreman_id,
        foremanName: r.foreman_name,
        status: r.status as DailyLog['status'],
        reviewComment: r.review_comment || undefined,
        entries: (r.entries as DailyLogEntry[]) || [],
        equipmentUsage: (r.equipment_usage as EquipmentUsageEntry[]) || [],
        revisions: (r.revisions as LogRevision[]) || undefined,
        deletedAt: r.deleted_at || undefined,
      })));
    }
  }, []);

  const fetchEquipmentRequests = useCallback(async () => {
    const data = await fetchAllRows('equipment_requests', { column: 'created_at', ascending: false });
    if (data) {
      setEquipmentRequests(data.map((r: any) => ({
        id: r.id,
        requesterId: r.requester_id,
        requesterName: r.requester_name,
        requesterRole: r.requester_role,
        requestType: r.request_type || 'existing',
        equipmentId: r.equipment_id || undefined,
        equipmentName: r.equipment_name,
        quantity: r.quantity || undefined,
        requiredDate: r.required_date || undefined,
        requestArea: r.request_area || undefined,
        suggestedModel: r.suggested_model || undefined,
        priority: r.priority || undefined,
        reason: r.reason,
        status: r.status as EquipmentRequestStatus,
        adminComment: r.admin_comment || undefined,
        engineerComment: r.engineer_comment || undefined,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at || undefined,
      })));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchPersonnel(), fetchEquipment(), fetchWorkCodes(), fetchWorkAreas(), fetchTeamAssignments(), fetchEngineerAssignments(), fetchDailyLogs(), fetchEquipmentRequests()]);
  }, [fetchPersonnel, fetchEquipment, fetchWorkCodes, fetchWorkAreas, fetchTeamAssignments, fetchEngineerAssignments, fetchDailyLogs, fetchEquipmentRequests]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  // Realtime subscription for daily_logs
  useEffect(() => {
    const channel = supabase
      .channel('daily_logs_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_logs' },
        () => { fetchDailyLogs(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDailyLogs]);

  // Realtime subscription for all other tables
  useEffect(() => {
    const channel = supabase
      .channel('all_tables_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' }, () => { fetchEquipment(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_requests' }, () => { fetchEquipmentRequests(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_assignments' }, () => { fetchTeamAssignments(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personnel' }, () => { fetchPersonnel(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'engineer_assignments' }, () => { fetchEngineerAssignments(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_codes' }, () => { fetchWorkCodes(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_areas' }, () => { fetchWorkAreas(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEquipment, fetchEquipmentRequests, fetchTeamAssignments, fetchPersonnel, fetchEngineerAssignments, fetchWorkCodes, fetchWorkAreas]);

  // ── Personnel CRUD ──
  const addPersonnel = async (p: Omit<Personnel, 'id'>): Promise<string> => {
    const row = toPersonnelDbRow(p);
    let { data, error } = await supabase.from('personnel').insert(row).select('id').single();
    if (error && isMissingLeaveColumnError(error)) {
      ({ data, error } = await supabase.from('personnel').insert(withoutLeaveFields(row)).select('id').single());
    }
    assertSupabaseOk(error, 'Add personnel');
    await fetchPersonnel();
    return data?.id || '';
  };

  const updatePersonnel = async (id: string, updates: Partial<Omit<Personnel, 'id'>>) => {
    const db: any = {};
    if (updates.laborId !== undefined) db.labor_id = updates.laborId || null;
    if (updates.codeNo !== undefined) db.code_no = updates.codeNo || null;
    if (updates.passportNo !== undefined) db.passport_no = updates.passportNo || null;
    if (updates.visaExpiryDate !== undefined) db.visa_expiry_date = updates.visaExpiryDate || null;
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.role !== undefined) db.role = updates.role;
    if (updates.phone !== undefined) db.phone = updates.phone;
    if (updates.status !== undefined) db.status = updates.status;
    if (updates.specialty !== undefined) db.specialty = updates.specialty || null;
    if (updates.nationality !== undefined) db.nationality = updates.nationality || null;
    if (updates.joinDate !== undefined) db.join_date = updates.joinDate;
    if (updates.projectDept !== undefined) db.project_dept = updates.projectDept || null;
    if (updates.assignedTo !== undefined) db.assigned_to = updates.assignedTo || null;
    if (updates.workLine !== undefined) db.work_line = updates.workLine || null;
    if (updates.actualWork !== undefined) db.actual_work = updates.actualWork || null;
    if (updates.leaveDate !== undefined) db.leave_date = updates.leaveDate || null;
    if (updates.leaveCount !== undefined) db.leave_count = updates.leaveCount || 0;
    if (updates.seqNo !== undefined) db.seq_no = updates.seqNo || null;
    let { error } = await supabase.from('personnel').update(db).eq('id', id);
    if (error && isMissingLeaveColumnError(error)) {
      const fallbackDb = withoutLeaveFields(db);
      if (Object.keys(fallbackDb).length > 0) {
        ({ error } = await supabase.from('personnel').update(fallbackDb).eq('id', id));
      } else {
        error = null;
      }
    }
    assertSupabaseOk(error, 'Update personnel');
    await fetchPersonnel();
  };

  const deletePersonnel = async (id: string) => {
    let result: any = await supabase.from('personnel').delete().eq('id', id);
    assertSupabaseOk(result.error, 'Delete personnel');
    // Cascade: delete linked accounts
    result = await supabase.from('accounts').delete().eq('linked_personnel_id', id);
    assertSupabaseOk(result.error, 'Delete linked account');
    // Also remove from team/engineer assignments
    const ta = teamAssignments.map(a => ({
      ...a,
      workerIds: a.workerIds.filter(wid => wid !== id),
    })).filter(a => a.foremanId !== id);
    const ea = engineerAssignments.map(a => ({
      ...a,
      foremanIds: a.foremanIds.filter(fid => fid !== id),
    })).filter(a => a.engineerId !== id);
    await setTeamAssignmentsBatch(ta);
    await setEngineerAssignmentsBatch(ea);
    await fetchPersonnel();
  };

  const batchUpdatePersonnelStatus = async (ids: string[], status: PersonnelStatus) => {
    if (ids.length === 0) return;
    await updateRowsByIds('personnel', 'id', ids, { status });
    if (status === 'resigned') {
      const ta = teamAssignments.map(a => ({
        ...a, workerIds: a.workerIds.filter(wid => !ids.includes(wid)),
      })).filter(a => !ids.includes(a.foremanId));
      const ea = engineerAssignments.map(a => ({
        ...a, foremanIds: a.foremanIds.filter(fid => !ids.includes(fid)),
      }));
      await setTeamAssignmentsBatch(ta);
      await setEngineerAssignmentsBatch(ea);
    }
    await fetchPersonnel();
  };

  const batchDeletePersonnel = async (ids: string[]) => {
    if (ids.length === 0) return;
    await deleteRowsByIds('personnel', 'id', ids);
    // Cascade: delete linked accounts
    await deleteRowsByIds('accounts', 'linked_personnel_id', ids);
    const ta = teamAssignments.map(a => ({
      ...a, workerIds: a.workerIds.filter(wid => !ids.includes(wid)),
    })).filter(a => !ids.includes(a.foremanId));
    const ea = engineerAssignments.map(a => ({
      ...a, foremanIds: a.foremanIds.filter(fid => !ids.includes(fid)),
    })).filter(a => !ids.includes(a.engineerId));
    await setTeamAssignmentsBatch(ta);
    await setEngineerAssignmentsBatch(ea);
    await fetchPersonnel();
  };

  const batchAddPersonnel = async (list: Omit<Personnel, 'id'>[]): Promise<string[]> => {
    if (list.length === 0) return [];
    const rows = list.map(toPersonnelDbRow);
    const rowsWithoutLeaveFields = rows.map(withoutLeaveFields);
    const inserted: any[] = [];
    for (const part of chunkArray(rows, MUTATION_CHUNK_SIZE)) {
      let { data, error } = await supabase.from('personnel').insert(part).select('id');
      if (error && isMissingLeaveColumnError(error)) {
        const start = inserted.length;
        const fallbackPart = rowsWithoutLeaveFields.slice(start, start + part.length);
        const fallback = await supabase.from('personnel').insert(fallbackPart).select('id');
        data = fallback.data;
        error = fallback.error;
      }
      assertSupabaseOk(error, 'Batch add personnel');
      inserted.push(...(data || []));
    }
    await fetchPersonnel();
    return inserted.map((r: any) => r.id);
  };

  const importPersonnelBatch = async (list: Omit<Personnel, 'id'>[]): Promise<{ ids: string[]; addedIds: string[]; updatedIds: string[] }> => {
    if (list.length === 0) return { ids: [], addedIds: [], updatedIds: [] };

    const laborIds = Array.from(new Set(list.map(p => p.laborId?.trim()).filter(Boolean) as string[]));
    const existingByLaborId = new Map<string, string>();
    for (const part of chunkArray(laborIds, MUTATION_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('personnel')
        .select('id,labor_id')
        .in('labor_id', part);
      assertSupabaseOk(error, 'Find existing personnel');
      (data || []).forEach((row: any) => {
        if (row.labor_id) existingByLaborId.set(row.labor_id, row.id);
      });
    }

    const ids: string[] = [];
    const addedIds: string[] = [];
    const updatedIds: string[] = [];

    for (const person of list) {
      const row = toPersonnelDbRow(person);
      const laborId = person.laborId?.trim();
      const existingId = laborId ? existingByLaborId.get(laborId) : undefined;

      if (existingId) {
        let { error } = await supabase.from('personnel').update(row).eq('id', existingId);
        if (error && isMissingLeaveColumnError(error)) {
          ({ error } = await supabase.from('personnel').update(withoutLeaveFields(row)).eq('id', existingId));
        }
        assertSupabaseOk(error, 'Update imported personnel');
        ids.push(existingId);
        if (!updatedIds.includes(existingId)) updatedIds.push(existingId);
        continue;
      }

      let { data, error } = await supabase.from('personnel').insert(row).select('id').single();
      if (error && isMissingLeaveColumnError(error)) {
        ({ data, error } = await supabase.from('personnel').insert(withoutLeaveFields(row)).select('id').single());
      }
      assertSupabaseOk(error, 'Add imported personnel');
      const id = data?.id || '';
      ids.push(id);
      addedIds.push(id);
      if (laborId && id) existingByLaborId.set(laborId, id);
    }

    await fetchPersonnel();
    return { ids, addedIds, updatedIds };
  };

  // ── Work code CRUD ──
  const addWorkCode = async (wc: Omit<WorkCode, 'id'>) => {
    const row = { code: wc.code, name: wc.name, category: wc.category, area: wc.area || null };
    let { error } = await supabase.from('work_codes').insert(row as any);
    if (error && isMissingAreaColumnError(error)) {
      const { area, ...fallbackRow } = row;
      ({ error } = await supabase.from('work_codes').insert(fallbackRow as any));
    }
    assertSupabaseOk(error, 'Add work code');
    await fetchWorkCodes();
  };
  const updateWorkCode = async (id: string, updates: Partial<Omit<WorkCode, 'id'>>) => {
    const db: any = {};
    if (updates.code !== undefined) db.code = updates.code;
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.category !== undefined) db.category = updates.category;
    if (updates.area !== undefined) db.area = updates.area || null;
    let { error } = await supabase.from('work_codes').update(db).eq('id', id);
    if (error && isMissingAreaColumnError(error)) {
      const { area, ...fallbackDb } = db;
      ({ error } = await supabase.from('work_codes').update(fallbackDb).eq('id', id));
    }
    assertSupabaseOk(error, 'Update work code');
    await fetchWorkCodes();
  };
  const deleteWorkCode = async (id: string) => {
    const { error } = await supabase.from('work_codes').delete().eq('id', id);
    assertSupabaseOk(error, 'Delete work code');
    await fetchWorkCodes();
  };

  const addWorkArea = async (name: string) => {
    const { error } = await (supabase as any).from('work_areas').insert({ name: name.trim() });
    assertSupabaseOk(error, 'Add work area');
    await fetchWorkAreas();
  };
  const updateWorkArea = async (id: string, name: string) => {
    const { error } = await (supabase as any).from('work_areas').update({ name: name.trim() }).eq('id', id);
    assertSupabaseOk(error, 'Update work area');
    await fetchWorkAreas();
  };
  const deleteWorkArea = async (id: string) => {
    const { error } = await (supabase as any).from('work_areas').delete().eq('id', id);
    assertSupabaseOk(error, 'Delete work area');
    await fetchWorkAreas();
  };

  // ── Equipment CRUD ──
  const addEquipment = async (eq: Omit<Equipment, 'id'>): Promise<string> => {
    const { data, error } = await supabase.from('equipment').insert({
      equipment_no: eq.equipmentNo || null, name: eq.name, model: eq.model,
      status: eq.status, location: eq.location || null,
    }).select('id').single();
    assertSupabaseOk(error, 'Add equipment');
    await fetchEquipment();
    return data?.id || '';
  };
  const updateEquipment = async (id: string, updates: Partial<Omit<Equipment, 'id'>>) => {
    const db: any = {};
    if (updates.equipmentNo !== undefined) db.equipment_no = updates.equipmentNo;
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.model !== undefined) db.model = updates.model;
    if (updates.status !== undefined) db.status = updates.status;
    if (updates.location !== undefined) db.location = updates.location;
    const { error } = await supabase.from('equipment').update(db).eq('id', id);
    assertSupabaseOk(error, 'Update equipment');
    await fetchEquipment();
  };
  const batchUpdateEquipment = async (ids: string[], updates: Partial<Omit<Equipment, 'id'>>) => {
    if (ids.length === 0) return;
    const db: any = {};
    if (updates.equipmentNo !== undefined) db.equipment_no = updates.equipmentNo;
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.model !== undefined) db.model = updates.model;
    if (updates.status !== undefined) db.status = updates.status;
    if (updates.location !== undefined) db.location = updates.location || null;
    if (Object.keys(db).length === 0) return;
    for (const part of chunkArray(ids, MUTATION_CHUNK_SIZE)) {
      const { error } = await supabase.from('equipment').update(db).in('id', part);
      assertSupabaseOk(error, 'Batch update equipment');
    }
    await fetchEquipment();
  };
  const deleteEquipment = async (id: string) => {
    const { error } = await supabase.from('equipment').delete().eq('id', id);
    assertSupabaseOk(error, 'Delete equipment');
    await fetchEquipment();
  };

  // ── Team assignment CRUD ──
  const updateTeamAssignment = async (foremanId: string, workerIds: string[], equipmentIds: string[]) => {
    const { error } = await supabase.from('team_assignments').upsert({
      foreman_id: foremanId, worker_ids: [...new Set(workerIds)], equipment_ids: [...new Set(equipmentIds)],
    }, { onConflict: 'foreman_id' });
    assertSupabaseOk(error, 'Update team assignment');
    await fetchTeamAssignments();
  };

  const addWorkerToTeam = async (foremanId: string, workerId: string) => {
    const a = teamAssignments.find(t => t.foremanId === foremanId);
    const workerIds = [...new Set([...(a?.workerIds || []), workerId])];
    await updateTeamAssignment(foremanId, workerIds, a?.equipmentIds || []);
  };

  const removeWorkerFromTeam = async (foremanId: string, workerId: string) => {
    const a = teamAssignments.find(t => t.foremanId === foremanId);
    if (!a) return;
    await updateTeamAssignment(foremanId, a.workerIds.filter(id => id !== workerId), a.equipmentIds);
  };

  const addEquipmentToTeam = async (foremanId: string, equipmentId: string) => {
    const normalized = teamAssignments.map(a => ({
      ...a,
      workerIds: [...new Set(a.workerIds)],
      equipmentIds: [...new Set(a.equipmentIds)],
    }));
    const target = normalized.find(t => t.foremanId === foremanId);
    if (target) {
      target.equipmentIds = [...new Set([...target.equipmentIds, equipmentId])];
    } else {
      normalized.push({ foremanId, workerIds: [], equipmentIds: [equipmentId] });
    }
    await setTeamAssignmentsBatch(normalized);
  };

  const removeEquipmentFromTeam = async (foremanId: string, equipmentId: string) => {
    const a = teamAssignments.find(t => t.foremanId === foremanId);
    if (!a) return;
    await updateTeamAssignment(foremanId, a.workerIds, a.equipmentIds.filter(id => id !== equipmentId));
  };

  const setTeamAssignmentsBatch = async (assignments: TeamAssignment[]) => {
    // Delete all existing, re-insert
    let result: any = await supabase.from('team_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    assertSupabaseOk(result.error, 'Clear team assignments');
    if (assignments.length > 0) {
      for (const part of chunkArray(assignments, MUTATION_CHUNK_SIZE)) {
        result = await supabase.from('team_assignments').insert(
          part.map(a => ({ foreman_id: a.foremanId, worker_ids: a.workerIds, equipment_ids: a.equipmentIds }))
        );
        assertSupabaseOk(result.error, 'Insert team assignments');
      }
    }
    await fetchTeamAssignments();
  };

  // ── Engineer assignment CRUD ──
  const setEngineerAssignmentsBatch = async (assignments: EngineerAssignment[]) => {
    let result: any = await supabase.from('engineer_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    assertSupabaseOk(result.error, 'Clear engineer assignments');
    if (assignments.length > 0) {
      for (const part of chunkArray(assignments, MUTATION_CHUNK_SIZE)) {
        result = await supabase.from('engineer_assignments').insert(
          part.map(a => ({ engineer_id: a.engineerId, foreman_ids: a.foremanIds }))
        );
        assertSupabaseOk(result.error, 'Insert engineer assignments');
      }
    }
    await fetchEngineerAssignments();
  };

  // ── Daily log CRUD ──
  const addDailyLog = async (log: Omit<DailyLog, 'id'>) => {
    const sanitized = stripDailyLogTimeFields(log);
    const { error } = await supabase.from('daily_logs').insert({
      date: log.date, foreman_id: log.foremanId, foreman_name: log.foremanName,
      status: log.status, review_comment: log.reviewComment || null,
      entries: sanitized.entries as any, equipment_usage: sanitized.equipmentUsage as any,
      revisions: sanitized.revisions as any || null,
    });
    assertSupabaseOk(error, 'Add daily log');
    await fetchDailyLogs();
  };

  const updateDailyLog = async (id: string, updates: Partial<Omit<DailyLog, 'id'>>) => {
    const db: any = {};
    if (updates.date !== undefined) db.date = updates.date;
    if (updates.foremanId !== undefined) db.foreman_id = updates.foremanId;
    if (updates.foremanName !== undefined) db.foreman_name = updates.foremanName;
    if (updates.status !== undefined) db.status = updates.status;
    if (updates.reviewComment !== undefined) db.review_comment = updates.reviewComment || null;
    if (updates.entries !== undefined) db.entries = updates.entries.map(stripTimeFields);
    if (updates.equipmentUsage !== undefined) db.equipment_usage = updates.equipmentUsage.map(stripTimeFields);
    if (updates.revisions !== undefined) db.revisions = updates.revisions.map(revision => ({
      ...revision,
      entries: revision.entries.map(stripTimeFields),
      equipmentUsage: revision.equipmentUsage.map(stripTimeFields),
    }));
    if (updates.deletedAt !== undefined) db.deleted_at = updates.deletedAt || null;
    const { error } = await supabase.from('daily_logs').update(db).eq('id', id);
    assertSupabaseOk(error, 'Update daily log');
    await fetchDailyLogs();
  };

  const deleteDailyLog = async (id: string) => {
    const { error } = await supabase.from('daily_logs').delete().eq('id', id);
    assertSupabaseOk(error, 'Delete daily log');
    await fetchDailyLogs();
  };

  const softDeleteDailyLog = async (id: string) => {
    await updateDailyLog(id, { deletedAt: new Date().toISOString() });
  };

  const restoreDailyLog = async (id: string) => {
    const { error } = await supabase.from('daily_logs').update({ deleted_at: null }).eq('id', id);
    assertSupabaseOk(error, 'Restore daily log');
    await fetchDailyLogs();
  };

  const emptyTrash = async (logIds: string[]) => {
    await deleteRowsByIds('daily_logs', 'id', logIds);
    await fetchDailyLogs();
  };

  // ── Equipment Request CRUD ──
  const addEquipmentRequest = async (req: Omit<EquipmentRequest, 'id' | 'createdAt' | 'resolvedAt'>) => {
    const { error } = await supabase.from('equipment_requests').insert({
      requester_id: req.requesterId,
      requester_name: req.requesterName,
      requester_role: req.requesterRole,
      request_type: req.requestType,
      equipment_id: req.equipmentId || null,
      equipment_name: req.equipmentName,
      quantity: req.quantity || null,
      required_date: req.requiredDate || null,
      request_area: req.requestArea || null,
      suggested_model: req.suggestedModel || null,
      priority: req.priority || null,
      reason: req.reason,
      status: req.status,
      admin_comment: req.adminComment || null,
    } as any);
    assertSupabaseOk(error, 'Add equipment request');
    await fetchEquipmentRequests();
  };

  const updateEquipmentRequest = async (id: string, updates: Partial<EquipmentRequest>) => {
    const db: any = {};
    if (updates.status !== undefined) db.status = updates.status;
    if (updates.adminComment !== undefined) db.admin_comment = updates.adminComment;
    if (updates.engineerComment !== undefined) db.engineer_comment = updates.engineerComment;
    if (updates.resolvedAt !== undefined) db.resolved_at = updates.resolvedAt;
    if (updates.requestType !== undefined) db.request_type = updates.requestType;
    if (updates.equipmentId !== undefined) db.equipment_id = updates.equipmentId || null;
    if (updates.equipmentName !== undefined) db.equipment_name = updates.equipmentName;
    if (updates.quantity !== undefined) db.quantity = updates.quantity || null;
    if (updates.requiredDate !== undefined) db.required_date = updates.requiredDate || null;
    if (updates.requestArea !== undefined) db.request_area = updates.requestArea || null;
    if (updates.suggestedModel !== undefined) db.suggested_model = updates.suggestedModel || null;
    if (updates.priority !== undefined) db.priority = updates.priority || null;
    if (updates.reason !== undefined) db.reason = updates.reason;
    const { error } = await supabase.from('equipment_requests').update(db).eq('id', id);
    assertSupabaseOk(error, 'Update equipment request');
    await fetchEquipmentRequests();
  };

  const deleteEquipmentRequest = async (id: string) => {
    const { error } = await supabase.from('equipment_requests').delete().eq('id', id);
    assertSupabaseOk(error, 'Delete equipment request');
    await fetchEquipmentRequests();
  };

  // ── Helper functions ──
  const getTeamWorkers = (foremanId: string) => {
    const a = teamAssignments.find(t => t.foremanId === foremanId);
    if (!a) return [];
    return personnel.filter(p => a.workerIds.includes(p.id));
  };

  const getTeamEquipment = (foremanId: string) => {
    const a = teamAssignments.find(t => t.foremanId === foremanId);
    if (!a) return [];
    return equipment.filter(e => a.equipmentIds.includes(e.id));
  };

  const getAvailableWorkers = (foremanId: string) => {
    const a = teamAssignments.find(t => t.foremanId === foremanId);
    const currentIds = a?.workerIds || [];
    return personnel.filter(p => p.role === 'worker' && !currentIds.includes(p.id) && p.status !== 'resigned');
  };

  const getAvailableEquipment = (foremanId: string) => {
    const a = teamAssignments.find(t => t.foremanId === foremanId);
    const currentIds = a?.equipmentIds || [];
    return equipment.filter(e => !currentIds.includes(e.id) && e.status !== 'retired');
  };

  const getEngineerForemen = (engineerId: string): string[] => {
    const a = engineerAssignments.find(t => t.engineerId === engineerId);
    return a?.foremanIds || [];
  };

  return (
    <DataContext.Provider value={{
      personnel, equipment, teamAssignments, workCodes, workAreas, engineerAssignments, dailyLogs, equipmentRequests,
      getTeamWorkers, getTeamEquipment, getAvailableWorkers, getAvailableEquipment, getEngineerForemen,
      addPersonnel, updatePersonnel, deletePersonnel, batchUpdatePersonnelStatus,
      batchDeletePersonnel, batchAddPersonnel, importPersonnelBatch,
      addWorkCode, updateWorkCode, deleteWorkCode,
      addWorkArea, updateWorkArea, deleteWorkArea,
      addEquipment, updateEquipment, batchUpdateEquipment, deleteEquipment,
      updateTeamAssignment, addWorkerToTeam, removeWorkerFromTeam, addEquipmentToTeam, removeEquipmentFromTeam, setTeamAssignmentsBatch,
      setEngineerAssignmentsBatch,
      addDailyLog, updateDailyLog, deleteDailyLog, softDeleteDailyLog, restoreDailyLog, emptyTrash,
      addEquipmentRequest, updateEquipmentRequest, deleteEquipmentRequest,
      refreshAll,
    }}>
      {children}
    </DataContext.Provider>
  );
};
