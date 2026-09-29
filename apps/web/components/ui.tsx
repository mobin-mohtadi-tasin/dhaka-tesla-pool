'use client';

import { ReactNode } from 'react';
import Link from 'next/link';

export function Icon({ name, size = 20 }: { name: 'arrow' | 'pin' | 'ride' | 'history' | 'logout' | 'check' | 'people' | 'bolt' | 'refresh'; size?: number }) {
  const paths = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    ride: <><path d="m4 10 2-6h12l2 6M3 10h18v8H3zM5 18v3m14-3v3M7 14h.01M17 14h.01" /></>,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" /></>,
    logout: <><path d="M9 4H4v16h5m5-13 5 5-5 5M8 12h11" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" /></>,
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-8z" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function Brand() {
  return <Link href="/" className="brand" aria-label="Dhaka Tesla Pool home"><span className="brand-icon"><Icon name="bolt" size={23} /></span><span>tesla<span className="brand-light">pool</span><small>DHAKA, TOGETHER</small></span></Link>;
}

export function Dashboard({ name, role, logout, children }: { name?: string; role: 'Passenger' | 'Driver'; logout: () => void; children: ReactNode }) {
  return <div className="app-frame"><aside className="sidebar"><Brand /><div className="workspace-label">YOUR WORKSPACE</div><nav aria-label="Main navigation"><a className="nav-link current" href="#dashboard"><Icon name="ride" />{role === 'Driver' ? 'Driver dashboard' : 'Book a ride'}</a><a className="nav-link" href="#history"><Icon name="history" />Trip history</a></nav><div className="sidebar-note"><span className="sunburst">✳</span><h3>One city.<br />A little more together.</h3><p>Share the journey.<br />Make room for someone.</p><span className="city-tag">23.8103° N · DHAKA</span></div><div className="profile"><span className="avatar">{name?.slice(0, 1).toUpperCase() || 'T'}</span><div><b>{name || 'Welcome'}</b><small>{role} account</small></div><button className="icon-button" onClick={logout} aria-label="Sign out"><Icon name="logout" size={18} /></button></div></aside><main className="dashboard" id="dashboard">{children}<footer className="dashboard-footer"><span>Made for the way Dhaka moves.</span><span>Electric rides. Shared possibilities.</span></footer></main></div>;
}

export { RouteMap } from '../features/map/components/route-map';

export function SeatDisplay({ capacity, occupied }: { capacity: number; occupied: number }) {
  return <div className="seat-display" aria-label={`${occupied} of ${capacity} seats occupied`}>{Array.from({ length: capacity }, (_, i) => <span key={i} className={`seat-icon ${i < occupied ? 'occupied' : ''}`}><Icon name="people" size={19} /><small>{i < occupied ? 'Taken' : 'Open'}</small></span>)}</div>;
}

export function TripProgress({ status }: { status: string }) {
  const stages = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED'];
  const names = ['Requested', 'Matched', 'Arrived', 'On the way', 'Complete'];
  const current = stages.indexOf(status);
  if (status === 'CANCELLED') return <p className="notice">This ride was cancelled before pickup. No charge.</p>;
  return <ol className="trip-progress" aria-label="Trip progress">{stages.map((stage, i) => <li key={stage} className={i <= current ? 'reached' : ''} aria-current={i === current ? 'step' : undefined}><span>{i < current ? <Icon name="check" size={13} /> : i + 1}</span><small>{names[i]}</small></li>)}</ol>;
}

export function LoadingScreen() { return <main className="loading-screen"><Brand /><span className="spinner" /><p>Getting your journey ready…</p></main>; }
