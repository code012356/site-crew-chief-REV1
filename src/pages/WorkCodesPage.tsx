import { useMemo, useRef, useState } from 'react';
import { Download, Edit2, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useDataContext } from '@/contexts/DataContext';
import { WorkCode } from '@/lib/types';
import { exportWorkCodes, importWorkCodes } from '@/lib/excel-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { actionLabels, fieldLabels, filterLabels, messages, pageTitles } from '@/lib/i18n';

type WorkCodeForm = {
  code: string;
  name: string;
  category: string;
};

const emptyForm: WorkCodeForm = { code: '', name: '', category: '' };
const PAGE_SIZE = 5;

export default function WorkCodesPage() {
  const { workCodes, workAreas, addWorkCode, updateWorkCode, deleteWorkCode, addWorkArea, updateWorkArea, deleteWorkArea } = useDataContext();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkCode | null>(null);
  const [form, setForm] = useState<WorkCodeForm>(emptyForm);
  const [areaInput, setAreaInput] = useState('');
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = Array.from(new Set(workCodes.map(wc => wc.category).filter(Boolean))).sort();

  const filtered = useMemo(() => workCodes.filter(wc => {
    const q = search.trim().toLowerCase();
    const hay = `${wc.code} ${wc.name} ${wc.category}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (filterCat !== 'all' && wc.category !== filterCat) return false;
    return true;
  }), [filterCat, search, workCodes]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedWorkCodes = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, category: categories[0] || '' });
    setDialogOpen(true);
  };

  const openEdit = (wc: WorkCode) => {
    setEditing(wc);
    setForm({ code: wc.code, name: wc.name, category: wc.category });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
    };
    if (!payload.code || !payload.name || !payload.category) {
      toast.error(messages.fillComplete);
      return;
    }
    if (editing) {
      await updateWorkCode(editing.id, payload);
      toast.success(messages.saved);
    } else {
      if (workCodes.some(wc => wc.code === payload.code)) {
        toast.error('Code already exists');
        return;
      }
      await addWorkCode(payload);
      toast.success(messages.saved);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteWorkCode(id);
    toast.success(messages.deleted);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importWorkCodes(file);
      const rowsByCode = new Map<string, WorkCode>();
      imported.forEach(wc => rowsByCode.set(wc.code, wc));
      for (const wc of rowsByCode.values()) {
        const existing = workCodes.find(w => w.code === wc.code);
        const payload = { name: wc.name, category: wc.category };
        if (existing) {
          await updateWorkCode(existing.id, payload);
        } else {
          await addWorkCode({ code: wc.code, ...payload });
        }
      }
      toast.success(`${messages.imported} (${rowsByCode.size})`);
    } catch (error) {
      console.error('Import work codes failed', error);
      toast.error(error instanceof Error ? error.message : messages.importFailed);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAreaSave = async () => {
    const name = areaInput.trim();
    if (!name) {
      toast.error('Please enter Area');
      return;
    }
    if (workAreas.some(a => a.name.toLowerCase() === name.toLowerCase() && a.id !== editingAreaId)) {
      toast.error('Area already exists');
      return;
    }
    if (editingAreaId) {
      await updateWorkArea(editingAreaId, name);
      toast.success(messages.saved);
    } else {
      await addWorkArea(name);
      toast.success(messages.saved);
    }
    setAreaInput('');
    setEditingAreaId(null);
  };

  const startEditArea = (id: string, name: string) => {
    setEditingAreaId(id);
    setAreaInput(name);
  };

  return (
    <div>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">{pageTitles.workCodes.title}</h1>
          <p className="page-subtitle">{pageTitles.workCodes.subtitle}</p>
        </div>
        <div className="mobile-action-grid">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2"><Upload size={16} /> {actionLabels.import}</Button>
          <Button variant="outline" onClick={() => exportWorkCodes(workCodes)} className="gap-2"><Download size={16} /> {actionLabels.export}</Button>
          <Button onClick={openCreate} className="gap-2"><Plus size={16} /> {actionLabels.add}</Button>
        </div>
      </div>

      <div className="mobile-filter-grid mb-4">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={filterLabels.searchCode} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={value => { setFilterCat(value); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{filterLabels.allCategories}</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.code}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.name}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.category}</th>
              <th className="sticky right-0 bg-muted/50 text-right px-4 py-3 font-medium text-muted-foreground shadow-[-8px_0_12px_-12px_hsl(var(--foreground))]">{fieldLabels.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pagedWorkCodes.map(wc => (
              <tr key={wc.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{wc.code}</td>
                <td className="px-4 py-3 font-medium">{wc.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{wc.category}</td>
                <td className="sticky right-0 bg-card px-4 py-3 text-right shadow-[-8px_0_12px_-12px_hsl(var(--foreground))]">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(wc)}><Edit2 size={15} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(wc.id)}><Trash2 size={15} className="text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > PAGE_SIZE && (
          <div className="flex flex-col gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>显示 {pageStart}-{pageEnd} / {filtered.length} Showing {pageStart}-{pageEnd} of {filtered.length}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}>
                上一页 Prev
              </Button>
              <span className="min-w-16 text-center">第 {safePage} / {totalPages} 页</span>
              <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages}>
                下一页 Next
              </Button>
            </div>
          </div>
        )}
        {filtered.length === 0 && <div className="px-4 py-12 text-center text-muted-foreground">{messages.noMatch}</div>}
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden mt-6">
        <div className="px-4 py-3 border-b bg-muted/30 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="font-semibold">施工区域 Area 管理</h2>
            <p className="text-sm text-muted-foreground">管理员维护一级 Area；工长填写日志时再输入二级具体位置。</p>
          </div>
          <div className="mobile-action-grid md:flex md:w-auto">
            <Input
              value={areaInput}
              onChange={e => setAreaInput(e.target.value)}
              placeholder="e.g. Area A / A区"
              className="w-full md:w-[240px]"
            />
            <Button onClick={handleAreaSave} className="gap-1">
              <Plus size={15} /> {editingAreaId ? actionLabels.save : actionLabels.add}
            </Button>
            {editingAreaId && (
              <Button variant="outline" onClick={() => { setEditingAreaId(null); setAreaInput(''); }}>
                {actionLabels.cancel}
              </Button>
            )}
          </div>
        </div>
        <div className="divide-y">
          {workAreas.map(area => (
            <div key={area.id} className="px-4 py-3 flex items-center justify-between">
              <span className="font-medium">{area.name}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => startEditArea(area.id, area.name)}><Edit2 size={15} /></Button>
                {!area.id.startsWith('default_') && (
                  <Button variant="ghost" size="icon" onClick={() => deleteWorkArea(area.id)}><Trash2 size={15} className="text-destructive" /></Button>
                )}
              </div>
            </div>
          ))}
          {workAreas.length === 0 && <div className="px-4 py-8 text-center text-muted-foreground">No Area</div>}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Work Code' : 'Add Work Code'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>{fieldLabels.code}</Label><Input placeholder="e.g. TJ-006" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} /></div>
            <div><Label>{fieldLabels.name}</Label><Input placeholder="e.g. Foundation Work" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label>{fieldLabels.category}</Label>
              <Input list="work-code-categories" placeholder="e.g. Civil / 土建工程" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              <datalist id="work-code-categories">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{actionLabels.cancel}</Button>
            <Button onClick={handleSave}>{editing ? actionLabels.save : actionLabels.add}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
