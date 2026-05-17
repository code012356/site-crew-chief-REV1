import { useRef, useState } from 'react';
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

const CATEGORIES = ['土建工程', '安装工程', '装修工程', '其他'];
const CATEGORY_EN: Record<string, string> = {
  土建工程: 'Civil',
  安装工程: 'Installation',
  装修工程: 'Decoration',
  其他: 'Other',
};

export default function WorkCodesPage() {
  const { workCodes, addWorkCode, updateWorkCode, deleteWorkCode } = useDataContext();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkCode | null>(null);
  const [form, setForm] = useState({ code: '', name: '', category: '土建工程' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = workCodes.filter(wc => {
    if (search && !wc.code.includes(search) && !wc.name.includes(search)) return false;
    if (filterCat !== 'all' && wc.category !== filterCat) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', category: '土建工程' });
    setDialogOpen(true);
  };

  const openEdit = (wc: WorkCode) => {
    setEditing(wc);
    setForm({ code: wc.code, name: wc.name, category: wc.category });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error(messages.fillComplete);
      return;
    }
    if (editing) {
      await updateWorkCode(editing.id, form);
      toast.success(messages.saved);
    } else {
      if (workCodes.some(wc => wc.code === form.code.trim())) {
        toast.error('代码已存在 Code already exists');
        return;
      }
      await addWorkCode(form);
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
      for (const wc of imported) {
        const existing = workCodes.find(w => w.code === wc.code);
        if (existing) {
          await updateWorkCode(existing.id, { name: wc.name, category: wc.category });
        } else {
          await addWorkCode({ code: wc.code, name: wc.name, category: wc.category });
        }
      }
      toast.success(`${messages.imported} (${imported.length})`);
    } catch {
      toast.error(messages.importFailed);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">{pageTitles.workCodes.title}</h1>
          <p className="page-subtitle">{pageTitles.workCodes.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2"><Upload size={16} /> {actionLabels.import}</Button>
          <Button variant="outline" onClick={() => exportWorkCodes(workCodes)} className="gap-2"><Download size={16} /> {actionLabels.export}</Button>
          <Button onClick={openCreate} className="gap-2"><Plus size={16} /> {actionLabels.add}</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={filterLabels.searchCode} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{filterLabels.allCategories}</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c} {CATEGORY_EN[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.code}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.name}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">{fieldLabels.category}</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">{fieldLabels.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(wc => (
              <tr key={wc.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{wc.code}</td>
                <td className="px-4 py-3 font-medium">{wc.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{wc.category} {CATEGORY_EN[wc.category] || ''}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(wc)}><Edit2 size={15} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(wc.id)}><Trash2 size={15} className="text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="px-4 py-12 text-center text-muted-foreground">{messages.noMatch}</div>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? '编辑施工代码 Edit Work Code' : '添加施工代码 Add Work Code'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>{fieldLabels.code}</Label><Input placeholder="e.g. TJ-006" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} /></div>
            <div><Label>{fieldLabels.name}</Label><Input placeholder="e.g. 地基处理 Foundation Work" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label>{fieldLabels.category}</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c} {CATEGORY_EN[c]}</SelectItem>)}
                </SelectContent>
              </Select>
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
