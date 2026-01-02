'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import Link from 'next/link';
import { WikiEditor } from '@/components/wiki';
import { Button, Input, Card, Select } from '@/components/ui';
import { PersonWithImage, SessionUser } from '@/types';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Loader2,
  Image as ImageIcon,
  X,
  Plus,
  BookOpen,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function NewWikiArticlePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [aboutPersonId, setAboutPersonId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const user = session?.user as SessionUser | undefined;

  // Fetch persons for "about" dropdown
  const { data: personsData } = useSWR<{
    success: boolean;
    data: { items: PersonWithImage[] };
  }>('/api/persons?limit=100', fetcher);

  const persons = personsData?.data?.items || [];

  // Redirect if not authenticated
  if (status === 'unauthenticated') {
    router.push('/login?callbackUrl=/wiki/new');
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-maroon-500 animate-spin" />
      </div>
    );
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (publish: boolean = false) => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/wiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          excerpt: excerpt.trim() || undefined,
          coverImage: coverImage.trim() || undefined,
          aboutPersonId: aboutPersonId || undefined,
          tags: tags.length > 0 ? tags : undefined,
          isPublished: publish,
        }),
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/wiki/${result.data.slug}`);
      } else {
        setError(result.error || 'Failed to create article');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/wiki"
              className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Wiki
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <BookOpen className="w-7 h-7 text-maroon-500" />
              Write New Article
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Publish
            </Button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title */}
            <Input
              label="Title"
              placeholder="Enter a compelling title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-semibold"
            />

            {/* Content editor */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Content
              </label>
              <WikiEditor
                value={content}
                onChange={setContent}
                placeholder="Share your story, knowledge, or family history..."
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Cover image */}
            <Card>
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-slate-400" />
                Cover Image
              </h3>
              <Input
                placeholder="Enter image URL..."
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
              />
              {coverImage && (
                <div className="mt-3 relative rounded-lg overflow-hidden">
                  <img
                    src={coverImage}
                    alt="Cover preview"
                    className="w-full h-32 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </Card>

            {/* Excerpt */}
            <Card>
              <h3 className="font-semibold text-slate-900 mb-4">Excerpt</h3>
              <textarea
                placeholder="Brief summary (optional)..."
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={3}
                className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-maroon-500"
              />
              <p className="text-xs text-slate-400 mt-2">
                Leave blank to auto-generate from content
              </p>
            </Card>

            {/* About person */}
            <Card>
              <h3 className="font-semibold text-slate-900 mb-4">About Person</h3>
              <Select
                value={aboutPersonId}
                onChange={(e) => setAboutPersonId(e.target.value)}
                placeholder="Select a person (optional)"
                options={[
                  { value: '', label: 'None' },
                  ...persons.map((person) => ({
                    value: person.id,
                    label: `${person.firstName} ${person.lastName}`,
                  })),
                ]}
              />
              <p className="text-xs text-slate-400 mt-2">
                Link this article to a family member
              </p>
            </Card>

            {/* Tags */}
            <Card>
              <h3 className="font-semibold text-slate-900 mb-4">Tags</h3>
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Add a tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-maroon-100 text-maroon-700 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-maroon-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-2">
                Suggested: History, Traditions, Stories, Recipes, Places
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

