export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: string;
  mustChangePassword: boolean;
  roleId: string;
  roleCode: string;
  roleName: string;
  branchId: string | null;
  permissions: string[];
  isPlatformAdmin: boolean;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

export interface PermissionDef {
  code: string;
  module: string;
  action: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  employeeCount: number;
}

export interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  locale: string;
  status: 'ACTIVE' | 'INACTIVE';
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roleId: string;
  branchId: string | null;
  role: { id: string; code: string; name: string };
  branch: { id: string; name: string; code: string } | null;
}

export interface AgencySettings {
  name: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  socialLinks: Partial<Record<'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'youtube', string>> | null;
  openingHours: string | null;
  legalInfo: string | null;
  taxId: string | null;
  bankDetails: string | null;
  currency: string;
  timezone: string;
  footerText: string | null;
  privacyPolicy: string | null;
  termsOfService: string | null;
  legalNotice: string | null;
  contractTemplate: string | null;
}

// ---------- CMS « Page d'accueil » (réservé au Super Admin) ----------

export const LANDING_SERVICE_ICONS = ['GraduationCap', 'Briefcase', 'Languages', 'Users', 'FileText', 'ShieldCheck', 'Sparkles', 'Plane', 'Home', 'Heart'] as const;
export type LandingServiceIcon = (typeof LANDING_SERVICE_ICONS)[number];

export interface LandingPageContent {
  id: string;
  heroTitleFr: string | null;
  heroTitleAr: string | null;
  heroSubtitleFr: string | null;
  heroSubtitleAr: string | null;
  heroImageUrl: string | null;
  aboutTitleFr: string | null;
  aboutTitleAr: string | null;
  aboutTextFr: string | null;
  aboutTextAr: string | null;
  aboutImageUrl: string | null;
  seoTitleFr: string | null;
  seoTitleAr: string | null;
  seoDescriptionFr: string | null;
  seoDescriptionAr: string | null;
}

export interface LandingBranding {
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  footerTextFr: string | null;
  footerTextAr: string | null;
}

export interface LandingService {
  id: string;
  titleFr: string;
  titleAr: string | null;
  descriptionFr: string;
  descriptionAr: string | null;
  iconName: LandingServiceIcon;
  position: number;
  isActive: boolean;
}

export interface LandingFaqItem {
  id: string;
  questionFr: string;
  questionAr: string | null;
  answerFr: string;
  answerAr: string | null;
  position: number;
  isActive: boolean;
}

export interface Testimonial {
  id: string;
  name: string;
  destination: string | null;
  quoteFr: string;
  quoteAr: string | null;
  position: number;
  isActive: boolean;
}

export interface PartnerLogo {
  id: string;
  name: string;
  logoUrl: string;
  position: number;
  isActive: boolean;
}

export interface LandingPageAdminData {
  content: LandingPageContent;
  branding: LandingBranding;
  services: LandingService[];
  faq: LandingFaqItem[];
  testimonials: Testimonial[];
  partnerLogos: PartnerLogo[];
}

export interface LandingPagePublicData {
  content: LandingPageContent | null;
  services: LandingService[];
  faq: LandingFaqItem[];
  testimonials: Testimonial[];
  partnerLogos: PartnerLogo[];
}

// ---------- Phase 2 : prospects et candidats ----------

export type ProspectSource = 'WEBSITE' | 'PHONE' | 'WALK_IN' | 'REFERRAL' | 'SOCIAL' | 'PARTNER' | 'OTHER';
export type ProspectStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
export type CandidateStatus = 'ACTIVE' | 'ON_HOLD' | 'ARCHIVED';

interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
}

export type LeadCategory = 'hot' | 'warm' | 'cold';

export interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  city: string | null;
  desiredCountryId: string | null;
  desiredCountry: { id: string; name: string; flagEmoji: string | null } | null;
  desiredProgram: string | null;
  budget: number | null;
  campaign: string | null;
  nextFollowUpAt: string | null;
  source: ProspectSource;
  status: ProspectStatus;
  notes: string | null;
  assignedToId: string | null;
  assignedTo: PersonRef | null;
  branch: { id: string; name: string } | null;
  score: number;
  category: LeadCategory;
  createdAt: string;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  nationality: string | null;
  passportNumber: string | null;
  status: CandidateStatus;
  assignedToId: string | null;
  assignedTo: PersonRef | null;
  branch: { id: string; name: string } | null;
  partner: { id: string; companyName: string; type: PartnerType } | null;
  _count: { applications: number; visaFiles: number; documents: number };
  portalActivatedAt: string | null;
  createdAt: string;
}

