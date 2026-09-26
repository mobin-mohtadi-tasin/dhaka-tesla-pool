'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, label, Manifest, User } from '@/lib/api';

type Vehicle = { id: string; name: string; licensePlate: string; capacity: number; driverStatus: 'ONLINE' | 'OFFLINE'; isActive: boolean };

export default function DriverPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [pool, setPool] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const [vehicleData, poolData] = await Promise.all([api<Vehicle>('/vehicles/me'), api<{ pool: Manifest | null }>('/driver/rides')]);
    setVehicle(vehicleData); setPool(poolData.pool);
  }, []);

  useEffect(() => {
    api<{ user: User }>('/auth/me').then(async ({ user }) => {
      if (user.role !== 'DRIVER') { router.replace('/passenger'); return; }
      setUser(user); await refresh();
    }).catch(() => router.replace('/')).finally(() => setLoading(false));
  }, [refresh, router]);

  useEffect(() => { const timer = setInterval(() => { void refresh().catch(() => {}); }, 5000); return () => clearInterval(timer); }, [refresh]);

  async function setStatus(status: 'ONLINE' | 'OFFLINE') {
    setBusy(true); setError('');
    try { await api('/vehicles/status', { method: 'POST', body: JSON.stringify({ driverStatus: status }) }); await refresh(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function advance(action: 'arrive' | 'start' | 'complete') {
    if (!pool) return;
    setBusy(true); setError('');
    try { await api(`/driver/rides/${pool.poolId}/${action}`, { method: 'POST', body: '{}' }); await refresh(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function logout() { await api('/auth/logout', { method: 'POST' }); router.replace('/'); }
  if (loading) return <main className="shell"><p>Loading your vehicle…</p></main>;

  return <main className="shell"><header className="topbar"><div><span className="eyebrow">DHAKA TESLA POOL · DRIVER</span><h1>Ready to roll, {user?.fullName}?</h1><p className="muted">Manage your availability and current passenger pool.</p></div><button className="text-button" onClick={logout}>Sign out</button></header>
    {error && <p className="error banner" role="alert">{error}</p>}
    <div className="grid"><section className="card"><div className="section-title"><span className="step">01</span><h2>Your Tesla</h2></div>
      {vehicle ? <><div className="vehicle-name">{vehicle.name}</div><p className="muted">{vehicle.licensePlate} · {vehicle.capacity} passenger seats</p><div className="availability"><span className={`dot ${vehicle.driverStatus === 'ONLINE' ? 'online' : ''}`} />{vehicle.driverStatus === 'ONLINE' ? 'Online and available' : 'Offline'}</div><button className="secondary full" disabled={busy} onClick={() => setStatus(vehicle.driverStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE')}>{vehicle.driverStatus === 'ONLINE' ? 'Go offline' : 'Go online'}</button></> : <div className="empty">No vehicle is assigned to this account.</div>}
    </section><section className="card"><div className="section-title"><span className="step">02</span><h2>Current pool</h2></div>
      {!pool ? <div className="empty">No active pool yet. Go online to receive matching ride requests.</div> : <><div className="status-row"><span className="status">{label(pool.status)}</span><span>{pool.occupiedSeats}/{pool.capacity} seats</span></div><p className="muted">{label(pool.corridor)} · {pool.vehicleName}</p><h3>Passengers</h3><div className="manifest">{pool.passengers.map((person) => <div key={person.rideRequestId} className="manifest-row"><div><b>{person.passengerName}</b><small>{label(person.pickupZone)} → {label(person.dropoffZone)}</small></div><span>{person.seats} {person.seats === 1 ? 'seat' : 'seats'}<small>{label(person.status)}</small></span></div>)}</div>
        <div className="actions">{pool.passengers.length > 0 && pool.passengers.every((p) => p.status === 'MATCHED') && <button className="primary" disabled={busy} onClick={() => advance('arrive')}>Mark arrived</button>}{pool.passengers.length > 0 && pool.passengers.every((p) => p.status === 'DRIVER_ARRIVED') && <button className="primary" disabled={busy} onClick={() => advance('start')}>Start trip</button>}{pool.status === 'IN_PROGRESS' && <button className="primary" disabled={busy} onClick={() => advance('complete')}>Complete trip</button>}</div>
      </>}
    </section></div>
  </main>;
}
