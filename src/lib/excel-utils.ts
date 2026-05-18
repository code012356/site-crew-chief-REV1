import * as XLSX from 'xlsx';
import { DailyLog, Equipment, EquipmentStatus, Personnel, WorkCode } from './types';

const gradeToRole: Record<string, Personnel['role']> = {
  FOREMAN: 'foreman',
  Foreman: 'foreman',
  foreman: 'foreman',
  'Assist Foreman': 'foreman',
  Engineer: 'engineer',
  engineer: 'engineer',
  Labor: 'worker',
  labor: 'worker',
  Worker: 'worker',
  worker: 'worker',
  工长: 'foreman',
  工程师: 'engineer',
  工人: 'worker',
};

const roleToGrade: Record<Personnel['role'], string> = {
  worker: 'Labor',
  foreman: 'FOREMAN',
  engineer: 'Engineer',
};

const eqStatusMap: Record<string, EquipmentStatus> = {
  可用: 'available',
  Available: 'available',
  available: 'available',
  使用中: 'in_use',
  'In Use': 'in_use',
  in_use: 'in_use',
  维修中: 'maintenance',
  Maintenance: 'maintenance',
  maintenance: 'maintenance',
  已报废: 'retired',
  Retired: 'retired',
  retired: 'retired',
};

const eqStatusLabelMap: Record<EquipmentStatus, string> = {
  available: '可用 Available',
  in_use: '使用中 In Use',
  maintenance: '维修中 Maintenance',
  retired: '已报废 Retired',
};

const logStatusLabelMap: Record<string, string> = {
  pending: '待审核 Pending',
  approved: '已通过 Approved',
  conditional: '有条件通过 Conditional',
  rejected: '已拒绝 Rejected',
  withdraw_requested: '撤回申请中 Withdraw Requested',
  withdrawn: '已撤回 Withdrawn',
};

const personnelHeaders = [
  '序列 No.',
  '胸卡号 Labor No.',
  '工号 Code No.',
  '护照号码 Passport No.',
  '签证有效期 Visa expiry date',
  '姓名 Name',
  '等级 Grade',
  '工种 Position',
  '国籍 Nationality',
  '所属项目/部门 Project/Dept.',
  '所属工长 Assigned To',
  '一线/二线 Site/Indirect',
  '休假日期 Leave Date',
  '休假次数 Leave Count',
  '入场日期 Entry Date',
  '电话 Phone',
];

function getByHeader(row: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const found = Object.keys(row).find(header => header.toLowerCase().includes(key.toLowerCase()));
    if (found) return String(row[found] ?? '').trim();
  }
  return '';
}

function parseDate(raw: string | number | undefined, fallback = ''): string {
  if (!raw) return fallback;
  const s = String(raw).trim();
  if (!s || s === '0') return fallback;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{4}[./-]\d{1,2}[./-]\d{1,2}$/.test(s)) {
    const [year, month, day] = s.split(/[./-]/);
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return s;
}