export type TimelineEntityType = 'PROSPECT' | 'CANDIDATE';
export type TimelineType = 'NOTE' | 'CALL' | 'MEETING' | 'EMAIL' | 'STATUS_CHANGE' | 'DOCUMENT' | 'SYSTEM';

export interface TimelineEntry {
  id: string;
  type: TimelineType;
  content: string;
  createdByName: string | null;
  createdAt: string;
}

// ---------- Phase 3 : dossier candidat ----------

export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ChecklistItemStatus = 'PENDING' | 'DONE' | 'NOT_APPLICABLE';

export interface CandidateDocument {
  id: string;
  type: string;
  label: string;
  version: number;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  reviewNote: string | null;
  expiryDate: string | null;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistItemStatus;
  note: string | null;
  position: number;
}

// ---------- Phase 4 : candidatures et visas ----------

export type ApplicationStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'WAITLISTED' | 'WITHDRAWN';
export type VisaStatus = 'NOT_STARTED' | 'PREPARING' | 'SUBMITTED' | 'APPROVED' | 'REFUSED';

export interface Application {
  id: string;
  programId: string | null;
  country: string;
  university: string;
  program: string;
  intake: string;
  status: ApplicationStatus;
  submittedAt: string | null;
  decisionAt: string | null;
  notes: string | null;
  createdAt: string;
}

// ---------- Phase 4 : catalogue (pays, universités, programmes) ----------

export type ProgramLevel =
  | 'LICENCE' | 'MASTER' | 'DOCTORAT' | 'FOUNDATION' | 'PREPA'
  | 'FORMATION_PRO' | 'FORMATION_PRIVEE' | 'FORMATION_PUBLIQUE'
  | 'SEJOUR_LINGUISTIQUE' | 'COURS_DE_LANGUE' | 'CERTIFICAT';

export interface Country {
  id: string;
  slug: string;
  name: string;
  flagEmoji: string | null;
  imageUrl: string | null;
  description: string | null;
  universitySystem: string | null;
  advantages: string | null;
  costOfLiving: string | null;
  tuitionFeesInfo: string | null;
  languages: string | null;
  admissionConditions: string | null;
  languageLevel: string | null;
  applicationProcess: string | null;
  visaInfo: string | null;
  housingInfo: string | null;
  insuranceInfo: string | null;
  studentWorkInfo: string | null;
  transportInfo: string | null;
  calendarInfo: string | null;
  documentsInfo: string | null;
  faq: string | null;
  isActive: boolean;
  universities?: University[];
}

export interface University {
  id: string;
  countryId: string;
  country?: { id: string; name: string; slug: string; flagEmoji: string | null };
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string;
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  isPublic: boolean;
  description: string | null;
  feesInfo: string | null;
  calendarInfo: string | null;
  deadlinesInfo: string | null;
  conditionsInfo: string | null;
  languageLevel: string | null;
  extraInfo: string | null;
  isActive: boolean;
  applicationsOpen: boolean;
  programs?: Program[];
}

export interface Program {
  id: string;
  universityId: string;
  university?: University & { country?: Country };
  slug: string;
  name: string;
  level: ProgramLevel;
  domain: string | null;
  specialty: string | null;
  language: string | null;
  durationMonths: number | null;
  credits: number | null;
  tuitionFees: number | null;
  applicationFees: number | null;
  currency: string;
  openDate: string | null;
  deadline: string | null;
  intake: string | null;
  academicConditions: string | null;
  prerequisites: string | null;
  minIelts: number | null;
  minToefl: number | null;
  otherCertificates: string | null;
  documentsRequired: string | null;
  description: string | null;
  outcomes: string | null;
  officialUrl: string | null;
  isActive: boolean;
}

export interface VisaFile {
  id: string;
  country: string;
  status: VisaStatus;
  visaCenter: string | null;
  referenceNumber: string | null;
  submissionDate: string | null;
  appointmentDate: string | null;
  notes: string | null;
  createdAt: string;
}

