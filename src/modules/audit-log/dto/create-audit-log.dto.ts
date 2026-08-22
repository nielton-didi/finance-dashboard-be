export class CreateAuditLogDto {
  organizationId?: number | null;
  userId?: number | null;
  action: string;
  details?: Record<string, unknown> | null;
}
