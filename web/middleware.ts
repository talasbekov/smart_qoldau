import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { shouldRenew, renewalTarget } from './lib/auth/renewal-navigation';
import { routing } from './lib/i18n/routing';

const handleLocale = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const localized = pathname.match(/^\/(ru|kz)(?:\/|$)/);
  const protectedPage = /^\/(ru|kz)\/(requests|consultations|expert|favorites|notifications|profile|expert-onboarding|payment-methods)(?:\/|$)/.test(pathname) || /^\/(ru|kz)\/support\/requests(?:\/|$)/.test(pathname);
  if (localized && protectedPage &&
      shouldRenew(request.cookies.get('sq_at')?.value, request.cookies.get('sq_rt')?.value)) {
    const next = request.nextUrl.clone();
    next.pathname = `/${localized[1]}/renew-session`;
    next.search = '';
    next.searchParams.set('returnTo', renewalTarget(pathname + request.nextUrl.search, localized[1]));
    return NextResponse.redirect(next);
  }
  const match = pathname.match(/^\/(ru|kz)\/(?:requests\/new|expert-onboarding|payment-methods|support\/requests(?:\/[^/]+)?)$/);

  // Запрос консультации остаётся защищённым серверным layout. Этот ранний
  // переход нужен только гостю: после SMS он вернётся именно к заявке, а не
  // в общий профиль. Список continuation-маршрутов валидируется на login.
  if (match && !request.cookies.has('sq_at')) {
    const login = request.nextUrl.clone();
    login.pathname = `/${match[1]}/login`;
    login.search = '';
    login.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(login);
  }

  return handleLocale(request);
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
