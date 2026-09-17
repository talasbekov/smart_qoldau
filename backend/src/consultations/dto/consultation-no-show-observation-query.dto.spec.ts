import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConsultationNoShowObservationQueryDto } from './consultation-no-show-observation-query.dto';

describe('ConsultationNoShowObservationQueryDto', () => {
  async function errorsFor(value: unknown) {
    return validate(
      plainToInstance(ConsultationNoShowObservationQueryDto, value),
    );
  }

  it.each([
    ['2026-09-17T00:00:00Z', '2026-09-17T23:59:59.999Z'],
    ['2024-02-29T12:34:56.1Z', '2024-02-29T12:34:56.12Z'],
  ])('accepts strict UTC instants %s .. %s', async (from, to) => {
    await expect(errorsFor({ from, to })).resolves.toEqual([]);
  });

  it.each([
    [{ to: '2026-09-17T01:00:00Z' }],
    [{ from: '2026-09-17T00:00:00Z' }],
    [{ from: '2026-09-17T00:00:00+00:00', to: '2026-09-17T01:00:00Z' }],
    [{ from: '2026-09-17T00:00:00z', to: '2026-09-17T01:00:00Z' }],
    [{ from: '2026-09-17 00:00:00Z', to: '2026-09-17T01:00:00Z' }],
    [{ from: '2026-09-17T00:00Z', to: '2026-09-17T01:00:00Z' }],
    [{ from: '2026-02-29T00:00:00Z', to: '2026-03-01T00:00:00Z' }],
    [{ from: '2026-04-31T00:00:00Z', to: '2026-05-01T00:00:00Z' }],
    [{ from: '2026-01-01T24:00:00Z', to: '2026-01-02T01:00:00Z' }],
    [{ from: '2026-01-01T00:60:00Z', to: '2026-01-02T01:00:00Z' }],
    [{ from: '2026-01-01T00:00:60Z', to: '2026-01-02T01:00:00Z' }],
    [{ from: '2026-01-01T00:00:00.1234Z', to: '2026-01-02T01:00:00Z' }],
    [{ from: ['2026-09-17T00:00:00Z'], to: '2026-09-17T01:00:00Z' }],
    [{ from: '2026-09-17T00:00:00Z', to: ['2026-09-17T01:00:00Z'] }],
    [{ from: { value: '2026-09-17T00:00:00Z' }, to: '2026-09-17T01:00:00Z' }],
  ])('rejects non-canonical or repeated query value %#', async (value) => {
    expect(await errorsFor(value)).not.toEqual([]);
  });
});
