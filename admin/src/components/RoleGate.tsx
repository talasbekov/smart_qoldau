import type { ReactNode } from 'react';
import { tokenStore } from '@/lib/tokenStore';
import type { AdminRole } from '@/lib/types';

export default function RoleGate({ roles, children }: { roles: AdminRole[]; children: ReactNode }) {
  const session = tokenStore.get();
  const myRoles = session?.admin.roles ?? [];
  const allowed = myRoles.includes('SUPERADMIN') || roles.some((r) => myRoles.includes(r));
  return allowed ? <>{children}</> : null;
}
