'use client';

import { useState } from 'react';
import {
  dealCategorySchema,
  dealLocationTypeSchema,
  type Deal,
  type DealCategory,
  type DealLocationType,
} from '@layo/contracts';
import { api, ApiError } from '../lib/api-client';

interface DealFormProps {
  businessId: string;
  defaultAirportIata: string;
  deal?: Deal;
  onSaved: () => void;
  onCancel: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  FOOD_DRINK: 'Food & drink',
  DUTY_FREE: 'Duty free',
  LOUNGE: 'Lounge',
  FASHION_RETAIL: 'Fashion & retail',
  TRAVEL_ESSENTIALS: 'Travel essentials',
  SERVICES: 'Services',
};

interface DealFormState {
  airportIata: string;
  terminal: string;
  locationType: DealLocationType;
  category: DealCategory;
  title: string;
  description: string;
  termsAndConditions: string;
  promoCode: string;
  validFrom: string;
  validUntil: string;
}

export function DealForm({ businessId, defaultAirportIata, deal, onSaved, onCancel }: DealFormProps) {
  const [form, setForm] = useState<DealFormState>({
    airportIata: deal?.airportIata ?? defaultAirportIata,
    terminal: deal?.terminal ?? '',
    locationType: deal?.locationType ?? 'UNKNOWN',
    category: deal?.category ?? dealCategorySchema.options[0],
    title: deal?.title ?? '',
    description: deal?.description ?? '',
    termsAndConditions: deal?.termsAndConditions ?? '',
    promoCode: deal?.promoCode ?? '',
    validFrom: deal?.validFrom ?? '',
    validUntil: deal?.validUntil ?? '',
  });
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setSaving(true);
    try {
      const dto = {
        airportIata: form.airportIata.toUpperCase(),
        terminal: form.terminal || undefined,
        locationType: form.locationType,
        category: form.category,
        title: form.title,
        description: form.description,
        termsAndConditions: form.termsAndConditions || undefined,
        promoCode: form.promoCode || undefined,
        validFrom: form.validFrom,
        validUntil: form.validUntil,
      };
      if (deal) {
        await api.patch(`/deals/${deal.id}`, dto);
      } else {
        await api.post('/deals', { ...dto, businessId });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this deal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-border bg-background p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Airport (IATA)">
          <input
            value={form.airportIata}
            onChange={(e) => setForm((f) => ({ ...f, airportIata: e.target.value }))}
            className="input"
            maxLength={3}
            required
          />
        </Field>
        <Field label="Terminal (optional)">
          <input
            value={form.terminal}
            onChange={(e) => setForm((f) => ({ ...f, terminal: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="Location">
          <select
            value={form.locationType}
            onChange={(e) => setForm((f) => ({ ...f, locationType: e.target.value as DealLocationType }))}
            className="input"
          >
            {dealLocationTypeSchema.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as DealCategory }))}
            className="input"
          >
            {dealCategorySchema.options.map((opt) => (
              <option key={opt} value={opt}>
                {CATEGORY_LABELS[opt] ?? opt}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Title">
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="input"
          required
        />
      </Field>

      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="input min-h-20"
          required
        />
      </Field>

      <Field label="Terms & conditions (optional)">
        <textarea
          value={form.termsAndConditions}
          onChange={(e) => setForm((f) => ({ ...f, termsAndConditions: e.target.value }))}
          className="input min-h-16"
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Promo code (optional)">
          <input
            value={form.promoCode}
            onChange={(e) => setForm((f) => ({ ...f, promoCode: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="Valid from">
          <input
            type="date"
            value={form.validFrom}
            onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
            className="input"
            required
          />
        </Field>
        <Field label="Valid until">
          <input
            type="date"
            value={form.validUntil}
            onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
            className="input"
            required
          />
        </Field>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : deal ? 'Save changes' : 'Submit for review'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-slate-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}
