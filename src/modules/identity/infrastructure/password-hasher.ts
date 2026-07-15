import { compare, hash } from 'bcryptjs';

const bcryptCost = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, bcryptCost);
}

export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return compare(password, passwordHash);
}
