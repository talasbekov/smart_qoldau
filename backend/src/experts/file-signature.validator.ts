import { FileValidator } from '@nestjs/common';

// Встроенный FileTypeValidator (@nestjs/common >= 10.4.x) грузит ESM-only пакет
// file-type через динамический import, который падает под Jest (CJS без
// --experimental-vm-modules) и молча отклоняет любой файл. Поэтому проверяем
// магические байты сами — PDF/PNG/JPEG покрываются первыми байтами буфера.
const SIGNATURES: ReadonlyArray<{
  mime: string;
  matches: (buf: Buffer) => boolean;
}> = [
  {
    mime: 'application/pdf',
    matches: (buf) => buf.subarray(0, 4).toString('latin1') === '%PDF',
  },
  {
    mime: 'image/png',
    matches: (buf) =>
      buf
        .subarray(0, 8)
        .equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        ),
  },
  {
    mime: 'image/jpeg',
    matches: (buf) => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
];

export class FileSignatureValidator extends FileValidator {
  constructor() {
    super({});
  }

  isValid(file?: Express.Multer.File): boolean {
    return (
      !!file?.buffer && SIGNATURES.some((s) => s.matches(file.buffer))
    );
  }

  buildErrorMessage(file?: Express.Multer.File): string {
    const mimetype = file?.mimetype ?? 'unknown';
    const expected = SIGNATURES.map((s) => s.mime).join(', ');
    return `Validation failed (current file type is ${mimetype}, expected one of: ${expected})`;
  }
}
