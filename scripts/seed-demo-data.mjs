import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envText = fs.readFileSync('.env', 'utf8');
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const [key, ...rest] = line.split('=');
      return [key, rest.join('=').replace(/^"|"$/g, '')];
    }),
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tables = [
  'account_requests',
  'equipment_requests',
  'daily_logs',
  'team_assignments',
  'engineer_assignments',
  'accounts',
  'personnel',
  'equipment',
  'work_codes',
];

const ids = {
  engineer: '10000000-0000-0000-0000-000000000001',
  foremanXia: '10000000-0000-0000-0000-000000000002',
  foremanPyare: '10000000-0000-0000-0000-000000000003',
  workerAamir: '10000000-0000-0000-0000-000000000101',
  workerAbdul: '10000000-0000-0000-0000-000000000102',
  workerRahim: '10000000-0000-0000-0000-000000000103',
  workerBikash: '10000000-0000-0000-0000-000000000104',
  workerSuresh: '10000000-0000-0000-0000-000000000105',
  workerIqbal: '10000000-0000-0000-0000-000000000106',
  workerChen: '10000000-0000-0000-0000-000000000107',
  workerHua: '10000000-0000-0000-0000-000000000108',
  excavator: '20000000-0000-0000-0000-000000000001',
  crane: '20000000-0000-0000-0000-000000000002',
  mixer: '20000000-0000-0000-0000-000000000003',
  truck: '20000000-0000-0000-0000-000000000004',
  generator: '20000000-0000-0000-0000-000000000005',
  wcA: '30000000-0000-0000-0000-000000000001',
  wcB: '30000000-0000-0000-0000-000000000002',
  wcC: '30000000-0000-0000-0000-000000000003',
  wcD: '30000000-0000-0000-0000-000000000004',
  wcE: '30000000-0000-0000-0000-000000000005',
};

const today = '2026-05-18';

const personnel = [
  { id: ids.engineer, seq_no: 1, labor_id: 'LQ-5188', code_no: 'E5188', name: 'WANG ZIAN', role: 'engineer', phone: '0501000001', status: 'active', specialty: 'Civil Engineer', nationality: 'China', join_date: '2025-01-10', project_dept: 'Management' },
  { id: ids.foremanXia, seq_no: 2, labor_id: 'LQ-5370', code_no: 'F5370', name: 'WEIGUO XIA', role: 'foreman', phone: '0501000002', status: 'active', specialty: 'Structure Foreman', nationality: 'China', join_date: '2025-02-01', project_dept: 'Structure Team' },
  { id: ids.foremanPyare, seq_no: 3, labor_id: 'LQ-0815', code_no: 'F0815', name: 'PYARE LAL', role: 'foreman', phone: '0501000003', status: 'active', specialty: 'Finishing Foreman', nationality: 'Pakistan', join_date: '2025-02-05', project_dept: 'Finishing Team' },
  { id: ids.workerAamir, seq_no: 4, labor_id: 'LQ-9071', code_no: 'L76034', name: 'AAMIR ALI', role: 'worker', phone: '0502000001', status: 'active', specialty: 'Driver(Light Duty)', nationality: 'Pakistan', join_date: '2025-03-01', project_dept: 'Driver', assigned_to: 'LQ-5370 WEIGUO XIA', work_line: 'Indirect', actual_work: 'Driver' },
  { id: ids.workerAbdul, seq_no: 5, labor_id: 'LQ-1267', code_no: 'L24558', name: 'ABDUL KUDDUS', role: 'worker', phone: '0502000002', status: 'active', specialty: 'Mason', nationality: 'Bangladesh', join_date: '2025-03-02', project_dept: 'Utility', assigned_to: 'LQ-5370 WEIGUO XIA', work_line: 'Site', actual_work: 'Block Work' },
  { id: ids.workerRahim, seq_no: 6, labor_id: 'LQ-3020', code_no: 'L30200', name: 'RAHIM UDDIN', role: 'worker', phone: '0502000003', status: 'active', specialty: 'Steel Fixer', nationality: 'Bangladesh', join_date: '2025-03-04', project_dept: 'Structure', assigned_to: 'LQ-5370 WEIGUO XIA', work_line: 'Site', actual_work: 'Rebar' },
  { id: ids.workerBikash, seq_no: 7, labor_id: 'LQ-5973', code_no: 'L59730', name: 'BIKASH DAS', role: 'worker', phone: '0502000004', status: 'leave', specialty: 'Carpenter', nationality: 'India', join_date: '2025-03-05', project_dept: 'Structure', assigned_to: 'LQ-5370 WEIGUO XIA', work_line: 'Site', actual_work: 'Formwork' },
  { id: ids.workerSuresh, seq_no: 8, labor_id: 'LQ-7285', code_no: 'L72850', name: 'SURESH KUMAR', role: 'worker', phone: '0502000005', status: 'active', specialty: 'Painter', nationality: 'India', join_date: '2025-03-08', project_dept: 'Finishing', assigned_to: 'LQ-0815 PYARE LAL', work_line: 'Site', actual_work: 'Painting' },
  { id: ids.workerIqbal, seq_no: 9, labor_id: 'LQ-8693', code_no: 'L86930', name: 'IQBAL MASIH', role: 'worker', phone: '0502000006', status: 'active', specialty: 'Electrician', nationality: 'Pakistan', join_date: '2025-03-11', project_dept: 'MEP', assigned_to: 'LQ-0815 PYARE LAL', work_line: 'Site', actual_work: 'Cable Pulling' },
  { id: ids.workerChen, seq_no: 10, labor_id: 'LQ-8698', code_no: 'L86980', name: 'CHEN PEI', role: 'worker', phone: '0502000007', status: 'active', specialty: 'Welder', nationality: 'China', join_date: '2025-03-15', project_dept: 'MEP', assigned_to: 'LQ-0815 PYARE LAL', work_line: 'Site', actual_work: 'Welding' },
  { id: ids.workerHua, seq_no: 11, labor_id: 'LQ-8738', code_no: 'L87380', name: 'HUA FUQUAN', role: 'worker', phone: '0502000008', status: 'active', specialty: 'Helper', nationality: 'China', join_date: '2025-03-18', project_dept: 'Finishing', assigned_to: 'LQ-0815 PYARE LAL', work_line: 'Site', actual_work: 'Material Handling' },
];

