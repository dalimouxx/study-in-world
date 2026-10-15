'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { PageHeader } from '@/components/page-header';
import { api, apiBaseUrl, ApiError, getAccessToken } from '@/lib/api';
import { LANDING_SERVICE_ICON_COMPONENTS } from '@/lib/landing-service-icons';
import type {
  LandingFaqItem, LandingPageAdminData, LandingService, LandingServiceIcon, PartnerLogo, Testimonial,
} from '@/lib/types';
import { LANDING_SERVICE_ICONS } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';

/**
 * CMS de la landing page publique : logos, photos, textes (français — la traduction arabe est générée
 * automatiquement par l'API à l'enregistrement). N'apparaît dans le menu que pour le rôle Super Admin
 * (voir components/nav.ts) ; l'API applique la même restriction (SuperAdminGuard), donc même en cas
 * d'accès direct à l'URL, aucune action ne peut réussir pour un autre rôle.
 */
export function SiteAdminPage() {
  const t = useTranslations('siteAdmin');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const query = useQuery({ queryKey: ['site-admin'], queryFn: () => api<LandingPageAdminData>('/landing-page') });

  if (query.isLoading) return <p role="status" className="text-sm text-muted-foreground">{tc('loading')}</p>;
  if (query.isError || !query.data) return <p role="alert" className="text-sm text-destructive">{errorMessage(query.error)}</p>;

  const data = query.data;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t('title')} description={t('subtitle')} />
      <BrandingSection branding={data.branding} />
      <ContentSection content={data.content} />
      <ServicesSection services={data.services} />
      <FaqSection items={data.faq} />
      <TestimonialsSection items={data.testimonials} />
      <PartnerLogosSection items={data.partnerLogos} />
    </div>
  );
}

// ---------- Téléversement d'image (logos, photos) ----------

function useImageUpload(onUploaded: (url: string) => void) {
  const errorMessage = useErrorMessage();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const token = getAccessToken();
      const res = await fetch(`${apiBaseUrl}/landing-page/upload`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { code?: string; message?: string });
        throw new ApiError(res.status, body.code, body.message ?? res.statusText);
      }
      return (await res.json()) as { url: string };
    },
    onSuccess: (data) => onUploaded(data.url),
    onError: (err) => toast.error(errorMessage(err)),
  });
}

function ImageUploadField({ label, value, onChange, hint }: { label: string; value: string | null; onChange: (url: string | null) => void; hint?: string }) {
  const t = useTranslations('siteAdmin');
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useImageUpload(onChange);

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-14 w-14 rounded-md border border-border bg-white object-contain" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
            <ImageIcon className="h-5 w-5" aria-hidden />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = '';
            }}
          />
          <Button type="button" variant="secondary" size="sm" loading={upload.isPending} onClick={() => inputRef.current?.click()}>
            {value ? t('upload.change') : t('upload.choose')}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              {t('upload.remove')}
            </Button>
          )}
        </div>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ---------- Logos, favicon, pied de page ----------

interface BrandingValues { logoUrl: string | null; logoDarkUrl: string | null; faviconUrl: string | null; footerTextFr: string }

function BrandingSection({ branding }: { branding: LandingPageAdminData['branding'] }) {
  const t = useTranslations('siteAdmin');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<BrandingValues>({
    logoUrl: branding.logoUrl, logoDarkUrl: branding.logoDarkUrl, faviconUrl: branding.faviconUrl, footerTextFr: branding.footerTextFr ?? '',
  });

  const save = useMutation({
    mutationFn: () => api('/landing-page/branding', { method: 'PATCH', body: values }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['site-admin'] }); void queryClient.invalidateQueries({ queryKey: ['public-agency'] }); toast.success(tc('save')); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Card>
      <CardHeader title={t('branding.title')} description={t('branding.hint')} action={<Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>{tc('save')}</Button>} />
      <div className="grid gap-5 p-5 sm:grid-cols-3">
        <ImageUploadField label={t('branding.logo')} value={values.logoUrl} onChange={(url) => setValues((v) => ({ ...v, logoUrl: url }))} />
        <ImageUploadField label={t('branding.logoDark')} value={values.logoDarkUrl} onChange={(url) => setValues((v) => ({ ...v, logoDarkUrl: url }))} />
        <ImageUploadField label={t('branding.favicon')} value={values.faviconUrl} onChange={(url) => setValues((v) => ({ ...v, faviconUrl: url }))} />
      </div>
      <div className="px-5 pb-5">
        <Field label={t('branding.footerText')} htmlFor="footer-text">
          <Textarea id="footer-text" rows={2} value={values.footerTextFr} onChange={(e) => setValues((v) => ({ ...v, footerTextFr: e.target.value }))} />
        </Field>
      </div>
    </Card>
  );
}

