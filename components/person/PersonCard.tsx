'use client';

import { PersonWithRelations } from '@/types';
import { Avatar, Badge, Card } from '@/components/ui';
import { calculateAge, formatPersonName } from '@/lib/tree-utils';
import {
  Calendar,
  MapPin,
  Briefcase,
  Mail,
  Phone,
  Heart,
  Users,
  Edit,
  Flag,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface PersonCardProps {
  person: PersonWithRelations;
  onEdit?: () => void;
  onRequestCorrection?: () => void;
  showActions?: boolean;
}

export function PersonCard({
  person,
  onEdit,
  onRequestCorrection,
  showActions = true,
}: PersonCardProps) {
  const age = person.birthDate
    ? calculateAge(new Date(person.birthDate), person.deathDate ? new Date(person.deathDate) : null)
    : null;

  const facts = person.facts ? JSON.parse(person.facts) : [];

  return (
    <Card className="overflow-hidden" padding="none">
      {/* Header with gradient */}
      <div className="relative h-32 bg-gradient-to-br from-emerald-500 to-teal-600">
        <div className="absolute inset-0 bg-black/10" />
        {showActions && (
          <div className="absolute top-4 right-4 flex space-x-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onRequestCorrection && (
              <button
                onClick={onRequestCorrection}
                className="p-2 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-colors"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="relative px-6 -mt-16">
        <Avatar
          src={person.profileImage?.url}
          name={formatPersonName(person)}
          size="2xl"
          className="ring-4 ring-white shadow-lg"
        />
        {person.isLiving ? (
          <div className="absolute bottom-2 left-24 w-5 h-5 bg-emerald-500 rounded-full border-3 border-white" />
        ) : (
          <div className="absolute bottom-2 left-24 w-5 h-5 bg-slate-400 rounded-full border-3 border-white flex items-center justify-center">
            <span className="text-white text-[10px]">†</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 pt-4">
        {/* Name and status */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {formatPersonName(person)}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {person.gender && (
                <Badge variant={person.gender === 'MALE' ? 'info' : person.gender === 'FEMALE' ? 'danger' : 'default'}>
                  {person.gender.toLowerCase()}
                </Badge>
              )}
              {!person.isLiving && (
                <Badge variant="default">Deceased</Badge>
              )}
              {age !== null && (
                <span className="text-sm text-slate-500">
                  {person.isLiving ? `${age} years old` : `Lived ${age} years`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3">
          {person.birthDate && (
            <div className="flex items-center text-sm text-slate-600">
              <Calendar className="w-4 h-4 mr-3 text-slate-400" />
              <span>
                Born {format(new Date(person.birthDate), 'MMMM d, yyyy')}
                {person.birthPlace && ` in ${person.birthPlace}`}
              </span>
            </div>
          )}

          {person.deathDate && (
            <div className="flex items-center text-sm text-slate-600">
              <Calendar className="w-4 h-4 mr-3 text-slate-400" />
              <span>
                Passed {format(new Date(person.deathDate), 'MMMM d, yyyy')}
                {person.deathPlace && ` in ${person.deathPlace}`}
              </span>
            </div>
          )}

          {person.occupation && (
            <div className="flex items-center text-sm text-slate-600">
              <Briefcase className="w-4 h-4 mr-3 text-slate-400" />
              <span>{person.occupation}</span>
            </div>
          )}

          {person.address && (
            <div className="flex items-center text-sm text-slate-600">
              <MapPin className="w-4 h-4 mr-3 text-slate-400" />
              <span>{person.address}</span>
            </div>
          )}

          {/* Contact info (if not private) */}
          {!person.isPrivate && (
            <>
              {person.email && (
                <div className="flex items-center text-sm text-slate-600">
                  <Mail className="w-4 h-4 mr-3 text-slate-400" />
                  <a href={`mailto:${person.email}`} className="text-emerald-600 hover:underline">
                    {person.email}
                  </a>
                </div>
              )}

              {person.phone && (
                <div className="flex items-center text-sm text-slate-600">
                  <Phone className="w-4 h-4 mr-3 text-slate-400" />
                  <a href={`tel:${person.phone}`} className="text-emerald-600 hover:underline">
                    {person.phone}
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Biography */}
        {person.biography && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">About</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {person.biography}
            </p>
          </div>
        )}

        {/* Interesting Facts */}
        {facts.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Interesting Facts</h3>
            <ul className="space-y-2">
              {facts.map((fact: string, index: number) => (
                <li key={index} className="flex items-start text-sm text-slate-600">
                  <span className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-medium mr-2 mt-0.5">
                    {index + 1}
                  </span>
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Relationships summary */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <Users className="w-5 h-5 mx-auto text-slate-400 mb-1" />
              <p className="text-lg font-semibold text-slate-900">
                {(person.childRelations?.length || 0) + (person.parentRelations?.length || 0)}
              </p>
              <p className="text-xs text-slate-500">Family Members</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <Heart className="w-5 h-5 mx-auto text-rose-400 mb-1" />
              <p className="text-lg font-semibold text-slate-900">
                {(person.spouseRelations1?.length || 0) + (person.spouseRelations2?.length || 0)}
              </p>
              <p className="text-xs text-slate-500">Marriages</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

