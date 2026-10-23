import type { Lead } from '@shared/types/crm.types';
import { leadLabels, qualificationLabels } from './leadPresentation';

const serviceText: Record<string, string> = {
  residency: 'Residency',
  business_setup: 'Business setup',
  both: 'Residency + business setup',
  unspecified: '',
};

const columns: [string, (lead: Lead) => string | null | undefined][] = [
  ['Name', (l) => l.fullName],
  ['Phone', (l) => l.phoneOrEmail || l.phoneNumber],
  ['WhatsApp', (l) => (l.whatsappSameAsPhone ? l.phoneOrEmail : l.whatsappNumber)],
  ['Stage', (l) => leadLabels[l.leadStatus]],
  ['Lead', (l) => qualificationLabels[l.qualification || 'unknown']],
  ['Lead reason', (l) => l.qualificationReason],
  ['Service', (l) => serviceText[l.serviceVertical] ?? l.serviceVertical],
  ['Profession / activity', (l) => l.profession || l.workBusinessActivity],
  ['Nationality', (l) => l.nationality],
  ['Current location', (l) => [l.currentCity, l.currentCountry].filter(Boolean).join(', ') || l.currentLocation],
  ['Preferred emirate', (l) => l.targetEmirate],
  ['Visa status', (l) => l.visaStatus],
  ['Timing', (l) => l.timeline],
  ['Need', (l) => l.summary],
  ['Next action', (l) => l.nextAction],
  ['Created', (l) => new Date(l.createdAt).toISOString().slice(0, 10)],
  ['Last activity', (l) => new Date(l.updatedAt).toISOString().slice(0, 16).replace('T', ' ')],
];

function cell(value: string | null | undefined): string {
  let text = value == null ? '' : String(value);
  // Prevent spreadsheet formula injection from customer-provided text.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function leadsToCsv(leads: Lead[]): string {
  const header = columns.map(([name]) => cell(name)).join(',');
  const rows = leads.map((lead) => columns.map(([, get]) => cell(get(lead))).join(','));
  // BOM so Excel opens UTF-8 (Malayalam/Arabic names) correctly.
  return `﻿${[header, ...rows].join('\r\n')}`;
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
