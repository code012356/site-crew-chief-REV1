export type UserRole = 'admin' | 'equipment_admin' | 'foreman' | 'engineer';

export type PersonnelStatus = 'active' | 'leave' | 'resigned';
export type EquipmentStatus = 'available' | 'in_use' | 'maintenance' | 'retired';
export type LogStatus = 'pending' | 'approved' | 'conditional' | 'rejected' | 'withdraw_requested' | 'withdrawn';

export interface Personnel {
  id: string;
  laborId?: string;
  codeNo?: string;
  passportNo?: string;
  visaExpiryDate?: string;
  name: string;
  role: 'worker' | 'foreman' | 'engineer';
  phone: string;
  status: PersonnelStatus;
  specialty?: string;
  nationality?: string;
  joinDate: string;
  projectDept?: string;
  assignedTo?: string;
  workLine?: string;
  actualWork?: string;
  leaveDate?: string;
  leaveCount?: number;
  seqNo?: number;
}

export interface Equipment {
  id: string;
  equipmentNo?: string;
  name: string;
  model: string;
  status: EquipmentStatus;
  location?: string;
}

export interface LogRevision {
  timestamp: string;
  entries: DailyLogEntry[];
  equipmentUsage: EquipmentUsageEntry[];
  reviewComment?: string;
  previousStatus?: LogStatus;
}

export interface DailyLog {
  id: string;
  date: string;
  foremanId: string;
  foremanName: string;
  status: LogStatus;
  reviewComment?: string;
  entries: DailyLogEntry[];
  equipmentUsage: EquipmentUsageEntry[];
  revisions?: LogRevision[];
  deletedAt?: string;
}

export interface DailyLogEntry {
  id: string;
  workerId: string;
  workerName: string;
  startTime: string;
  endTime: string;
  hours: number;
  area: string;
  areaDetail?: string;
  workCodeId: string;
  workCodeName: string;
  detail: string;
}

export interface WorkCode {
  id: string;
  code: string;
  name: string;
  category: string;
  area?: string;
}

export interface WorkArea {
  id: string;
  name: string;
}

export interface EquipmentUsageEntry {
  id: string;
  equipmentId: string;
  equipmentName: string;
  startTime: string;
  endTime: string;
  hours: number;
  area: string;
  areaDetail?: string;
  workCodeId: string;
  workCodeName: string;
  detail: string;
}

export interface TeamAssignment {
  foremanId: string;
  workerIds: string[];
  equipmentIds: string[];
}

export interface EngineerAssignment {
  engineerId: string;
  foremanIds: string[];
}

export type EquipmentRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'engineer_pending' | 'engineer_approved' | 'engineer_rejected';
export type EquipmentRequestType = 'existing' | 'new';

export interface EquipmentRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  requestType: EquipmentRequestType;
  equipmentId?: string;
  equipmentName: string;
  reason: string;
  status: EquipmentRequestStatus;
  adminComment?: string;
  engineerComment?: string;
  createdAt: string;
  resolvedAt?: string;
}

export const DEFAULT_WORK_AREAS = [
  'Area A',
  'Area B',
  'Area C',
  'Area D',
  'Area E',
  'Area F',
];

export const WORK_AREAS = [
  'A区 基础施工',
  'B区 主体结构',
  'C区 装饰装修',
  'D区 机电安装',
  'E区 外墙施工',
  'F区 道路铺设',
];