// ---------- Hero, à propos, SEO ----------

interface ContentValues {
  heroTitleFr: string; heroSubtitleFr: string; heroImageUrl: string | null;
  aboutTitleFr: string; aboutTextFr: string; aboutImageUrl: string | null;
  seoTitleFr: string; seoDescriptionFr: string;
}

function ContentSection({ content }: { content: LandingPageAdminData['content'] }) {
  const t = useTranslations('siteAdmin');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ContentValues>({
    heroTitleFr: content.heroTitleFr ?? '', heroSubtitleFr: content.heroSubtitleFr ?? '', heroImageUrl: content.heroImageUrl,
    aboutTitleFr: content.aboutTitleFr ?? '', aboutTextFr: content.aboutTextFr ?? '', aboutImageUrl: content.aboutImageUrl,
    seoTitleFr: content.seoTitleFr ?? '', seoDescriptionFr: content.seoDescriptionFr ?? '',
  });

  const save = useMutation({
    mutationFn: () => api('/landing-page/content', { method: 'PATCH', body: values }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['site-admin'] }); toast.success(tc('save')); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const set = (k: keyof ContentValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Card>
      <CardHeader title={t('content.title')} description={t('content.hint')} action={<Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>{tc('save')}</Button>} />
      <div className="space-y-6 p-5">
        <div>
          <p className="mb-3 text-sm font-semibold text-muted-foreground">{t('content.heroGroup')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('content.heroTitle')} htmlFor="hero-title"><Input id="hero-title" value={values.heroTitleFr} onChange={set('heroTitleFr')} /></Field>
            <Field label={t('content.heroSubtitle')} htmlFor="hero-subtitle"><Input id="hero-subtitle" value={values.heroSubtitleFr} onChange={set('heroSubtitleFr')} /></Field>
          </div>
          <div className="mt-4">
            <ImageUploadField label={t('content.heroImage')} value={values.heroImageUrl} onChange={(url) => setValues((v) => ({ ...v, heroImageUrl: url }))} />
          </div>
        </div>
        <div className="border-t border-border pt-5">
          <p className="mb-3 text-sm font-semibold text-muted-foreground">{t('content.aboutGroup')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('content.aboutTitle')} htmlFor="about-title"><Input id="about-title" value={values.aboutTitleFr} onChange={set('aboutTitleFr')} /></Field>
            <Field label={t('content.aboutText')} htmlFor="about-text" className="sm:col-span-2"><Textarea id="about-text" rows={4} value={values.aboutTextFr} onChange={set('aboutTextFr')} /></Field>
          </div>
          <div className="mt-4">
            <ImageUploadField label={t('content.aboutImage')} value={values.aboutImageUrl} onChange={(url) => setValues((v) => ({ ...v, aboutImageUrl: url }))} />
          </div>
        </div>
        <div className="border-t border-border pt-5">
          <p className="mb-3 text-sm font-semibold text-muted-foreground">{t('content.seoGroup')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('content.seoTitle')} htmlFor="seo-title" hint={t('content.seoTitleHint')}><Input id="seo-title" value={values.seoTitleFr} onChange={set('seoTitleFr')} /></Field>
            <Field label={t('content.seoDescription')} htmlFor="seo-description" hint={t('content.seoDescriptionHint')} className="sm:col-span-2">
              <Textarea id="seo-description" rows={2} value={values.seoDescriptionFr} onChange={set('seoDescriptionFr')} />
            </Field>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------- Aide commune : réordonner une liste ----------

function useReorder(path: string, queryKey: string[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; position: number }[]) => api(`${path}/reorder`, { method: 'PATCH', body: { items } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });
}

function MoveButtons({ onUp, onDown, upDisabled, downDisabled }: { onUp: () => void; onDown: () => void; upDisabled: boolean; downDisabled: boolean }) {
  return (
    <div className="flex flex-col">
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={upDisabled} onClick={onUp}><ChevronUp className="h-3.5 w-3.5" aria-hidden /></Button>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={downDisabled} onClick={onDown}><ChevronDown className="h-3.5 w-3.5" aria-hidden /></Button>
    </div>
  );
}

// ---------- Services ----------

interface ServiceFormValues { titleFr: string; descriptionFr: string; iconName: LandingServiceIcon }

function ServicesSection({ services }: { services: LandingService[] }) {
  const t = useTranslations('siteAdmin');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LandingService | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<LandingService | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceFormValues>();
  const reorder = useReorder('/landing-page/services', ['site-admin']);

  const save = useMutation({
    mutationFn: (v: ServiceFormValues) =>
      editing ? api(`/landing-page/services/${editing.id}`, { method: 'PATCH', body: v }) : api('/landing-page/services', { method: 'POST', body: v }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['site-admin'] }); toast.success(tc('save')); setFormOpen(false); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/landing-page/services/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['site-admin'] }); setDeleting(null); },
    onError: (err) => { toast.error(errorMessage(err)); setDeleting(null); },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api(`/landing-page/services/${id}`, { method: 'PATCH', body: { isActive } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['site-admin'] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const openCreate = () => { setEditing(null); reset({ titleFr: '', descriptionFr: '', iconName: 'GraduationCap' }); setFormOpen(true); };
  const openEdit = (s: LandingService) => { setEditing(s); reset({ titleFr: s.titleFr, descriptionFr: s.descriptionFr, iconName: s.iconName }); setFormOpen(true); };

  const move = (index: number, dir: -1 | 1) => {
    const target = services[index + dir];
    const current = services[index];
    if (!target || !current) return;
    reorder.mutate([{ id: current.id, position: target.position }, { id: target.id, position: current.position }]);
  };

  return (
    <Card>
      <CardHeader title={t('services.title')} description={t('services.hint')} action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" aria-hidden /> {tc('create')}</Button>} />
      <div className="divide-y divide-border">
        {services.length === 0 && <p className="p-5 text-sm text-muted-foreground">{t('services.empty')}</p>}
        {services.map((s, i) => {
          const Icon = LANDING_SERVICE_ICON_COMPONENTS[s.iconName];
          return (
            <div key={s.id} className="flex items-start gap-3 p-4">
              <MoveButtons onUp={() => move(i, -1)} onDown={() => move(i, 1)} upDisabled={i === 0} downDisabled={i === services.length - 1} />
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-4 w-4" aria-hidden /></span>
              <div className="flex-1">
                <p className="font-medium">{s.titleFr}</p>
                <p className="text-sm text-muted-foreground">{s.descriptionFr}</p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={s.isActive} onChange={(e) => toggleActive.mutate({ id: s.id, isActive: e.target.checked })} /> {t('visibleOnSite')}
              </label>
              <Button variant="ghost" size="icon" aria-label={tc('edit')} onClick={() => openEdit(s)}><Pencil className="h-4 w-4" aria-hidden /></Button>
              <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => setDeleting(s)}><Trash2 className="h-4 w-4 text-destructive" aria-hidden /></Button>
            </div>
          );
        })}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={editing ? t('services.editTitle') : t('services.addTitle')}>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
          <Field label={t('services.titleField')} htmlFor="svc-title" error={errors.titleFr?.message}>
            <Input id="svc-title" aria-invalid={!!errors.titleFr} {...register('titleFr', { required: tc('required') })} />
          </Field>
          <Field label={t('services.description')} htmlFor="svc-desc" error={errors.descriptionFr?.message}>
            <Textarea id="svc-desc" rows={3} aria-invalid={!!errors.descriptionFr} {...register('descriptionFr', { required: tc('required') })} />
          </Field>
          <Field label={t('services.icon')} htmlFor="svc-icon">
            <Select id="svc-icon" {...register('iconName')}>
              {LANDING_SERVICE_ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={save.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title={t('services.deleteTitle')} description={t('services.deleteDescription')} confirmLabel={tc('delete')}
        loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </Card>
  );
}

// ---------- FAQ ----------

interface FaqFormValues { questionFr: string; answerFr: string }

function FaqSection({ items }: { items: LandingFaqItem[] }) {
  const t = useTranslations('siteAdmin');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LandingFaqItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<LandingFaqItem | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FaqFormValues>();
  const reorder = useReorder('/landing-page/faq', ['site-admin']);

  const save = useMutation({
    mutationFn: (v: FaqFormValues) =>
      editing ? api(`/landing-page/faq/${editing.id}`, { method: 'PATCH', body: v }) : api('/landing-page/faq', { method: 'POST', body: v }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['site-admin'] }); toast.success(tc('save')); setFormOpen(false); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/landing-page/faq/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['site-admin'] }); setDeleting(null); },
    onError: (err) => { toast.error(errorMessage(err)); setDeleting(null); },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api(`/landing-page/faq/${id}`, { method: 'PATCH', body: { isActive } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['site-admin'] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const openCreate = () => { setEditing(null); reset({ questionFr: '', answerFr: '' }); setFormOpen(true); };
  const openEdit = (item: LandingFaqItem) => { setEditing(item); reset({ questionFr: item.questionFr, answerFr: item.answerFr }); setFormOpen(true); };

  const move = (index: number, dir: -1 | 1) => {
    const target = items[index + dir];
    const current = items[index];
    if (!target || !current) return;
    reorder.mutate([{ id: current.id, position: target.position }, { id: target.id, position: current.position }]);
  };

  return (
    <Card>
      <CardHeader title={t('faq.title')} description={t('faq.hint')} action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" aria-hidden /> {tc('create')}</Button>} />
      <div className="divide-y divide-border">
        {items.length === 0 && <p className="p-5 text-sm text-muted-foreground">{t('faq.empty')}</p>}
        {items.map((item, i) => (
          <div key={item.id} className="flex items-start gap-3 p-4">
            <MoveButtons onUp={() => move(i, -1)} onDown={() => move(i, 1)} upDisabled={i === 0} downDisabled={i === items.length - 1} />
            <div className="flex-1">
              <p className="font-medium">{item.questionFr}</p>
              <p className="text-sm text-muted-foreground">{item.answerFr}</p>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={item.isActive} onChange={(e) => toggleActive.mutate({ id: item.id, isActive: e.target.checked })} /> {t('visibleOnSite')}
            </label>
            <Button variant="ghost" size="icon" aria-label={tc('edit')} onClick={() => openEdit(item)}><Pencil className="h-4 w-4" aria-hidden /></Button>
            <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => setDeleting(item)}><Trash2 className="h-4 w-4 text-destructive" aria-hidden /></Button>
          </div>
        ))}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={editing ? t('faq.editTitle') : t('faq.addTitle')}>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
          <Field label={t('faq.question')} htmlFor="faq-q" error={errors.questionFr?.message}>
            <Input id="faq-q" aria-invalid={!!errors.questionFr} {...register('questionFr', { required: tc('required') })} />
          </Field>
          <Field label={t('faq.answer')} htmlFor="faq-a" error={errors.answerFr?.message}>
            <Textarea id="faq-a" rows={3} aria-invalid={!!errors.answerFr} {...register('answerFr', { required: tc('required') })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={save.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title={t('faq.deleteTitle')} description={t('faq.deleteDescription')} confirmLabel={tc('delete')}
        loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </Card>
  );
}

// ---------- Témoignages ----------

interface TestimonialFormValues { name: string; destination: string; quoteFr: string }

function TestimonialsSection({ items }: { items: Testimonial[] }) {
  const t = useTranslations('siteAdmin');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Testimonial | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<TestimonialFormValues>();
  const reorder = useReorder('/landing-page/testimonials', ['site-admin']);

  const save = useMutation({
    mutationFn: (v: TestimonialFormValues) => {
      const body = { ...v, destination: v.destination || undefined };
      return editing ? api(`/landing-page/testimonials/${editing.id}`, { method: 'PATCH', body }) : api('/landing-page/testimonials', { method: 'POST', body });
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['site-admin'] }); toast.success(tc('save')); setFormOpen(false); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/landing-page/testimonials/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['site-admin'] }); setDeleting(null); },
    onError: (err) => { toast.error(errorMessage(err)); setDeleting(null); },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api(`/landing-page/testimonials/${id}`, { method: 'PATCH', body: { isActive } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['site-admin'] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const openCreate = () => { setEditing(null); reset({ name: '', destination: '', quoteFr: '' }); setFormOpen(true); };
  const openEdit = (item: Testimonial) => { setEditing(item); reset({ name: item.name, destination: item.destination ?? '', quoteFr: item.quoteFr }); setFormOpen(true); };

  const move = (index: number, dir: -1 | 1) => {
    const target = items[index + dir];
    const current = items[index];
    if (!target || !current) return;
    reorder.mutate([{ id: current.id, position: target.position }, { id: target.id, position: current.position }]);
  };

  return (
    <Card>
      <CardHeader title={t('testimonials.title')} description={t('testimonials.hint')} action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" aria-hidden /> {tc('create')}</Button>} />
      <div className="divide-y divide-border">
        {items.length === 0 && <p className="p-5 text-sm text-muted-foreground">{t('testimonials.empty')}</p>}
        {items.map((item, i) => (
          <div key={item.id} className="flex items-start gap-3 p-4">
            <MoveButtons onUp={() => move(i, -1)} onDown={() => move(i, 1)} upDisabled={i === 0} downDisabled={i === items.length - 1} />
            <div className="flex-1">
              <p className="font-medium">{item.name}{item.destination ? ` — ${item.destination}` : ''}</p>
              <p className="text-sm text-muted-foreground">« {item.quoteFr} »</p>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={item.isActive} onChange={(e) => toggleActive.mutate({ id: item.id, isActive: e.target.checked })} /> {t('visibleOnSite')}
            </label>
            <Button variant="ghost" size="icon" aria-label={tc('edit')} onClick={() => openEdit(item)}><Pencil className="h-4 w-4" aria-hidden /></Button>
            <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => setDeleting(item)}><Trash2 className="h-4 w-4 text-destructive" aria-hidden /></Button>
          </div>
        ))}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen} title={editing ? t('testimonials.editTitle') : t('testimonials.addTitle')} description={t('testimonials.formHint')}>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
          <Field label={t('testimonials.name')} htmlFor="tm-name" error={errors.name?.message}>
            <Input id="tm-name" aria-invalid={!!errors.name} {...register('name', { required: tc('required') })} />
          </Field>
          <Field label={t('testimonials.destination')} htmlFor="tm-dest">
            <Input id="tm-dest" {...register('destination')} />
          </Field>
          <Field label={t('testimonials.quote')} htmlFor="tm-quote" error={errors.quoteFr?.message}>
            <Textarea id="tm-quote" rows={3} aria-invalid={!!errors.quoteFr} {...register('quoteFr', { required: tc('required') })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>{tc('cancel')}</Button>
            <Button type="submit" loading={save.isPending}>{tc('save')}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title={t('testimonials.deleteTitle')} description={t('testimonials.deleteDescription')} confirmLabel={tc('delete')}
        loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </Card>
  );
}

// ---------- Logos partenaires ----------

function PartnerLogosSection({ items }: { items: PartnerLogo[] }) {
  const t = useTranslations('siteAdmin');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PartnerLogo | null>(null);
  const reorder = useReorder('/landing-page/partner-logos', ['site-admin']);

  const create = useMutation({
    mutationFn: () => api('/landing-page/partner-logos', { method: 'POST', body: { name, logoUrl } }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['site-admin'] }); setName(''); setLogoUrl(null); toast.success(tc('save')); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/landing-page/partner-logos/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['site-admin'] }); setDeleting(null); },
    onError: (err) => { toast.error(errorMessage(err)); setDeleting(null); },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api(`/landing-page/partner-logos/${id}`, { method: 'PATCH', body: { isActive } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['site-admin'] }),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const move = (index: number, dir: -1 | 1) => {
    const target = items[index + dir];
    const current = items[index];
    if (!target || !current) return;
    reorder.mutate([{ id: current.id, position: target.position }, { id: target.id, position: current.position }]);
  };

  return (
    <Card>
      <CardHeader title={t('partners.title')} description={t('partners.hint')} />
      <div className="divide-y divide-border">
        {items.length === 0 && <p className="p-5 text-sm text-muted-foreground">{t('partners.empty')}</p>}
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-3 p-4">
            <MoveButtons onUp={() => move(i, -1)} onDown={() => move(i, 1)} upDisabled={i === 0} downDisabled={i === items.length - 1} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.logoUrl} alt={item.name} className="h-10 w-auto max-w-[120px] object-contain" />
            <p className="flex-1 font-medium">{item.name}</p>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={item.isActive} onChange={(e) => toggleActive.mutate({ id: item.id, isActive: e.target.checked })} /> {t('visibleOnSite')}
            </label>
            <Button variant="ghost" size="icon" aria-label={tc('delete')} onClick={() => setDeleting(item)}><Trash2 className="h-4 w-4 text-destructive" aria-hidden /></Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-4 border-t border-border p-5">
        <ImageUploadField label={t('partners.logo')} value={logoUrl} onChange={setLogoUrl} />
        <div className="min-w-[200px] flex-1">
          <Field label={t('partners.name')} htmlFor="partner-name"><Input id="partner-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        </div>
        <Button disabled={!name.trim() || !logoUrl} loading={create.isPending} onClick={() => create.mutate()}>
          <Plus className="h-4 w-4" aria-hidden /> {tc('create')}
        </Button>
      </div>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title={t('partners.deleteTitle')} description={t('partners.deleteDescription')} confirmLabel={tc('delete')}
        loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </Card>
  );
}
