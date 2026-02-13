import { 
  User, 
  Person, 
  Relationship, 
  PendingChange, 
  CorrectionRequest, 
  Message, 
  Notification,
  PersonImage,
  Approval,
  Activity,
  Conversation,
  WikiArticle,
  WikiComment,
  WikiTag,
  NotableNomination,
  NotableImage,
  Family,
  FamilyMembership,
  AdminRemovalRequest,
  FamilyRole
} from '@prisma/client';

// Re-export Prisma types
export type { 
  User, 
  Person, 
  Relationship, 
  PendingChange, 
  CorrectionRequest, 
  Message, 
  Notification,
  PersonImage,
  Approval,
  Activity,
  Conversation,
  WikiArticle,
  WikiComment,
  WikiTag,
  NotableNomination,
  NotableImage,
  Family,
  FamilyMembership,
  AdminRemovalRequest,
  FamilyRole
};

// Extended types with relations
export type PersonWithRelations = Person & {
  profileImage?: PersonImage | null;
  images?: PersonImage[];
  parentRelations?: RelationshipWithPersons[];
  childRelations?: RelationshipWithPersons[];
  spouseRelations1?: RelationshipWithPersons[];
  spouseRelations2?: RelationshipWithPersons[];
  user?: User | null;
};

export type PersonWithImage = Person & { profileImage?: PersonImage | null };

export type RelationshipWithPersons = Relationship & {
  parent?: PersonWithImage | null;
  child?: PersonWithImage | null;
  spouse1?: PersonWithImage | null;
  spouse2?: PersonWithImage | null;
};

export type ApprovalWithApprover = Approval & { approver: User };

export type PendingChangeWithDetails = PendingChange & {
  createdBy: User;
  person?: Person | null;
  approvals: ApprovalWithApprover[];
};

export type CorrectionWithDetails = CorrectionRequest & {
  requestedBy: User;
  person: Person & { profileImage?: PersonImage | null };
};

export type MessageWithUsers = Message & {
  sender: User;
  receiver?: User | null;
};

export type NotificationWithData = Notification & {
  data: {
    link?: string;
    personId?: string;
    changeId?: string;
  } | null;
};

export type ConversationWithDetails = Conversation & {
  messages: MessageWithUsers[];
  participants: { userId: string }[];
};

// Tree visualization types
export interface TreeNode {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  birthDate?: string;
  deathDate?: string;
  profileImage?: string;
  isLiving: boolean;
  isVerified?: boolean;  // Shows "Unverified" badge if false
  children?: TreeNode[];
  spouse?: TreeNode;  // Legacy single spouse (for backward compatibility)
  spouses?: SpouseNode[];  // Multiple spouses support
  attributes?: {
    birthYear?: string;
    deathYear?: string;
    occupation?: string;
    maidenName?: string;
    birthFamilyId?: string;
  };
}

// Spouse with marriage details
export interface SpouseNode extends TreeNode {
  marriageDate?: string;
  divorceDate?: string;
  marriageOrder?: number;  // 1 = first wife, 2 = second wife, etc.
  marriageNotes?: string;
}

export interface FamilyTreeData {
  rootPerson: TreeNode;
  generations: number;
  totalMembers: number;
}

// Form types
export interface PersonFormData {
  firstName: string;
  lastName: string;
  middleName?: string;
  maidenName?: string;
  nickname?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  biography?: string;
  facts?: string[];
  email?: string;
  phone?: string;
  address?: string;
  occupation?: string;
  isLiving?: boolean;
  isPrivate?: boolean;
  profileImage?: File;
}

export interface RelationshipFormData {
  type: 'PARENT_CHILD' | 'SPOUSE' | 'SIBLING' | 'ADOPTED' | 'STEP_PARENT' | 'STEP_CHILD' | 'FOSTER';
  personId: string;
  relatedPersonId: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface CorrectionFormData {
  personId: string;
  proposedChanges: Partial<PersonFormData>;
  reason: string;
}

export interface MessageFormData {
  content: string;
  receiverId?: string;
  conversationId?: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Auth types
export interface SessionUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  image?: string | null;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  linkedPersonId?: string | null;
}

// ============================================
// FAMILY MEMBERSHIP TYPES
// ============================================

export type FamilyMembershipWithUser = FamilyMembership & {
  user: User;
};

export type FamilyMembershipWithFamily = FamilyMembership & {
  family: Family;
};

export type FamilyWithMemberships = Family & {
  memberships: FamilyMembershipWithUser[];
  createdBy?: User | null;
};

export type AdminRemovalRequestWithDetails = AdminRemovalRequest & {
  family: Family;
  targetUser: User;
  requestedBy: User;
  resolvedBy?: User | null;
};

// Check if user is Family Admin for a specific tree
export interface FamilyAdminCheck {
  isFamilyAdmin: boolean;
  isSystemAdmin: boolean;
  canManageTree: boolean;
  membership?: FamilyMembership | null;
}

// Search types
export interface SearchFilters {
  query?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  isLiving?: boolean;
  birthYearFrom?: number;
  birthYearTo?: number;
  location?: string;
}

export interface SearchResult {
  persons: PersonWithRelations[];
  total: number;
}

// Activity feed types
export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  user?: {
    id: string;
    name: string;
    image?: string;
  };
  data?: Record<string, unknown>;
  createdAt: string;
}

// Notification preferences
export interface NotificationPreferences {
  emailApprovals: boolean;
  emailMessages: boolean;
  emailNewMembers: boolean;
  pushApprovals: boolean;
  pushMessages: boolean;
  pushNewMembers: boolean;
}

// ============================================
// WIKI TYPES
// ============================================

export type WikiArticleWithAuthor = WikiArticle & {
  author: User;
  aboutPerson?: PersonWithImage | null;
  tags?: WikiTag[];
  _count?: {
    comments: number;
  };
};

export type WikiCommentWithAuthor = WikiComment & {
  author: User;
  replies?: WikiCommentWithAuthor[];
};

export type WikiArticleWithDetails = WikiArticle & {
  author: User;
  aboutPerson?: PersonWithImage | null;
  tags?: WikiTag[];
  comments: WikiCommentWithAuthor[];
};

export interface WikiArticleFormData {
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  aboutPersonId?: string;
  tags?: string[];
  isPublished?: boolean;
}

// ============================================
// NOTABLE PERSONS TYPES
// ============================================

export type NotableNominationWithDetails = NotableNomination & {
  nominatedBy: User;
  person: PersonWithImage;
  images: NotableImage[];
};

export type NotablePersonWithDetails = Person & {
  profileImage?: PersonImage | null;
  images?: PersonImage[];
  notableNominations?: NotableNominationWithDetails[];
};

export interface NotableNominationFormData {
  personId: string;
  title: string;
  description: string;
  achievements?: string[];
  images?: File[];
}

// ============================================
// RELATIVE DISCOVERY TYPES
// ============================================

export interface RelativeSuggestion {
  person: PersonWithImage;
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  relationshipPath: string; // e.g., "2nd Cousin", "Great Uncle"
  distance: number; // relationship distance
  commonAncestor?: PersonWithImage;
  hasAccount: boolean;
}

// ============================================
// EXPANDED TREE VIEW TYPES
// ============================================

export interface ExpandedTreeViewData {
  notablePersons: NotablePersonWithDetails[];
  recentArticles: WikiArticleWithAuthor[];
  familyStats: {
    totalMembers: number;
    livingCount: number;
    generations: number;
    oldestRecord?: string;
  };
}

