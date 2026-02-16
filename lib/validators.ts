import { z } from 'zod';

// Common validators
const phoneRegex = /^\+?[1-9]\d{1,14}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// User registration schema
export const registerSchema = z.object({
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().regex(phoneRegex, 'Invalid phone number').optional().or(z.literal('')),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine(data => data.email || data.phone, {
  message: 'Either email or phone is required',
  path: ['email'],
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  password: z.string().min(1, 'Password is required'),
}).refine(data => data.email || data.phone, {
  message: 'Either email or phone is required',
  path: ['email'],
});

// Person form schema
export const personSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  middleName: z.string().max(100).optional().or(z.literal('')),
  maidenName: z.string().max(100).optional().or(z.literal('')),
  nickname: z.string().max(50).optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  birthDate: z.string().regex(dateRegex, 'Invalid date format').optional().or(z.literal('')),
  birthPlace: z.string().max(200).optional().or(z.literal('')),
  deathDate: z.string().regex(dateRegex, 'Invalid date format').optional().or(z.literal('')),
  deathPlace: z.string().max(200).optional().or(z.literal('')),
  biography: z.string().max(5000).optional().or(z.literal('')),
  facts: z.array(z.string().max(500)).max(20).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().regex(phoneRegex, 'Invalid phone number').optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  occupation: z.string().max(200).optional().or(z.literal('')),
  isLiving: z.boolean(),
  isPrivate: z.boolean(),
  // Birth family link for spouses
  birthFamilyRootPersonId: z.string().optional().nullable(),
}).refine(data => {
  if (data.birthDate && data.deathDate) {
    return new Date(data.birthDate) < new Date(data.deathDate);
  }
  return true;
}, {
  message: 'Death date must be after birth date',
  path: ['deathDate'],
});

// Relationship schema
// Use .min(1) instead of .cuid() because Prisma 7 generates CUIDv2 and seed data uses custom IDs
export const relationshipSchema = z.object({
  type: z.enum(['PARENT_CHILD', 'SPOUSE', 'SIBLING', 'ADOPTED', 'STEP_PARENT', 'STEP_CHILD', 'FOSTER']),
  person1Id: z.string().min(1, 'Person ID is required'),
  person2Id: z.string().min(1, 'Person ID is required'),
  startDate: z.string().regex(dateRegex, 'Invalid date format').optional().or(z.literal('')),
  endDate: z.string().regex(dateRegex, 'Invalid date format').optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
}).refine(data => data.person1Id !== data.person2Id, {
  message: 'Cannot create relationship with the same person',
  path: ['person2Id'],
});

// Correction request schema
export const correctionSchema = z.object({
  personId: z.string().min(1, 'Person ID is required'),
  proposedChanges: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    birthDate: z.string().optional(),
    deathDate: z.string().optional(),
    biography: z.string().optional(),
    // ... other optional fields
  }),
  reason: z.string().min(10, 'Please provide a detailed reason for the correction').max(2000),
});

// Message schema
export const messageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(5000),
  receiverId: z.string().min(1).optional(),
  conversationId: z.string().min(1).optional(),
}).refine(data => data.receiverId || data.conversationId, {
  message: 'Either receiverId or conversationId is required',
  path: ['receiverId'],
});

// Approval schema
export const approvalSchema = z.object({
  pendingChangeId: z.string().min(1, 'Change ID is required'),
  status: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(1000).optional().or(z.literal('')),
});

// Search schema
export const searchSchema = z.object({
  query: z.string().max(200).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  isLiving: z.boolean().optional(),
  birthYearFrom: z.number().int().min(1800).max(2100).optional(),
  birthYearTo: z.number().int().min(1800).max(2100).optional(),
  location: z.string().max(200).optional(),
});

// Change request with approvers
export const changeRequestSchema = z.object({
  changeType: z.enum([
    'CREATE_PERSON',
    'UPDATE_PERSON',
    'DELETE_PERSON',
    'ADD_RELATIONSHIP',
    'UPDATE_RELATIONSHIP',
    'DELETE_RELATIONSHIP',
    'ADD_IMAGE',
    'DELETE_IMAGE',
  ]),
  changeData: z.record(z.string(), z.unknown()),
  personId: z.string().min(1).optional(),
  approverIds: z.array(z.string().min(1)).min(0).max(2),
  comment: z.string().max(1000).optional(),
});

// Profile update schema
export const profileSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().regex(phoneRegex).optional().or(z.literal('')),
});

// Password change schema
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PersonInput = z.infer<typeof personSchema>;
export type RelationshipInput = z.infer<typeof relationshipSchema>;
export type CorrectionInput = z.infer<typeof correctionSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type ApprovalInput = z.infer<typeof approvalSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type ChangeRequestInput = z.infer<typeof changeRequestSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

