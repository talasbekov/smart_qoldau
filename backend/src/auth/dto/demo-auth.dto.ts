import { ApiProperty } from '@nestjs/swagger';

export class DemoAuthConfigDto {
  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ type: String, isArray: true })
  phones: string[];
}

export class DemoRequestCodeDto {
  @ApiProperty({ example: '123456' })
  demoCode: string;
}
