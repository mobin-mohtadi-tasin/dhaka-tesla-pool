'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, User } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'PASSENGER' | 'DRIVER'>('PASSENGER');
  const [phoneNumber, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setName] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ user: User }>('/auth/me').then(({ user }) => router.replace(user.role === 'DRIVER' ? '/driver' : '/passenger')).catch(() => {});
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const body = mode === 'login' ? { phoneNumber, password } : {
        phoneNumber, password, fullName, role,
        ...(role === 'DRIVER' ? { vehicle: { name: vehicleName, licensePlate, capacity: 3 } } : {}),
      };
      const { user } = await api<{ user: User }>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) });
      router.replace(user.role === 'DRIVER' ? '/driver' : '/passenger');
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  return <main className="landing">
    <section className="intro">
      <span className="eyebrow">DHAKA · SHARED JOURNEYS</span>
      <h1>A better ride through the city.</h1>
      <p>Request a seat, follow your trip, and see a clear fare. Drivers get one simple view of everyone riding.</p>
      <div className="journey"><span>BANANI</span><span className="route-line"/><span>MOHAKHALI / GULSHAN 1</span></div>
      <p className="aside">Built for three seat battery rickshaws and familiar Dhaka corridors.</p>
    </section>
    <section className="auth-card card">
      <div className="tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button><button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button></div>
      <h2>{mode === 'login' ? 'Welcome back' : 'Join the pool'}</h2>
      <p className="muted">{mode === 'login' ? 'Continue as a passenger or driver.' : 'A quick setup, then you’re ready to ride.'}</p>
      <form onSubmit={submit}>
        {mode === 'register' && <><label>Account type<select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="PASSENGER">Passenger</option><option value="DRIVER">Driver</option></select></label><label>Full name<input value={fullName} onChange={(event) => setName(event.target.value)} required /></label></>}
        <label>Phone number<input type="tel" value={phoneNumber} onChange={(event) => setPhone(event.target.value)} placeholder="+8801711000001" required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === 'register' ? 10 : undefined} required /></label>
        {mode === 'register' && role === 'DRIVER' && <><label>Vehicle name<input value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} required /></label><label>License plate<input value={licensePlate} onChange={(event) => setLicensePlate(event.target.value)} required /></label><p className="muted small">Driver vehicles have three passenger seats.</p></>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
    </section>
  </main>;
}
