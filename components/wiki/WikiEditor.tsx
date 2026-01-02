'use client';

import { useState, useRef } from 'react';
import { Button, Input, Textarea } from '@/components/ui';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Heading1, 
  Heading2,
  Link as LinkIcon,
  Image as ImageIcon,
} from 'lucide-react';

interface WikiEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function WikiEditor({ value, onChange, placeholder }: WikiEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const insertMarkdown = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || defaultText;
    
    const newValue = 
      value.substring(0, start) + 
      before + selectedText + after + 
      value.substring(end);
    
    onChange(newValue);
    
    // Set cursor position after the inserted text
    setTimeout(() => {
      textarea.focus();
      const newPos = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleBold = () => insertMarkdown('**', '**', 'bold text');
  const handleItalic = () => insertMarkdown('*', '*', 'italic text');
  const handleH1 = () => insertMarkdown('\n# ', '\n', 'Heading');
  const handleH2 = () => insertMarkdown('\n## ', '\n', 'Subheading');
  const handleQuote = () => insertMarkdown('\n> ', '\n', 'Quote');
  const handleBulletList = () => insertMarkdown('\n- ', '\n', 'List item');
  const handleNumberedList = () => insertMarkdown('\n1. ', '\n', 'List item');

  const handleInsertLink = () => {
    if (linkUrl) {
      const linkMarkdown = `[${linkText || linkUrl}](${linkUrl})`;
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const newValue = value.substring(0, start) + linkMarkdown + value.substring(start);
        onChange(newValue);
      }
    }
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
  };

  const handleImageUrl = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      insertMarkdown(`\n![Image](${url})\n`, '', '');
    }
  };

  const toolbarButtons = [
    { icon: Bold, action: handleBold, title: 'Bold (Ctrl+B)' },
    { icon: Italic, action: handleItalic, title: 'Italic (Ctrl+I)' },
    { type: 'divider' as const },
    { icon: Heading1, action: handleH1, title: 'Heading 1' },
    { icon: Heading2, action: handleH2, title: 'Heading 2' },
    { type: 'divider' as const },
    { icon: List, action: handleBulletList, title: 'Bullet List' },
    { icon: ListOrdered, action: handleNumberedList, title: 'Numbered List' },
    { icon: Quote, action: handleQuote, title: 'Quote' },
    { type: 'divider' as const },
    { icon: LinkIcon, action: () => setShowLinkModal(true), title: 'Insert Link' },
    { icon: ImageIcon, action: handleImageUrl, title: 'Insert Image' },
  ];

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 flex-wrap">
        {toolbarButtons.map((button, index) => {
          if (button.type === 'divider') {
            return <div key={index} className="w-px h-6 bg-slate-300 mx-1" />;
          }
          const Icon = button.icon!;
          return (
            <button
              key={index}
              type="button"
              onClick={button.action}
              title={button.title}
              className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Write your article here... (Markdown supported)'}
        className="w-full min-h-[400px] p-4 text-slate-900 placeholder:text-slate-400 focus:outline-none resize-y font-mono text-sm"
        onKeyDown={(e) => {
          // Keyboard shortcuts
          if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') {
              e.preventDefault();
              handleBold();
            } else if (e.key === 'i') {
              e.preventDefault();
              handleItalic();
            }
          }
        }}
      />

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Insert Link</h3>
            <div className="space-y-4">
              <Input
                label="URL"
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <Input
                label="Link Text (optional)"
                placeholder="Click here"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowLinkModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleInsertLink}>
                Insert Link
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
        Markdown supported: **bold**, *italic*, # headings, - lists, &gt; quotes, [links](url), ![images](url)
      </div>
    </div>
  );
}

