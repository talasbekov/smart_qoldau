import { useState, useSyncExternalStore } from 'react';
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
import { tokenStore } from './lib/tokenStore';
import type { SessionSnapshot } from './lib/tokenStore';
import type { Session } from './lib/types';
import './index.css';

export default function App() {
  const snapshot = useSyncExternalStore(
    tokenStore.subscribe,
    tokenStore.snapshot,
  );
  const session = snapshot.session;
  const [logoutFailure, setLogoutFailure] = useState<SessionSnapshot | null>(
    null,
  );
  const [challenge, setChallenge] = useState<{
    token: string;
    revision: string;
  } | null>(null);
  const challengeToken =
    challenge && challenge.revision === snapshot.revision
      ? challenge.token
      : null;

  async function handleSession(next: Session, expected: SessionSnapshot) {
    await tokenStore.set(next, expected);
    setLogoutFailure(null);
    setChallenge(null);
  }

  async function handleLogout(expected: SessionSnapshot) {
    setChallenge(null);
    try {
      await tokenStore.clear(expected);
      setLogoutFailure(null);
    } catch {
      setLogoutFailure(expected);
    }
  }

  // basename — тот же префикс, что у сборки (vite base): без него
  // маршруты SPA разъезжаются с адресом, под которым её отдаёт прокси.
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {logoutFailure && (
        <div role="alert">
          Локальный доступ закрыт, но не удалось сохранить выход. Другие вкладки
          и повторное открытие могут сохранять сессию. Разрешите хранилище и
          повторите выход.
          <button onClick={() => void handleLogout(logoutFailure)}>
            Повторить выход
          </button>
        </div>
      )}
      <Routes key={snapshot.id}>
        <Route
          path="/login"
          element={
            session ? (
              <Navigate to="/" replace />
            ) : challengeToken ? (
              <Navigate to="/login/totp" replace />
            ) : (
              <LoginPage
                onSession={handleSession}
                onTotpChallenge={(token) =>
                  setChallenge({ token, revision: snapshot.revision })
                }
              />
            )
          }
        />
        <Route
          path="/login/totp"
          element={
            session ? (
              <Navigate to="/" replace />
            ) : challengeToken ? (
              <TotpChallengePage
                challengeToken={challengeToken}
                onSession={handleSession}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route element={<RequireAuth />}>
          <Route
            element={<AppLayout onLogout={() => handleLogout(snapshot)} />}
          >
            <Route path="/" element={<Navigate to="/verification" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/verification" element={<VerificationQueuePage />} />
            <Route
              path="/profile-moderation"
              element={<ProfileModerationPage />}
            />
            <Route path="/flagged-experts" element={<FlaggedExpertsPage />} />
            <Route path="/content" element={<ContentPage />} />
            <Route path="/reviews" element={<ReviewsModerationPage />} />
            <Route path="/payouts" element={<PayoutsPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