// ---------- Phase 5 : finance ----------

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE';

export interface LineItem {
  id: string;
  label: string;
  quantity: number;
  unitPrice: number;
}

export interface Quote {
  id: string;
  number: string;
  status: QuoteStatus;
  currency: string;
  validUntil: string | null;
  items: LineItem[];
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  method: PaymentMethod;
  receiptNumber: string;
  paidAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  dueDate: string | null;
  items: LineItem[];
  payments: Payment[];
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  candidateId?: string | null;
  createdAt: string;
}

export interface CashboxMovement {
  id: string;
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  createdAt: string;
}

export interface CashboxSession {
  id: string;
  openedAt: string;
  openingAmount: number;
  closedAt: string | null;
  closingAmount: number | null;
  expectedAmount: number | null;
  note: string | null;
  balance?: number;
  totalIn?: number;
  totalOut?: number;
}

// ---------- Phase 6 : tâches et rendez-vous ----------

export type TaskStatus = 'TODO' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type AppointmentStatus = 'SCHEDULED' | 'DONE' | 'CANCELLED' | 'NO_SHOW';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: PersonRef | null;
  createdAt: string;
}

export interface Appointment {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  status: AppointmentStatus;
}

export interface ActivityEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  userName: string | null;
  ip: string | null;
  createdAt: string;
}

export interface LoginEntry {
  id: string;
  email: string;
  success: boolean;
  reason: string | null;
  ip: string | null;
  createdAt: string;
}

// ---------- Phase 5 (approfondie) : automatisations et échéances ----------

export type AutomationTrigger = 'APPLICATION_STATUS_CHANGED' | 'VISA_STATUS_CHANGED' | 'DOCUMENT_REJECTED' | 'CANDIDATE_STATUS_CHANGED';
export type AutomationActionType = 'CREATE_TASK' | 'ADD_CHECKLIST_ITEM' | 'TIMELINE_NOTE';

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  config: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  triggerValue: string | null;
  isActive: boolean;
  actions: AutomationAction[];
}

export interface AutomationExecution {
  id: string;
  candidateId: string;
  summary: string;
  createdAt: string;
  rule: { name: string };
}

export type DeadlineUrgency = 'overdue' | 'today' | 'soon' | 'upcoming';

export interface DeadlineItem {
  kind: 'APPLICATION' | 'VISA' | 'TASK' | 'APPOINTMENT' | 'INVOICE' | 'PROSPECT';
  id: string;
  candidateId: string | null;
  candidateName: string;
  label: string;
  date: string;
  daysUntil: number;
  urgency: DeadlineUrgency;
}

export interface DeadlinesResponse {
  items: DeadlineItem[];
  counts: Record<DeadlineUrgency, number>;
}

// ---------- Portail candidat (Phase 3, section 19) ----------

export interface PortalCandidate {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface PortalProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  nationality: string | null;
  passportNumber: string | null;
  status: CandidateStatus;
  createdAt: string;
}

// ---------- Phase 9 : messagerie candidat ↔ agence ----------

export type MessageSender = 'STAFF' | 'CANDIDATE';

export interface Message {
  id: string;
  sender: MessageSender;
  content: string;
  readByStaffAt: string | null;
  readByCandidateAt: string | null;
  createdAt: string;
}

// ---------- Phase 7 (approfondie) : contrats et signature électronique ----------

export type ContractStatus = 'DRAFT' | 'SENT' | 'SIGNED' | 'CANCELLED';
export type SignatureMethod = 'DRAWN' | 'TYPED';

export interface Contract {
  id: string;
  number: string;
  status: ContractStatus;
  content: string;
  totalAmount: number;
  currency: string;
  signedAt: string | null;
  signerName: string | null;
  signatureMethod: SignatureMethod | null;
  createdAt: string;
}

// ---------- Phase 10 : rentabilité et prévisions financières ----------

export interface CandidateProfitability {
  revenue: number;
  expenses: number;
  margin: number;
  marginPercent: number;
  expenseLines: { amount: number; category: string; description: string; date: string }[];
}

export type ForecastPeriod = '7d' | '30d' | '3m' | '6m' | '12m';

