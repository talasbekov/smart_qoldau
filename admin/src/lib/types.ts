export type AdminRole =
  | 'VERIFICATION_OPERATOR'
  | 'SUPPORT_OPERATOR'
  | 'QUALITY_TEAM'
  | 'FINANCE_CONTROL'
  | 'SUPERADMIN';

export interface AdminSummary {
  id: string;
  email: string;
  roles: AdminRole[];
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  admin: AdminSummary;
}
