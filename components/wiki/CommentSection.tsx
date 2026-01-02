'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { WikiCommentWithAuthor, SessionUser } from '@/types';
import { Avatar, Button, Textarea } from '@/components/ui';
import { MessageSquare, Reply, Trash2, CornerDownRight } from 'lucide-react';

interface CommentSectionProps {
  articleId: string;
  comments: WikiCommentWithAuthor[];
  currentUser: SessionUser | null;
  onAddComment: (content: string, parentId?: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}

interface CommentItemProps {
  comment: WikiCommentWithAuthor;
  currentUser: SessionUser | null;
  onReply: (parentId: string) => void;
  onDelete: (commentId: string) => void;
  isReply?: boolean;
}

function CommentItem({ comment, currentUser, onReply, onDelete, isReply = false }: CommentItemProps) {
  const canDelete = currentUser?.id === comment.authorId || currentUser?.role === 'ADMIN';

  return (
    <div className={`flex gap-3 ${isReply ? 'ml-10' : ''}`}>
      {isReply && (
        <CornerDownRight className="w-4 h-4 text-slate-300 mt-2 flex-shrink-0" />
      )}
      <Avatar
        src={comment.author.image}
        name={comment.author.name || 'User'}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900 text-sm">
                {comment.author.name}
              </span>
              <span className="text-xs text-slate-400">
                {format(new Date(comment.createdAt), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            {canDelete && (
              <button
                onClick={() => onDelete(comment.id)}
                className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                title="Delete comment"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-slate-700 text-sm whitespace-pre-wrap">
            {comment.content}
          </p>
        </div>
        
        {/* Reply button (only for top-level comments) */}
        {!isReply && currentUser && (
          <button
            onClick={() => onReply(comment.id)}
            className="flex items-center gap-1 mt-2 text-xs text-slate-500 hover:text-maroon-600 transition-colors"
          >
            <Reply className="w-3 h-3" />
            Reply
          </button>
        )}

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUser={currentUser}
                onReply={onReply}
                onDelete={onDelete}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentSection({
  articleId,
  comments,
  currentUser,
  onAddComment,
  onDeleteComment,
}: CommentSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onAddComment(newComment.trim());
      setNewComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !replyingTo || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onAddComment(replyContent.trim(), replyingTo);
      setReplyContent('');
      setReplyingTo(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (confirm('Are you sure you want to delete this comment?')) {
      await onDeleteComment(commentId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-slate-400" />
        <h3 className="text-lg font-semibold text-slate-900">
          Comments ({comments.length})
        </h3>
      </div>

      {/* New comment form */}
      {currentUser ? (
        <div className="flex gap-3">
          <Avatar
            src={currentUser.image}
            name={currentUser.name || 'User'}
            size="sm"
          />
          <div className="flex-1">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts..."
              className="resize-none"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || isSubmitting}
                size="sm"
              >
                {isSubmitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl p-4 text-center">
          <p className="text-slate-600 text-sm">
            <a href="/login" className="text-maroon-600 hover:text-maroon-700 font-medium">
              Sign in
            </a>{' '}
            to leave a comment
          </p>
        </div>
      )}

      {/* Reply form (floating) */}
      {replyingTo && currentUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h4 className="font-semibold text-slate-900 mb-4">Reply to comment</h4>
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write your reply..."
              className="resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyContent('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReply}
                disabled={!replyContent.trim() || isSubmitting}
              >
                {isSubmitting ? 'Posting...' : 'Post Reply'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comments list */}
      <div className="space-y-6">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No comments yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              onReply={setReplyingTo}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