export function exportPersonnel(data: Personnel[]) {
  const rows = data.map(p => ({
    '序列 No.': p.seqNo || '',
    '胸卡号 Labor No.': p.laborId || '',
    '工号 Code No.': p.codeNo || '',
    '护照号码 Passport No.': p.passportNo || '',
    '签证有效期 Visa expiry date': p.visaExpiryDate || '',
    '姓名 Name': p.name,
    '等级 Grade': roleToGrade[p.role],
    '工种 Position': p.specialty || '',
    '国籍 Nationality': p.nationality || '',
    '所属项目/部门 Project/Dept.': p.projectDept || '',
    '所属工长 Assigned To': p.assignedTo || '',
    '一线/二线 Site/Indirect': p.workLine || '',
    '休假日期 Leave Date': p.leaveDate || '',
    '休假次数 Leave Count': p.leaveCount ?? 0,
    '入场日期 Entry Date': p.joinDate,
    '电话 Phone': p.phone,
  }));
  const ws = data.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([personnelHeaders]);
  ws['!cols'] = personnelHeaders.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '人员列表 Personnel');
  XLSX.writeFile(wb, `人员列表_Personnel_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function importPersonnel(file: File): Promise<Personnel[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        const today = new Date().toISOString().split('T')[0];
        const personnel: Personnel[] = rows.map((row, index) => {
          const grade = getByHeader(row, ['Grade_Admin', 'Grade_Operational', 'Grade', '等级']);
          const seqRaw = getByHeader(row, ['No.', '序列']);

          return {
            id: `imp_${Date.now()}_${index}`,
            laborId: getByHeader(row, ['Labor No', 'Labor', '胸卡号']) || undefined,
            codeNo: getByHeader(row, ['Code No', 'code No', '工号']) || undefined,
            passportNo: getByHeader(row, ['Passport', '护照']) || undefined,
            visaExpiryDate: parseDate(getByHeader(row, ['Visa expiry', 'Visa', '签证有效期'])) || undefined,
            name: getByHeader(row, ['Full_Name', 'Full Name', 'Name', '姓名']),
            role: gradeToRole[grade] || 'worker',
            phone: getByHeader(row, ['Phone', '电话']),
            status: 'active',
            specialty: getByHeader(row, ['Position_Admin', 'Position_Operational', 'Position', '工种']) || undefined,
            nationality: getByHeader(row, ['Nationality_Admin', 'Nationality_Operational', 'Nationality', '国籍']) || undefined,
            joinDate: parseDate(getByHeader(row, ['Date of join', 'Entry Date', '入场日期', '入职日期']), today),
            projectDept: getByHeader(row, ['Project/Dept', 'Project', '所属项目', '部门']) || undefined,
            assignedTo: getByHeader(row, ['Assigned To', 'Foreman', 'Engineer', 'Officer', '所属工长']) || undefined,
            workLine: getByHeader(row, ['Site/Indirect', '一线', '二线']) || undefined,
            leaveDate: getByHeader(row, ['Leave Date', 'Leave date', '休假日期', '休假记录']) || undefined,
            leaveCount: (() => {
              const raw = getByHeader(row, ['Leave Count', 'Leave count', '休假次数']);
              return raw ? parseInt(raw, 10) || 0 : 0;
            })(),
            seqNo: seqRaw ? parseInt(seqRaw, 10) || undefined : undefined,
          };
        }).filter(p => p.name);
        resolve(personnel);
      } catch {
        reject(new Error('文件解析失败 File parsing failed'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败 File reading failed'));
    reader.readAsArrayBuffer(file);
  });
}

export function exportEquipment(data: Equipment[]) {
  const rows = data.map(e => ({
    '设备编号 Equipment No.': e.equipmentNo || '',
    '设备名称 Equipment Name': e.name,
    '型号 Model': e.model,
    '状态 Status': eqStatusLabelMap[e.status],
    '位置 Location': e.location || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '设备列表 Equipment');
  XLSX.writeFile(wb, `设备列表_Equipment_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function importEquipment(file: File): Promise<Equipment[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        const equipment: Equipment[] = rows.map((row, index) => {
          const statusRaw = getByHeader(row, ['Status', '状态']);
          return {
            id: `imp_eq_${Date.now()}_${index}`,
            equipmentNo: getByHeader(row, ['Equipment No', '设备编号']) || undefined,
            name: getByHeader(row, ['Equipment Name', '设备名称', '名称']),
            model: getByHeader(row, ['Model', '型号']),
            status: eqStatusMap[statusRaw] || 'available',
            location: getByHeader(row, ['Location', '位置']) || undefined,
          };
        }).filter(equipment => equipment.name);
        resolve(equipment);
      } catch {
        reject(new Error('文件解析失败 File parsing failed'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败 File reading failed'));
    reader.readAsArrayBuffer(file);
  });
}

export function exportWorkCodes(data: WorkCode[]) {
  const rows = data.map(wc => ({
    '代码 Code': wc.code,
    '名称 Name': wc.name,
    '分类 Category': wc.category,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '施工代码 Work Codes');
  XLSX.writeFile(wb, `施工代码_WorkCodes_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function importWorkCodes(file: File): Promise<WorkCode[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        const codes: WorkCode[] = rows.map((row, index) => ({
          id: `imp_wc_${Date.now()}_${index}`,
          code: getByHeader(row, ['Code', 'Work Code', 'Cost Code', '施工代码', '成本代码', '代码']).trim(),
          name: getByHeader(row, ['Name', 'Work Name', 'Cost Name', 'Description', '名称', '姓名']).trim(),
          category: getByHeader(row, ['Category', 'Type', '分类', '类别']) || '其他',
        })).filter(code => code.code && code.name);
        resolve(codes);
      } catch {
        reject(new Error('文件解析失败 File parsing failed'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败 File reading failed'));
    reader.readAsArrayBuffer(file);
  });
}

export function exportDailyLogs(logs: DailyLog[], personnelList?: Personnel[]) {
  const exportLogs = logs.filter(log => !log.deletedAt && log.status !== 'withdrawn');
  const wb = XLSX.utils.book_new();

  const getLaborId = (personId: string, fallback: string) => {
    const person = personnelList?.find(p => p.id === personId);
    return person?.laborId || fallback;
  };

  const summaryRows = exportLogs.map(log => ({
    '日期 Date': log.date,
    '工长 Foreman': log.foremanName,
    '工长工号 Foreman ID': getLaborId(log.foremanId, ''),
    '状态 Status': logStatusLabelMap[log.status] || log.status,
    '工人记录数 Worker Entries': log.entries.length,
    '设备记录数 Equipment Entries': log.equipmentUsage.length,
    '总工时 Total Hours': log.entries.reduce((sum, entry) => sum + entry.hours, 0),
    '设备总时长 Equipment Hours': log.equipmentUsage.reduce((sum, entry) => sum + entry.hours, 0),
    '审核意见 Review Comment': log.reviewComment || '',
  }));
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, '总览 Summary');

  const foremanMap = new Map<string, DailyLog[]>();
  for (const log of exportLogs) {
    foremanMap.set(log.foremanId, [...(foremanMap.get(log.foremanId) || []), log]);
  }

  for (const [foremanId, foremanLogs] of foremanMap) {
    const firstLog = foremanLogs[0];
    const sheetLabel = getLaborId(foremanId, firstLog.foremanName).slice(0, 20);
    const sortedLogs = [...foremanLogs].sort((a, b) => a.date.localeCompare(b.date));

    const workerRows = sortedLogs.flatMap(log =>
      log.entries.map(entry => ({
        '日期 Date': log.date,
        '工人姓名 Worker': entry.workerName,
        '工人工号 Worker ID': getLaborId(entry.workerId, entry.workerName),
        '开始时间 Start': entry.startTime?.replace('T', ' ') || '',
        '结束时间 End': entry.endTime?.replace('T', ' ') || '',
        '工时 Hours': entry.hours,
        '施工区域 Area': entry.area,
        '施工代码 Work Code': entry.workCodeName,
        '详细描述 Detail': entry.detail || '',
        '日志状态 Status': logStatusLabelMap[log.status] || log.status,
      }))
    );
    const workerSheet = XLSX.utils.json_to_sheet(workerRows);
    workerSheet['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 28 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, workerSheet, `${sheetLabel}-工时 Hours`);

    const equipmentRows = sortedLogs.flatMap(log =>
      log.equipmentUsage.map(entry => ({
        '日期 Date': log.date,
        '设备名称 Equipment': entry.equipmentName,
        '开始时间 Start': entry.startTime?.replace('T', ' ') || '',
        '结束时间 End': entry.endTime?.replace('T', ' ') || '',
        '使用时长 Hours': entry.hours,
        '使用区域 Area': entry.area,
        '施工代码 Work Code': entry.workCodeName || '',
        '详细描述 Detail': entry.detail || '',
        '日志状态 Status': logStatusLabelMap[log.status] || log.status,
      }))
    );
    if (equipmentRows.length > 0) {
      const equipmentSheet = XLSX.utils.json_to_sheet(equipmentRows);
      equipmentSheet['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 28 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, equipmentSheet, `${sheetLabel}-设备 Equip`);
    }
  }

  XLSX.writeFile(wb, `施工日志_DailyLogs_${new Date().toISOString().split('T')[0]}.xlsx`);
}
