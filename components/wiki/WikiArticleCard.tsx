'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { WikiArticleWithAuthor } from '@/types';
import { Card, Avatar } from '@/components/ui';
import { MessageSquare, Eye, Calendar, User } from 'lucide-react';

interface WikiArticleCardProps {
  article: WikiArticleWithAuthor;
  variant?: 'default' | 'compact';
}

export function WikiArticleCard({ article, variant = 'default' }: WikiArticleCardProps) {
  if (variant === 'compact') {
    return (
      <Link href={`/wiki/${article.slug}`}>
        <Card className="hover:shadow-md transition-shadow p-4">
          <h4 className="font-medium text-slate-900 line-clamp-1 mb-1">
            {article.title}
          </h4>
          <p className="text-xs text-slate-500">
            {format(new Date(article.createdAt), 'MMM d, yyyy')}
          </p>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/wiki/${article.slug}`}>
      <Card className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
        {article.coverImage && (
          <div className="relative h-48 -mx-6 -mt-6 mb-4 overflow-hidden">
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        )}
        
        <div className="space-y-3">
          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {article.tags.slice(0, 3).map((tag: { id: string; name: string }) => (
                <span
                  key={tag.id}
                  className="px-2 py-0.5 text-xs font-medium bg-maroon-100 text-maroon-700 rounded-full"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h3 className="text-lg font-semibold text-slate-900 group-hover:text-maroon-600 transition-colors line-clamp-2">
            {article.title}
          </h3>

          {/* Excerpt */}
          {article.excerpt && (
            <p className="text-sm text-slate-600 line-clamp-2">
              {article.excerpt}
            </p>
          )}

          {/* About Person Badge */}
          {article.aboutPerson && (
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-600">
                About: <span className="font-medium">{article.aboutPerson.firstName} {article.aboutPerson.lastName}</span>
              </span>
            </div>
          )}

          {/* Meta info */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Avatar
                src={article.author.image}
                name={article.author.name || 'Author'}
                size="sm"
              />
              <div className="text-xs">
                <p className="font-medium text-slate-700">{article.author.name}</p>
                <p className="text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(article.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-400">
              <span className="flex items-center gap-1 text-xs">
                <Eye className="w-4 h-4" />
                {article.viewCount}
              </span>
              <span className="flex items-center gap-1 text-xs">
                <MessageSquare className="w-4 h-4" />
                {article._count?.comments || 0}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

