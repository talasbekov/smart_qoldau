import { INestApplication, Injectable } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { RolesGuard } from '../admin/roles.guard';
import {
  AdminSessionService,
  AdminState,
} from '../admin/admin-session.service';
import { JwtPayload } from '../auth/jwt.strategy';

const JWT_SECRET = 'verification-signal-test-secret-at-least-32-chars';
const SIGNAL = {
  signal: 'verification.queue_over_24h',
  state: 'alerting',
  thresholdHours: 24,
  overdueCount: 2,
  oldestPendingAgeSeconds: 90001,
  missingSubmittedAtCount: 1,
  observedAt: '2026-09-17T12:00:00.900Z',
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

describe('GET /admin/verification/operational-signal', () => {
  const operationalSignal = jest.fn();
  const adminStates = new Map<string, AdminState>();
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [VerificationController],
      providers: [
        AdminJwtGuard,
        RolesGuard,
        TestJwtStrategy,
        {
          provide: VerificationService,
          useValue: { operationalSignal },
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
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    adminStates.clear();
    operationalSignal.mockResolvedValue(SIGNAL);
  });

  afterAll(async () => {
    await app.close();
  });

  function tokenFor(id: string): string {
    return jwt.sign({ sub: id, isGuest: false, isAdmin: true });
  }

  it('returns only the aggregate DTO to a current verification operator', async () => {
    adminStates.set('operator-1', {
      isActive: true,
      roles: [AdminRole.VERIFICATION_OPERATOR],
      totpEnabled: true,
    });

    const response = await request(app.getHttpServer())
      .get('/v1/admin/verification/operational-signal')
      .set('Authorization', `Bearer ${tokenFor('operator-1')}`)
      .expect(200);

    expect(response.body).toEqual(SIGNAL);
    expect(Object.keys(response.body).sort()).toEqual(
      [
        'signal',
        'state',
        'thresholdHours',
        'overdueCount',
        'oldestPendingAgeSeconds',
        'missingSubmittedAtCount',
        'observedAt',
      ].sort(),
    );
    expect(operationalSignal).toHaveBeenCalledTimes(1);
  });

  it('rejects an unauthenticated request through AdminJwtGuard', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/verification/operational-signal')
      .expect(401);

    expect(operationalSignal).not.toHaveBeenCalled();
  });

  it('rejects a current employee with the wrong role through RolesGuard', async () => {
    adminStates.set('finance-1', {
      isActive: true,
      roles: [AdminRole.FINANCE_CONTROL],
      totpEnabled: true,
    });

    await request(app.getHttpServer())
      .get('/v1/admin/verification/operational-signal')
      .set('Authorization', `Bearer ${tokenFor('finance-1')}`)
      .expect(403);

    expect(operationalSignal).not.toHaveBeenCalled();
  });

  it('surfaces a signal-source failure as an HTTP 500', async () => {
    adminStates.set('operator-2', {
      isActive: true,
      roles: [AdminRole.VERIFICATION_OPERATOR],
      totpEnabled: true,
    });
    operationalSignal.mockRejectedValueOnce(new Error('database unavailable'));

    await request(app.getHttpServer())
      .get('/v1/admin/verification/operational-signal')
      .set('Authorization', `Bearer ${tokenFor('operator-2')}`)
      .expect(500);
  });
});
