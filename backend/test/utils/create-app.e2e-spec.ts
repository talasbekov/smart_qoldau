import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createApp } from './create-app';

const BOOTSTRAP_ERROR = 'intentional bootstrap failure';
const CLEANUP_ERROR = 'intentional cleanup failure';

@Injectable()
class FailingResource implements OnModuleInit, OnModuleDestroy {
  static closed = false;

  private interval?: ReturnType<typeof setInterval>;

  onModuleInit(): void {
    this.interval = setInterval(() => undefined, 1_000);
    throw new Error(BOOTSTRAP_ERROR);
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
    FailingResource.closed = true;
  }
}

@Injectable()
class FailingCleanupResource implements OnModuleInit, OnModuleDestroy {
  static readonly bootstrapError = Object.freeze(new Error(BOOTSTRAP_ERROR));
  static closed = false;

  private interval?: ReturnType<typeof setInterval>;

  onModuleInit(): void {
    this.interval = setInterval(() => undefined, 1_000);
    throw FailingCleanupResource.bootstrapError;
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
    FailingCleanupResource.closed = true;
    throw new Error(CLEANUP_ERROR);
  }
}

@Injectable()
class SuccessfulResource implements OnModuleInit, OnModuleDestroy {
  static closed = false;

  private interval?: ReturnType<typeof setInterval>;

  onModuleInit(): void {
    this.interval = setInterval(() => undefined, 1_000);
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
    SuccessfulResource.closed = true;
  }
}

describe('createApp', () => {
  beforeEach(() => {
    FailingResource.closed = false;
    FailingCleanupResource.closed = false;
    SuccessfulResource.closed = false;
  });

  it('returns an initialized application that closes normally', async () => {
    const builder = Test.createTestingModule({
      providers: [SuccessfulResource],
    });

    const app = await createApp(builder);
    await app.close();

    expect(SuccessfulResource.closed).toBe(true);
  });

  it('closes resources created before application bootstrap fails', async () => {
    const builder = Test.createTestingModule({ providers: [FailingResource] });

    await expect(createApp(builder)).rejects.toThrow(BOOTSTRAP_ERROR);

    expect(FailingResource.closed).toBe(true);
  });

  it('preserves a frozen bootstrap error when cleanup also fails', async () => {
    const builder = Test.createTestingModule({
      providers: [FailingCleanupResource],
    });

    await expect(createApp(builder)).rejects.toBe(
      FailingCleanupResource.bootstrapError,
    );

    expect(FailingCleanupResource.closed).toBe(true);
  });
});
