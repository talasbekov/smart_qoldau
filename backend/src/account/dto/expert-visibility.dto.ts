import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_DISPLAY_NAME } from '../consent';

export class AcceptExpertVisibilityDto {
  @ApiProperty({
    description: 'Как к человеку обращаться. Свободная строка без проверки.',
    example: 'Айгерим',
    maxLength: MAX_DISPLAY_NAME,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_DISPLAY_NAME)
  displayName: string;
}

export class ProfileDto {
  @ApiProperty({ type: String, nullable: true, description: 'Как к человеку обращаться' })
  displayName: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Когда человек согласился, что психолог видит его имя и историю встреч (Р-27)',
  })
  expertVisibilityAcceptedAt: Date | null;
}
