'use client';

import { useEffect, useState } from 'react';
import type { AdminAuditEntry, Settings } from '@layo/contracts';
import { api, ApiError } from '../../../lib/api-client';
import { useCurrentUser } from '../../../lib/use-current-user';

export default function SettingsPage() {
  const me = useCurrentUser();
  const isSuperAdmin = me?.adminRole === 'SUPER_ADMIN';

  const [settings, setSettings] = useState<Settings | undefined>();
  const [auditLog, setAuditLog] = useState<AdminAuditEntry[] | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [savedAt, setSavedAt] = useState<number | undefined>();

  useEffect(() => {
    api.get<Settings>('/settings').then(setSettings);
    api.get<AdminAuditEntry[]>('/audit-log?limit=30').then(setAuditLog);
  }, []);

  const save = async () => {
    if (!settings) return;
    setError(undefined);
    setSaving(true);
    try {
      const updated = await api.patch<Settings>('/settings', settings);
      setSettings(updated);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Settings</h2>
      <p className="mb-6 text-sm text-slate-500">Moderation thresholds, matching rules, airport chat access windows, and feature flags.</p>

      {!isSuperAdmin && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Only a Super Admin can change settings — you can view the current configuration below.
        </p>
      )}

      <div className="space-y-6">
        <Section title="Moderation thresholds">
          <NumberField
            label="Warning threshold (distinct reporters)"
            value={settings.moderation.warningThreshold}
            onChange={(v) => setSettings({ ...settings, moderation: { ...settings.moderation, warningThreshold: v } })}
            disabled={!isSuperAdmin}
          />
          <NumberField
            label="Escalation threshold (flags for admin review — never auto-bans)"
            value={settings.moderation.escalationThreshold}
            onChange={(v) => setSettings({ ...settings, moderation: { ...settings.moderation, escalationThreshold: v } })}
            disabled={!isSuperAdmin}
          />
        </Section>

        <Section title="Matching rules">
          <ToggleField
            label="Matching enabled"
            value={settings.matching.enabled}
            onChange={(v) => setSettings({ ...settings, matching: { ...settings.matching, enabled: v } })}
            disabled={!isSuperAdmin}
          />
          <NumberField
            label="Departure window — minutes before"
            value={settings.matching.departureAirportWindowMinutesBefore}
            onChange={(v) => setSettings({ ...settings, matching: { ...settings.matching, departureAirportWindowMinutesBefore: v } })}
            disabled={!isSuperAdmin}
          />
          <NumberField
            label="Departure window — minutes after"
            value={settings.matching.departureAirportWindowMinutesAfter}
            onChange={(v) => setSettings({ ...settings, matching: { ...settings.matching, departureAirportWindowMinutesAfter: v } })}
            disabled={!isSuperAdmin}
          />
          <NumberField
            label="Minimum airport overlap (minutes)"
            value={settings.matching.minAirportOverlapMinutes}
            onChange={(v) => setSettings({ ...settings, matching: { ...settings.matching, minAirportOverlapMinutes: v } })}
            disabled={!isSuperAdmin}
          />
        </Section>

        <Section title="Airport chat access">
          <ToggleField
            label="Airport chat enabled"
            value={settings.airportChat.enabled}
            onChange={(v) => setSettings({ ...settings, airportChat: { ...settings.airportChat, enabled: v } })}
            disabled={!isSuperAdmin}
          />
          <NumberField
            label="Access window — hours before arrival"
            value={settings.airportChat.accessWindowHoursBefore}
            onChange={(v) => setSettings({ ...settings, airportChat: { ...settings.airportChat, accessWindowHoursBefore: v } })}
            disabled={!isSuperAdmin}
          />
          <NumberField
            label="Access window — hours after departure"
            value={settings.airportChat.accessWindowHoursAfter}
            onChange={(v) => setSettings({ ...settings, airportChat: { ...settings.airportChat, accessWindowHoursAfter: v } })}
            disabled={!isSuperAdmin}
          />
        </Section>

        <Section title="Feature flags & integrations">
          <ToggleField
            label="Business self-signup open"
            value={settings.featureFlags.businessSelfSignup}
            onChange={(v) => setSettings({ ...settings, featureFlags: { ...settings.featureFlags, businessSelfSignup: v } })}
            disabled={!isSuperAdmin}
          />
          <p className="text-xs text-slate-400">
            Flight data provider is configured via the API&apos;s environment (mock vs. live) — not editable here.
          </p>
        </Section>

        {isSuperAdmin && (
          <div>
            <button onClick={save} disabled={saving} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            {savedAt && <span className="ml-3 text-xs text-teal-600">Saved</span>}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        )}
      </div>

      <h3 className="mb-2 mt-8 text-sm font-semibold text-navy-900">Audit log</h3>
      {auditLog === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : auditLog.length === 0 ? (
        <p className="text-sm text-slate-400">No audit entries yet.</p>
      ) : (
        <ul className="max-h-96 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface p-4">
          {auditLog.map((entry) => (
            <li key={entry.id} className="text-sm">
              <span className="font-semibold text-navy-900">{entry.actorEmail ?? 'System'}</span>{' '}
              <span className="text-slate-600">
                {entry.action.toLowerCase()} {entry.targetType.toLowerCase()} ({entry.targetId.slice(0, 8)})
              </span>{' '}
              <span className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 text-sm font-semibold text-navy-900">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function NumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-600">{label}</span>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input w-28 disabled:opacity-60"
      />
    </label>
  );
}

function ToggleField({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-600">{label}</span>
      <input type="checkbox" checked={value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}
