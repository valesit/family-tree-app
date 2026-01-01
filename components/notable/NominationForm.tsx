'use client';

import { useState } from 'react';
import { Button, Input, Textarea, Card, Select } from '@/components/ui';
import { PersonWithImage } from '@/types';
import { Award, Plus, X, Loader2 } from 'lucide-react';

interface NominationFormProps {
  persons: PersonWithImage[];
  onSubmit: (data: {
    personId: string;
    title: string;
    description: string;
    achievements: string[];
  }) => Promise<void>;
  onCancel: () => void;
}

export function NominationForm({ persons, onSubmit, onCancel }: NominationFormProps) {
  const [personId, setPersonId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [achievements, setAchievements] = useState<string[]>([]);
  const [newAchievement, setNewAchievement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddAchievement = () => {
    if (newAchievement.trim() && !achievements.includes(newAchievement.trim())) {
      setAchievements([...achievements, newAchievement.trim()]);
      setNewAchievement('');
    }
  };

  const handleRemoveAchievement = (achievement: string) => {
    setAchievements(achievements.filter(a => a !== achievement));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!personId) {
      setError('Please select a person');
      return;
    }
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        personId,
        title: title.trim(),
        description: description.trim(),
        achievements,
      });
    } catch (err) {
      setError('Failed to submit nomination. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter out persons who are already notable
  const eligiblePersons = persons.filter(p => !p.isNotable);

  return (
    <Card className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <Award className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Nominate Notable Person</h2>
          <p className="text-sm text-slate-500">
            Recognize a family member who made a significant impact
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Person selection */}
        <div>
          <Select
            label="Family Member *"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            placeholder="Select a person to nominate"
            options={eligiblePersons.map((person) => ({
              value: person.id,
              label: `${person.firstName} ${person.lastName}${person.isLiving ? '' : ' (Deceased)'}`,
            }))}
          />
          {eligiblePersons.length === 0 && (
            <p className="text-xs text-slate-500 mt-1">
              All family members are already notable or there are no family members yet.
            </p>
          )}
        </div>

        {/* Title */}
        <div>
          <Input
            label="Title / Role *"
            placeholder="e.g., Community Leader, Philanthropist, War Veteran"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1">A short title describing their notable contribution</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description *
          </label>
          <Textarea
            placeholder="Describe their achievements, contributions, and impact on the family and community..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
        </div>

        {/* Achievements */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Key Achievements
          </label>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Add an achievement..."
              value={newAchievement}
              onChange={(e) => setNewAchievement(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddAchievement();
                }
              }}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddAchievement}
              disabled={!newAchievement.trim()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {achievements.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {achievements.map((achievement) => (
                <span
                  key={achievement}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm"
                >
                  {achievement}
                  <button
                    type="button"
                    onClick={() => handleRemoveAchievement(achievement)}
                    className="hover:text-amber-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Submit buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Award className="w-4 h-4 mr-2" />
                Submit Nomination
              </>
            )}
          </Button>
        </div>
      </form>

      <p className="text-xs text-slate-500 mt-4 text-center">
        Nominations are reviewed by family administrators before being published.
      </p>
    </Card>
  );
}

