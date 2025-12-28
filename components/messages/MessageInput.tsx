'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile } from 'lucide-react';
import { Button } from '@/components/ui';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ onSend, disabled, placeholder = 'Type a message...' }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSend(content.trim());
      setContent('');
      textareaRef.current?.focus();
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [content]);

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-slate-200 bg-white p-4"
    >
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSending}
            rows={1}
            className="w-full resize-none rounded-xl border-2 border-slate-200 px-4 py-3 pr-12 text-sm focus:border-emerald-500 focus:outline-none disabled:bg-slate-50"
          />
          <button
            type="button"
            className="absolute right-3 bottom-3 text-slate-400 hover:text-slate-600"
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>
        <Button
          type="submit"
          disabled={!content.trim() || disabled || isSending}
          isLoading={isSending}
          className="rounded-xl"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}

