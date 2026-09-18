import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './lib/i18n/routing';

const handleLocale = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/(ru|kz)\/requests\/new$/);

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
