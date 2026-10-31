'use client';

import { useEffect, useState } from 'react';
import {
  businessCategorySchema,
  type Business,
  type BusinessCategory,
  type RegisterBusinessRequest,
} from '@layo/contracts';
import { api, ApiError } from '../lib/api-client';
import { StatusBadge } from './StatusBadge';
import { BusinessDeals } from './BusinessDeals';

const CATEGORY_LABELS: Record<string, string> = {
  FOOD_DRINK: 'Food & drink',
  DUTY_FREE: 'Duty free',
  LOUNGE: 'Lounge',
  FASHION_RETAIL: 'Fashion & retail',
  TRAVEL_ESSENTIALS: 'Travel essentials',
  SERVICES: 'Services',
};

const STATUS_MESSAGE: Record<string, string> = {
  PENDING: 'Awaiting admin approval. You can submit deals once this business is approved.',
  REJECTED: 'This registration was rejected. Contact an admin, or register a different business below.',
  SUSPENDED: 'This business account has been suspended. Contact an admin.',
};

export function BusinessPortal() {
  const [businesses, setBusinesses] = useState<Business[] | undefined>();
  const [showRegister, setShowRegister] = useState(false);

  const refresh = () => {
    api.get<Business[]>('/businesses/me').then(setBusinesses);
  };

  useEffect(refresh, []);

  if (businesses === undefined) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Business portal</h2>
      <p className="mb-6 text-sm text-slate-500">
        Manage your business registration and submit deals for admin review.
      </p>

      {businesses.map((business) => (
        <div key={business.id} className="mb-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-navy-900">{business.name}</h3>
              <p className="text-sm text-slate-500">
                {CATEGORY_LABELS[business.category] ?? business.category} · {business.airportIata}
              </p>
            </div>
            <StatusBadge status={business.status} />
          </div>

          {business.status === 'APPROVED' ? (
            <BusinessDeals businessId={business.id} airportIata={business.airportIata} />
          ) : (
            <p className="mt-3 text-sm text-slate-500">{STATUS_MESSAGE[business.status]}</p>
          )}
        </div>
      ))}

      {!showRegister && (
        <button
          onClick={() => setShowRegister(true)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-navy-700"
        >
          {businesses.length === 0 ? 'Register your business' : 'Register another business'}
        </button>
      )}

      {showRegister && (
        <RegisterBusinessForm
          onRegistered={() => {
            setShowRegister(false);
            refresh();
          }}
          onCancel={() => setShowRegister(false)}
        />
      )}
    </div>
  );
}

interface RegisterFormState {
  name: string;
  category: BusinessCategory;
  airportIata: string;
  contactEmail: string;
}

function RegisterBusinessForm({ onRegistered, onCancel }: { onRegistered: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<RegisterFormState>({
    name: '',
    category: businessCategorySchema.options[0],
    airportIata: '',
    contactEmail: '',
  });
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setSaving(true);
    try {
      const dto: RegisterBusinessRequest = { ...form, airportIata: form.airportIata.toUpperCase() };
      await api.post('/businesses', dto);
      onRegistered();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register this business');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-md space-y-3 rounded-xl border border-border bg-background p-4">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-500">Business name</span>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="input"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-500">Category</span>
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as BusinessCategory }))}
          className="input"
        >
          {businessCategorySchema.options.map((opt) => (
            <option key={opt} value={opt}>
              {CATEGORY_LABELS[opt] ?? opt}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-500">Airport (IATA)</span>
        <input
          value={form.airportIata}
          onChange={(e) => setForm((f) => ({ ...f, airportIata: e.target.value }))}
          className="input"
          maxLength={3}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-500">Contact email</span>
        <input
          type="email"
          value={form.contactEmail}
          onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
          className="input"
          required
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Submitting…' : 'Submit for approval'}
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
