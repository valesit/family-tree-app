'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Input, Textarea } from '@/components/ui';
import { listingSchema, ListingInput } from '@/lib/community-validation';
import { BusinessListingView } from '@/types/community';
import { communityFetch, CommunityErrorNotice } from './shared';

export function ListingForm({ familyId, listing, onSaved, onCancel }: { familyId: string; listing?: BusinessListingView; onSaved: () => void; onCancel: () => void }) {
  const { data: session } = useSession();
  const [values, setValues] = useState<ListingInput>(listing ? { ...listing, familyId } : {
    familyId, kind: 'BUSINESS', name: '', description: '', location: '', contactName: session?.user?.name || '', email: '', phone: '', website: '', supportDetails: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const update = (key: keyof ListingInput, value: string) => { setValues(old => ({ ...old, [key]: value })); setFieldErrors(old => ({ ...old, [key]: '' })); };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const parsed = listingSchema.safeParse(values);
    if (!parsed.success) {
      const errors = Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]));
      setFieldErrors(errors); setError('Please check the highlighted fields.'); return;
    }
    setBusy(true);
    try {
      await communityFetch(listing ? `/api/businesses/${listing.id}` : '/api/businesses', { method: listing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save your listing.'); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="listing-form-heading" className="mb-8 rounded-2xl border border-[#d8c8bc] bg-white p-5 shadow-sm sm:p-7">
    <h2 id="listing-form-heading" className="font-serif text-2xl">{listing ? 'Edit your listing' : 'Share a business or cause'}</h2><p className="mb-6 mt-2 text-sm text-[#7e6e65]">Help the family discover what you do and how to support you.</p>
    <form onSubmit={submit} noValidate><fieldset disabled={busy} className="space-y-5">
      <fieldset><legend className="mb-2 text-sm font-medium text-[#5e4f47]">Listing type</legend><div className="flex flex-wrap gap-3">{(['BUSINESS', 'CAUSE'] as const).map(kind => <label key={kind} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm ${values.kind === kind ? 'border-maroon-500 bg-maroon-50 text-maroon-800' : 'border-[#ded2c8]'}`}><input type="radio" name="listing-kind" value={kind} checked={values.kind === kind} onChange={() => update('kind', kind)} className="accent-maroon-600" />{kind === 'BUSINESS' ? 'Business' : 'Charitable cause'}</label>)}</div></fieldset>
      <Input id="listing-name" label={values.kind === 'BUSINESS' ? 'Business name' : 'Cause name'} value={values.name} onChange={e => update('name', e.target.value)} maxLength={120} required error={fieldErrors.name} />
      <Textarea id="listing-description" label={values.kind === 'BUSINESS' ? 'About the business' : 'About the cause'} placeholder={values.kind === 'BUSINESS' ? 'What do you offer, and who do you serve?' : 'What are you working toward, and who will benefit?'} value={values.description} onChange={e => update('description', e.target.value)} maxLength={5000} required rows={4} error={fieldErrors.description} />
      <Input id="listing-location" label="Location (optional)" placeholder="City, country, or online" value={values.location} onChange={e => update('location', e.target.value)} maxLength={160} error={fieldErrors.location} />
      <Textarea id="listing-support" label="How can family members support you?" placeholder={values.kind === 'BUSINESS' ? 'Buy a product, book a service, refer a friend…' : 'Volunteer, donate supplies, contribute through your website…'} value={values.supportDetails} onChange={e => update('supportDetails', e.target.value)} maxLength={2000} required rows={3} error={fieldErrors.supportDetails} />
      <div className="border-t border-[#eee5de] pt-5"><h3 className="font-serif text-lg">Contact details</h3><p className="mt-1 text-xs text-[#8a7b72]">These details will be public. Add at least one contact method.</p></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input id="listing-contact-name" label="Contact name" value={values.contactName} onChange={e => update('contactName', e.target.value)} required maxLength={100} error={fieldErrors.contactName} />
        <Input id="listing-email" label="Email" type="email" value={values.email} onChange={e => update('email', e.target.value)} maxLength={254} error={fieldErrors.email} />
        <Input id="listing-phone" label="Phone" type="tel" placeholder="Include country code" value={values.phone} onChange={e => update('phone', e.target.value)} maxLength={40} error={fieldErrors.phone} />
        <Input id="listing-website" label="Website or support link" type="url" placeholder="https://" value={values.website} onChange={e => update('website', e.target.value)} maxLength={500} error={fieldErrors.website} />
      </div>
      {error && <CommunityErrorNotice message={error} />}
      <div className="flex flex-wrap gap-3 border-t border-[#eee5de] pt-5"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : listing ? 'Save changes' : 'Publish listing'}</Button><Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button></div>
    </fieldset></form>
  </section>;
}
