import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Memora - Agent Memory & Skills Platform',
  description:
    'Agent Memory & Skills Platform - Foundation & Data Layer with self-improving Experience Logger, Skill Generator, Multi-Agent Swarm with Hermes Kanban Orchestrator, Local-First Ollama Hub, and Telegram/Discord/Slack gateways.',
  openGraph: {
    title: 'Memora - Agent Memory & Skills Platform',
    description:
      'Agent Memory & Skills Platform - Foundation & Data Layer with self-improving Experience Logger, Skill Generator, Multi-Agent Swarm with Hermes Kanban Orchestrator, Local-First Ollama Hub, and Telegram/Discord/Slack gateways.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Memora - Agent Memory & Skills Platform',
    description:
      'Agent Memory & Skills Platform - Foundation & Data Layer with self-improving Experience Logger, Skill Generator, Multi-Agent Swarm with Hermes Kanban Orchestrator, Local-First Ollama Hub, and Telegram/Discord/Slack gateways.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
