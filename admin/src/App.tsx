import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './routes/LoginPage';
import TotpChallengePage from './routes/TotpChallengePage';
import RequireAuth from './routes/RequireAuth';
import AppLayout from './routes/AppLayout';
import SettingsPage from './routes/SettingsPage';
import StaffPage from './routes/StaffPage';
import { tokenStore } from './lib/tokenStore';
import type { Session } from './lib/types';
import './index.css';

export default function App() {
  const [session, setSession] = useState<Session | null>(tokenStore.get());
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  function handleSession(next: Session) {
    tokenStore.set(next);
    setSession(next);
    setChallengeToken(null);
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            session ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage onSession={handleSession} onTotpChallenge={setChallengeToken} />
            )
          }
        />
        <Route
          path="/login/totp"
          element={
            challengeToken ? (
              <TotpChallengePage challengeToken={challengeToken} onSession={handleSession} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/verification" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/staff" element={<StaffPage />} />
            {/* Остальные маршруты подключаются задачами 6-11 */}
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
