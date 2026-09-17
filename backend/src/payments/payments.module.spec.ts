/* eslint-disable @typescript-eslint/no-require-imports */
import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ForwardReference, Type } from '@nestjs/common';

// AdminModule reaches PaymentsModule through Chat/Consultations. Both entry
// orders must retain the admin-session import needed by the new route's guard.
describe.each(['admin', 'payments'])(
  'PaymentsModule registration via %s',
  (entry) => {
    it('registers the guarded controller, read service and resolvable admin dependency', () => {
      jest.isolateModules(() => {
        if (entry === 'admin') require('../admin/admin.module');
        const { PaymentsModule } = require('./payments.module');
        const { AdminModule } = require('../admin/admin.module');
        const {
          PaymentsAdminController,
        } = require('./payments-admin.controller');
        const {
          PaymentOperationalSignalService,
        } = require('./payment-operational-signal.service');
        const imports = (
          Reflect.getMetadata(MODULE_METADATA.IMPORTS, PaymentsModule) as (
            Type | ForwardReference
          )[]
        ).map((item) =>
          item && 'forwardRef' in item ? item.forwardRef() : item,
        );
        expect(imports).not.toContain(undefined);
        expect(imports).toContain(AdminModule);
        expect(
          Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PaymentsModule),
        ).toContain(PaymentsAdminController);
        expect(
          Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PaymentsModule),
        ).toContain(PaymentOperationalSignalService);
      });
    });
  },
);
