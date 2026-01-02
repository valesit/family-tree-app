'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
  Link2,
  Search,
  Loader2,
  TreePine,
  ExternalLink,
} from 'lucide-react';

interface BirthFamilyOption {
  id: string;
  familyName: string;
  rootPerson: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage: string | null;
    birthYear: number | null;
  };
  memberCount: number;
}

interface PersonFormProps {
  initialData?: Partial<PersonInput> & { birthFamilyRootPersonId?: string | null };
  onSubmit: (data: PersonInput & { birthFamilyRootPersonId?: string | null }, profileImage?: File) => Promise<void>;
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

  // Birth family linking state
  const [birthFamilyOptions, setBirthFamilyOptions] = useState<BirthFamilyOption[]>([]);
  const [selectedBirthFamily, setSelectedBirthFamily] = useState<string | null>(
    initialData?.birthFamilyRootPersonId || null
  );
  const [isSearchingFamilies, setIsSearchingFamilies] = useState(false);
  const [showCreateNewFamily, setShowCreateNewFamily] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const maidenName = watch('maidenName');

  // Search for families when maiden name changes
  const searchFamilies = useCallback(async (surname: string) => {
    if (!surname || surname.length < 2) {
      setBirthFamilyOptions([]);
      return;
    }

    setIsSearchingFamilies(true);
    try {
      const response = await fetch(`/api/families/search?surname=${encodeURIComponent(surname)}`);
      const result = await response.json();
      
      if (result.success) {
        setBirthFamilyOptions(result.data.families);
        setShowCreateNewFamily(result.data.families.length === 0);
      }
    } catch (error) {
      console.error('Error searching families:', error);
    } finally {
      setIsSearchingFamilies(false);
    }
  }, []);

  // Debounced search when maiden name changes
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (maidenName && maidenName.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchFamilies(maidenName);
      }, 500);
    } else {
      setBirthFamilyOptions([]);
      setShowCreateNewFamily(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [maidenName, searchFamilies]);

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
    await onSubmit(
      { ...data, birthFamilyRootPersonId: selectedBirthFamily },
      profileImage || undefined
    );
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
              className="absolute bottom-0 right-0 p-2 bg-maroon-500 text-white rounded-full shadow-lg hover:bg-maroon-600 transition-colors"
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
        </div>

        {/* Birth Family Linking - Shows when maiden name is entered */}
        {maidenName && maidenName.length >= 2 && (
          <div className="border border-purple-200 bg-purple-50/50 rounded-xl p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-semibold text-purple-900">
                Link to Birth Family ({maidenName})
              </h3>
            </div>
            
            {isSearchingFamilies ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-purple-500 animate-spin mr-2" />
                <span className="text-sm text-purple-600">Searching for {maidenName} families...</span>
              </div>
            ) : birthFamilyOptions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-purple-700 mb-2">
                  Select an existing family tree to link this person&apos;s birth family:
                </p>
                {birthFamilyOptions.map((family) => (
                  <button
                    key={family.id}
                    type="button"
                    onClick={() => setSelectedBirthFamily(
                      selectedBirthFamily === family.id ? null : family.id
                    )}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      selectedBirthFamily === family.id
                        ? 'border-purple-500 bg-purple-100'
                        : 'border-purple-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {family.rootPerson.profileImage ? (
                        <img 
                          src={family.rootPerson.profileImage} 
                          alt={family.rootPerson.firstName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center">
                          <TreePine className="w-5 h-5 text-purple-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {family.familyName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Founded by {family.rootPerson.firstName} {family.rootPerson.lastName}
                        {family.rootPerson.birthYear && ` (b. ${family.rootPerson.birthYear})`}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {selectedBirthFamily === family.id ? (
                        <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-purple-300" />
                      )}
                    </div>
                  </button>
                ))}
                
                {/* Option to not link */}
                <button
                  type="button"
                  onClick={() => setSelectedBirthFamily(null)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                    selectedBirthFamily === null
                      ? 'border-slate-400 bg-slate-100'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <X className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-700">Don&apos;t link to a family</p>
                    <p className="text-xs text-slate-500">Keep maiden name without linking to a family tree</p>
                  </div>
                </button>

                {/* Create new family option */}
                <div className="pt-2 border-t border-purple-200 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateNewFamily(true)}
                    className="w-full flex items-center justify-center gap-2 p-2 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-100 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create new {maidenName} family tree
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-sm text-purple-700 mb-1">
                  No &quot;{maidenName}&quot; family trees found
                </p>
                <p className="text-xs text-purple-500 mb-3">
                  You can create a new family tree for this birth family later
                </p>
                <button
                  type="button"
                  onClick={() => {
                    // This will be handled by parent component or redirect
                    alert(`To create the ${maidenName} family tree:\n\n1. Save this person first\n2. Click on their "née ${maidenName}" badge in the tree\n3. Click "Add Parent" to start their birth family tree`);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Learn how to create birth family
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
              className="w-4 h-4 rounded border-slate-300 text-maroon-600 focus:ring-maroon-500"
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
              className="w-4 h-4 rounded border-slate-300 text-maroon-600 focus:ring-maroon-500"
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