const equipment = [
  { id: ids.excavator, equipment_no: 'EQ-EX-001', name: 'Excavator CAT 320', model: 'CAT 320', status: 'in_use', location: 'A Zone' },
  { id: ids.crane, equipment_no: 'EQ-CR-001', name: 'Tower Crane TC-01', model: 'TC-7030', status: 'available', location: 'B Zone' },
  { id: ids.mixer, equipment_no: 'EQ-MX-001', name: 'Concrete Mixer', model: 'CM-500', status: 'available', location: 'A Zone' },
  { id: ids.truck, equipment_no: 'EQ-TR-001', name: 'Dump Truck', model: 'Howo 371', status: 'in_use', location: 'Road Works' },
  { id: ids.generator, equipment_no: 'EQ-GN-001', name: 'Generator 100KVA', model: 'Perkins 100KVA', status: 'maintenance', location: 'Store' },
];

const workCodes = [
  { id: ids.wcA, code: 'A', name: 'Earthwork / Foundation', category: 'Civil', area: 'A区 基础施工' },
  { id: ids.wcB, code: 'B', name: 'Rebar & Concrete', category: 'Civil', area: 'B区 主体结构' },
  { id: ids.wcC, code: 'C', name: 'Masonry / Block Work', category: 'Civil', area: 'C区 装饰装修' },
  { id: ids.wcD, code: 'D', name: 'Painting / Finishing', category: 'Finishing', area: 'E区 外墙施工' },
  { id: ids.wcE, code: 'E', name: 'MEP Installation', category: 'MEP', area: 'D区 机电安装' },
];

const demoAccounts = [
  { id: '40000000-0000-0000-0000-000000000001', username: 'wangzian', password: 'test123', role: 'engineer', display_name: 'WANG ZIAN', enabled: true, labor_id: 'LQ-5188', linked_personnel_id: ids.engineer, phone: '0501000001' },
  { id: '40000000-0000-0000-0000-000000000002', username: 'xiaweiguo', password: 'test123', role: 'foreman', display_name: 'WEIGUO XIA', enabled: true, labor_id: 'LQ-5370', linked_personnel_id: ids.foremanXia, phone: '0501000002' },
  { id: '40000000-0000-0000-0000-000000000003', username: 'pyarelal', password: 'test123', role: 'foreman', display_name: 'PYARE LAL', enabled: true, labor_id: 'LQ-0815', linked_personnel_id: ids.foremanPyare, phone: '0501000003' },
];

