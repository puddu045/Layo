import type { Metadata } from 'next';
import { BRAND } from '@layo/config';
import './globals.css';

export const metadata: Metadata = {
  title: `${BRAND.name} Admin`,
  description: `Admin and business portal for ${BRAND.name}`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-slate-900 antialiased">{children}</body>
    </html>
  );
}
