'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { api } from '@/lib/api';
import { PASSWORD_REGEX } from '@/lib/schemas';
import type { Branch, Employee, Role } from '@/lib/types';
import { useErrorMessage } from '@/lib/use-error-message';
import { useAuth } from '@/features/auth/auth-context';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null; // null = création
  roles: Role[];
  branches: Branch[];
}

interface Values {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  roleId: string;
  branchId: string;
  locale: 'fr' | 'ar';
  status: 'ACTIVE' | 'INACTIVE';
  password: string;
}

export function EmployeeFormDialog({ open, onOpenChange, employee, roles, branches }: Props) {
  const t = useTranslations('employees');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const editing = !!employee;
  const isSelf = employee?.id === user?.id;

  const schema = z.object({
    email: editing ? z.string() : z.string().min(1, tc('required')).email(ta('emailInvalid')),
    firstName: z.string().trim().min(1, tc('required')),
    lastName: z.string().trim().min(1, tc('required')),
    phone: z.string(),
    roleId: z.string().min(1, tc('required')),
    branchId: z.string(),
    locale: z.enum(['fr', 'ar']),
    status: z.enum(['ACTIVE', 'INACTIVE']),
    password: editing
      ? z.string().refine((v) => v === '' || PASSWORD_REGEX.test(v), ta('passwordRule'))
      : z.string().regex(PASSWORD_REGEX, ta('passwordRule')),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      email: employee?.email ?? '',
      firstName: employee?.firstName ?? '',
      lastName: employee?.lastName ?? '',
      phone: employee?.phone ?? '',
      roleId: employee?.roleId ?? '',
      branchId: employee?.branchId ?? '',
      locale: (employee?.locale as 'fr' | 'ar') ?? 'fr',
      status: employee?.status ?? 'ACTIVE',
      password: '',
    });
  }, [open, employee, reset]);

  const save = useMutation({
    mutationFn: (v: Values) =>
      editing
        ? api<Employee>(`/employees/${employee.id}`, {
            method: 'PATCH',
            body: {
              firstName: v.firstName,
              lastName: v.lastName,
              phone: v.phone,
              roleId: v.roleId,
              branchId: v.branchId || null,
              locale: v.locale,
              ...(isSelf ? {} : { status: v.status }),
              ...(v.password ? { password: v.password } : {}),
            },
          })
        : api<Employee>('/employees', {
            method: 'POST',
            body: {
              email: v.email,
              firstName: v.firstName,
              lastName: v.lastName,
              roleId: v.roleId,
              locale: v.locale,
              password: v.password,
              ...(v.phone ? { phone: v.phone } : {}),
              ...(v.branchId ? { branchId: v.branchId } : {}),
            },
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(editing ? t('updated') : t('created'));
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const err = (k: keyof Values) => errors[k]?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={editing ? t('editTitle') : t('newTitle')}>
      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('firstName')} htmlFor="firstName" error={err('firstName')}>
            <Input id="firstName" autoComplete="off" aria-invalid={!!errors.firstName} {...register('firstName')} />
          </Field>
          <Field label={t('lastName')} htmlFor="lastName" error={err('lastName')}>
            <Input id="lastName" autoComplete="off" aria-invalid={!!errors.lastName} {...register('lastName')} />
          </Field>
        </div>
        <Field label={t('email')} htmlFor="email" error={err('email')}>
          <Input id="email" type="email" dir="ltr" autoComplete="off" disabled={editing} aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('phone')} htmlFor="phone">
            <Input id="phone" type="tel" dir="ltr" autoComplete="off" {...register('phone')} />
          </Field>
          <Field label={t('locale')} htmlFor="locale">
            <Select id="locale" {...register('locale')}>
              <option value="fr">Français</option>
              <option value="ar">العربية</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('role')} htmlFor="roleId" error={err('roleId')}>
            <Select id="roleId" disabled={isSelf} aria-invalid={!!errors.roleId} {...register('roleId')}>
              <option value="">{t('choose')}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('branch')} htmlFor="branchId">
            <Select id="branchId" {...register('branchId')}>
              <option value="">{t('noBranch')}</option>
              {branches.filter((b) => b.isActive || b.id === employee?.branchId).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        {editing && !isSelf && (
          <Field label={t('status')} htmlFor="status">
            <Select id="status" {...register('status')}>
              <option value="ACTIVE">{t('active')}</option>
              <option value="INACTIVE">{t('inactive')}</option>
            </Select>
          </Field>
        )}
        <Field
          label={editing ? t('resetPassword') : t('initialPassword')}
          htmlFor="password"
          hint={editing ? t('resetPasswordHint') : t('initialPasswordHint')}
          error={err('password')}
        >
          <Input id="password" type="password" dir="ltr" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button type="submit" loading={save.isPending}>{tc('save')}</Button>
        </div>
      </form>
    </Dialog>
  );
}
