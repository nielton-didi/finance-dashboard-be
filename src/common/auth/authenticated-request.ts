import { Request } from 'express';
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
