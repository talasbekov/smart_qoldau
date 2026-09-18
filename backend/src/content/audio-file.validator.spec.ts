import { AudioFileValidator } from './audio-file.validator';

function file(buffer: Buffer, mimetype = 'audio/mpeg'): Express.Multer.File {
  return { buffer, mimetype } as Express.Multer.File;
}

describe('AudioFileValidator', () => {
  const validator = new AudioFileValidator();
  const mpegFrame = Buffer.from([0xff, 0xfb, 0x90, 0x00]);

  it('accepts a plausible MPEG Layer III frame header', () => {
    expect(validator.isValid(file(mpegFrame))).toBe(true);
  });

  it('accepts a plausible ID3v2 header followed by an MPEG frame', () => {
    const id3Header = Buffer.from([
      0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    expect(validator.isValid(file(Buffer.concat([id3Header, mpegFrame])))).toBe(
      true,
    );
  });

  it.each([
    ['a mismatched MIME type', file(mpegFrame, 'application/octet-stream')],
    ['an empty buffer', file(Buffer.alloc(0))],
    ['arbitrary bytes', file(Buffer.from('not an mp3'))],
    ['a three-byte ID3 prefix', file(Buffer.from('ID3'))],
    [
      'an ID3 header with an impossible synchsafe size',
      file(
        Buffer.from([
          0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0xff,
          0xfb, 0x90, 0x00,
        ]),
      ),
    ],
    [
      'an MPEG frame with a reserved version',
      file(Buffer.from([0xff, 0xeb, 0x90, 0x00])),
    ],
    [
      'an MPEG frame with an invalid bitrate index',
      file(Buffer.from([0xff, 0xfb, 0x00, 0x00])),
    ],
  ])('rejects %s', (_name, candidate) => {
    expect(validator.isValid(candidate)).toBe(false);
  });
});
