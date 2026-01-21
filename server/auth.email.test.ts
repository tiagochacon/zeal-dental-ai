import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword, verifyPassword, isAdminEmail, ADMIN_EMAILS } from './auth';

describe('Email/Password Authentication', () => {
  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
    });

    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('wrongPassword', hash);
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2); // bcrypt uses random salt
    });
  });

  describe('Admin Email Detection', () => {
    it('should identify admin emails', () => {
      expect(isAdminEmail('tiagosennachacon@gmail.com')).toBe(true);
      expect(isAdminEmail('zealtecnologia@gmail.com')).toBe(true);
      expect(isAdminEmail('victorodriguez2611@gmail.com')).toBe(true);
    });

    it('should be case-insensitive for admin emails', () => {
      expect(isAdminEmail('TiagoSennaChacon@Gmail.com')).toBe(true);
      expect(isAdminEmail('ZEALTECNOLOGIA@GMAIL.COM')).toBe(true);
    });

    it('should reject non-admin emails', () => {
      expect(isAdminEmail('random@gmail.com')).toBe(false);
      expect(isAdminEmail('test@example.com')).toBe(false);
      expect(isAdminEmail('user@zeal.com')).toBe(false);
    });

    it('should have exactly 3 admin emails configured', () => {
      expect(ADMIN_EMAILS).toHaveLength(3);
    });
  });

  describe('Password Validation Rules', () => {
    it('should handle minimum password length (6 chars)', async () => {
      const shortPassword = '12345';
      const validPassword = '123456';
      
      // These should both hash successfully (validation is at route level)
      const shortHash = await hashPassword(shortPassword);
      const validHash = await hashPassword(validPassword);
      
      expect(shortHash).toBeDefined();
      expect(validHash).toBeDefined();
    });

    it('should handle long passwords', async () => {
      const longPassword = 'a'.repeat(100);
      const hash = await hashPassword(longPassword);
      
      const isValid = await verifyPassword(longPassword, hash);
      expect(isValid).toBe(true);
    });

    it('should handle special characters in password', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = await hashPassword(specialPassword);
      
      const isValid = await verifyPassword(specialPassword, hash);
      expect(isValid).toBe(true);
    });

    it('should handle unicode characters in password', async () => {
      const unicodePassword = 'senhaComÇedilha123';
      const hash = await hashPassword(unicodePassword);
      
      const isValid = await verifyPassword(unicodePassword, hash);
      expect(isValid).toBe(true);
    });
  });
});
