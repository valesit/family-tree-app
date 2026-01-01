'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import Link from 'next/link';
import { format } from 'date-fns';
import { CommentSection } from '@/components/wiki';
import { Card, Button, Avatar } from '@/components/ui';
import { WikiArticleWithDetails, SessionUser } from '@/types';
import { 
  ArrowLeft, 
  Calendar, 
  Eye, 
  Edit, 
  Trash2, 
  User,
  Loader2,
  AlertCircle,
  Share2,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// HTML escape function to prevent XSS
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return text.replace(/[&<>"']/g, char => htmlEntities[char]);
}

// Validate URL to only allow safe protocols
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://example.com');
    // Only allow http, https, and mailto protocols
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    // If URL parsing fails, check if it's a relative URL (starts with / or #)
    return url.startsWith('/') || url.startsWith('#') || url.startsWith('./');
  }
}

// Sanitize URL - returns safe URL or '#' for invalid ones
function sanitizeUrl(url: string): string {
  const trimmedUrl = url.trim();
  if (isValidUrl(trimmedUrl)) {
    return escapeHtml(trimmedUrl);
  }
  return '#';
}

// Simple markdown renderer with XSS protection
function renderMarkdown(content: string): string {
  // First, escape HTML in the content to prevent injection
  let escaped = escapeHtml(content);
  
  return escaped
    // Headers (content already escaped)
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-slate-900 mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold text-slate-900 mt-8 mb-4">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-slate-900 mt-8 mb-4">$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
    // Links - with URL validation
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      const safeUrl = sanitizeUrl(url);
      return `<a href="${safeUrl}" class="text-maroon-600 hover:text-maroon-700 underline" target="_blank" rel="noopener noreferrer">${text}</a>`;
    })
    // Images - with URL validation
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      const safeUrl = sanitizeUrl(url);
      // Only render image if URL is valid, otherwise show alt text
      if (safeUrl === '#') {
        return `[Image: ${alt}]`;
      }
      return `<img src="${safeUrl}" alt="${alt}" class="rounded-lg my-4 max-w-full" loading="lazy" />`;
    })
    // Blockquotes
    .replace(/^&gt; (.*$)/gim, '<blockquote class="border-l-4 border-maroon-400 pl-4 py-2 my-4 bg-maroon-50 text-slate-700 italic">$1</blockquote>')
    // Unordered lists
    .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
    // Paragraphs (simple line breaks)
    .replace(/\n\n/g, '</p><p class="text-slate-700 leading-relaxed mb-4">')
    .replace(/\n/g, '<br />');
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function WikiArticlePage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [isDeleting, setIsDeleting] = useState(false);

  const user = session?.user as SessionUser | undefined;

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: WikiArticleWithDetails;
  }>(`/api/wiki/${slug}`, fetcher);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/wiki/${data?.data?.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        router.push('/wiki');
      }
    } catch (error) {
      console.error('Error deleting article:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddComment = async (content: string, parentId?: string) => {
    if (!data?.data?.id) return;
    
    await fetch(`/api/wiki/${data.data.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, parentId }),
    });
    
    mutate();
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!data?.data?.id) return;
    
    await fetch(`/api/wiki/${data.data.id}/comments?commentId=${commentId}`, {
      method: 'DELETE',
    });
    
    mutate();
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: data?.data?.title,
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-maroon-500 animate-spin" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">Article not found</p>
          <Link href="/wiki">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Wiki
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const article = data.data;
  const canEdit = user?.id === article.authorId || user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Cover image */}
      {article.coverImage && (
        <div className="relative h-64 md:h-96 bg-slate-200">
          <img
            src={article.coverImage}
            alt={article.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/wiki"
          className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Wiki
        </Link>

        {/* Article header */}
        <article className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 md:p-10">
            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {article.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/wiki?tag=${tag.name}`}
                    className="px-3 py-1 text-xs font-medium bg-maroon-100 text-maroon-700 rounded-full hover:bg-maroon-200 transition-colors"
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              {article.title}
            </h1>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-6 pb-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <Avatar
                  src={article.author.image}
                  name={article.author.name || 'Author'}
                  size="md"
                />
                <div>
                  <p className="font-medium text-slate-900">{article.author.name}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(article.createdAt), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {article.viewCount} views
                </span>
              </div>

              <div className="flex-1" />

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="w-4 h-4" />
                </Button>
                {canEdit && (
                  <>
                    <Link href={`/wiki/${slug}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* About person badge */}
            {article.aboutPerson && (
              <Link
                href={`/person/${article.aboutPerson.id}`}
                className="flex items-center gap-3 p-4 mt-6 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <User className="w-5 h-5 text-slate-400" />
                <div className="flex items-center gap-3">
                  <Avatar
                    src={article.aboutPerson.profileImage?.url}
                    name={`${article.aboutPerson.firstName} ${article.aboutPerson.lastName}`}
                    size="sm"
                  />
                  <div>
                    <p className="text-sm text-slate-500">This article is about</p>
                    <p className="font-medium text-slate-900">
                      {article.aboutPerson.firstName} {article.aboutPerson.lastName}
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {/* Content */}
            <div 
              className="mt-8 prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: `<p class="text-slate-700 leading-relaxed mb-4">${renderMarkdown(article.content)}</p>` 
              }}
            />
          </div>

          {/* Comments section */}
          <div className="border-t border-slate-200 p-6 md:p-10 bg-slate-50">
            <CommentSection
              articleId={article.id}
              comments={article.comments || []}
              currentUser={user || null}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
            />
          </div>
        </article>
      </div>
    </div>
  );
}

