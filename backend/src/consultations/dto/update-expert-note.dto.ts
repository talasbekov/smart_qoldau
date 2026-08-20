import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateExpertNoteDto {
  @IsString({ message: 'Текст должен быть строкой' })
  @MinLength(1, { message: 'Текст не может быть пустым (только пробелы)' })
  @MaxLength(5000, { message: 'Текст не может быть длиннее 5000 символов' })
  text: string;
}
