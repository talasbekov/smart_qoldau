import { INestApplication, Injectable } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import { PaymentsAdminController } from './payments-admin.controller';
import { PaymentOperationalSignalService } from './payment-operational-signal.service';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { RolesGuard } from '../admin/roles.guard';
import {
  AdminSessionService,
  AdminState,
} from '../admin/admin-session.service';
import { JwtPayload } from '../auth/jwt.strategy';

const JWT_SECRET = 'payment-signal-test-secret-at-least-32-chars';
const SIGNAL = {
  signal: 'payment.settle_exhausted',
  state: 'alerting',
  maxAttempts: 10,
  currentExhaustedCount: 2,
  unexpectedContextCount: 1,
  providerOutcome: 'not_determined_by_source',
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

describe('GET /admin/payments/operational-signal', () => {
  const operationalSignal = jest.fn();
  const adminStates = new Map<string, AdminState>();
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [PaymentsAdminController],
      providers: [
        AdminJwtGuard,
        RolesGuard,
        TestJwtStrategy,
        {
          provide: PaymentOperationalSignalService,
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
    return jwt.sign({
      sub: id,
      isGuest: false,
      isAdmin: true,
      roles: [AdminRole.FINANCE_CONTROL],
    });
  }

  it.each([AdminRole.FINANCE_CONTROL, AdminRole.SUPERADMIN])(
    'allows current %s and returns the exact aggregate DTO',
    async (role) => {
      adminStates.set('operator-1', {
        isActive: true,
        roles: [role],
        totpEnabled: true,
      });

      const response = await request(app.getHttpServer())
        .get('/v1/admin/payments/operational-signal')
        .set('Authorization', `Bearer ${tokenFor('operator-1')}`)
        .expect(200);

      expect(response.body).toEqual(SIGNAL);
      expect(Object.keys(response.body).sort()).toEqual(
        [
          'signal',
          'state',
          'maxAttempts',
          'currentExhaustedCount',
          'unexpectedContextCount',
          'providerOutcome',
          'observedAt',
        ].sort(),
      );
      expect(operationalSignal).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects an unauthenticated request through AdminJwtGuard', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/payments/operational-signal')
      .expect(401);

    expect(operationalSignal).not.toHaveBeenCalled();
  });

  it.each([
    AdminRole.VERIFICATION_OPERATOR,
    AdminRole.CONTENT_EDITOR,
    AdminRole.SUPPORT_OPERATOR,
    AdminRole.QUALITY_TEAM,
  ])('rejects current %s even if JWT claims finance', async (role) => {
    adminStates.set('finance-1', {
      isActive: true,
      roles: [role],
      totpEnabled: true,
    });

    await request(app.getHttpServer())
      .get('/v1/admin/payments/operational-signal')
      .set('Authorization', `Bearer ${tokenFor('finance-1')}`)
      .expect(403);

    expect(operationalSignal).not.toHaveBeenCalled();
  });

  it('surfaces a signal-source failure as an HTTP 500', async () => {
    adminStates.set('operator-2', {
      isActive: true,
      roles: [AdminRole.FINANCE_CONTROL],
      totpEnabled: true,
    });
    operationalSignal.mockRejectedValueOnce(new Error('database unavailable'));

    await request(app.getHttpServer())
      .get('/v1/admin/payments/operational-signal')
      .set('Authorization', `Bearer ${tokenFor('operator-2')}`)
      .expect(500);
  });
});
