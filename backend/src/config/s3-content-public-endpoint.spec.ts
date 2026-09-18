import { envValidationSchema } from './env.validation';

function endpointError(value: string | undefined) {
  const result = envValidationSchema.validate(
    { S3_CONTENT_PUBLIC_ENDPOINT: value },
    { abortEarly: false },
  );
  return result.error?.details.find(
    (detail) => detail.path[0] === 'S3_CONTENT_PUBLIC_ENDPOINT',
  );
}

describe('S3_CONTENT_PUBLIC_ENDPOINT validation', () => {
  it.each([
    'ftp://media.example.test',
    'http://user:password@media.example.test',
    'https://media.example.test/?token=secret',
    'https://media.example.test?',
    'https://media.example.test/#fragment',
    'https://media.example.test#',
    'https://media.example.test/media',
    ' http://localhost:8080',
    'http://localhost:8080 ',
  ])('rejects unsafe or path-prefixed endpoint %p', (value) => {
    expect(endpointError(value)).toBeDefined();
  });

  it.each([
    undefined,
    'http://localhost:8080',
    'http://localhost:8080/',
    'https://media.example.test',
  ])('accepts optional root http(s) endpoint %p', (value) => {
    expect(endpointError(value)).toBeUndefined();
  });
});
