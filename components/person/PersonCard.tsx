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
} from 'lucide-react';
import { format } from 'date-fns';

interface PersonCardProps {
  person: PersonWithRelations;
  onEdit?: () => void;
  showActions?: boolean;
}

export function PersonCard({
  person,
  onEdit,
  showActions = true,
}: PersonCardProps) {
  const age = person.birthDate
    ? calculateAge(new Date(person.birthDate), person.deathDate ? new Date(person.deathDate) : null)
    : null;

  const facts = (() => {
    if (!person.facts) return [];
    try {
      return JSON.parse(person.facts);
    } catch {
      console.error('Failed to parse facts JSON');
      return [];
    }
  })();

  return (
    <Card className="overflow-hidden border-[#e4d7cc] bg-[#fffdf9]" padding="none">
      <div className="relative h-28 bg-gradient-to-r from-maroon-700 via-maroon-600 to-[#8a4c3b]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(255,255,255,0.12),transparent_34%)]" />
        {showActions && onEdit && (
          <button
            onClick={onEdit}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg border border-white/20 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
            aria-label="Edit person"
          >
            <Edit className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="relative -mt-12 px-6">
        <Avatar
          src={person.profileImage?.url}
          name={formatPersonName(person)}
          size="2xl"
          className="ring-4 ring-[#fffdf9] shadow-lg"
        />
        <span
          className={`absolute bottom-2 left-24 grid h-5 w-5 place-items-center rounded-full border-[3px] border-[#fffdf9] ${
            person.isLiving ? 'bg-emerald-500' : 'bg-[#9d958f]'
          }`}
          title={person.isLiving ? 'Living' : 'Deceased'}
        >
          {!person.isLiving && <span className="text-[9px] text-white">†</span>}
        </span>
      </div>

      <div className="p-6 pt-4">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-serif text-2xl font-semibold tracking-[-0.02em] text-[#30231e]">
              {formatPersonName(person)}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {person.gender && (
                <Badge variant={person.gender === 'MALE' ? 'info' : person.gender === 'FEMALE' ? 'danger' : 'default'}>
                  {person.gender.toLowerCase()}
                </Badge>
              )}
              {!person.isLiving && <Badge variant="default">Deceased</Badge>}
              {age !== null && (
                <span className="text-xs text-[#887970]">
                  {person.isLiving ? `${age} years old` : `Lived ${age} years`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-[#eee4dc] pt-5">
          {person.birthDate && (
            <DetailRow icon={<Calendar className="h-4 w-4" />}>
              Born {format(new Date(person.birthDate), 'MMMM d, yyyy')}
              {person.birthPlace && ` in ${person.birthPlace}`}
            </DetailRow>
          )}

          {person.deathDate && (
            <DetailRow icon={<Calendar className="h-4 w-4" />}>
              Passed {format(new Date(person.deathDate), 'MMMM d, yyyy')}
              {person.deathPlace && ` in ${person.deathPlace}`}
            </DetailRow>
          )}

          {person.occupation && (
            <DetailRow icon={<Briefcase className="h-4 w-4" />}>{person.occupation}</DetailRow>
          )}

          {person.address && (
            <DetailRow icon={<MapPin className="h-4 w-4" />}>{person.address}</DetailRow>
          )}

          {!person.isPrivate && (
            <>
              {person.email && (
                <DetailRow icon={<Mail className="h-4 w-4" />}>
                  <a href={`mailto:${person.email}`} className="text-maroon-700 hover:underline">
                    {person.email}
                  </a>
                </DetailRow>
              )}

              {person.phone && (
                <DetailRow icon={<Phone className="h-4 w-4" />}>
                  <a href={`tel:${person.phone}`} className="text-maroon-700 hover:underline">
                    {person.phone}
                  </a>
                </DetailRow>
              )}
            </>
          )}
        </div>

        {person.biography && (
          <section className="mt-6 border-t border-[#eee4dc] pt-5">
            <h3 className="font-serif text-base font-semibold text-[#3b2b24]">About</h3>
            <p className="mt-2 text-sm leading-6 text-[#6f6058]">{person.biography}</p>
          </section>
        )}

        {facts.length > 0 && (
          <section className="mt-6 border-t border-[#eee4dc] pt-5">
            <h3 className="font-serif text-base font-semibold text-[#3b2b24]">Interesting Facts</h3>
            <ul className="mt-3 space-y-2.5">
              {facts.map((fact: string, index: number) => (
                <li key={index} className="flex items-start text-sm leading-5 text-[#6f6058]">
                  <span className="mr-2.5 mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#f2e8e2] text-[10px] font-semibold text-maroon-700">
                    {index + 1}
                  </span>
                  {fact}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-6 border-t border-[#eee4dc] pt-5">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Users className="h-5 w-5" />}
              value={(person.childRelations?.length || 0) + (person.parentRelations?.length || 0)}
              label="Family Members"
            />
            <StatCard
              icon={<Heart className="h-5 w-5" />}
              value={(person.spouseRelations1?.length || 0) + (person.spouseRelations2?.length || 0)}
              label="Marriages"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function DetailRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start text-sm text-[#66574f]">
      <span className="mr-3 mt-0.5 text-[#9a7867]">{icon}</span>
      <span className="leading-5">{children}</span>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-[#e8ded5] bg-[#faf6f2] p-4 text-center">
      <span className="mx-auto mb-1.5 block w-fit text-[#9a7867]">{icon}</span>
      <p className="font-serif text-xl font-semibold text-[#3b2b24]">{value}</p>
      <p className="mt-0.5 text-[11px] text-[#887970]">{label}</p>
    </div>
  );
}
