import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Memora - Auditable Memory & Context Control for AI Agents',
  description:
    'An auditable memory and context-control layer for AI agents. Remember the right thing. Prove why it was recalled. Forget it on command.',
  openGraph: {
    title: 'Memora - Auditable Memory & Context Control for AI Agents',
    description:
      'An auditable memory and context-control layer for AI agents. Remember the right thing. Prove why it was recalled. Forget it on command.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Memora - Auditable Memory & Context Control for AI Agents',
    description:
      'An auditable memory and context-control layer for AI agents. Remember the right thing. Prove why it was recalled. Forget it on command.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
