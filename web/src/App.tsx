import { useState } from 'react';
import './App.css';

type Role = 'client' | 'admin';

export default function App() {
  const [role, setRole] = useState<Role>('client');

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo">⚡</span>
          <h1>MeterMate</h1>
          <span className="app-tagline">Billing Concierge</span>
        </div>
        <div className="role-switch">
          <button
            className={`role-btn${role === 'client' ? ' active' : ''}`}
            onClick={() => setRole('client')}
          >
            Client
          </button>
          <button
            className={`role-btn${role === 'admin' ? ' active' : ''}`}
            onClick={() => setRole('admin')}
          >
            Admin
          </button>
        </div>
      </header>

      <main className="app-main">
        {role === 'client' ? <ClientView /> : <AdminView />}
      </main>
    </div>
  );
}

function ClientView() {
  return (
    <div className="view-container">
      <div className="setup-banner">
        <h2>Client Portal</h2>
        <p>
          Use this portal to book sessions, manage your subscription, and track
          billing — all narrated live in your private Slack channel.
        </p>
        <p className="setup-note">
          Client forms (Book & Subscribe, Report Usage, Plan Change, Lifecycle
          Control) will appear here as each use case is implemented.
        </p>
      </div>
    </div>
  );
}

function AdminView() {
  return (
    <div className="view-container">
      <div className="setup-banner">
        <h2>Admin Panel</h2>
        <p>
          Issue invoices, trigger billing digests, and view all active
          transactions across consultants.
        </p>
        <p className="setup-note">
          Admin forms (Invoice Issue, Activity Digest) will appear here as each
          use case is implemented.
        </p>
      </div>
    </div>
  );
}
