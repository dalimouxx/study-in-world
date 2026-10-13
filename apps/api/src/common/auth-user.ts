export interface AuthUser {
  id: string;
  organizationId: string;
  branchId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  locale: string;
  mustChangePassword: boolean;
  roleId: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  /** Distinct du RBAC ci-dessus : accès à /platform-admin (gestion des agences elles-mêmes), jamais réglable
   *  depuis l'écran de gestion des employés — voir le commentaire sur le champ dans schema.prisma. */
  isPlatformAdmin: boolean;
}

/** Identité d'un candidat connecté au portail (Phase 3, section 19) — jamais un employé, aucune permission. */
export interface CandidateAuthUser {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
}

/** Identité d'un utilisateur partenaire connecté à son portail (Phase 8, section 64) — isolé à son partnerId. */
export interface PartnerAuthUser {
  id: string;
  organizationId: string;
  partnerId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}
