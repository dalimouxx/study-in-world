import { Briefcase, FileText, GraduationCap, Heart, Home, Languages, Plane, ShieldCheck, Sparkles, Users, type LucideIcon } from 'lucide-react';
import type { LandingServiceIcon } from './types';

/** Mappe le nom d'icône (liste fermée, choisie par le Super Admin) vers le composant lucide-react réel. */
export const LANDING_SERVICE_ICON_COMPONENTS: Record<LandingServiceIcon, LucideIcon> = {
  GraduationCap, Briefcase, Languages, Users, FileText, ShieldCheck, Sparkles, Plane, Home, Heart,
};