export interface Forecast {
  period: ForecastPeriod;
  collected: number;
  toCollect: number;
  overdue: number;
  expenses: number;
  netCashFlow: number;
}

// ---------- Phase 10 : Health Score ----------

export type IssueSeverity = 'CRITICAL' | 'IMPORTANT' | 'ATTENTION' | 'INFO';
export type HealthCategory = 'good' | 'watch' | 'risk';

export interface HealthIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
}

export interface HealthScore {
  score: number;
  category: HealthCategory;
  issues: HealthIssue[];
}

// ---------- Command Center ----------

export interface CommandCenterToday {
  newProspects: number;
  uncontacted: number;
  appointmentsToday: number;
  pendingDocuments: number;
  paymentsToday: number;
  tasksToday: number;
}

export interface AtRiskCandidate {
  candidateId: string;
  candidateName: string;
  reasons: string[];
}

export interface CommandCenterRisks {
  atRiskCandidates: AtRiskCandidate[];
  overdueInvoicesCount: number;
  expiringDocumentsCount: number;
  missedVisaAppointmentsCount: number;
  stalledApplicationsCount: number;
  overdueTasksCount: number;
}

export interface CommandCenterAdmissions {
  byStatus: Record<string, number>;
  pendingDocuments: number;
}

export interface CommandCenterVisa {
  byStatus: Record<string, number>;
}

// ---------- Phase 8 : partenaires et commissions ----------

export type PartnerType = 'UNIVERSITY' | 'SCHOOL' | 'TRAINING_CENTER' | 'LANGUAGE_ORGANIZATION' | 'AGENT' | 'OTHER';
export type CommissionType = 'FIXED' | 'PERCENTAGE';
export type CommissionStatus = 'TO_CONFIRM' | 'EXPECTED' | 'INVOICED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface Partner {
  id: string;
  type: PartnerType;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  notes: string | null;
  commissionType: CommissionType;
  commissionValue: number;
  isActive: boolean;
  createdAt: string;
}

export interface PartnerPortalUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  portalActivatedAt: string | null;
  lastLoginAt: string | null;
}

export interface Commission {
  id: string;
  amount: number;
  currency: string;
  status: CommissionStatus;
  notes: string | null;
  candidate?: { firstName: string; lastName: string };
  createdAt: string;
}

// ---------- Portail partenaire ----------

export interface PartnerAuthUser {
  id: string;
  partnerId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface PartnerPortalProfile {
  id: string;
  companyName: string;
  type: PartnerType;
  country: string | null;
}

export interface PartnerPortalCandidate {
  id: string;
  firstName: string;
  lastName: string;
  status: CandidateStatus;
  createdAt: string;
  applications: { id: string; university: string; program: string; country: string; status: ApplicationStatus; intake?: string }[];
  visaFiles: { id: string; country: string; status: VisaStatus }[];
}

export interface PartnerComment {
  id: string;
  content: string;
  createdAt: string;
  partnerUser: { firstName: string; lastName: string };
}

// ---------- OCR (extraction MRZ passeport) ----------

export interface OcrPassportField {
  value: string | null;
  valid: boolean;
}

export interface OcrPassportResult {
  success: boolean;
  warning: string | null;
  documentNumber: OcrPassportField | null;
  lastName: OcrPassportField | null;
  firstName: OcrPassportField | null;
  nationality: OcrPassportField | null;
  birthDate: OcrPassportField | null;
  expirationDate: OcrPassportField | null;
  sex: OcrPassportField | null;
}

// ---------- Blog (Phase 11) ----------

export type BlogPostStatus = 'DRAFT' | 'PUBLISHED';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  status: BlogPostStatus;
  publishedAt: string | null;
  createdAt: string;
  author?: { id: string; firstName: string; lastName: string } | null;
}

export interface PublicBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

// ---------- SaaS multi-agences (Phase 12) ----------

export type OrganizationPlan = 'TRIAL' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

export interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  plan: OrganizationPlan;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  createdAt: string;
  _count: { users: number; candidates: number; prospects: number };
}

export type PlatformInvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface PlatformInvoice {
  id: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: PlatformInvoiceStatus;
  paidAt: string | null;
  notes: string | null;
  isOverdue: boolean;
}

export type NotificationType = 'NEW_MESSAGE' | 'TASK_ASSIGNED';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
