import { Navigate, Outlet } from 'react-router-dom';
import { tokenStore } from '@/lib/tokenStore';

export default function RequireAuth() {
  return tokenStore.get() ? <Outlet /> : <Navigate to="/login" replace />;
}