const teamAssignments = [
  { foreman_id: ids.foremanXia, worker_ids: [ids.workerAamir, ids.workerAbdul, ids.workerRahim, ids.workerBikash], equipment_ids: [ids.excavator, ids.mixer, ids.truck] },
  { foreman_id: ids.foremanPyare, worker_ids: [ids.workerSuresh, ids.workerIqbal, ids.workerChen, ids.workerHua], equipment_ids: [ids.crane, ids.generator] },
];

const engineerAssignments = [
  { engineer_id: ids.engineer, foreman_ids: [ids.foremanXia, ids.foremanPyare] },
];

function entry(id, workerId, workerName, start, end, hours, area, workCodeId, workCodeName, detail = '') {
  return { id, workerId, workerName, startTime: start, endTime: end, hours, area, workCodeId, workCodeName, detail };
}

function eqEntry(id, equipmentId, equipmentName, start, end, hours, area, workCodeId, workCodeName, detail = '') {
  return { id, equipmentId, equipmentName, startTime: start, endTime: end, hours, area, workCodeId, workCodeName, detail };
}

const dailyLogs = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    date: today,
    foreman_id: ids.foremanXia,
    foreman_name: 'WEIGUO XIA',
    status: 'pending',
    entries: [
      entry('w-001', ids.workerAamir, 'AAMIR ALI', `${today}T07:00`, `${today}T15:00`, 8, 'A区 基础施工', ids.wcA, '[A] Earthwork / Foundation', 'Excavation support'),
      entry('w-002', ids.workerAbdul, 'ABDUL KUDDUS', `${today}T07:00`, `${today}T17:00`, 10, 'C区 装饰装修', ids.wcC, '[C] Masonry / Block Work', 'Block wall at utility room'),
      entry('w-003', ids.workerRahim, 'RAHIM UDDIN', `${today}T07:00`, `${today}T15:00`, 8, 'B区 主体结构', ids.wcB, '[B] Rebar & Concrete', 'Rebar tying'),
    ],
    equipment_usage: [
      eqEntry('eq-001', ids.excavator, 'Excavator CAT 320', `${today}T07:00`, `${today}T13:00`, 6, 'A区 基础施工', ids.wcA, '[A] Earthwork / Foundation'),
      eqEntry('eq-002', ids.mixer, 'Concrete Mixer', `${today}T09:00`, `${today}T12:00`, 3, 'B区 主体结构', ids.wcB, '[B] Rebar & Concrete'),
    ],
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    date: '2026-05-17',
    foreman_id: ids.foremanPyare,
    foreman_name: 'PYARE LAL',
    status: 'approved',
    entries: [
      entry('w-004', ids.workerSuresh, 'SURESH KUMAR', '2026-05-17T07:00', '2026-05-17T15:00', 8, 'D区 机电安装', ids.wcD, '[D] Painting / Finishing', 'Wall putty and first coat'),
      entry('w-005', ids.workerIqbal, 'IQBAL MASIH', '2026-05-17T07:00', '2026-05-17T15:00', 8, 'D区 机电安装', ids.wcE, '[E] MEP Installation', 'Cable tray installation'),
      entry('w-006', ids.workerChen, 'CHEN PEI', '2026-05-17T07:00', '2026-05-17T13:00', 6, 'D区 机电安装', ids.wcE, '[E] MEP Installation', 'Welding supports'),
    ],
    equipment_usage: [
      eqEntry('eq-003', ids.crane, 'Tower Crane TC-01', '2026-05-17T08:00', '2026-05-17T11:00', 3, 'B区 主体结构', ids.wcB, '[B] Rebar & Concrete'),
    ],
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    date: '2026-05-16',
    foreman_id: ids.foremanXia,
    foreman_name: 'WEIGUO XIA',
    status: 'conditional',
    review_comment: 'Please attach concrete delivery ticket next time.',
    entries: [
      entry('w-007', ids.workerAamir, 'AAMIR ALI', '2026-05-16T07:00', '2026-05-16T14:00', 7, 'A区 基础施工', ids.wcA, '[A] Earthwork / Foundation'),
      entry('w-008', ids.workerAbdul, 'ABDUL KUDDUS', '2026-05-16T07:00', '2026-05-16T15:00', 8, 'C区 装饰装修', ids.wcC, '[C] Masonry / Block Work'),
    ],
    equipment_usage: [
      eqEntry('eq-004', ids.truck, 'Dump Truck', '2026-05-16T07:00', '2026-05-16T12:00', 5, 'A区 基础施工', ids.wcA, '[A] Earthwork / Foundation'),
    ],
  },
  {
    id: '50000000-0000-0000-0000-000000000004',
    date: '2026-05-10',
    foreman_id: ids.foremanPyare,
    foreman_name: 'PYARE LAL',
    status: 'rejected',
    review_comment: 'Duplicate worker hours, please revise.',
    entries: [
      entry('w-009', ids.workerHua, 'HUA FUQUAN', '2026-05-10T07:00', '2026-05-10T19:00', 12, 'E区 外墙施工', ids.wcD, '[D] Painting / Finishing'),
    ],
    equipment_usage: [],
  },
  {
    id: '50000000-0000-0000-0000-000000000005',
    date: '2026-04-28',
    foreman_id: ids.foremanXia,
    foreman_name: 'WEIGUO XIA',
    status: 'approved',
    entries: [
      entry('w-010', ids.workerRahim, 'RAHIM UDDIN', '2026-04-28T07:00', '2026-04-28T15:00', 8, 'B区 主体结构', ids.wcB, '[B] Rebar & Concrete'),
      entry('w-011', ids.workerBikash, 'BIKASH DAS', '2026-04-28T07:00', '2026-04-28T15:00', 8, 'B区 主体结构', ids.wcB, '[B] Rebar & Concrete'),
    ],
    equipment_usage: [
      eqEntry('eq-005', ids.crane, 'Tower Crane TC-01', '2026-04-28T10:00', '2026-04-28T14:00', 4, 'B区 主体结构', ids.wcB, '[B] Rebar & Concrete'),
    ],
  },
].map((log) => ({ ...log, revisions: null, deleted_at: null }));

