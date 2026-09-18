import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './routes/LoginPage';
import TotpChallengePage from './routes/TotpChallengePage';
import RequireAuth from './routes/RequireAuth';
import AppLayout from './routes/AppLayout';
import SettingsPage from './routes/SettingsPage';
import StaffPage from './routes/StaffPage';
import VerificationQueuePage from './routes/VerificationQueuePage';
import ProfileModerationPage from './routes/ProfileModerationPage';
import ContentPage from './routes/ContentPage';
import FlaggedExpertsPage from './routes/FlaggedExpertsPage';
import ReviewsModerationPage from './routes/ReviewsModerationPage';
import PayoutsPage from './routes/PayoutsPage';
import TicketsPage from './routes/TicketsPage';
import TicketDetailPage from './routes/TicketDetailPage';
import ContentEditorPage from './routes/ContentEditorPage';
import HelpPage from './routes/HelpPage';
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

  // basename — тот же префикс, что у сборки (vite base): без него
  // маршруты SPA разъезжаются с адресом, под которым её отдаёт прокси.
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
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
            <Route path="/verification" element={<VerificationQueuePage />} />
            <Route path="/profile-moderation" element={<ProfileModerationPage />} />
            <Route path="/flagged-experts" element={<FlaggedExpertsPage />} />
            <Route path="/content" element={<ContentPage />} />
            <Route path="/content/new" element={<ContentEditorPage />} />
            <Route path="/content/:id/edit" element={<ContentEditorPage />} />
            <Route path="/reviews" element={<ReviewsModerationPage />} />
            <Route path="/payouts" element={<PayoutsPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/help" element={<HelpPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
