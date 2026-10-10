import type { LucideIcon } from 'lucide-react';

export interface BuildingCardData {
  title: string;
  count: number | string;
  status: string;
  icon: LucideIcon;
  variant?: 'info' | 'success' | 'warning' | 'error';
}
