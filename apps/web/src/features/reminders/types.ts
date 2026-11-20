export type ReminderKind = 'APPOINTMENT_TOMORROW' | 'VISA_APPOINTMENT_TOMORROW' | 'PROSPECT_FOLLOW_UP' | 'INVOICE_OVERDUE' | 'DOCUMENT_REJECTED';

export interface TodayReminder {
  key: string;
  kind: ReminderKind;
  entityType: 'APPOINTMENT' | 'VISA_FILE' | 'PROSPECT' | 'INVOICE' | 'DOCUMENT';
  entityId: string;
  target: { type: 'CANDIDATE' | 'PROSPECT'; id: string; name: string; phone: string | null; preferredLanguage: 'fr' | 'ar' };
  at: string | null;
  summary: Record<string, string>;
  autoChannel: { channel: 'EMAIL' | 'NOTIFICATION'; status: 'SENT' | 'SKIPPED' | 'FAILED'; at: string; error: string | null } | null;
  assignedToId: string | null;
  unassigned: boolean;
  whatsappText: string;
}

export interface TodayResponse {
  items: TodayReminder[];
  doneToday: TodayReminder[];
}
