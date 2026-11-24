'use client';

import React, { useState } from 'react';
import { StoreProvider } from '@/components/app/Store';
import { PromptProvider } from '@/components/app/shared/PromptDialog';
import { AlumniProfileModal } from '@/components/app/alumni/AlumniProfileModal';
import { AlumniCard } from '@/components/app/alumni/AlumniCard';
import type { AppState, MemberProfile, AlumniSummary } from '@fecpc/contracts';
import '../app/app.css';
import '../app/alumni-cards.css';

const mockProfile = {
  id: 'alumni-1',
  name: 'Shahriar Kabir',
  email: 'shahriar@northwind.io',
  role: 'Software Engineer',
  batch: 16,
  dept: 'CSE',
  location: 'Dhaka',
  bio: 'Software Engineer at a Dhaka fintech working on payment ledgers and distributed queues. Former FECPC President and two-time ICPC Dhaka Regionalist.',
  skills: ['CP', 'Systems', 'Graphs'],
  cf_handle: 'shahriar_k',
  github_url: 'https://github.com',
  linkedin_url: 'https://linkedin.com',
  available_for_questions: true,
  rating: 2104,
  cf_rating: 2104,
  problems_solved: 2010,
  current_streak: 0,
  contests_participated: 64,
  experience: [
    {
      period: '2016–PRESENT',
      role: 'Software Engineer · Northwind Labs · Tech Company',
      summary: 'Working on distributed backend services and infrastructure.',
    },
    {
      period: '2016',
      role: 'Graduated · Batch 16',
      summary: 'Department of CSE.',
    },
    {
      period: '2012–2016',
      role: 'FECPC Member',
      summary: 'Active contest competitor in competitive programming.',
    },
  ],
  jobs_posted: [
    {
      id: 1,
      company: 'Lumen Studio',
      title: 'Product Designer',
      role: 'Product Designer',
      location: 'Dhaka',
      source: 'fetched',
      url: '#',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      company: 'Northwind Labs',
      title: 'Frontend Engineer',
      role: 'Frontend Engineer',
      location: 'Dhaka · Hybrid',
      source: 'manual',
      url: '#',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 3,
      company: 'Brightpath Systems',
      title: 'Backend Engineer (Go)',
      role: 'Backend Engineer (Go)',
      location: 'Singapore',
      source: 'fetched',
      url: '#',
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
} as unknown as MemberProfile;

const mockSummary = {
  id: 'alumni-1',
  name: 'Shahriar Kabir',
  batch: 16,
  role: 'Software Engineer · Northwind Labs',
  dept: 'CSE',
  location: 'Dhaka · Hybrid',
  skills: ['CP', 'Systems', 'Graphs'],
  available_for_questions: true,
  saved: false,
} as unknown as AlumniSummary;

const mockAppState: AppState = {
  me: {
    id: 'alumni-1',
    name: 'Shahriar Kabir',
    handle: 'shahriar_k',
    batch: 16,
    avatar: null,
    xp: 2500,
  },
  s: {
    roles: ['alumni.toggleQuestions', 'alumni.job.fetch'],
    spent: 0,
    earned: 2500,
    base: { solved: 0, done: 0 },
    solved: [],
    verified: [],
    done: [],
    lessons: [],
    quiz: {},
    present: [],
    checkin: false,
    kudos: [],
    reg: [],
    pay: {},
    votes: {},
    read: [],
    posts: 0,
  } as any,
  counts: {
    alumniCount: 42,
    jobsCount: 4,
    blogsCount: 12,
  },
  members: [],
} as any;

export default function TestAlumniPage() {
  const [modalOpen, setModalOpen] = useState(true);
  const [themeDark, setThemeDark] = useState(false);

  const toggleTheme = () => {
    setThemeDark((prev) => !prev);
  };

  return (
    <StoreProvider initial={mockAppState}>
      <PromptProvider>
        <div
          className={themeDark ? 't-d' : 't-b'}
          style={{ minHeight: '100vh', padding: '40px 20px', background: 'var(--bg)' }}
        >
          {/* Controls */}
          <div
            className="controls"
            style={{
              position: 'fixed',
              top: 16,
              right: 16,
              zIndex: 1000,
              display: 'flex',
              gap: 10,
            }}
          >
            <button
              id="test-toggle-modal"
              className="ctl"
              type="button"
              onClick={() => setModalOpen((prev) => !prev)}
            >
              [ {modalOpen ? 'Hide Modal' : 'Open Modal'} ]
            </button>
            <button id="test-theme" className="ctl" type="button" onClick={toggleTheme}>
              [ {themeDark ? 'Light' : 'Dark'} ]
            </button>
          </div>

          {/* Grid with AlumniCard */}
          <div style={{ maxWidth: 1200, margin: '0 auto', marginBottom: 40 }}>
            <h2
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 18,
                marginBottom: 16,
                color: 'var(--hi)',
              }}
            >
              Alumni Mini Card (Grid Item)
            </h2>
            <div style={{ width: 400 }}>
              <AlumniCard alumnus={mockSummary} onOpenProfile={() => setModalOpen(true)} />
            </div>
          </div>

          {/* Profile Modal */}
          {modalOpen && (
            <AlumniProfileModal
              userId="alumni-1"
              initialProfile={mockProfile}
              onClose={() => setModalOpen(false)}
            />
          )}
        </div>
      </PromptProvider>
    </StoreProvider>
  );
}
