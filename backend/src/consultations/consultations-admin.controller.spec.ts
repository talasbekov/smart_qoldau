import { INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PassportStrategy } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import request from 'supertest';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import {
  AdminSessionService,
  AdminState,
} from '../admin/admin-session.service';
import { RolesGuard } from '../admin/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { ConsultationNoShowObservationService } from './consultation-no-show-observation.service';
import { ConsultationsAdminController } from './consultations-admin.controller';

const JWT_SECRET = 'consultation-no-show-test-secret-32-chars';
const FROM = '2026-09-17T00:00:00Z';
const TO = '2026-09-17T01:00:00Z';
const SIGNAL = {
  signal: 'consultation.client_no_show_observation',
  state: 'observed',
  window: { from: FROM, to: TO },
  observedAt: '2026-09-17T01:00:00.900Z',
  cohortCompletedCount: 14,
  clientNoShowOutcomeCount: 2,
  outcomeCounts: {
    COMPLETED: 8,
    CLIENT_CANCELLED: 1,
    TECH_ISSUE: 2,
    EXPERT_CANCELLED: 0,
  },
  completedWithoutOutcomeCount: 1,
  completedWithoutEndedAtCountAllTime: 0,
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

describe('GET /admin/consultations/no-show-observation', () => {
  const observe = jest.fn();
  const adminStates = new Map<string, AdminState>();
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [ConsultationsAdminController],
      providers: [
        AdminJwtGuard,
        RolesGuard,
        TestJwtStrategy,
        {
          provide: ConsultationNoShowObservationService,
          useValue: { observe },
        },
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

  it.each([AdminRole.QUALITY_TEAM, AdminRole.SUPERADMIN])(
    'allows current %s staff',
    async (role) => {
      adminStates.set('staff-allowed', {
        isActive: true,
        roles: [role],
        totpEnabled: true,
      });

      const response = await request(app.getHttpServer())
        .get('/v1/admin/consultations/no-show-observation')
        .query({ from: FROM, to: TO })
        .set('Authorization', `Bearer ${tokenFor('staff-allowed')}`)
        .expect(200);

      expect(response.body).toEqual(SIGNAL);
      expect(Object.keys(response.body).sort()).toEqual(
        Object.keys(SIGNAL).sort(),
      );
      expect(response.body).not.toHaveProperty('ratio');
      expect(response.body).not.toHaveProperty('rate');
      expect(response.body).not.toHaveProperty('alert');
      expect(observe).toHaveBeenCalledWith({ from: FROM, to: TO });
    },
  );

  it.each(
    Object.values(AdminRole).filter(
      (role) =>
        role !== AdminRole.QUALITY_TEAM && role !== AdminRole.SUPERADMIN,
    ),
  )('rejects current %s staff', async (role) => {
    adminStates.set('staff-forbidden', {
      isActive: true,
      roles: [role],
      totpEnabled: true,
    });

    await request(app.getHttpServer())
      .get('/v1/admin/consultations/no-show-observation')
      .query({ from: FROM, to: TO })
      .set('Authorization', `Bearer ${tokenFor('staff-forbidden')}`)
      .expect(403);
    expect(observe).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/consultations/no-show-observation')
      .query({ from: FROM, to: TO })
      .expect(401);
    expect(observe).not.toHaveBeenCalled();
  });

  it('rejects a non-admin JWT', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/consultations/no-show-observation')
      .query({ from: FROM, to: TO })
      .set('Authorization', `Bearer ${tokenFor('user-1', false)}`)
      .expect(403);
    expect(observe).not.toHaveBeenCalled();
  });

  it('rejects an admin JWT without a current active staff session', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/consultations/no-show-observation')
      .query({ from: FROM, to: TO })
      .set('Authorization', `Bearer ${tokenFor('missing-staff')}`)
      .expect(401);
    expect(observe).not.toHaveBeenCalled();
  });

  it.each([
    `/v1/admin/consultations/no-show-observation?to=${encodeURIComponent(TO)}`,
    `/v1/admin/consultations/no-show-observation?from=${encodeURIComponent(FROM)}`,
    `/v1/admin/consultations/no-show-observation?from=${encodeURIComponent(FROM)}&from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`,
    `/v1/admin/consultations/no-show-observation?from[value]=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`,
    `/v1/admin/consultations/no-show-observation?from=${encodeURIComponent('2026-09-17T00:00:00+00:00')}&to=${encodeURIComponent(TO)}`,
  ])('rejects malformed query %s', async (url) => {
    adminStates.set('staff-quality', {
      isActive: true,
      roles: [AdminRole.QUALITY_TEAM],
      totpEnabled: true,
    });
    await request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${tokenFor('staff-quality')}`)
      .expect(400);
    expect(observe).not.toHaveBeenCalled();
  });

  it('surfaces a database failure as HTTP 500', async () => {
    adminStates.set('staff-quality', {
      isActive: true,
      roles: [AdminRole.QUALITY_TEAM],
      totpEnabled: true,
    });
    observe.mockRejectedValueOnce(new Error('database unavailable'));

    await request(app.getHttpServer())
      .get('/v1/admin/consultations/no-show-observation')
      .query({ from: FROM, to: TO })
      .set('Authorization', `Bearer ${tokenFor('staff-quality')}`)
      .expect(500);
  });
});
