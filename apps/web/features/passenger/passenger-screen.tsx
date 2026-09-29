'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { bdt, label } from '@/lib/format';
import type { Ride, User } from '@/types/api';
import { Dashboard, Icon, LoadingScreen, RouteMap, SeatDisplay, TripProgress } from '../../components/ui';

const routes = [['BANANI', 'MOHAKHALI'], ['BANANI', 'GULSHAN_1'], ['BANANI', 'GULSHAN_2'], ['GULSHAN_2', 'GULSHAN_1'], ['MOHAKHALI', 'BANANI'], ['MIRPUR_10', 'UTTARA']];
type Summary = { rideRequestId: string; pickupZone: string; dropoffZone: string; status: string; totalFarePoysha: number | null; createdAt: string };
type Quote = { fare: { totalFarePoysha: number }; potentialPooledFare: { totalFarePoysha: number } };
const isActive = (status: string) => !['CANCELLED', 'COMPLETED'].includes(status);

export default function PassengerPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [rides, setRides] = useState<Summary[]>([]);
  const [selected, setSelected] = useState<Ride | null>(null);
  const [pickup, setPickup] = useState('BANANI');
  const [dropoff, setDropoff] = useState('MOHAKHALI');
  const [seats, setSeats] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [syncError, setSyncError] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [filter, setFilter] = useState('All');
  const [quoteRetry, setQuoteRetry] = useState(0);

  const refresh = useCallback(async (rideId?: string) => {
    const data = await api<{ rides: Summary[] }>('/rides');
    setRides(data.rides);
    const id = rideId ?? data.rides.find((ride) => isActive(ride.status))?.rideRequestId;
    if (id) setSelected(await api<Ride>(`/rides/${id}`));
    setSyncError(false);
  }, []);

  useEffect(() => {
    api<{ user: User }>('/auth/me').then(async ({ user }) => {
      if (user.role !== 'PASSENGER') { router.replace('/driver'); return; }
      setUser(user);
      try { await refresh(); } catch (failure) { setError((failure as Error).message); }
    }).catch(() => router.replace('/')).finally(() => setLoading(false));
  }, [refresh, router]);

  const selectedId = selected?.rideRequestId;
  useEffect(() => {
    if (!user) return;
    let running = false;
    const timer = setInterval(async () => {
      if (running) return;
      running = true;
      try { await refresh(selectedId); } catch { setSyncError(true); } finally { running = false; }
    }, 5000);
    return () => clearInterval(timer);
  }, [refresh, selectedId, user]);

  useEffect(() => {
    if (!user) return;
    let current = true;
    setQuote(null); setQuoting(true);
    api<Quote>('/rides/quote', { method: 'POST', body: JSON.stringify({ pickupZone: pickup, dropoffZone: dropoff, seatsRequested: seats }) })
      .then((value) => { if (current) setQuote(value); })
      .catch((failure) => { if (current) setError(failure.message); })
      .finally(() => { if (current) setQuoting(false); });
    return () => { current = false; };
  }, [pickup, dropoff, seats, user, quoteRetry]);

  function changeRoute(from: string, to: string) { setPickup(from); setDropoff(to); setQuote(null); setQuoting(true); setError(''); }

  async function book() {
    if (!quote || busy) return;
    setBusy(true); setError(''); setMessage(''); setConfirmCancel(false);
    try {
      const ride = await api<Ride>('/rides', { method: 'POST', body: JSON.stringify({ pickupZone: pickup, dropoffZone: dropoff, seatsRequested: seats }) });
      setSelected(ride);
      setMessage(ride.status === 'MATCHED' ? 'You’re in! Your seat reservation is confirmed.' : 'Request received. No vehicle matched yet; see your trip details below.');
      await refresh(ride.rideRequestId);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!selected) return;
    setBusy(true); setError('');
    try { const ride = await api<Ride>(`/rides/${selected.rideRequestId}/cancel`, { method: 'POST', body: '{}' }); setSelected(ride); setConfirmCancel(false); setMessage('Ride cancelled. You have not been charged.'); await refresh(ride.rideRequestId); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function viewRide(id: string) {
    setBusy(true); setConfirmCancel(false); setError('');
    try { setSelected(await api<Ride>(`/rides/${id}`)); document.getElementById('trip-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function logout() { try { await api('/auth/logout', { method: 'POST' }); router.replace('/'); } catch (failure) { setError((failure as Error).message); } }
  if (loading) return <LoadingScreen />;
  const filtered = rides.filter((ride) => filter === 'All' || (filter === 'Active' ? isActive(ride.status) : ride.status === filter.toUpperCase()));

  return <Dashboard name={user?.fullName} role="Passenger" logout={logout}><header className="page-header"><div><span className="eyebrow">LET’S MAKE MOVES</span><h1>Where to, {user?.fullName.split(' ')[0]}<span className="accent">?</span></h1><p className="muted">A familiar route. A shared seat. A better way to go.</p></div><span className="location-pill"><Icon name="pin" size={16} /> Dhaka, Bangladesh</span></header>
    {error && <p className="error banner" role="alert">{error}</p>}{message && <div className="success banner" role="status"><Icon name="check" /><span>{message}</span><button className="icon-button" onClick={() => setMessage('')} aria-label="Dismiss notification">×</button></div>}
    <div className="booking-grid"><section className="card booking-card"><div className="section-title"><span className="mini-badge"><Icon name="pin" /></span><h2>Find your next ride</h2></div><div className="route-inputs"><label><span className="field-caption"><i className="pickup-dot" /> PICKUP ZONE</span><select value={pickup} disabled={busy} onChange={(e) => { const from = e.target.value; changeRoute(from, routes.find(([start]) => start === from)![1]); }}>{Array.from(new Set(routes.map(([from]) => from))).map((from) => <option key={from} value={from}>{label(from)}</option>)}</select></label><label><span className="field-caption"><i className="destination-dot" /> DROP-OFF ZONE</span><select value={dropoff} disabled={busy} onChange={(e) => changeRoute(pickup, e.target.value)}>{routes.filter(([from]) => from === pickup).map(([, to]) => <option key={to} value={to}>{label(to)}</option>)}</select></label></div><div className="seat-picker-heading"><b>Who’s coming?</b><span className="muted small">Up to 3 seats</span></div><div className="seat-picker" role="group" aria-label="Number of seats">{[1, 2, 3].map((count) => <button key={count} disabled={busy} aria-pressed={count === seats} className={count === seats ? 'selected' : ''} onClick={() => { if (count !== seats) { setSeats(count); setQuote(null); setQuoting(true); } }}><Icon name="people" size={19} /><b>{count} {count === 1 ? 'seat' : 'seats'}</b></button>)}</div><div className="quote" aria-live="polite"><div><span>Estimated total fare</span><strong>{quoting ? <span className="skeleton price-skeleton" /> : quote ? bdt(quote.fare.totalFarePoysha) : 'Unavailable'}</strong></div>{quote && <p><Icon name="bolt" size={15} /><span>Share with another booking and pay <b>{bdt(quote.potentialPooledFare.totalFarePoysha)}</b></span></p>}{!quote && !quoting && <button className="text-button" onClick={() => setQuoteRetry((value) => value + 1)}>Retry estimate</button>}</div><button className="primary full" disabled={busy || quoting || !quote} onClick={book}>{busy ? 'Please wait…' : 'Find me a seat'}<Icon name="arrow" size={18} /></button><p className="booking-note">Final fare updates when passengers join or cancel before arrival.</p></section>
      <section className="map-panel"><RouteMap from={pickup} to={dropoff} /><div className="map-panel-bottom"><span className="mini-badge warm"><Icon name="bolt" /></span><div><h3>A small ride. A shared possibility.</h3><p>Three seats, familiar corridors, and room for a lighter fare.</p></div><span className="map-decoration">✳</span></div></section></div>
    <section className="card trip-card" id="trip-details"><div className="section-title spread"><div><span className="eyebrow">YOUR JOURNEY</span><h2>{selected ? 'Trip details' : 'Ready when you are'}</h2></div><span className={`sync-label ${syncError ? 'sync-warning' : ''}`}><i className={`dot ${syncError ? '' : 'online'}`} />{syncError ? 'Connection interrupted' : 'Updates every 5 seconds'}</span></div>{!selected ? <div className="empty-journey"><span className="empty-icon"><Icon name="ride" size={30} /></span><div><h3>Your next chapter starts with a seat.</h3><p>Choose a corridor above to request your first ride. Your driver and trip progress will appear here.</p></div></div> : <><div className="trip-summary"><h3>{label(selected.pickupZone)} <span className="muted">→</span> {label(selected.dropoffZone)}</h3><span className={`status status-${selected.status.toLowerCase()}`}>{label(selected.status)}</span></div><TripProgress status={selected.status} /><div className="trip-detail-grid"><div>{selected.pool && selected.driver ? <><div className="driver-identity"><span className="avatar large-avatar">{selected.driver.fullName[0]}</span><div><small className="muted">YOUR DRIVER</small><h3>{selected.driver.fullName}</h3><p>{selected.driver.vehicleName} · {selected.driver.licensePlate}</p></div></div><SeatDisplay capacity={selected.pool.capacity} occupied={selected.pool.occupiedSeats} /></> : <div className="notice"><Icon name="ride" /><p>{selected.status === 'CANCELLED' ? 'All clear. Choose a new corridor whenever you’re ready.' : 'No vehicle matched this request. Pending requests do not automatically rematch. Cancel this request and try again when a driver is available.'}</p></div>}<details className="activity-details"><summary>View trip activity</summary><ol className="timeline">{selected.history.map((entry, index) => <li key={index}><b>{label(entry.toStatus)}</b><time>{new Date(entry.createdAt).toLocaleString()}</time></li>)}</ol></details></div>{selected.fare && <div className="fare"><div><span>Base fare</span><b>{bdt(selected.fare.baseFarePoysha)}</b></div><div><span>Distance fare</span><b>{bdt(selected.fare.distanceFarePoysha)}</b></div><div className="discount"><span>Pooling discount</span><b>−{bdt(selected.fare.discountPoysha)}</b></div><div className="fare-total"><span>{selected.status === 'CANCELLED' ? 'Estimate · no charge' : 'Your fare'}</span><b>{bdt(selected.fare.totalFarePoysha)}</b></div><small className="muted">{selected.status === 'CANCELLED' ? 'Cancelled before pickup' : 'Cash payment · fare shown for your booking'}</small></div>}</div>{['REQUESTED', 'MATCHED'].includes(selected.status) && <div className="cancel-area">{confirmCancel ? <div className="confirm-inline"><p>Cancel this ride and release your seats?</p><button className="secondary" disabled={busy} onClick={() => setConfirmCancel(false)}>Keep my ride</button><button className="danger" disabled={busy} onClick={cancel}>Yes, cancel ride</button></div> : <button className="text-button danger-text" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel this ride</button>}</div>}</>}</section>
    <section className="card history" id="history"><div className="section-title spread"><div><span className="eyebrow">PLACES YOU’VE BEEN</span><h2>Your rides <span className="count-badge">{rides.length}</span></h2></div><div className="filter-tabs" aria-label="Filter rides">{['All', 'Active', 'Completed', 'Cancelled'].map((value) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div></div>{filtered.length === 0 ? <div className="empty">{rides.length ? 'No rides in this view yet.' : 'A fresh start. Your journeys will appear here.'}</div> : <div className="ride-list">{filtered.map((ride) => <button key={ride.rideRequestId} disabled={busy} className={`ride-item ${ride.rideRequestId === selectedId ? 'selected-ride' : ''}`} onClick={() => void viewRide(ride.rideRequestId)}><span className="history-icon"><Icon name="ride" /></span><span className="ride-route"><b>{label(ride.pickupZone)} → {label(ride.dropoffZone)}</b><small>{new Date(ride.createdAt).toLocaleString()}</small></span><span className={`status status-${ride.status.toLowerCase()}`}>{label(ride.status)}</span><span className="ride-meta"><b>{ride.status === 'CANCELLED' ? 'No charge' : ride.totalFarePoysha == null ? '—' : bdt(ride.totalFarePoysha)}</b><Icon name="arrow" size={16} /></span></button>)}</div>}</section>
  </Dashboard>;
}
