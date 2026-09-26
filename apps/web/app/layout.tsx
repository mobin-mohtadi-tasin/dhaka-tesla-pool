import './globals.css';

export const metadata = { title: 'Dhaka Tesla Pool', description: 'Share a seat. Split the fare.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
