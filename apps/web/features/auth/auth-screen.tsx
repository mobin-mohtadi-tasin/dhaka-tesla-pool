'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { User } from '@/types/api';
import { Brand, Icon, RouteMap } from '../../components/ui';

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'PASSENGER' | 'DRIVER'>('PASSENGER');
  const [phoneNumber, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setName] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [destination, setDestination] = useState('MOHAKHALI');
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

  return <div className="landing-page"><header className="landing-nav"><Brand /><a className="nav-about" href="#how-it-works">How it works <Icon name="arrow" size={16} /></a><span className="location-pill"><Icon name="pin" size={15} /> Dhaka, Bangladesh</span></header>
    <main className="landing"><section className="intro"><span className="eyebrow"><i className="dot online" /> A LITTLE ELECTRIC. A LOT MORE TOGETHER.</span><h1>Your city.<br />Your people.<br /><em>Your next ride.</em></h1><p>Skip the solo fare. Find a seat in a local Tesla and share the everyday journey through Dhaka.</p><div className="landing-map"><RouteMap to={destination} /><div className="route-chips" aria-label="Preview a route from Banani"><span>From Banani to</span>{['MOHAKHALI', 'GULSHAN_1', 'GULSHAN_2'].map((zone) => <button key={zone} aria-pressed={zone === destination} className={zone === destination ? 'selected' : ''} onClick={() => setDestination(zone)}>{zone === 'MOHAKHALI' ? 'Mohakhali' : zone === 'GULSHAN_1' ? 'Gulshan 1' : 'Gulshan 2'}<Icon name="arrow" size={13} /></button>)}</div></div></section>
      <section className="auth-card card" id="join"><div className="auth-heading"><span className="mini-badge"><Icon name="ride" /></span><span className="eyebrow">LET’S GET YOU MOVING</span></div><div className="tabs" aria-label="Account access"><button disabled={busy} className={mode === 'login' ? 'active' : ''} aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>Sign in</button><button disabled={busy} className={mode === 'register' ? 'active' : ''} aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(''); }}>Create account</button></div><h2>{mode === 'login' ? 'Welcome aboard.' : 'A seat for everyone.'}</h2><p className="muted">{mode === 'login' ? 'Your next shared journey starts here.' : 'A few details and you’re ready to roll.'}</p>
        <form onSubmit={submit}>
          {mode === 'register' && <><div className="role-selector" role="group" aria-label="Account type"><button type="button" disabled={busy} aria-pressed={role === 'PASSENGER'} className={role === 'PASSENGER' ? 'selected' : ''} onClick={() => setRole('PASSENGER')}><Icon name="people" /> I’m a passenger</button><button type="button" disabled={busy} aria-pressed={role === 'DRIVER'} className={role === 'DRIVER' ? 'selected' : ''} onClick={() => setRole('DRIVER')}><Icon name="ride" /> I’m a driver</button></div><label>Full name<input autoComplete="name" value={fullName} onChange={(event) => setName(event.target.value)} placeholder="Your full name" required disabled={busy} /></label></>}
          <label>Phone number<input type="tel" autoComplete="tel" value={phoneNumber} onChange={(event) => setPhone(event.target.value)} placeholder="+88017XXXXXXXX" required disabled={busy} /></label>
          <label>Password<span className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === 'register' ? 10 : undefined} placeholder={mode === 'register' ? 'At least 10 characters' : 'Enter your password'} required disabled={busy} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></span></label>
          {mode === 'register' && role === 'DRIVER' && <div className="vehicle-fields"><label>Vehicle name<input value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} placeholder="e.g. Bullet" required disabled={busy} /></label><label>License plate<input value={licensePlate} onChange={(event) => setLicensePlate(event.target.value)} required disabled={busy} /></label><small className="muted">Your Tesla has 3 passenger seats.</small></div>}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary full" disabled={busy}>{busy ? <><span className="spinner small-spinner" /> Getting ready…</> : <>{mode === 'login' ? 'Let’s go' : 'Create my account'}<Icon name="arrow" size={18} /></>}</button>
        </form><div className="auth-footnote"><Icon name="check" size={16} /> Clear fares. Your own account. A shared journey.</div><div className="auth-bottom"><span>LOCAL RIDES</span><span className="little-star">✳</span><span>BETTER TOGETHER</span></div>
      </section>
    </main><section className="how-it-works" id="how-it-works"><div><span className="eyebrow">LESS FUSS. MORE GO.</span><h2>Three steps to your next stop.</h2></div><article><span>01</span><h3>Pick your corridor</h3><p>Choose where you’re going and how many seats you need.</p></article><article><span>02</span><h3>Share the ride</h3><p>We match compatible journeys into a three-seat Tesla.</p></article><article><span>03</span><h3>Enjoy a lighter fare</h3><p>Share with another booking to receive a pooling discount.</p></article></section><footer className="landing-footer"><Brand /><span>Small rides. A more connected Dhaka.</span><span>Built for the everyday journey.</span></footer></div>;
}
