/**
 * Catalogue des permissions. Format : `<module>.<action>`.
 * Chaque phase ajoute ses codes ici ; le seed les insère (idempotent).
 */
export const PERMISSION_CODES = [
  'employee.view',
  'employee.create',
  'employee.edit',
  'employee.delete',
  'role.view',
  'role.manage',
  'branch.view',
  'branch.manage',
  'settings.view',
  'settings.manage',
  'audit.view',
  // Phase 2 — CRM
  'prospect.view',
  'prospect.manage',
  'candidate.view',
  'candidate.manage',
  // Phase 3 — dossier candidat
  'document.manage',
  'checklist.manage',
  // Phase 4 — candidatures, visas
  'application.manage',
  'visa.manage',
  // Phase 5 — finance
  'finance.view',
  'finance.manage',
  'cashbox.manage',
  'expense.manage',
  // Phase 4 — catalogue
  'catalog.view',
  'catalog.manage',
  // Phase 5 (approfondie) — automatisations
  'automation.view',
  'automation.manage',
  // Phase 10 — vue de pilotage agrégée
  'command_center.view',
  // Phase 8 — partenaires
  'partner.view',
  'partner.manage',
  // Phase 6 — tâches, rendez-vous
  'task.view',
  'task.manage',
  'appointment.view',
  'appointment.manage',
  // Phase 11 — blog du site public
  'blog.view',
  'blog.manage',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export interface SystemRoleDef {
  code: string;
  name: string;
  description: string;
  permissions: PermissionCode[] | 'ALL';
}

/** Rôles initiaux du cahier des charges. Les droits métier des rôles opérationnels s'ajoutent phase par phase. */
export const SYSTEM_ROLES: SystemRoleDef[] = [
  { code: SUPER_ADMIN_ROLE, name: 'Super Admin', description: 'Accès total, non modifiable', permissions: 'ALL' },
  { code: 'ADMIN', name: 'Administrateur', description: 'Administration complète de l’agence', permissions: 'ALL' },
  {
    code: 'DIRECTOR',
    name: 'Directeur',
    description: 'Pilotage et consultation',
    permissions: [
      'employee.view', 'role.view', 'branch.view', 'settings.view', 'audit.view',
      'prospect.view', 'candidate.view', 'application.manage', 'visa.manage',
      'finance.view', 'task.view', 'appointment.view', 'catalog.view', 'automation.view', 'command_center.view', 'partner.view',
    ],
  },
  {
    code: 'ADVISOR',
    name: 'Conseiller',
    description: 'Suivi des prospects et candidats',
    permissions: [
      'prospect.view', 'prospect.manage', 'candidate.view', 'candidate.manage',
      'document.manage', 'checklist.manage', 'application.manage',
      'task.view', 'task.manage', 'appointment.view', 'appointment.manage', 'catalog.view',
    ],
  },
  {
    code: 'ADMISSIONS',
    name: 'Admissions',
    description: 'Candidatures et admissions',
    permissions: ['candidate.view', 'document.manage', 'checklist.manage', 'application.manage', 'task.view', 'task.manage', 'catalog.view'],
  },
  {
    code: 'VISA',
    name: 'Visa',
    description: 'Procédures de visa',
    permissions: ['candidate.view', 'document.manage', 'visa.manage', 'task.view', 'task.manage'],
  },
  {
    code: 'ACCOUNTANT',
    name: 'Comptable',
    description: 'Finance et facturation',
    permissions: ['candidate.view', 'finance.view', 'finance.manage', 'cashbox.manage', 'expense.manage'],
  },
  {
    code: 'RECEPTION',
    name: 'Réception',
    description: 'Accueil et rendez-vous',
    permissions: ['prospect.view', 'prospect.manage', 'candidate.view', 'appointment.view', 'appointment.manage', 'task.view'],
  },
  {
    code: 'MARKETING',
    name: 'Marketing',
    description: 'Sources, campagnes, contenu',
    permissions: ['prospect.view', 'prospect.manage'],
  },
];
