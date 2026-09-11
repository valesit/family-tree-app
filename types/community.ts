export type ForumCommentView = {
  id: string; authorName: string; isGuest: boolean; content: string; createdAt: string; canDelete: boolean;
};
export type ForumPostView = {
  id: string; authorName: string; isGuest: boolean; content: string; createdAt: string; canDelete: boolean;
  images: { id: string; url: string }[];
  _count: { comments: number };
};
export type BusinessListingView = {
  id: string; familyId: string; kind: 'BUSINESS' | 'CAUSE'; name: string; description: string;
  location: string; contactName: string; email: string; phone: string; website: string; supportDetails: string;
  createdAt: string; updatedAt: string; canManage: boolean;
};
export type CommunityPage<T> = { items: T[]; total: number; page: number; totalPages: number };
