'use client';

import { useState, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PersonInput, personSchema } from '@/lib/validators';
import { Button, Input, Select, Textarea, Card } from '@/components/ui';
import { Avatar } from '@/components/ui/avatar';
import {
  User,
  Calendar,
  MapPin,
  Briefcase,
  Mail,
  Phone,
  FileText,
  Plus,
  X,
  Upload,
  Camera,
} from 'lucide-react';

interface PersonFormProps {
  initialData?: Partial<PersonInput>;
  onSubmit: (data: PersonInput, profileImage?: File) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  title?: string;
  submitLabel?: string;
}

export function PersonForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  title = 'Add Family Member',
  submitLabel = 'Save',
}: PersonFormProps) {
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<PersonInput>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      middleName: '',
      maidenName: '',
      nickname: '',
      gender: undefined,
      birthDate: '',
      birthPlace: '',
      deathDate: '',
      deathPlace: '',
      biography: '',
      facts: [],
      email: '',
      phone: '',
      address: '',
      occupation: '',
      isLiving: true,
      isPrivate: false,
      ...initialData,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'facts' as never,
  });

  const isLiving = watch('isLiving');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFormSubmit = async (data: PersonInput) => {
    await onSubmit(data, profileImage || undefined);
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-slate-900 mb-6">{title}</h2>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Profile Image */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <Avatar
              src={imagePreview || undefined}
              name={watch('firstName') || 'New Person'}
              size="2xl"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
          <p className="text-sm text-slate-500 mt-2">Click to upload photo</p>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name *"
            placeholder="John"
            leftIcon={<User className="w-5 h-5" />}
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <Input
            label="Last Name *"
            placeholder="Doe"
            leftIcon={<User className="w-5 h-5" />}
            error={errors.lastName?.message}
            {...register('lastName')}
          />
          <Input
            label="Middle Name"
            placeholder="Michael"
            error={errors.middleName?.message}
            {...register('middleName')}
          />
          <Input
            label="Maiden Name"
            placeholder="Smith"
            error={errors.maidenName?.message}
            {...register('maidenName')}
          />
          <Input
            label="Nickname"
            placeholder="Johnny"
            error={errors.nickname?.message}
            {...register('nickname')}
          />
          <Select
            label="Gender"
            options={[
              { value: 'MALE', label: 'Male' },
              { value: 'FEMALE', label: 'Female' },
              { value: 'OTHER', label: 'Other' },
            ]}
            placeholder="Select gender"
            error={errors.gender?.message}
            {...register('gender')}
          />
        </div>

        {/* Dates and Places */}
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Birth & Death Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Birth Date"
              type="date"
              leftIcon={<Calendar className="w-5 h-5" />}
              error={errors.birthDate?.message}
              {...register('birthDate')}
            />
            <Input
              label="Birth Place"
              placeholder="City, Country"
              leftIcon={<MapPin className="w-5 h-5" />}
              error={errors.birthPlace?.message}
              {...register('birthPlace')}
            />
          </div>

          <div className="flex items-center mt-4 mb-4">
            <input
              type="checkbox"
              id="isLiving"
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              {...register('isLiving')}
            />
            <label htmlFor="isLiving" className="ml-2 text-sm text-slate-600">
              This person is still living
            </label>
          </div>

          {!isLiving && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Death Date"
                type="date"
                leftIcon={<Calendar className="w-5 h-5" />}
                error={errors.deathDate?.message}
                {...register('deathDate')}
              />
              <Input
                label="Death Place"
                placeholder="City, Country"
                leftIcon={<MapPin className="w-5 h-5" />}
                error={errors.deathPlace?.message}
                {...register('deathPlace')}
              />
            </div>
          )}
        </div>

        {/* Contact & Work */}
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Contact & Occupation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="john@example.com"
              leftIcon={<Mail className="w-5 h-5" />}
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              leftIcon={<Phone className="w-5 h-5" />}
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              label="Occupation"
              placeholder="Software Engineer"
              leftIcon={<Briefcase className="w-5 h-5" />}
              error={errors.occupation?.message}
              {...register('occupation')}
            />
            <Input
              label="Address"
              placeholder="City, State, Country"
              leftIcon={<MapPin className="w-5 h-5" />}
              error={errors.address?.message}
              {...register('address')}
            />
          </div>

          <div className="flex items-center mt-4">
            <input
              type="checkbox"
              id="isPrivate"
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              {...register('isPrivate')}
            />
            <label htmlFor="isPrivate" className="ml-2 text-sm text-slate-600">
              Keep contact information private
            </label>
          </div>
        </div>

        {/* Biography */}
        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Biography</h3>
          <Textarea
            placeholder="Write a brief biography about this person..."
            rows={4}
            error={errors.biography?.message}
            {...register('biography')}
          />
        </div>

        {/* Interesting Facts */}
        <div className="border-t border-slate-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Interesting Facts</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append('')}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Fact
            </Button>
          </div>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <Input
                  placeholder={`Fact ${index + 1}`}
                  {...register(`facts.${index}` as const)}
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
            {fields.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No facts added yet. Click &quot;Add Fact&quot; to add interesting facts about this person.
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
}

