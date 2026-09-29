'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { label } from '@/lib/format';
import type { Manifest, PastPool, User } from '@/types/api';
import { Dashboard, Icon, LoadingScreen, RouteMap, SeatDisplay, TripProgress } from '../../components/ui';

type Vehicle = { id: string; name: string; licensePlate: string; capacity: number; driverStatus: 'ONLINE' | 'OFFLINE'; isActive: boolean };

export default function DriverPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [pool, setPool] = useState<Manifest | null>(null);
  const [history, setHistory] = useState<PastPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [syncError, setSyncError] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const refresh = useCallback(async () => {
    const [vehicleData, poolData, historyData] = await Promise.all([api<Vehicle>('/vehicles/me'), api<{ pool: Manifest | null }>('/driver/rides'), api<{ pools: PastPool[] }>('/driver/history')]);
    setVehicle(vehicleData); setPool(poolData.pool); setHistory(historyData.pools); setSyncError(false);
  }, []);

  useEffect(() => {
    api<{ user: User }>('/auth/me').then(async ({ user }) => {
      if (user.role !== 'DRIVER') { router.replace('/passenger'); return; }
      setUser(user);
      try { await refresh(); } catch (failure) { setError((failure as Error).message); }
    }).catch(() => router.replace('/')).finally(() => setLoading(false));
  }, [refresh, router]);

  useEffect(() => {
    if (!user) return;
    let running = false;
    const timer = setInterval(async () => {
      if (running) return;
      running = true;
      try { await refresh(); } catch { setSyncError(true); } finally { running = false; }
    }, 5000);
    return () => clearInterval(timer);
  }, [refresh, user]);

  async function setStatus(status: 'ONLINE' | 'OFFLINE') {
    setBusy(true); setError('');
    try { await api('/vehicles/status', { method: 'POST', body: JSON.stringify({ driverStatus: status }) }); setMessage(status === 'ONLINE' ? 'You’re online. Compatible requests can now join your vehicle.' : 'You’re offline. Take a breather.'); await refresh(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function advance(action: 'arrive' | 'start' | 'complete') {
    if (!pool) return;
    setBusy(true); setError('');
    try { await api(`/driver/rides/${pool.poolId}/${action}`, { method: 'POST', body: '{}' }); setConfirmComplete(false); setMessage(action === 'arrive' ? 'Arrival recorded. Your passengers can see you’re here.' : action === 'start' ? 'Trip started. Have a good journey.' : 'Trip completed. Thanks for keeping Dhaka moving!'); await refresh(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function logout() { try { await api('/auth/logout', { method: 'POST' }); router.replace('/'); } catch (failure) { setError((failure as Error).message); } }
  if (loading) return <LoadingScreen />;
  const online = vehicle?.driverStatus === 'ONLINE';
  const tripStatus = pool?.passengers[0]?.status ?? 'REQUESTED';
  const completed = history.filter((trip) => trip.status === 'COMPLETED');

  return <Dashboard name={user?.fullName} role="Driver" logout={logout}><header className="page-header"><div><span className="eyebrow">YOUR CITY IS CALLING</span><h1>Let’s roll, {user?.fullName.split(' ')[0]}<span className="accent">.</span></h1><p className="muted">A clear view of your vehicle, your passengers, and your next move.</p></div><span className={`sync-label ${syncError ? 'sync-warning' : ''}`}><i className={`dot ${syncError ? '' : 'online'}`} />{syncError ? 'Connection interrupted' : 'Updates every 5 seconds'}</span></header>
    {error && <p className="error banner" role="alert">{error}</p>}{message && <div className="success banner" role="status"><Icon name="check" /><span>{message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setMessage('')}>×</button></div>}
    <section className="driver-stats" aria-label="Driver overview"><div><span className="mini-badge"><Icon name="ride" /></span><div><small>Completed trips</small><strong>{completed.length}</strong></div></div><div><span className="mini-badge warm"><Icon name="people" /></span><div><small>Seats on this trip</small><strong>{pool?.occupiedSeats ?? 0}<span> / {vehicle?.capacity ?? '—'}</span></strong></div></div><div><span className="mini-badge"><Icon name="bolt" /></span><div><small>Your availability</small><strong className="availability-value">{online ? 'Online' : 'Offline'}</strong></div><i className={`dot ${online ? 'online' : ''}`} /></div></section>
    <div className="driver-grid"><section className="vehicle-card"><div className="section-title spread"><span className="eyebrow">YOUR EVERYDAY ELECTRIC</span><span className="vehicle-tag">TESLA · 3 WHEELER</span></div>{vehicle ? <><div className="vehicle-illustration" aria-hidden="true"><svg viewBox="0 0 300 175"><ellipse cx="154" cy="154" rx="105" ry="12" fill="#0c2923" opacity=".4" /><path d="M60 63q3-24 25-24h108q18 0 24 20l18 62H56z" fill="#dcf2a0" /><path d="M90 48h86v42H76z" fill="#32584b" /><path d="M185 48h14l15 42h-29z" fill="#a3c3a2" /><path d="M56 96h177v39H56z" fill="#c1dc82" /><path d="M69 108h30m93 0h25" stroke="#f7f5d7" strokeWidth="9" /><path d="M116 49v79m60-79v79" stroke="#173e34" strokeWidth="5" /><circle cx="90" cy="138" r="21" fill="#132e28" /><circle cx="90" cy="138" r="10" fill="#91a894" /><circle cx="207" cy="138" r="21" fill="#132e28" /><circle cx="207" cy="138" r="10" fill="#91a894" /><path d="m144 99-11 16h12l-3 12 15-20h-12z" fill="#28533f" /></svg></div><h2 className="vehicle-name">{vehicle.name}</h2><p className="vehicle-caption">{vehicle.licensePlate} · {vehicle.capacity} passenger seats</p><div className="availability-control"><div><b>{online ? 'You’re on the map' : 'You’re taking a break'}</b><small>{online ? 'Available for new matches' : 'Go online to receive rides'}</small></div><button className={`toggle ${online ? 'is-on' : ''}`} role="switch" aria-checked={online} aria-label="Available for rides" disabled={busy} onClick={() => void setStatus(online ? 'OFFLINE' : 'ONLINE')}><span /></button></div><p className="vehicle-hint">{pool ? 'Finish your active trip before going offline.' : 'You choose when your next journey begins.'}</p></> : <div className="empty">No vehicle is assigned to this account.</div>}</section>
    <section className="card pool-card"><div className="section-title spread"><div><span className="eyebrow">ON YOUR RADAR</span><h2>Current passenger pool</h2></div>{pool && <span className={`status status-${pool.status.toLowerCase()}`}>{label(pool.status)}</span>}</div>{!pool ? <div className="waiting-state"><div className={`radar ${online ? 'radar-active' : ''}`}><Icon name="ride" size={35} /></div><h3>{online ? 'Ready for your next passenger.' : 'A new journey is one switch away.'}</h3><p>{online ? 'You’re available. Compatible new requests will appear here automatically.' : 'Go online when you’re ready to welcome passengers aboard.'}</p><span className="small muted">Predefined Dhaka corridors · Up to {vehicle?.capacity ?? 3} seats</span></div> : <><div className="pool-heading"><p>{label(pool.corridor)}</p><b>{pool.occupiedSeats} of {pool.capacity} seats</b></div><SeatDisplay occupied={pool.occupiedSeats} capacity={pool.capacity} /><TripProgress status={tripStatus} /><div className="manifest">{pool.passengers.map((person) => <div key={person.rideRequestId} className="manifest-row"><span className="avatar">{person.passengerName[0]}</span><div><b>{person.passengerName}</b><small>{label(person.pickupZone)} → {label(person.dropoffZone)}</small></div><span className="passenger-seats">{person.seats} {person.seats === 1 ? 'seat' : 'seats'}<small>{label(person.status)}</small></span></div>)}</div><div className="actions">{pool.passengers.length > 0 && pool.passengers.every((p) => p.status === 'MATCHED') && <button className="primary full" disabled={busy} onClick={() => void advance('arrive')}>I’m at the pickup point<Icon name="pin" size={18} /></button>}{pool.passengers.length > 0 && pool.passengers.every((p) => p.status === 'DRIVER_ARRIVED') && <button className="primary full" disabled={busy} onClick={() => void advance('start')}>Everyone aboard? Start trip<Icon name="arrow" size={18} /></button>}{pool.status === 'IN_PROGRESS' && (confirmComplete ? <div className="confirm-inline"><p>Have all passengers reached their destination?</p><button className="secondary" disabled={busy} onClick={() => setConfirmComplete(false)}>Still driving</button><button className="primary" disabled={busy} onClick={() => void advance('complete')}>Yes, complete trip</button></div> : <button className="primary full" disabled={busy} onClick={() => setConfirmComplete(true)}>Complete this trip<Icon name="check" size={18} /></button>)}</div></>}</section></div>
    {pool?.passengers[0] && <section className="driver-map"><RouteMap from={pool.passengers[0].pickupZone} to={pool.passengers[0].dropoffZone} /><p className="muted small">First passenger’s corridor. Check each passenger’s drop-off in the manifest above.</p></section>}
    <section className="card history" id="history"><div className="section-title spread"><div><span className="eyebrow">JOURNEYS SHARED</span><h2>Trip history <span className="count-badge">{history.length}</span></h2></div><Icon name="history" /></div>{history.length === 0 ? <div className="empty">Your completed journeys will live here. Let’s make the first one happen.</div> : <div className="ride-list">{history.map((trip) => <details key={trip.poolId} className="history-details"><summary><span className="history-icon"><Icon name="ride" /></span><span className="ride-route"><b>{label(trip.corridor)}</b><small>{new Date(trip.completedAt ?? trip.createdAt).toLocaleString()}</small></span><span className={`status status-${trip.status.toLowerCase()}`}>{label(trip.status)}</span><b>{trip.occupiedSeats} seats</b><span className="expand-indicator">+</span></summary><div className="history-passengers">{trip.passengers.length ? trip.passengers.map((person, i) => <p key={i}><b>{person.name}</b><span>{label(person.pickupZone)} → {label(person.dropoffZone)}</span></p>) : <p>No passengers in this pool.</p>}</div></details>)}</div>}</section>
  </Dashboard>;
}
