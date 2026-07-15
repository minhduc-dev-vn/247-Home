export { actorHasRole } from '@/modules/identity/application/authorization';
export {
  authenticateWithPassword,
  getActiveActor,
  getOwnProfile,
  registerCustomer,
  requestPasswordReset,
  resetPassword,
} from '@/modules/identity/application/identity-service';
export { IdentityError } from '@/modules/identity/domain/errors';
export {
  roleCodes,
  type IdentityActor,
  type RoleCode,
} from '@/modules/identity/domain/roles';
export {
  forgotPasswordSchema,
  loginSchema,
  registrationSchema,
  resetPasswordSchema,
} from '@/modules/identity/presentation/schemas';
