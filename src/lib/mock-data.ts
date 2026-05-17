import { Personnel, Equipment, DailyLog, TeamAssignment, WorkCode, EngineerAssignment } from './types';

export const mockWorkCodes: WorkCode[] = [
  { id: 'wc1', code: 'TJ-001', name: '混凝土浇筑', category: '土建工程' },
  { id: 'wc2', code: 'TJ-002', name: '钢筋绑扎', category: '土建工程' },
  { id: 'wc3', code: 'TJ-003', name: '模板安装', category: '土建工程' },
  { id: 'wc4', code: 'TJ-004', name: '脚手架搭设', category: '土建工程' },
  { id: 'wc5', code: 'TJ-005', name: '土方开挖', category: '土建工程' },
  { id: 'wc6', code: 'AZ-001', name: '水电管线铺设', category: '安装工程' },
  { id: 'wc7', code: 'AZ-002', name: '设备安装调试', category: '安装工程' },
  { id: 'wc8', code: 'ZX-001', name: '墙面粉刷', category: '装修工程' },
  { id: 'wc9', code: 'ZX-002', name: '防水施工', category: '装修工程' },
  { id: 'wc10', code: 'QT-001', name: '材料搬运', category: '其他' },
  { id: 'wc11', code: 'QT-002', name: '质量检查', category: '其他' },
  { id: 'wc12', code: 'QT-003', name: '安全巡查', category: '其他' },
];

export const mockPersonnel: Personnel[] = [
  { id: 'w1', laborId: 'LW-2024-001', name: '张三', role: 'worker', phone: '138****1001', status: 'active', specialty: '混凝土工', joinDate: '2024-03-01' },
  { id: 'w2', laborId: 'LW-2024-002', name: '李四', role: 'worker', phone: '138****1002', status: 'active', specialty: '钢筋工', joinDate: '2024-03-15' },
  { id: 'w3', laborId: 'LW-2024-003', name: '王五', role: 'worker', phone: '138****1003', status: 'active', specialty: '木工', joinDate: '2024-04-01' },
  { id: 'w4', laborId: 'LW-2024-004', name: '赵六', role: 'worker', phone: '138****1004', status: 'leave', specialty: '电焊工', joinDate: '2024-02-10' },
  { id: 'w5', laborId: 'LW-2024-005', name: '钱七', role: 'worker', phone: '138****1005', status: 'active', specialty: '水电工', joinDate: '2024-05-01' },
  { id: 'w6', laborId: 'LW-2024-006', name: '孙八', role: 'worker', phone: '138****1006', status: 'resigned', specialty: '架子工', joinDate: '2024-01-15' },
  { id: 'w7', laborId: 'LW-2024-007', name: '周九', role: 'worker', phone: '138****1007', status: 'active', specialty: '泥瓦工', joinDate: '2024-06-01' },
  { id: 'w8', laborId: 'LW-2024-008', name: '吴十', role: 'worker', phone: '138****1008', status: 'active', specialty: '防水工', joinDate: '2024-04-20' },
  { id: 'f1', laborId: 'FM-2023-001', name: '刘工长', role: 'foreman', phone: '139****2001', status: 'active', joinDate: '2023-06-01' },
  { id: 'f2', laborId: 'FM-2023-002', name: '陈工长', role: 'foreman', phone: '139****2002', status: 'active', joinDate: '2023-09-01' },
  { id: 'e1', name: '林工程师', role: 'engineer', phone: '137****3001', status: 'active', joinDate: '2023-01-01' },
  { id: 'e2', name: '黄工程师', role: 'engineer', phone: '137****3002', status: 'active', joinDate: '2023-03-01' },
];

export const mockEquipment: Equipment[] = [
  { id: 'eq1', equipmentNo: 'EQ-2024-001', name: '塔吊-01', model: 'QTZ63', status: 'in_use', location: 'A区' },
  { id: 'eq2', equipmentNo: 'EQ-2024-002', name: '挖掘机-01', model: 'CAT320', status: 'available', location: '停放区' },
  { id: 'eq3', equipmentNo: 'EQ-2024-003', name: '混凝土泵车-01', model: 'SANY56m', status: 'in_use', location: 'B区' },
  { id: 'eq4', equipmentNo: 'EQ-2024-004', name: '发电机-01', model: 'SDEC200', status: 'available', location: '配电房' },
  { id: 'eq5', equipmentNo: 'EQ-2024-005', name: '振动棒-01', model: 'ZN50', status: 'in_use', location: 'A区' },
  { id: 'eq6', equipmentNo: 'EQ-2024-006', name: '电焊机-01', model: 'ZX7-400', status: 'maintenance', location: '维修区' },
];

