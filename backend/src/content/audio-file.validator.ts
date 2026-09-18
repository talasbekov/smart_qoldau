import { FileValidator } from '@nestjs/common';

const ID3_HEADER_BYTES = 10;
const MPEG_HEADER_BYTES = 4;

function hasMpegLayerThreeHeader(buffer: Buffer, offset = 0): boolean {
  if (buffer.length < offset + MPEG_HEADER_BYTES) return false;

  const second = buffer[offset + 1];
  const third = buffer[offset + 2];
  const fourth = buffer[offset + 3];
  const version = (second >> 3) & 0x03;
  const layer = (second >> 1) & 0x03;
  const bitrateIndex = (third >> 4) & 0x0f;
  const sampleRateIndex = (third >> 2) & 0x03;
  const emphasis = fourth & 0x03;

  return (
    buffer[offset] === 0xff &&
    (second & 0xe0) === 0xe0 &&
    version !== 0x01 &&
    layer === 0x01 &&
    bitrateIndex !== 0x00 &&
    bitrateIndex !== 0x0f &&
    sampleRateIndex !== 0x03 &&
    emphasis !== 0x02
  );
}

function hasPlausibleId3Header(buffer: Buffer): boolean {
  if (
    buffer.length < ID3_HEADER_BYTES + MPEG_HEADER_BYTES ||
    buffer.subarray(0, 3).toString('latin1') !== 'ID3'
  ) {
    return false;
  }

  const majorVersion = buffer[3];
  const revision = buffer[4];
  const flags = buffer[5];
  const sizeBytes = buffer.subarray(6, 10);
  if (
    majorVersion < 2 ||
    majorVersion > 4 ||
    revision === 0xff ||
    sizeBytes.some((byte) => (byte & 0x80) !== 0)
  ) {
    return false;
  }

  const reservedFlagMask =
    majorVersion === 2 ? 0x3f : majorVersion === 3 ? 0x1f : 0x0f;
  if ((flags & reservedFlagMask) !== 0) return false;

  const tagSize =
    (sizeBytes[0] << 21) |
    (sizeBytes[1] << 14) |
    (sizeBytes[2] << 7) |
    sizeBytes[3];
  const hasFooter = majorVersion === 4 && (flags & 0x10) !== 0;
  const frameOffset = ID3_HEADER_BYTES + tagSize + (hasFooter ? 10 : 0);

  return hasMpegLayerThreeHeader(buffer, frameOffset);
}

export class AudioFileValidator extends FileValidator {
  constructor() {
    super({});
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file?.buffer?.length || file.mimetype !== 'audio/mpeg') return false;
    return (
      hasMpegLayerThreeHeader(file.buffer) || hasPlausibleId3Header(file.buffer)
    );
  }

  buildErrorMessage(file?: Express.Multer.File): string {
    return `Validation failed (current file type is ${file?.mimetype ?? 'unknown'}, expected a valid audio/mpeg MP3)`;
  }
}
