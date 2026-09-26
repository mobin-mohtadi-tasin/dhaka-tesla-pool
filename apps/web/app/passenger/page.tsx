'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, bdt, label, Ride, User } from '@/lib/api';

const routes = [
  ['BANANI', 'MOHAKHALI'], ['BANANI', 'GULSHAN_1'], ['BANANI', 'GULSHAN_2'],
  ['GULSHAN_2', 'GULSHAN_1'], ['MOHAKHALI', 'BANANI'], ['MIRPUR_10', 'UTTARA'],
];
type Summary = { rideRequestId: string; pickupZone: string; dropoffZone: string; status: string; totalFarePoysha: number; createdAt: string };
type Quote = { corridorId: string; fare: { totalFarePoysha: number }; potentialPooledFare: { totalFarePoysha: number } };

export default function PassengerPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [rides, setRides] = useState<Summary[]>([]);
  const [selected, setSelected] = useState<Ride | null>(null);
  const [routeIndex, setRouteIndex] = useState(0);
  const [seats, setSeats] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async (rideId?: string) => {
    const data = await api<{ rides: Summary[] }>('/rides');
    setRides(data.rides);
    if (rideId) setSelected(await api<Ride>(`/rides/${rideId}`));
  }, []);

  useEffect(() => {
    api<{ user: User }>('/auth/me').then(async ({ user }) => {
      if (user.role !== 'PASSENGER') { router.replace('/driver'); return; }
      setUser(user); await refresh();
    }).catch(() => router.replace('/')).finally(() => setLoading(false));
  }, [refresh, router]);

  const selectedId = selected?.rideRequestId;
  useEffect(() => {
    if (!selectedId) return;
    const timer = setInterval(() => { void refresh(selectedId).catch(() => {}); }, 5000);
    return () => clearInterval(timer);
  }, [refresh, selectedId]);

  async function getQuote(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const [pickupZone, dropoffZone] = routes[routeIndex];
      setQuote(await api<Quote>('/rides/quote', { method: 'POST', body: JSON.stringify({ pickupZone, dropoffZone, seatsRequested: seats }) }));
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function book() {
    setBusy(true); setError('');
    try {
      const [pickupZone, dropoffZone] = routes[routeIndex];
      const ride = await api<Ride>('/rides', { method: 'POST', body: JSON.stringify({ pickupZone, dropoffZone, seatsRequested: seats }) });
      setSelected(ride); setQuote(null); await refresh(ride.rideRequestId);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const ride = await api<Ride>(`/rides/${selected.rideRequestId}/cancel`, { method: 'POST', body: '{}' });
      setSelected(ride); await refresh(ride.rideRequestId);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function logout() { await api('/auth/logout', { method: 'POST' }); router.replace('/'); }
  if (loading) return <main className="shell"><p>Loading your rides…</p></main>;

  return <main className="shell">
    <header className="topbar"><div><span className="eyebrow">DHAKA TESLA POOL</span><h1>Your journey</h1><p className="muted">Hello, {user?.fullName}. Find a seat along a familiar corridor.</p></div><button className="text-button" onClick={logout}>Sign out</button></header>
    {error && <p className="error banner" role="alert">{error}</p>}
    <div className="grid">
      <section className="card"><div className="section-title"><span className="step">01</span><h2>Request a ride</h2></div>
        <form onSubmit={getQuote}>
          <label>Route<select value={routeIndex} onChange={(event) => { setRouteIndex(Number(event.target.value)); setQuote(null); }}>{routes.map(([from, to], index) => <option key={index} value={index}>{label(from)} → {label(to)}</option>)}</select></label>
          <label>Seats<select value={seats} onChange={(event) => { setSeats(Number(event.target.value)); setQuote(null); }}><option value={1}>1 seat</option><option value={2}>2 seats</option><option value={3}>3 seats</option></select></label>
          <button className="secondary full" disabled={busy}>See fare estimate</button>
        </form>
        {quote && <div className="quote"><span>Estimated fare</span><strong>{bdt(quote.fare.totalFarePoysha)}</strong><p>If shared with another passenger: {bdt(quote.potentialPooledFare.totalFarePoysha)}</p><button className="primary full" onClick={book} disabled={busy}>{busy ? 'Booking…' : 'Request this ride'}</button></div>}
      </section>
      <section className="card"><div className="section-title"><span className="step">02</span><h2>Ride details</h2></div>
        {!selected ? <div className="empty">Choose a ride from your history or request a new one to see its status.</div> : <>
          <div className="status-row"><span className="status">{label(selected.status)}</span><span>{label(selected.pickupZone)} → {label(selected.dropoffZone)}</span></div>
          <p className="muted">{selected.pool ? `${selected.driver?.fullName} · ${selected.driver?.vehicleName} · ${selected.pool.occupiedSeats}/${selected.pool.capacity} seats` : 'Waiting for an available vehicle'}</p>
          {selected.fare && <div className="fare"><div><span>Base fare</span><b>{bdt(selected.fare.baseFarePoysha)}</b></div><div><span>Distance</span><b>{bdt(selected.fare.distanceFarePoysha)}</b></div><div><span>Pool discount</span><b>−{bdt(selected.fare.discountPoysha)}</b></div><div className="fare-total"><span>Your fare</span><b>{bdt(selected.fare.totalFarePoysha)}</b></div></div>}
          <h3>Status history</h3><ol className="timeline">{selected.history.map((entry, index) => <li key={index}><b>{label(entry.toStatus)}</b><time>{new Date(entry.createdAt).toLocaleString()}</time></li>)}</ol>
          {(selected.status === 'REQUESTED' || selected.status === 'MATCHED') && <button className="danger" disabled={busy} onClick={cancel}>Cancel ride</button>}
        </>}
      </section>
    </div>
    <section className="card history"><div className="section-title"><span className="step">03</span><h2>Ride history</h2></div>{rides.length === 0 ? <div className="empty">No rides yet. Your next trip will appear here.</div> : <div className="ride-list">{rides.map((ride) => <button key={ride.rideRequestId} className="ride-item" onClick={() => { setError(''); void api<Ride>(`/rides/${ride.rideRequestId}`).then(setSelected).catch((failure) => setError(failure.message)); }}><span><b>{label(ride.pickupZone)} → {label(ride.dropoffZone)}</b><small>{new Date(ride.createdAt).toLocaleString()}</small></span><span className="ride-meta"><b>{ride.totalFarePoysha == null ? '—' : bdt(ride.totalFarePoysha)}</b><small>{label(ride.status)}</small></span></button>)}</div>}</section>
  </main>;
}