export const mockDailyLogs: DailyLog[] = [
  {
    id: 'log1',
    date: '2026-03-07',
    foremanId: 'f1',
    foremanName: '刘工长',
    status: 'approved',
    entries: [
      { id: 'e1', workerId: 'w1', workerName: '张三', startTime: '2024-03-20T07:00', endTime: '2024-03-20T15:00', hours: 8, area: 'A区-基础施工', workCodeId: 'wc1', workCodeName: '混凝土浇筑', detail: '浇筑A区第三层楼板' },
      { id: 'e2', workerId: 'w2', workerName: '李四', startTime: '2024-03-20T07:00', endTime: '2024-03-20T15:00', hours: 8, area: 'A区-基础施工', workCodeId: 'wc2', workCodeName: '钢筋绑扎', detail: '绑扎A区承台钢筋' },
      { id: 'e3', workerId: 'w3', workerName: '王五', startTime: '2024-03-20T08:00', endTime: '2024-03-20T15:00', hours: 7, area: 'B区-主体结构', workCodeId: 'wc3', workCodeName: '模板安装', detail: 'B区二层柱模板安装' },
      { id: 'e4', workerId: 'w5', workerName: '钱七', startTime: '2024-03-20T07:00', endTime: '2024-03-20T15:00', hours: 8, area: 'D区-机电安装', workCodeId: 'wc6', workCodeName: '水电管线铺设', detail: 'D区地下室给水管线安装' },
    ],
    equipmentUsage: [
      { id: 'eu1', equipmentId: 'eq1', equipmentName: '塔吊-01', startTime: '2024-03-20T07:00', endTime: '2024-03-20T13:00', hours: 6, area: 'A区-基础施工', workCodeId: 'wc1', workCodeName: '[GC-001] 混凝土浇筑', detail: '吊运A区混凝土材料' },
      { id: 'eu2', equipmentId: 'eq3', equipmentName: '混凝土泵车-01', startTime: '2024-03-20T08:00', endTime: '2024-03-20T12:00', hours: 4, area: 'A区-基础施工', workCodeId: 'wc1', workCodeName: '[GC-001] 混凝土浇筑', detail: 'A区楼板混凝土泵送' },
    ],
  },
  {
    id: 'log2',
    date: '2026-03-07',
    foremanId: 'f2',
    foremanName: '陈工长',
    status: 'pending',
    entries: [
      { id: 'e5', workerId: 'w7', workerName: '周九', startTime: '2026-03-07T07:30', endTime: '2026-03-07T15:30', hours: 8, area: 'C区-装饰装修', workCodeId: 'wc8', workCodeName: '墙面粉刷', detail: 'C区一层内墙粉刷' },
      { id: 'e6', workerId: 'w8', workerName: '吴十', startTime: '2026-03-07T08:00', endTime: '2026-03-07T14:00', hours: 6, area: 'E区-外墙施工', workCodeId: 'wc9', workCodeName: '防水施工', detail: 'E区外墙防水涂层施工' },
    ],
    equipmentUsage: [
      { id: 'eu3', equipmentId: 'eq5', equipmentName: '振动棒-01', startTime: '2026-03-07T09:00', endTime: '2026-03-07T12:00', hours: 3, area: 'C区-装饰装修', workCodeId: 'wc8', workCodeName: '[ZX-001] 墙面粉刷', detail: 'C区振捣辅助' },
    ],
  },
  {
    id: 'log3',
    date: '2026-03-06',
    foremanId: 'f1',
    foremanName: '刘工长',
    status: 'rejected',
    reviewComment: '张三工时有误，当日实际工作时间为6小时，请修改后重新提交。',
    entries: [
      { id: 'e7', workerId: 'w1', workerName: '张三', startTime: '2026-03-06T06:00', endTime: '2026-03-06T16:00', hours: 10, area: 'A区-基础施工', workCodeId: 'wc1', workCodeName: '混凝土浇筑', detail: 'A区基础混凝土浇筑' },
      { id: 'e8', workerId: 'w2', workerName: '李四', startTime: '2026-03-06T07:00', endTime: '2026-03-06T15:00', hours: 8, area: 'B区-主体结构', workCodeId: 'wc2', workCodeName: '钢筋绑扎', detail: 'B区一层柱钢筋绑扎' },
    ],
    equipmentUsage: [],
  },
  {
    id: 'log4',
    date: '2026-03-06',
    foremanId: 'f2',
    foremanName: '陈工长',
    status: 'approved',
    entries: [
      { id: 'e9', workerId: 'w7', workerName: '周九', startTime: '2026-03-06T07:00', endTime: '2026-03-06T15:00', hours: 8, area: 'C区-装饰装修', workCodeId: 'wc8', workCodeName: '墙面粉刷', detail: 'C区二层内墙粉刷' },
      { id: 'e10', workerId: 'w5', workerName: '钱七', startTime: '2026-03-06T07:00', endTime: '2026-03-06T15:00', hours: 8, area: 'D区-机电安装', workCodeId: 'wc6', workCodeName: '水电管线铺设', detail: 'D区一层消防管线安装' },
      { id: 'e11', workerId: 'w8', workerName: '吴十', startTime: '2026-03-06T07:30', endTime: '2026-03-06T14:30', hours: 7, area: 'E区-外墙施工', workCodeId: 'wc9', workCodeName: '防水施工', detail: 'E区屋面防水施工' },
    ],
    equipmentUsage: [
      { id: 'eu4', equipmentId: 'eq2', equipmentName: '挖掘机-01', startTime: '2026-03-06T08:00', endTime: '2026-03-06T13:00', hours: 5, area: 'F区-道路铺设', workCodeId: 'wc7', workCodeName: '[DL-001] 道路基层施工', detail: 'F区路基开挖作业' },
    ],
  },
];

export const mockTeamAssignments: TeamAssignment[] = [
  { foremanId: 'f1', workerIds: ['w1', 'w2', 'w3', 'w5'], equipmentIds: ['eq1', 'eq3'] },
  { foremanId: 'f2', workerIds: ['w7', 'w8', 'w4'], equipmentIds: ['eq2', 'eq5'] },
];

export const mockEngineerAssignments: EngineerAssignment[] = [
  { engineerId: 'e1', foremanIds: ['f1', 'f2'] },
  { engineerId: 'e2', foremanIds: ['f2'] },
];
