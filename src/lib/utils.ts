import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function validateLaborId(laborId: string, role: 'worker' | 'foreman' | 'engineer' | 'admin'): string | null {
  if (!laborId.trim()) return null;
  const id = laborId.trim();
  if (role === 'engineer' || role === 'admin') {
    if (!/^\d+$/.test(id)) {
      return '工程师工号必须为纯数字 Engineer labor ID must be digits only';
    }
  } else if (!/^LQ/i.test(id)) {
    return '工人/工长工号必须以 LQ 开头 Worker/Foreman labor ID must start with LQ';
  }
  return null;
}
