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
  Conversation
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
  Conversation
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

export type PendingChangeWithDetails = PendingChange & {
  createdBy: User;
  person?: Person | null;
  approvals: (Approval & { approver: User })[];
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
  children?: TreeNode[];
  spouse?: TreeNode;
  attributes?: {
    birthYear?: string;
    deathYear?: string;
    occupation?: string;
  };
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

