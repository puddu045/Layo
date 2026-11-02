'use client';

import { useEffect, useState } from 'react';
import type { AdminJourneyListItem, AirportTraffic, DuplicateJourneyFlag, FlightLookupFailure, PaginatedResponse } from '@layo/contracts';
import { api } from '../../../lib/api-client';

type Tab = 'journeys' | 'traffic' | 'failures' | 'duplicates';

export default function JourneysPage() {
  const [tab, setTab] = useState<Tab>('journeys');

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold text-navy-900">Flights & Journeys</h2>
      <p className="mb-4 text-sm text-slate-500">Search traveller journeys, airport traffic, flight lookup failures, and duplicate flags.</p>

      <div className="mb-4 flex gap-2">
        {(
          [
            ['journeys', 'Journeys'],
            ['traffic', 'Airport traffic'],
            ['failures', 'Lookup failures'],
            ['duplicates', 'Duplicates'],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              tab === key ? 'bg-navy-900 text-white' : 'bg-surface text-slate-600 border border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'journeys' && <JourneysTab />}
      {tab === 'traffic' && <TrafficTab />}
      {tab === 'failures' && <FailuresTab />}
      {tab === 'duplicates' && <DuplicatesTab />}
    </div>
  );
}

function JourneysTab() {
  const [search, setSearch] = useState('');
  const [airportIata, setAirportIata] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<AdminJourneyListItem> | undefined>();

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (search.trim()) params.set('search', search.trim());
    if (airportIata.trim()) params.set('airportIata', airportIata.trim().toUpperCase());
    api.get<PaginatedResponse<AdminJourneyListItem>>(`/journeys/admin?${params.toString()}`).then(setData);
  }, [search, airportIata, page]);

  return (
    <div>
      <div className="mb-3 flex gap-3">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search by traveller email or name…"
          className="input max-w-xs"
        />
        <input
          value={airportIata}
          onChange={(e) => {
            setPage(1);
            setAirportIata(e.target.value);
          }}
          placeholder="Airport IATA"
          maxLength={3}
          className="input w-32"
        />
      </div>

      {data === undefined ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-slate-400">No journeys match.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {data.items.map((j) => (
              <li key={j.id} className="rounded-lg border border-border bg-surface p-3">
                <p className="text-sm font-semibold text-navy-900">{j.userDisplayName ?? j.userEmail}</p>
                <p className="text-xs text-slate-500">
                  {j.userEmail} · {j.segmentCount} segment{j.segmentCount === 1 ? '' : 's'} ·{' '}
                  {j.firstDepartureAirportIata ?? '?'} → {j.lastArrivalAirportIata ?? '?'} ·{' '}
                  {new Date(j.createdAt).toLocaleDateString()}
                  {!j.isDiscoverable && <span className="ml-2 text-amber-600">(not discoverable)</span>}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              Page {data.page} of {data.totalPages} · {data.total} journeys
            </span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-border px-3 py-1 disabled:opacity-40">
                Prev
              </button>
              <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-border px-3 py-1 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TrafficTab() {
  const [traffic, setTraffic] = useState<AirportTraffic[] | undefined>();

  useEffect(() => {
    api.get<AirportTraffic[]>('/airports/admin/traffic').then(setTraffic);
  }, []);

  if (traffic === undefined) return <p className="text-sm text-slate-400">Loading…</p>;
  if (traffic.length === 0) return <p className="text-sm text-slate-400">No airport activity yet.</p>;

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-border text-xs uppercase text-slate-400">
          <th className="py-2">Airport</th>
          <th className="py-2">Journey segments</th>
          <th className="py-2">Room participants</th>
          <th className="py-2">Approved businesses</th>
          <th className="py-2">Active deals</th>
        </tr>
      </thead>
      <tbody>
        {traffic.map((t) => (
          <tr key={t.airportIata} className="border-b border-border">
            <td className="py-2 font-semibold text-navy-900">{t.airportIata}</td>
            <td className="py-2">{t.journeySegmentCount}</td>
            <td className="py-2">{t.roomParticipantCount}</td>
            <td className="py-2">{t.businessCount}</td>
            <td className="py-2">{t.activeDealCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FailuresTab() {
  const [failures, setFailures] = useState<FlightLookupFailure[] | undefined>();

  useEffect(() => {
    api.get<FlightLookupFailure[]>('/flights/admin/lookup-failures').then(setFailures);
  }, []);

  if (failures === undefined) return <p className="text-sm text-slate-400">Loading…</p>;
  if (failures.length === 0) return <p className="text-sm text-slate-400">No failed flight lookups recently.</p>;

  return (
    <ul className="space-y-2">
      {failures.map((f) => (
        <li key={f.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
          <span className="font-semibold text-navy-900">{f.flightNumber}</span> on {f.departureDate} —{' '}
          <span className="text-slate-600">{f.reason}</span>{' '}
          <span className="text-xs text-slate-400">({new Date(f.createdAt).toLocaleString()})</span>
        </li>
      ))}
    </ul>
  );
}

function DuplicatesTab() {
  const [flags, setFlags] = useState<DuplicateJourneyFlag[] | undefined>();

  useEffect(() => {
    api.get<DuplicateJourneyFlag[]>('/journeys/admin/duplicates').then(setFlags);
  }, []);

  if (flags === undefined) return <p className="text-sm text-slate-400">Loading…</p>;
  if (flags.length === 0) return <p className="text-sm text-slate-400">No duplicate journey entries detected.</p>;

  return (
    <ul className="space-y-2">
      {flags.map((f) => (
        <li key={`${f.userId}-${f.flightId}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <span className="font-semibold text-navy-900">{f.userEmail}</span> has {f.journeyIds.length} journeys containing flight{' '}
          <span className="font-semibold">{f.flightNumber}</span>
        </li>
      ))}
    </ul>
  );
}
