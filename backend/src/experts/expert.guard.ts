import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ExpertsService } from './experts.service';
import { apiError } from '../common/filters/app-exception.filter';
import { JwtPayload } from '../auth/jwt.strategy';

// Применяется ПОСЛЕ JwtAuthGuard: ищет профиль эксперта по req.user.sub и
// кладёт его в req.expert. Нет профиля -> 404 EXPERT_NOT_FOUND.
@Injectable()
export class ExpertGuard implements CanActivate {
  constructor(private expertsService: ExpertsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    const expert = await this.expertsService.findByUserId(user.sub);
    if (!expert)
      apiError('EXPERT_NOT_FOUND', 'Анкета эксперта не найдена', 404);
    request.expert = expert;
    return true;
  }
}
