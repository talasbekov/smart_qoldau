import { INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import {
  AdminSessionService,
  AdminState,
} from '../admin/admin-session.service';
import { RolesGuard } from '../admin/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { NotificationsAdminController } from './notifications-admin.controller';
import { PushObservationService } from './push-observation.service';

const JWT_SECRET = 'push-observation-test-secret-at-least-32-chars';
const FROM = '2026-09-17T00:00:00Z';
const TO = '2026-09-17T01:00:00Z';
const SIGNAL = {
  signal: 'push.offer_observation',
  state: 'observed',
  window: { from: FROM, to: TO },
  observedAt: '2026-09-17T01:00:00.900Z',
  completedFanoutCount: 37,
  deviceAckCount: 29,
  unacknowledgedCount: 8,
  latencySampleCount: 28,
  negativeLatencyCount: 1,
  ackLatencyP95Ms: 2180,
  outboxDeadCount: 2,
  closedWithoutRecordedFanoutCount: 4,
  missingNotificationForClosedOutboxCount: 0,
  providerAcceptance: 'not_observed',
  delivery: 'not_determined_by_source',
};

@Injectable()
class TestJwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}

describe('GET /admin/notifications/push-observation', () => {
  const observe = jest.fn();
  const adminStates = new Map<string, AdminState>();
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [NotificationsAdminController],
      providers: [
        AdminJwtGuard,
        RolesGuard,
        TestJwtStrategy,
        { provide: PushObservationService, useValue: { observe } },
        {
          provide: AdminSessionService,
          useValue: {
            stateOf: jest.fn(async (id: string) => adminStates.get(id) ?? null),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    adminStates.clear();
    observe.mockResolvedValue(SIGNAL);
  });

  afterAll(async () => {
    await app.close();
  });

  function tokenFor(id: string, isAdmin = true): string {
    return jwt.sign({ sub: id, isGuest: false, isAdmin });
  }

  it.each(Object.values(AdminRole))(
    'allows current %s without a route role restriction',
    async (role) => {
      adminStates.set('staff-1', {
        isActive: true,
        roles: [role],
        totpEnabled: true,
      });

      const response = await request(app.getHttpServer())
        .get('/v1/admin/notifications/push-observation')
        .query({ from: FROM, to: TO })
        .set('Authorization', `Bearer ${tokenFor('staff-1')}`)
        .expect(200);

      expect(response.body).toEqual(SIGNAL);
      expect(Object.keys(response.body).sort()).toEqual(
        Object.keys(SIGNAL).sort(),
      );
      expect(observe).toHaveBeenCalledWith({ from: FROM, to: TO });
    },
  );

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/notifications/push-observation')
      .query({ from: FROM, to: TO })
      .expect(401);
    expect(observe).not.toHaveBeenCalled();
  });

  it('rejects a non-admin JWT', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/notifications/push-observation')
      .query({ from: FROM, to: TO })
      .set('Authorization', `Bearer ${tokenFor('user-1', false)}`)
      .expect(403);
    expect(observe).not.toHaveBeenCalled();
  });

  it('rejects an admin JWT without a current active staff session', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/notifications/push-observation')
      .query({ from: FROM, to: TO })
      .set('Authorization', `Bearer ${tokenFor('missing-staff')}`)
      .expect(401);
    expect(observe).not.toHaveBeenCalled();
  });

  it.each([
    `/v1/admin/notifications/push-observation?to=${encodeURIComponent(TO)}`,
    `/v1/admin/notifications/push-observation?from=${encodeURIComponent(FROM)}`,
    `/v1/admin/notifications/push-observation?from=${encodeURIComponent(FROM)}&from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`,
    `/v1/admin/notifications/push-observation?from[value]=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`,
    `/v1/admin/notifications/push-observation?from=${encodeURIComponent('2026-09-17T00:00:00+00:00')}&to=${encodeURIComponent(TO)}`,
  ])('rejects malformed query %s', async (url) => {
    adminStates.set('staff-2', {
      isActive: true,
      roles: [AdminRole.SUPPORT_OPERATOR],
      totpEnabled: true,
    });
    await request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${tokenFor('staff-2')}`)
      .expect(400);
    expect(observe).not.toHaveBeenCalled();
  });

  it('surfaces a database failure as HTTP 500', async () => {
    adminStates.set('staff-3', {
      isActive: true,
      roles: [AdminRole.QUALITY_TEAM],
      totpEnabled: true,
    });
    observe.mockRejectedValueOnce(new Error('database unavailable'));

    await request(app.getHttpServer())
      .get('/v1/admin/notifications/push-observation')
      .query({ from: FROM, to: TO })
      .set('Authorization', `Bearer ${tokenFor('staff-3')}`)
      .expect(500);
  });
});
