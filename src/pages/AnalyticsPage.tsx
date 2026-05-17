import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useDataContext } from '@/contexts/DataContext';
import { DailyLogEntry, EquipmentUsageEntry, DailyLog } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COLORS = ['hsl(38,92%,50%)', 'hsl(199,89%,48%)', 'hsl(142,71%,40%)', 'hsl(0,72%,51%)', 'hsl(262,60%,55%)', 'hsl(215,50%,40%)', 'hsl(330,60%,50%)', 'hsl(170,60%,40%)'];

interface AreaDetail {
  areaName: string;
  workerCount: number;
  equipmentCount: number;
  totalHours: number;
  totalEqHours: number;
}

interface DateTaggedEntry extends DailyLogEntry { _date: string; }
interface DateTaggedEqEntry extends EquipmentUsageEntry { _date: string; }

type TimeGranularity = 'day' | 'week' | 'month' | 'year';

const granularityLabels: Record<TimeGranularity, string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
};

function getWeekPeriod(date: string): string {
  const current = new Date(`${date}T00:00:00`);
  if (Number.isNaN(current.getTime())) return date;
  const start = new Date(current);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  const yearStart = new Date(start.getFullYear(), 0, 1);
  const week = Math.ceil((((start.getTime() - yearStart.getTime()) / 86400000) + yearStart.getDay() + 1) / 7);
  return `${start.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getTimePeriod(date: string, granularity: TimeGranularity): string {
  if (granularity === 'year') return date.substring(0, 4);
  if (granularity === 'month') return date.substring(0, 7);
  if (granularity === 'week') return getWeekPeriod(date);
  return date;
}

function getPeriodsFromDates(dates: string[], granularity: TimeGranularity): string[] {
  const s = new Set<string>();
  dates.forEach(d => s.add(getTimePeriod(d, granularity)));
  return Array.from(s).sort().reverse();
}

function filterByPeriod<T extends { _date: string }>(items: T[], period: string, granularity: TimeGranularity): T[] {
  if (period === 'all') return items;
  return items.filter(e => getTimePeriod(e._date, granularity) === period);
}

function tagEntries(logs: DailyLog[]): { entries: DateTaggedEntry[]; eqUsage: DateTaggedEqEntry[] } {
  const entries: DateTaggedEntry[] = [];
  const eqUsage: DateTaggedEqEntry[] = [];
  logs.forEach(log => {
    log.entries.forEach(e => entries.push({ ...e, _date: log.date }));
    log.equipmentUsage.forEach(e => eqUsage.push({ ...e, _date: log.date }));
  });
  return { entries, eqUsage };
}

// ─── Time Period Selector ───
function TimePeriodSelector({
  granularity, setGranularity, period, setPeriod, periods,
}: {
  granularity: TimeGranularity;
  setGranularity: (g: TimeGranularity) => void;
  period: string;
  setPeriod: (p: string) => void;
  periods: string[];
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Select value={granularity} onValueChange={v => { setGranularity(v as TimeGranularity); setPeriod('all'); }}>
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">Daily</SelectItem>
          <SelectItem value="week">Weekly</SelectItem>
          <SelectItem value="month">Monthly</SelectItem>
          <SelectItem value="year">Yearly</SelectItem>
        </SelectContent>
      </Select>
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="选择时段 Period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部 All</SelectItem>
          {periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Area Colors ───
const AREA_COLORS: Record<string, string> = {
  'A区': 'hsl(38,92%,50%)', 'B区': 'hsl(199,89%,48%)', 'C区': 'hsl(142,71%,40%)',
  'D区': 'hsl(262,60%,55%)', 'E区': 'hsl(0,72%,51%)', 'F区': 'hsl(215,50%,40%)',
};

// ─── Equipment Stacked Bar ───
function EquipmentAreaChart({
  eqUsage,
  title = 'Equipment Hours by Area',
  hideTimeFilter = false,
}: {
  eqUsage: DateTaggedEqEntry[];
  title?: string;
  hideTimeFilter?: boolean;
}) {
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [period, setPeriod] = useState<string>('all');

  const allDates = useMemo(() => Array.from(new Set(eqUsage.map(e => e._date))), [eqUsage]);
  const periods = useMemo(() => getPeriodsFromDates(allDates, granularity), [allDates, granularity]);
  const filtered = useMemo(() => hideTimeFilter ? eqUsage : filterByPeriod(eqUsage, period, granularity), [eqUsage, period, granularity, hideTimeFilter]);

  const allAreas = useMemo(() => Array.from(new Set(filtered.map(e => e.area.split('-')[0]))).sort(), [filtered]);

  const stackedData = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    filtered.forEach(e => {
      const areaKey = e.area.split('-')[0];
      const existing = map.get(e.equipmentName) || {};
      existing[areaKey] = (existing[areaKey] || 0) + e.hours;
      map.set(e.equipmentName, existing);
    });
    return Array.from(map.entries())
      .map(([name, areas]) => ({ name, ...areas, _total: Object.values(areas).reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b._total - a._total);
  }, [filtered]);

  return (
    <ChartCard title={title}>
      {!hideTimeFilter && (
        <TimePeriodSelector granularity={granularity} setGranularity={setGranularity} period={period} setPeriod={setPeriod} periods={periods} />
      )}
      {stackedData.length > 0 ? (
        <ResponsiveContainer width="100%" height={Math.max(200, stackedData.length * 45 + 40)}>
          <BarChart data={stackedData} layout="vertical" margin={{ left: 30, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,88%)" />
            <XAxis type="number" tick={{ fontSize: 12 }} unit="h" />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(214,20%,88%)' }} formatter={(value: number, name: string) => [`${value}h`, name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {allAreas.map(area => (
              <Bar key={area} dataKey={area} stackId="area" fill={AREA_COLORS[area] || COLORS[allAreas.indexOf(area) % COLORS.length]} name={area} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">暂无数据 No data</p>
      )}
    </ChartCard>
  );
}

// ─── Area Pie Chart ───
function AreaPieChart({
  entries, eqUsage, title = '施工区域工时分布', colorOffset = 0, hideTimeFilter = false,
}: { entries: DateTaggedEntry[]; eqUsage: DateTaggedEqEntry[]; title?: string; colorOffset?: number; hideTimeFilter?: boolean }) {
  const [selectedArea, setSelectedArea] = useState<AreaDetail | null>(null);
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [period, setPeriod] = useState<string>('all');

  const allDates = useMemo(() => Array.from(new Set(entries.map(e => e._date))), [entries]);
  const periods = useMemo(() => getPeriodsFromDates(allDates, granularity), [allDates, granularity]);
  const filteredEntries = useMemo(() => hideTimeFilter ? entries : filterByPeriod(entries, period, granularity), [entries, period, granularity, hideTimeFilter]);
  const filteredEqUsage = useMemo(() => hideTimeFilter ? eqUsage : filterByPeriod(eqUsage, period, granularity), [eqUsage, period, granularity, hideTimeFilter]);

  const areaMap = new Map<string, number>();
  filteredEntries.forEach(e => areaMap.set(e.area, (areaMap.get(e.area) || 0) + e.hours));
  const areaData = Array.from(areaMap.entries()).map(([name, value]) => ({ name: name.split('-')[0], fullName: name, value }));

  const handlePieClick = (_: unknown, index: number) => {
    const clicked = areaData[index];
    if (!clicked) return;
    const fullArea = clicked.fullName;
    const areaEntries = filteredEntries.filter(e => e.area === fullArea);
    const areaEq = filteredEqUsage.filter(e => e.area === fullArea);
    setSelectedArea({
      areaName: fullArea,
      workerCount: new Set(areaEntries.map(e => e.workerId)).size,
      equipmentCount: new Set(areaEq.map(e => e.equipmentId)).size,
      totalHours: areaEntries.reduce((s, e) => s + e.hours, 0),
      totalEqHours: areaEq.reduce((s, e) => s + e.hours, 0),
    });
  };

  const periodLabel = period === 'all' ? `全部${granularityLabels[granularity].slice(1)}汇总` : period;

  return (
    <ChartCard title={title}>
      {!hideTimeFilter && (
        <TimePeriodSelector
          granularity={granularity}
          setGranularity={g => { setGranularity(g); setSelectedArea(null); }}
          period={period}
          setPeriod={p => { setPeriod(p); setSelectedArea(null); }}
          periods={periods}
        />
      )}
      <div className="relative">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={areaData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} onClick={handlePieClick} cursor="pointer">
              {areaData.map((_, i) => <Cell key={i} fill={COLORS[(i + colorOffset) % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>

        {selectedArea && (
          <div className="absolute inset-0 bg-card/95 backdrop-blur-sm rounded-lg flex flex-col justify-center px-6 py-4 animate-fade-in">
            <button onClick={() => setSelectedArea(null)} className="absolute top-3 right-3 p-1 rounded-md hover:bg-muted transition-colors">
              <X size={16} className="text-muted-foreground" />
            </button>
            <h4 className="font-semibold text-sm mb-1">{selectedArea.areaName}</h4>
            <p className="text-xs text-muted-foreground mb-3">{periodLabel}</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-muted/50 rounded-md p-3 text-center">
                <p className="text-2xl font-bold">{selectedArea.workerCount}</p>
                <p className="text-xs text-muted-foreground">用工人数 Workers</p>
              </div>
              <div className="bg-muted/50 rounded-md p-3 text-center">
                <p className="text-2xl font-bold">{selectedArea.equipmentCount}</p>
                <p className="text-xs text-muted-foreground">使用设备数 Equipment</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-md p-2.5 text-center">
                <p className="text-lg font-bold">{selectedArea.totalHours}<span className="text-sm font-normal text-muted-foreground">h</span></p>
                <p className="text-xs text-muted-foreground">工人总工时 Worker Hours</p>
              </div>
              <div className="bg-muted/50 rounded-md p-2.5 text-center">
                <p className="text-lg font-bold">{selectedArea.totalEqHours}<span className="text-sm font-normal text-muted-foreground">h</span></p>
                <p className="text-xs text-muted-foreground">设备总用时 Eq. Hours</p>
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2">点击扇区查看该区域用工与设备数量 Click a sector to view area details</p>
    </ChartCard>
  );
}

// ─── Foreman View ───
function ForemanAnalytics() {
  const { getTeamWorkers, getTeamEquipment, dailyLogs } = useDataContext();
  const { currentPersonnelId } = useAppContext();
  const foremanId = currentPersonnelId;
  const teamWorkers = getTeamWorkers(foremanId);
  const teamEquip = getTeamEquipment(foremanId);
  const logs = dailyLogs.filter(l => !l.deletedAt && l.foremanId === foremanId && (l.status === 'approved' || l.status === 'conditional'));
  const [granularity, setGranularity] = useState<TimeGranularity>('month');
  const [period, setPeriod] = useState<string>('all');
  const periods = useMemo(() => getPeriodsFromDates(logs.map(log => log.date), granularity), [logs, granularity]);
  const filteredLogs = useMemo(() => {
    if (period === 'all') return logs;
    return logs.filter(log => getTimePeriod(log.date, granularity) === period);
  }, [logs, period, granularity]);
  const { entries, eqUsage } = tagEntries(filteredLogs);

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const totalEqHours = eqUsage.reduce((s, e) => s + e.hours, 0);

  const activeWorkerIds = new Set(entries.map(e => e.workerId));
  const activeEqIds = new Set(eqUsage.map(e => e.equipmentId));
  const idleWorkers = teamWorkers.filter(w => !activeWorkerIds.has(w.id) && w.status === 'active').length;
  const idleEquipment = teamEquip.filter(eq => !activeEqIds.has(eq.id) && eq.status === 'available').length;

  const workerHoursMap = new Map<string, number>();
  entries.forEach(e => workerHoursMap.set(e.workerName, (workerHoursMap.get(e.workerName) || 0) + e.hours));
  const workerHoursData = Array.from(workerHoursMap.entries()).map(([name, hours]) => ({ name, hours })).sort((a, b) => b.hours - a.hours);

  return (
    <>
      <div className="bg-card rounded-lg border shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Data Range:</span>
          <TimePeriodSelector
            granularity={granularity}
            setGranularity={setGranularity}
            period={period}
            setPeriod={setPeriod}
            periods={periods}
          />
          <span className="text-xs text-muted-foreground">Filtered logs: {filteredLogs.length}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="班组工人 Team Workers" value={teamWorkers.length} unit="" />
        <StatCard label="班组设备 Team Equipment" value={teamEquip.length} unit="" />
        <StatCard label="总工时 Total Hours" value={totalHours} unit="h" />
        <StatCard label="设备总用时 Eq. Hours" value={totalEqHours} unit="h" />
        <StatCard label="闲置工人 Idle Workers" value={idleWorkers} unit="" highlight={idleWorkers > 0} />
        <StatCard label="闲置设备 Idle Equipment" value={idleEquipment} unit="" highlight={idleEquipment > 0} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="工人工时统计 Worker Hours">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={workerHoursData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,88%)" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={50} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(214,20%,88%)' }} />
              <Bar dataKey="hours" fill="hsl(215,50%,23%)" radius={[0, 4, 4, 0]} name="工时 Hours(h)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <EquipmentAreaChart eqUsage={eqUsage} title="设备使用时长与区域 Equipment Hours by Area" />
        <AreaPieChart entries={entries} eqUsage={eqUsage} title="施工区域工时分布 Area Hours Distribution" />
      </div>
    </>
  );
}

// ─── Engineer View ───
function EngineerAnalytics() {
  const { personnel, equipment, teamAssignments, dailyLogs, getEngineerForemen } = useDataContext();
  const { currentPersonnelId } = useAppContext();
  const managedForemanIds = getEngineerForemen(currentPersonnelId);
  const foremen = personnel.filter(p => p.role === 'foreman' && p.status !== 'resigned' && managedForemanIds.includes(p.id));
  const approvedLogs = dailyLogs.filter(l => !l.deletedAt && managedForemanIds.includes(l.foremanId) && (l.status === 'approved' || l.status === 'conditional'));

  // Global time filter for engineer
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [period, setPeriod] = useState<string>('all');

  const allDates = useMemo(() => Array.from(new Set(approvedLogs.map(l => l.date))), [approvedLogs]);
  const periods = useMemo(() => getPeriodsFromDates(allDates, granularity), [allDates, granularity]);

  const filteredLogs = useMemo(() => {
    if (period === 'all') return approvedLogs;
    return approvedLogs.filter(l => getTimePeriod(l.date, granularity) === period);
  }, [approvedLogs, period, granularity]);

  const foremanData = foremen.map(fm => {
    const assignment = teamAssignments.find(a => a.foremanId === fm.id);
    const fmLogs = filteredLogs.filter(l => l.foremanId === fm.id);
    const { entries: fmEntries, eqUsage: fmEqUsage } = tagEntries(fmLogs);

    // Group by time period for chart
    const dailyMap = new Map<string, { workers: Set<string>; eqHours: number }>();
    fmLogs.forEach(log => {
      const key = getTimePeriod(log.date, granularity);
      const d = dailyMap.get(key) || { workers: new Set<string>(), eqHours: 0 };
      log.entries.forEach(e => d.workers.add(e.workerId));
      log.equipmentUsage.forEach(e => d.eqHours += e.hours);
      dailyMap.set(key, d);
    });
    const dailyData = Array.from(dailyMap.entries())
      .map(([date, d]) => ({ date, '在班工人 Workers': d.workers.size, '设备用时 Eq.Hours': d.eqHours }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const workerIds = assignment?.workerIds || [];
    const eqIds = assignment?.equipmentIds || [];
    const workerCount = workerIds.length;
    const totalHours = fmEntries.reduce((s, e) => s + e.hours, 0);
    const totalEqHours = fmEqUsage.reduce((s, e) => s + e.hours, 0);

    // Idle counts: team members not appearing in filtered logs
    const activeWorkerIds = new Set(fmEntries.map(e => e.workerId));
    const activeEqIds = new Set(fmEqUsage.map(e => e.equipmentId));
    const teamWorkersObj = personnel.filter(p => workerIds.includes(p.id));
    const teamEqObj = equipment.filter(e => eqIds.includes(e.id));
    const idleWorkers = teamWorkersObj.filter(w => !activeWorkerIds.has(w.id) && w.status === 'active').length;
    const idleEquipment = teamEqObj.filter(eq => !activeEqIds.has(eq.id) && eq.status === 'available').length;

    return { ...fm, workerCount, totalHours, totalEqHours, dailyData, entries: fmEntries, eqUsage: fmEqUsage, idleWorkers, idleEquipment };
  });

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1 mr-4">
          <StatCard label="管理工长 Managed Foremen" value={foremen.length} unit="" />
          <StatCard label="全部设备 All Equipment" value={equipment.length} unit="" />
          <StatCard label="筛选日志 Filtered Logs" value={filteredLogs.length} unit="" />
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm p-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">数据范围 Data Range：</span>
          <TimePeriodSelector granularity={granularity} setGranularity={setGranularity} period={period} setPeriod={setPeriod} periods={periods} />
        </div>
      </div>

      <div className="space-y-6">
        {foremanData.map(fm => (
          <div key={fm.id} className="bg-card rounded-lg border shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold">
                {fm.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold">{fm.laborId && <span className="font-mono text-xs text-muted-foreground mr-1.5">{fm.laborId}</span>}{fm.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fm.workerCount} 工人 Workers · 总工时 Total {fm.totalHours}h · 设备用时 Eq. {fm.totalEqHours}h
                  {(fm.idleWorkers > 0 || fm.idleEquipment > 0) && (
                    <span className="text-amber-600 ml-2">
                      · 闲置 Idle: {fm.idleWorkers > 0 ? `${fm.idleWorkers} 工人 Workers` : ''}{fm.idleWorkers > 0 && fm.idleEquipment > 0 ? ', ' : ''}{fm.idleEquipment > 0 ? `${fm.idleEquipment} 设备 Eq.` : ''}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                在班工人 & 设备使用 Workers & Equipment ({granularity === 'day' ? 'Daily' : granularity === 'week' ? 'Weekly' : granularity === 'month' ? 'Monthly' : 'Yearly'})
              </h4>
              {fm.dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={fm.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,88%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={30} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(214,20%,88%)' }} />
                    <Bar dataKey="在班工人 Workers" fill="hsl(215,50%,23%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="设备用时 Eq.Hours" fill="hsl(142,71%,40%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">该时段暂无数据 No data for this period</p>
                )}
              </div>
              <AreaPieChart entries={fm.entries} eqUsage={fm.eqUsage} title="施工区域分布 Area Distribution" hideTimeFilter />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Admin View ───
function AdminAnalytics() {
  const { personnel, equipment, teamAssignments, dailyLogs } = useDataContext();
  const approvedLogs = dailyLogs.filter(l => !l.deletedAt && (l.status === 'approved' || l.status === 'conditional'));
  const [granularity, setGranularity] = useState<TimeGranularity>('month');
  const [period, setPeriod] = useState<string>('all');
  const periods = useMemo(() => getPeriodsFromDates(approvedLogs.map(log => log.date), granularity), [approvedLogs, granularity]);
  const filteredLogs = useMemo(() => {
    if (period === 'all') return approvedLogs;
    return approvedLogs.filter(log => getTimePeriod(log.date, granularity) === period);
  }, [approvedLogs, period, granularity]);
  const { entries: allEntries, eqUsage: allEqUsage } = tagEntries(filteredLogs);
  const foremen = personnel.filter(p => p.role === 'foreman');

  const totalHours = allEntries.reduce((s, e) => s + e.hours, 0);
  const totalWorkers = new Set(allEntries.map(e => e.workerId)).size;
  const avgHours = totalWorkers > 0 ? (totalHours / totalWorkers).toFixed(1) : 0;
  const totalEqHours = allEqUsage.reduce((s, e) => s + e.hours, 0);

  const allWorkers = personnel.filter(p => p.role === 'worker' && p.status === 'active');
  const allEquip = equipment.filter(eq => eq.status === 'available' || eq.status === 'in_use');
  const activeWorkerIds = new Set(allEntries.map(e => e.workerId));
  const activeEqIds = new Set(allEqUsage.map(e => e.equipmentId));
  const idleWorkers = allWorkers.filter(w => !activeWorkerIds.has(w.id)).length;
  const idleEquipment = allEquip.filter(eq => !activeEqIds.has(eq.id)).length;

  const foremanSummary = foremen.map(fm => {
    const assignment = teamAssignments.find(a => a.foremanId === fm.id);
    const fmLogs = filteredLogs.filter(l => l.foremanId === fm.id);
    const { entries: fmEntries, eqUsage: fmEqUsage } = tagEntries(fmLogs);
    const workerIds = assignment?.workerIds || [];
    const eqIds = assignment?.equipmentIds || [];
    const fmActiveWorkers = new Set(fmEntries.map(e => e.workerId));
    const fmActiveEq = new Set(fmEqUsage.map(e => e.equipmentId));
    const fmIdleWorkers = personnel.filter(p => workerIds.includes(p.id) && !fmActiveWorkers.has(p.id) && p.status === 'active').length;
    const fmIdleEq = equipment.filter(e => eqIds.includes(e.id) && !fmActiveEq.has(e.id) && (e.status === 'available' || e.status === 'in_use')).length;
    return {
      name: fm.name,
      laborId: fm.laborId,
      workerCount: workerIds.length,
      totalHours: fmEntries.reduce((s, e) => s + e.hours, 0),
      eqHours: fmEqUsage.reduce((s, e) => s + e.hours, 0),
      logCount: fmLogs.length,
      idleWorkers: fmIdleWorkers,
      idleEq: fmIdleEq,
    };
  });

  return (
    <>
      <div className="bg-card rounded-lg border shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Data Range:</span>
          <TimePeriodSelector
            granularity={granularity}
            setGranularity={setGranularity}
            period={period}
            setPeriod={setPeriod}
            periods={periods}
          />
          <span className="text-xs text-muted-foreground">Filtered logs: {filteredLogs.length}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="总工时 Total Hours" value={totalHours} unit="h" />
        <StatCard label="参与工人 Workers" value={totalWorkers} unit="" />
        <StatCard label="人均工时 Avg Hours" value={avgHours} unit="h" />
        <StatCard label="设备总用时 Eq. Hours" value={totalEqHours} unit="h" />
        <StatCard label="闲置工人 Idle Workers" value={idleWorkers} unit="" highlight={idleWorkers > 0} />
        <StatCard label="闲置设备 Idle Equipment" value={idleEquipment} unit="" highlight={idleEquipment > 0} />
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-3 border-b bg-muted/50"><h3 className="font-semibold text-sm">工长数据汇总 Foreman Summary</h3></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">工长 Foreman</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">管理工人 Workers</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">闲置工人 Idle W.</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">闲置设备 Idle Eq.</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">总工时 Hours</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">设备用时 Eq.Hours</th>
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">审核日志 Logs</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {foremanSummary.map(fm => (
              <tr key={fm.name} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-medium">
                  {fm.laborId && <span className="font-mono text-xs text-muted-foreground mr-1.5">{fm.laborId}</span>}
                  {fm.name}
                </td>
                <td className="px-4 py-2.5 text-center">{fm.workerCount} 人</td>
                <td className={`px-4 py-2.5 text-center ${fm.idleWorkers > 0 ? 'text-amber-600 font-medium' : ''}`}>{fm.idleWorkers}</td>
                <td className={`px-4 py-2.5 text-center ${fm.idleEq > 0 ? 'text-amber-600 font-medium' : ''}`}>{fm.idleEq}</td>
                <td className="px-4 py-2.5 text-center">{fm.totalHours}h</td>
                <td className="px-4 py-2.5 text-center">{fm.eqHours}h</td>
                <td className="px-4 py-2.5 text-center">{fm.logCount} 份</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <EquipmentAreaChart eqUsage={allEqUsage} title="Equipment Hours by Area" hideTimeFilter />
        <AreaPieChart entries={allEntries} eqUsage={allEqUsage} title="Area Hours Distribution" hideTimeFilter />
      </div>
    </>
  );
}

// ─── Shared Components ───
function StatCard({ label, value, unit, highlight }: { label: string; value: number | string; unit: string; highlight?: boolean }) {
  return (
    <div className={`stat-card text-center ${highlight ? 'border-amber-500/50 bg-amber-500/5' : ''}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${highlight ? 'text-amber-600' : ''}`}>{value}<span className="text-lg font-normal text-muted-foreground">{unit}</span></p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border shadow-sm p-5">
      <h3 className="font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ─── Main ───
const roleSubtitles = {
  foreman: '您的班组工人工时与设备使用数据 Your team worker hours and equipment usage',
  engineer: 'Foreman team data, filter by day/week/month/year',
  admin: 'Project-wide data overview, filter by day/week/month/year',
};

export default function AnalyticsPage() {
  const { currentRole } = useAppContext();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">数据分析 Analytics</h1>
        <p className="page-subtitle">{roleSubtitles[currentRole]}</p>
      </div>
      {currentRole === 'foreman' && <ForemanAnalytics />}
      {currentRole === 'engineer' && <EngineerAnalytics />}
      {currentRole === 'admin' && <AdminAnalytics />}
    </div>
  );
}