const equipmentRequests = [
  {
    id: '60000000-0000-0000-0000-000000000001',
    requester_id: ids.foremanXia,
    requester_name: 'WEIGUO XIA',
    requester_role: 'foreman',
    request_type: 'existing',
    equipment_id: ids.crane,
    equipment_name: 'Tower Crane TC-01',
    reason: 'Need lifting support for rebar cage on B zone.',
    status: 'engineer_pending',
  },
];

async function assertOk(result, action) {
  if (result.error) {
    throw new Error(`${action}: ${result.error.message}`);
  }
  return result.data;
}

async function getAdminAccount() {
  const admin = await assertOk(
    await supabase.from('accounts').select('*').eq('username', 'admin').maybeSingle(),
    'Read admin account',
  );
  return {
    id: admin?.id || '00000000-0000-0000-0000-000000000001',
    username: 'admin',
    password: admin?.password || 'admin123',
    role: 'admin',
    display_name: admin?.display_name || 'System Admin',
    enabled: true,
    labor_id: admin?.labor_id || null,
    linked_personnel_id: admin?.linked_personnel_id || null,
    phone: admin?.phone || '0500000000',
  };
}

async function clearTables() {
  for (const table of tables) {
    await assertOk(
      await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      `Clear ${table}`,
    );
  }
}

async function insertRows(table, rows) {
  if (!rows.length) return;
  await assertOk(await supabase.from(table).insert(rows), `Insert ${table}`);
}

async function main() {
  console.log('Reading current admin account password...');
  const adminAccount = await getAdminAccount();

  console.log('Clearing existing data...');
  await clearTables();

  console.log('Importing demo data...');
  await insertRows('personnel', personnel);
  await insertRows('equipment', equipment);
  await insertRows('work_codes', workCodes);
  await insertRows('accounts', [adminAccount, ...demoAccounts]);
  await insertRows('team_assignments', teamAssignments);
  await insertRows('engineer_assignments', engineerAssignments);
  await insertRows('daily_logs', dailyLogs);
  await insertRows('equipment_requests', equipmentRequests);

  console.log('Demo data import complete.');
  console.log('Test accounts:');
  console.log('  admin / <your existing admin password>');
  console.log('  wangzian / test123');
  console.log('  xiaweiguo / test123');
  console.log('  pyarelal / test123');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
