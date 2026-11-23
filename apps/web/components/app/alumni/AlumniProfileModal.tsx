'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { canFully } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import type { MemberProfile, AlumniJob } from '@fecpc/contracts';
import { useConfirm } from '@/components/app/shared/PromptDialog';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Pixel avatar 7x7 grid matching alumni-card (1).html
const PIXEL_GRID = ['..###..', '..###..', '#######', '.#####.', '...#...', '..#.#..', '..#.#..'];

const PIXEL_RECTS: { x: number; y: number; p: number }[] = [];
let pixelP = 0;
PIXEL_GRID.forEach((row, y) => {
  row.split('').forEach((c, x) => {
    if (c === '#') {
      PIXEL_RECTS.push({ x, y, p: pixelP++ });
    }
  });
});

export function AlumniProfileModal({
  userId,
  initialProfile,
  onClose,
  onMutated,
}: {
  userId: string;
  initialProfile?: MemberProfile;
  onClose: () => void;
  onMutated?: () => void;
}) {
  const sure = useConfirm();
  const { me, s, toast: storeToast } = useStore();
  const [profile, setProfile] = useState<MemberProfile | null>(initialProfile ?? null);
  const [loading, setLoading] = useState(!initialProfile);
  const [error, setError] = useState('');

  const [available, setAvailable] = useState(
    initialProfile ? Boolean(initialProfile.available_for_questions) : false,
  );
  const [togglingAvailable, setTogglingAvailable] = useState(false);
  const [jobsPosted, setJobsPosted] = useState<AlumniJob[]>(initialProfile?.jobs_posted ?? []);
  const [kudosCount, setKudosCount] = useState(12);
  const [hasGivenKudos, setHasGivenKudos] = useState(false);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'about' | 'career' | 'jobs'>('about');

  // Stats displays (for count-up animation)
  const [ratingDisplay, setRatingDisplay] = useState(0);
  const [solvedDisplay, setSolvedDisplay] = useState(0);
  const [streakDisplay, setStreakDisplay] = useState(0);
  const [contestsDisplay, setContestsDisplay] = useState(0);

  // Chart state
  const [chartMetric, setChartMetric] = useState<'rating' | 'solved'>('rating');
  const [bigValueDisplay, setBigValueDisplay] = useState(0);
  const [deltaDisplay, setDeltaDisplay] = useState('');
  const [chartLabel, setChartLabel] = useState('Peak rating');
  const [hoveredPoint, setHoveredPoint] = useState<{
    index: number;
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [interpolatedVals, setInterpolatedVals] = useState<number[]>([]);
  const [chartMinMax, setChartMinMax] = useState<{ min: number; max: number }>({
    min: 1200,
    max: 2200,
  });
  const [isTw, setIsTw] = useState(false);

  // Toast state
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs
  const modalRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const wmRef = useRef<HTMLDivElement>(null);
  const kcRef = useRef<HTMLSpanElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const aboutTabBtnRef = useRef<HTMLButtonElement>(null);
  const careerTabBtnRef = useRef<HTMLButtonElement>(null);
  const jobsTabBtnRef = useRef<HTMLButtonElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRafRef = useRef<number>(0);
  const bigRafRef = useRef<number>(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastText(null);
    }, 1800);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const profRes = await fetch('/api/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'getMemberProfile', userId }),
      });

      if (!profRes.ok) {
        const j = await profRes.json().catch(() => ({}));
        setError(j.error ?? 'Could not load alumni profile.');
        return;
      }

      const prof = (await profRes.json()) as MemberProfile;
      setProfile(prof);
      setAvailable(Boolean(prof.available_for_questions));
      setJobsPosted(prof.jobs_posted ?? []);
    } catch {
      setError('Network error while loading alumni profile.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!initialProfile) {
      loadData();
    }
  }, [loadData, initialProfile]);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Trap focus + Escape key
  useEffect(() => {
    modalRef.current?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      // A confirm dialog (e.g. Delete job) is rendered outside this modal. Let it own the keyboard.
      if (document.querySelector('[data-prompt]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;

      // getClientRects() also keeps position:fixed controls (Replay / Close) in the trap,
      // while still skipping buttons inside display:none panels.
      const nodes = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (
          !active ||
          active === first ||
          active === modalRef.current ||
          !modalRef.current.contains(active)
        ) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !modalRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [loading, profile]);

  // Derived profile variables
  const batchNumber = profile?.batch ?? 16;
  const batchStr = String(batchNumber).slice(-2);
  const batchYear = profile?.batch != null ? 2000 + Number(batchStr) : 2016;
  const joinedYear = batchYear - 4;
  const gradYear = batchYear;
  const dept = profile?.dept || 'CSE';

  // `role` is the member's job title; older records may store "Title · Company".
  const roleParts = (profile?.role || '')
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);
  const roleTitle = roleParts[0] || 'Software Engineer';
  const company = roleParts[1] || `Dept. of ${dept}`;
  const location = profile?.location || 'Dhaka';

  const peakRating = profile?.cf_rating ?? profile?.rating ?? 0;
  const totalSolved = profile?.problems_solved ?? 0;
  const currentStreak = profile?.current_streak ?? 0;
  const contestsCount = profile?.contests_participated ?? 0;

  const skills =
    profile?.skills && profile.skills.length > 0 ? profile.skills : ['CP', 'Systems', 'Graphs'];

  const isOwner = me.id === userId;
  const canAdmin = canFully(s.roles, 'alumni.job.fetch');
  const canToggle = isOwner || canFully(s.roles, 'alumni.toggleQuestions');

  // Chart datasets
  const yrs = [joinedYear, joinedYear + 1, joinedYear + 2, joinedYear + 3, gradYear];
  const DS = React.useMemo(() => {
    const rVals = [
      Math.round(peakRating * 0.65),
      Math.round(peakRating * 0.77),
      Math.round(peakRating * 0.85),
      Math.round(peakRating * 0.93),
      peakRating,
    ];
    const sVals = [
      Math.round(totalSolved * 0.07),
      Math.round(totalSolved * 0.31),
      Math.round(totalSolved * 0.55),
      Math.round(totalSolved * 0.78),
      totalSolved,
    ];
    return {
      rating: {
        vals: rVals,
        min: Math.max(0, Math.floor((Math.min(...rVals) - 180) / 100) * 100),
        max: Math.ceil((peakRating + 100) / 100) * 100,
        label: 'Peak rating',
        tip: '',
      },
      solved: {
        vals: sVals,
        min: 0,
        max: Math.ceil((totalSolved + 100) / 100) * 100,
        label: 'Problems solved',
        tip: ' solved',
      },
    };
  }, [peakRating, totalSolved]);

  // Tab ink animation
  const moveInk = useCallback((tabKey: 'about' | 'career' | 'jobs') => {
    let targetBtn: HTMLButtonElement | null = null;
    if (tabKey === 'about') targetBtn = aboutTabBtnRef.current;
    else if (tabKey === 'career') targetBtn = careerTabBtnRef.current;
    else if (tabKey === 'jobs') targetBtn = jobsTabBtnRef.current;

    if (targetBtn && inkRef.current) {
      inkRef.current.style.setProperty('--x', `${targetBtn.offsetLeft}px`);
      inkRef.current.style.setProperty('--w', `${targetBtn.offsetWidth}px`);
    }
  }, []);

  const handleTabClick = (tabKey: 'about' | 'career' | 'jobs') => {
    setActiveTab(tabKey);
    moveInk(tabKey);
  };

  useEffect(() => {
    if (!loading && profile) {
      moveInk(activeTab);
      const raf = requestAnimationFrame(() => moveInk(activeTab));
      document.fonts?.ready?.then(() => moveInk(activeTab));
      const onResize = () => moveInk(activeTab);
      window.addEventListener('resize', onResize);
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
      };
    }
  }, [loading, profile, activeTab, moveInk]);

  // Count-up animations for stats
  const countUp = useCallback(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      setRatingDisplay(peakRating);
      setSolvedDisplay(totalSolved);
      setStreakDisplay(currentStreak);
      setContestsDisplay(contestsCount);
      return;
    }

    const items = [
      { to: peakRating, set: setRatingDisplay, delay: 700 },
      { to: totalSolved, set: setSolvedDisplay, delay: 790 },
      { to: currentStreak, set: setStreakDisplay, delay: 880 },
      { to: contestsCount, set: setContestsDisplay, delay: 970 },
    ];

    items.forEach(({ to, set, delay }) => {
      if (to === 0) {
        set(0);
        return;
      }
      const dur = 1300;
      const t0 = performance.now() + delay;
      set(0);
      const tick = (now: number) => {
        const t = Math.min(Math.max((now - t0) / dur, 0), 1);
        const e = 1 - Math.pow(1 - t, 4);
        set(Math.round(to * e));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, [peakRating, totalSolved, currentStreak, contestsCount]);

  // Big number animate
  const animateBig = useCallback((from: number, to: number, dur: number, delay: number) => {
    cancelAnimationFrame(bigRafRef.current);
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || dur === 0) {
      setBigValueDisplay(Math.round(to));
      return;
    }

    const t0 = performance.now() + delay;
    setBigValueDisplay(Math.round(from));
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - t0) / dur, 0), 1);
      const e = 1 - Math.pow(1 - t, 4);
      setBigValueDisplay(Math.round(from + (to - from) * e));
      if (t < 1) bigRafRef.current = requestAnimationFrame(tick);
    };
    bigRafRef.current = requestAnimationFrame(tick);
  }, []);

  // Set metric with smooth interpolation
  const setMetric = useCallback(
    (m: 'rating' | 'solved') => {
      if (m === chartMetric) return;
      setChartMetric(m);
      setIsTw(true);

      const targetDS = DS[m];
      const prevVals = [...interpolatedVals];
      const prevMin = chartMinMax.min;
      const prevMax = chartMinMax.max;

      const dl = targetDS.vals[4] - targetDS.vals[3];
      setDeltaDisplay(`▲ +${dl} vs ${yrs[3]}`);
      setChartLabel(targetDS.label);

      const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduce) {
        setInterpolatedVals(targetDS.vals.slice());
        setChartMinMax({ min: targetDS.min, max: targetDS.max });
        animateBig(0, targetDS.vals[4], 0, 0);
        return;
      }

      animateBig(bigValueDisplay, targetDS.vals[4], 700, 0);
      cancelAnimationFrame(chartRafRef.current);
      const t0 = performance.now();

      const f = (now: number) => {
        const t = Math.min((now - t0) / 700, 1);
        const e = 1 - Math.pow(1 - t, 3);
        const nextVals = prevVals.map((v, i) => v + (targetDS.vals[i] - v) * e);
        const nextMin = prevMin + (targetDS.min - prevMin) * e;
        const nextMax = prevMax + (targetDS.max - prevMax) * e;

        setInterpolatedVals(nextVals);
        setChartMinMax({ min: nextMin, max: nextMax });

        if (t < 1) {
          chartRafRef.current = requestAnimationFrame(f);
        }
      };
      chartRafRef.current = requestAnimationFrame(f);
    },
    [chartMetric, DS, interpolatedVals, chartMinMax, yrs, bigValueDisplay, animateBig],
  );

  // Initialize and play card entrance
  const play = useCallback(() => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    card.classList.remove('go', 'enter');
    void card.offsetWidth;
    card.classList.add('enter');

    // Reset chart
    setChartMetric('rating');
    setIsTw(false);
    setInterpolatedVals(DS.rating.vals.slice());
    setChartMinMax({ min: DS.rating.min, max: DS.rating.max });
    const dl = DS.rating.vals[4] - DS.rating.vals[3];
    setDeltaDisplay(`▲ +${dl} vs ${yrs[3]}`);
    setChartLabel(DS.rating.label);

    requestAnimationFrame(() => {
      card.classList.add('go');
      countUp();
      animateBig(0, DS.rating.vals[4], 1300, 900);
      moveInk(activeTab);
    });
  }, [DS, yrs, countUp, animateBig, activeTab, moveInk]);

  useEffect(() => {
    if (!loading && profile) {
      play();
    }
  }, [loading, profile]);

  // Watermark parallax
  const handleHeroPointerMove = (
    e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
  ) => {
    if (!heroRef.current || !wmRef.current) return;
    const r = heroRef.current.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width - 0.5) * -24;
    const my = ((e.clientY - r.top) / r.height - 0.5) * -16;
    wmRef.current.style.setProperty('--mx', `${mx}px`);
    wmRef.current.style.setProperty('--my', `${my}px`);
  };

  const handleHeroPointerLeave = () => {
    if (!wmRef.current) return;
    wmRef.current.style.setProperty('--mx', '0px');
    wmRef.current.style.setProperty('--my', '0px');
  };

  // Chart pointer interactions
  const SW = 300;
  const SH = 165;
  const PL = 36;
  const PR = 12;
  const PT = 22;
  const PB = 26;

  const cx = useCallback((i: number) => PL + (i * (SW - PL - PR)) / (yrs.length - 1), [yrs.length]);
  const cy = useCallback((v: number, min: number, max: number) => {
    if (max <= min) return SH - PB;
    return SH - PB - ((v - min) / (max - min)) * (SH - PT - PB);
  }, []);

  const handleChartPointerMove = (
    e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>,
  ) => {
    if (!chartContainerRef.current || interpolatedVals.length === 0) return;
    const r = chartContainerRef.current.getBoundingClientRect();
    const xSvg = ((e.clientX - r.left) / r.width) * SW;

    let best = 0;
    let bd = 1e9;
    yrs.forEach((_, i) => {
      const d = Math.abs(cx(i) - xSvg);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });

    const ptX = cx(best);
    const ptY = cy(interpolatedVals[best], chartMinMax.min, chartMinMax.max);
    const textVal = Math.round(interpolatedVals[best]);
    const tipText = `${yrs[best]} · ${textVal}${DS[chartMetric].tip}`;

    setHoveredPoint({
      index: best,
      x: ptX,
      y: ptY,
      text: tipText,
    });
  };

  const handleChartPointerLeave = () => {
    setHoveredPoint(null);
  };

  // Kudos burst particles
  const handleKudosClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const nextGiven = !hasGivenKudos;
    setHasGivenKudos(nextGiven);
    const nextCount = nextGiven ? kudosCount + 1 : kudosCount - 1;
    setKudosCount(nextCount);

    showToast(nextGiven ? 'Kudos sent' : 'Kudos removed');

    // Pop counter
    if (kcRef.current) {
      kcRef.current.classList.add('pop');
      setTimeout(() => kcRef.current?.classList.remove('pop'), 200);
    }

    // Spawn 14 burst particles
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (nextGiven && !reduce) {
      const r = e.currentTarget.getBoundingClientRect();
      const pX = r.left + r.width / 2;
      const pY = r.top + r.height / 2;
      // The sparks are appended to <body>, outside the themed .main, so copy the
      // modal accent onto each one or `background: var(--acc)` resolves to nothing.
      const accent =
        getComputedStyle(e.currentTarget).getPropertyValue('--acc').trim() || '#ff5a1f';

      for (let i = 0; i < 14; i++) {
        const s = document.createElement('i');
        s.className = 'alumni-spark';
        const a = (Math.PI * 2 * i) / 14;
        const dist = 50 + Math.random() * 50;
        s.style.left = `${pX}px`;
        s.style.top = `${pY}px`;
        s.style.setProperty('--acc', accent);
        s.style.setProperty('--dx', `${Math.cos(a) * dist}px`);
        s.style.setProperty('--dy', `${Math.sin(a) * dist}px`);
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 750);
      }
    }
  };

  // Share
  const handleShareClick = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast('Link copied');
      } else {
        showToast('Copy not available');
      }
    } catch {
      showToast('Copy not available');
    }
  };

  // Toggle availability
  const handleToggleAvailable = async () => {
    if (!canToggle || togglingAvailable) return;

    const next = !available;
    setAvailable(next);
    setTogglingAvailable(true);

    try {
      const res = await fetch('/api/alumni', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'setAvailableForQuestions',
          available: next,
          alumniId: userId,
        }),
      });
      if (!res.ok) {
        setAvailable(!next); // revert
      } else {
        onMutated?.();
        showToast(next ? 'Marked available' : 'Marked unavailable');
      }
    } catch {
      setAvailable(!next);
    } finally {
      setTogglingAvailable(false);
    }
  };

  // Delete job
  const handleDeleteJob = async (jobId: number) => {
    if (!(await sure('Are you sure you want to delete this job posting?'))) return;

    const rowEl = document.getElementById(`job-row-${jobId}`);
    if (rowEl) rowEl.classList.add('removing');

    setTimeout(async () => {
      try {
        const res = await fetch('/api/alumni', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'deleteAlumniJob', jobId }),
        });
        if (res.ok) {
          setJobsPosted((prev) => prev.filter((j) => j.id !== jobId));
          showToast('Job removed');
          onMutated?.();
        } else {
          rowEl?.classList.remove('removing');
          storeToast('Could not delete job.', 'bad');
        }
      } catch {
        rowEl?.classList.remove('removing');
        storeToast('Network error deleting job.', 'bad');
      }
    }, 350);
  };

  // Chart geometry is derived state, so it must be computed before any early return:
  // hooks below the loading/error returns would change the hook order on the first
  // successful load and crash React ("Rendered more hooks than during the previous render").
  const curVals = interpolatedVals.length === 5 ? interpolatedVals : DS.rating.vals;
  const pts = curVals.map((v, i) => [cx(i), cy(v, chartMinMax.min, chartMinMax.max)]);
  const lineD = pts
    .map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1))
    .join(' ');
  const areaD =
    lineD +
    ' L' +
    pts[4][0].toFixed(1) +
    ' ' +
    (SH - PB) +
    ' L' +
    pts[0][0].toFixed(1) +
    ' ' +
    (SH - PB) +
    ' Z';

  // The line is a chain of straight segments, so its length is known during render.
  // Using the real value up front keeps the dash reveal from starting with a wrong fallback.
  const dashLen =
    Math.ceil(
      pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0),
    ) + 4;

  // Grid lines
  const gridLines = [0, 1, 2, 3].map((k) => {
    const v = chartMinMax.min + ((chartMinMax.max - chartMinMax.min) * k) / 3;
    const y = cy(v, chartMinMax.min, chartMinMax.max);
    return { y, val: Math.round(v / 10) * 10 };
  });

  if (loading) {
    return (
      <div className="alumni-modal-overlay" role="presentation">
        <div
          className="alumni-modal"
          style={{
            background: 'var(--panel)',
            border: '2px solid var(--line2)',
            padding: '32px 48px',
            fontFamily: 'var(--mono)',
            fontWeight: 700,
            textTransform: 'uppercase',
            fontSize: 13,
            boxShadow: 'var(--shadow-hard)',
          }}
        >
          Loading alumni profile…
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div
        className="alumni-modal-overlay"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="alumni-modal"
          style={{
            background: 'var(--panel)',
            border: '2px solid var(--line2)',
            padding: 32,
            maxWidth: 440,
            textAlign: 'center',
            boxShadow: 'var(--shadow-hard)',
          }}
        >
          <p
            style={{
              color: 'var(--acc)',
              marginBottom: 16,
              fontFamily: 'var(--mono)',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {error || 'Alumni profile not found.'}
          </p>
          <p
            style={{
              color: 'var(--dim)',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Press Esc or click outside to close.
          </p>
        </div>
      </div>
    );
  }

  // Calculate stat bar widths
  const ratingWidth = Math.min(1, Math.max(0.05, peakRating / 2400));
  const solvedWidth = Math.min(1, Math.max(0.05, totalSolved / 2400));
  const streakWidth = Math.min(1, Math.max(0.03, currentStreak / 100));
  const contestsWidth = Math.min(1, Math.max(0.05, contestsCount / 100));

  return (
    <div
      className="alumni-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="alumni-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${profile.name} alumni profile`}
        tabIndex={-1}
        style={{ width: '100%', maxWidth: 960, position: 'relative', outline: 'none' }}
      >
        {/* Card Component */}
        <article ref={cardRef} className="card alumni-card-full enter" id="card">
          {/* HERO */}
          <header
            ref={heroRef}
            className="hero"
            id="hero"
            onPointerMove={handleHeroPointerMove}
            onMouseMove={handleHeroPointerMove}
            onPointerLeave={handleHeroPointerLeave}
            onMouseLeave={handleHeroPointerLeave}
          >
            <div className="hero-grid"></div>
            <div ref={wmRef} className="watermark" id="wm" data-t={batchStr}>
              {batchStr}
            </div>

            <div className="hero-top">
              <div
                className="avatar"
                data-r
                style={{ '--i': 0 } as React.CSSProperties}
                title="Hover me"
              >
                <svg viewBox="0 0 7 7" id="px">
                  {PIXEL_RECTS.map((r) => (
                    <rect
                      key={`${r.x}-${r.y}`}
                      x={r.x}
                      y={r.y}
                      width="1"
                      height="1"
                      style={{ '--p': r.p } as React.CSSProperties}
                    />
                  ))}
                </svg>
                <span className="live"></span>
              </div>
              <div>
                <div className="badge" data-r style={{ '--i': 1 } as React.CSSProperties}>
                  Alumni · Class of {batchYear}
                </div>
                <h1 className="name" id="name" aria-label={profile.name}>
                  {profile.name.split('').map((ch, i) => (
                    <span key={i} style={{ '--c': i } as React.CSSProperties} aria-hidden="true">
                      {ch === ' ' ? '\u00A0' : ch}
                    </span>
                  ))}
                </h1>
                <div className="role" data-r style={{ '--i': 4 } as React.CSSProperties}>
                  {roleTitle} · {company}
                  <small>
                    {location} · {dept}
                  </small>
                </div>
              </div>
            </div>

            <div className="timeline" data-r style={{ '--i': 5 } as React.CSSProperties}>
              <div className="tl">
                <i></i>
                <b>[{joinedYear}]</b>
                <span>Joined the club</span>
              </div>
              <div className="tl">
                <i></i>
                <b>[{gradYear}]</b>
                <span>Graduated</span>
              </div>
              <div className="tl now">
                <i></i>
                <b>NOW</b>
                <span>
                  {roleTitle} · {company}
                </span>
              </div>
            </div>
          </header>

          {/* STATS */}
          <section className="stats">
            <div className="stat" data-r style={{ '--i': 6 } as React.CSSProperties}>
              <div className="stat-val">{ratingDisplay}</div>
              <div className="stat-label">Rating</div>
              <div
                className="stat-bar"
                style={{ '--w': ratingWidth, '--i': 0 } as React.CSSProperties}
              ></div>
            </div>
            <div className="stat" data-r style={{ '--i': 7 } as React.CSSProperties}>
              <div className="stat-val">{solvedDisplay}</div>
              <div className="stat-label">Solved</div>
              <div
                className="stat-bar"
                style={{ '--w': solvedWidth, '--i': 1 } as React.CSSProperties}
              ></div>
            </div>
            <div className="stat" data-r style={{ '--i': 8 } as React.CSSProperties}>
              <div className="stat-val">{streakDisplay}d</div>
              <div className="stat-label">Streak</div>
              <div
                className="stat-bar"
                style={{ '--w': streakWidth, '--i': 2 } as React.CSSProperties}
              ></div>
            </div>
            <div className="stat" data-r style={{ '--i': 9 } as React.CSSProperties}>
              <div className="stat-val">{contestsDisplay}</div>
              <div className="stat-label">Contests</div>
              <div
                className="stat-bar"
                style={{ '--w': contestsWidth, '--i': 3 } as React.CSSProperties}
              ></div>
            </div>
          </section>

          {/* BODY */}
          <div className="body">
            <div className="left">
              <div
                className="tabs"
                role="tablist"
                data-r
                style={{ '--i': 10 } as React.CSSProperties}
                ref={tabsRef}
              >
                <div className="tab-ink" id="ink" ref={inkRef}></div>
                <button
                  ref={aboutTabBtnRef}
                  className="tab"
                  role="tab"
                  aria-selected={activeTab === 'about'}
                  data-p="p-about"
                  onClick={() => handleTabClick('about')}
                >
                  About
                </button>
                <button
                  ref={careerTabBtnRef}
                  className="tab"
                  role="tab"
                  aria-selected={activeTab === 'career'}
                  data-p="p-career"
                  onClick={() => handleTabClick('career')}
                >
                  Career
                </button>
                <button
                  ref={jobsTabBtnRef}
                  className="tab"
                  role="tab"
                  aria-selected={activeTab === 'jobs'}
                  data-p="p-jobs"
                  onClick={() => handleTabClick('jobs')}
                >
                  Jobs{jobsPosted.length > 0 && <sup>{jobsPosted.length}</sup>}
                </button>
              </div>

              <div className="panels" data-r style={{ '--i': 11 } as React.CSSProperties}>
                {/* About Panel */}
                <div className={`panel ${activeTab === 'about' ? 'on' : ''}`} id="p-about">
                  <div style={{ '--k': 0 } as React.CSSProperties}>
                    <div className="section-title">About</div>
                    <p className="about">
                      {profile.bio ? (
                        profile.bio
                      ) : (
                        <>
                          Software Engineer working on distributed systems and competitive
                          programming. Former FECPC member and active competitive programmer.
                        </>
                      )}
                    </p>
                  </div>
                  <div style={{ '--k': 1 } as React.CSSProperties}>
                    <div className="section-title">Ask me about</div>
                    <div className="tags">
                      {skills.map((sk) => (
                        <button key={sk} type="button" className="tag">
                          {sk}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Career Panel */}
                <div className={`panel ${activeTab === 'career' ? 'on' : ''}`} id="p-career">
                  <div className="section-title" style={{ '--k': 0 } as React.CSSProperties}>
                    Career path
                  </div>
                  <div className="path">
                    <div className="step now" style={{ '--k': 1 } as React.CSSProperties}>
                      <small>NOW</small>
                      <h4>
                        {roleTitle} · {company}
                      </h4>
                      <p>Working on distributed backend services and infrastructure.</p>
                    </div>

                    {profile.experience && profile.experience.length > 0
                      ? profile.experience.map((exp, idx) => (
                          <div
                            key={idx}
                            className="step"
                            style={{ '--k': idx + 2 } as React.CSSProperties}
                          >
                            <small>[{exp.period}]</small>
                            <h4>{exp.role}</h4>
                            {exp.summary && <p>{exp.summary}</p>}
                          </div>
                        ))
                      : null}

                    <div
                      className="step"
                      style={
                        {
                          '--k': (profile.experience?.length || 0) + 2,
                        } as React.CSSProperties
                      }
                    >
                      <small>[{gradYear}]</small>
                      <h4>Graduated · Batch {batchNumber}</h4>
                      <p>Department of {dept}.</p>
                    </div>

                    <div
                      className="step"
                      style={
                        {
                          '--k': (profile.experience?.length || 0) + 3,
                        } as React.CSSProperties
                      }
                    >
                      <small>
                        [{joinedYear}–{gradYear}]
                      </small>
                      <h4>FECPC Member</h4>
                      <p>Active contest competitor in competitive programming.</p>
                    </div>
                  </div>
                </div>

                {/* Jobs Panel */}
                <div className={`panel ${activeTab === 'jobs' ? 'on' : ''}`} id="p-jobs">
                  <div className="jobs-head" style={{ '--k': 0 } as React.CSSProperties}>
                    <div className="section-title" style={{ margin: 0 }}>
                      Jobs posted
                    </div>
                  </div>
                  {jobsPosted.length === 0 ? (
                    <p
                      style={{
                        color: 'var(--dim)',
                        fontFamily: 'var(--mono)',
                        fontSize: 13,
                        padding: '16px 0',
                      }}
                    >
                      No jobs posted yet.
                    </p>
                  ) : (
                    <div id="jobs">
                      {jobsPosted.map((job, idx) => (
                        <div
                          key={job.id}
                          id={`job-row-${job.id}`}
                          className="job"
                          style={{ '--k': idx + 1 } as React.CSSProperties}
                        >
                          <div>
                            <h4>
                              {job.company} <span>· {job.title || job.role}</span>
                            </h4>
                            <div className="meta">
                              <span>{job.location || 'Remote'}</span>
                              <span className="src">{job.source || 'manual'}</span>
                            </div>
                          </div>
                          <div className="job-actions">
                            {(isOwner || canAdmin) && (
                              <button
                                type="button"
                                className="btn sm danger line"
                                onClick={() => handleDeleteJob(job.id)}
                              >
                                Delete
                              </button>
                            )}
                            {job.url && (
                              <a
                                href={job.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn sm primary"
                                style={{ textDecoration: 'none' }}
                              >
                                Apply ↗
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT ASIDE */}
            <aside className="right">
              {/* Alumni Pass */}
              <div className="pass" data-r style={{ '--i': 12 } as React.CSSProperties}>
                <div className="pass-h">
                  <span>Alumni Pass</span>
                  <span className={`pill ${available ? '' : 'off'}`} id="pill">
                    <i className="dot"></i>
                    <span id="pillT">{available ? 'Open' : 'Closed'}</span>
                  </span>
                </div>
                <div className="pass-b">
                  <div className="hint" style={{ marginTop: 0 }}>
                    {available
                      ? 'Usually replies within a few days.'
                      : 'Not taking questions right now.'}
                  </div>
                  <div className="btns">
                    <button
                      type="button"
                      className="btn primary"
                      id="kudos"
                      onClick={handleKudosClick}
                    >
                      Kudos
                      <span ref={kcRef} className="kudos-count" id="kc">
                        {kudosCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn line"
                      id="share"
                      onClick={handleShareClick}
                    >
                      Share
                    </button>
                  </div>
                  <div className="links">
                    {profile.cf_handle && (
                      <a
                        href={`https://codeforces.com/profile/${profile.cf_handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        CF handle <span>↗</span>
                      </a>
                    )}
                    {profile.github_url && (
                      <a href={profile.github_url} target="_blank" rel="noopener noreferrer">
                        GitHub <span>↗</span>
                      </a>
                    )}
                    {profile.linkedin_url && (
                      <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">
                        LinkedIn <span>↗</span>
                      </a>
                    )}
                    {!profile.cf_handle && !profile.github_url && !profile.linkedin_url && (
                      <span
                        style={{
                          color: 'var(--dim)',
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          padding: '6px 0',
                          display: 'block',
                        }}
                      >
                        No social links
                      </span>
                    )}
                  </div>
                  {canToggle && (
                    <label className="switch">
                      <input
                        type="checkbox"
                        id="avail"
                        checked={available}
                        onChange={handleToggleAvailable}
                        disabled={togglingAvailable}
                      />
                      <span className="track"></span>Available · owner &amp; admin only
                    </label>
                  )}
                </div>
              </div>

              {/* History Viz */}
              <div className="viz" data-r style={{ '--i': 13 } as React.CSSProperties}>
                <div className="viz-t">
                  <span>History</span>
                  <div className="seg" role="tablist">
                    <button
                      type="button"
                      className={chartMetric === 'rating' ? 'on' : ''}
                      data-m="rating"
                      onClick={() => setMetric('rating')}
                    >
                      Rating
                    </button>
                    <button
                      type="button"
                      className={chartMetric === 'solved' ? 'on' : ''}
                      data-m="solved"
                      onClick={() => setMetric('solved')}
                    >
                      Solved
                    </button>
                  </div>
                </div>
                <div className="viz-big">
                  <b id="vbig">{bigValueDisplay}</b>
                  <span className="delta" id="vdelta">
                    {deltaDisplay}
                  </span>
                </div>
                <small className="viz-cap" id="vlab">
                  {chartLabel}
                </small>

                {/* SVG Chart */}
                <div
                  className="chart"
                  id="chart"
                  ref={chartContainerRef}
                  onPointerMove={handleChartPointerMove}
                  onMouseMove={handleChartPointerMove}
                  onPointerLeave={handleChartPointerLeave}
                  onMouseLeave={handleChartPointerLeave}
                >
                  <svg
                    viewBox={`0 0 ${SW} ${SH}`}
                    role="img"
                    aria-label="Rating history chart"
                    className={isTw ? 'tw' : ''}
                  >
                    <defs>
                      <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" style={{ stopColor: 'var(--acc)', stopOpacity: 0.4 }} />
                        <stop offset="1" style={{ stopColor: 'var(--acc)', stopOpacity: 0 }} />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {gridLines.map((gl, i) => (
                      <React.Fragment key={i}>
                        <line className="gridl" x1={PL} x2={SW - PR} y1={gl.y} y2={gl.y} />
                        <text className="ylab" x={PL - 6} y={gl.y + 3} textAnchor="end">
                          {gl.val}
                        </text>
                      </React.Fragment>
                    ))}

                    {/* Crosshair */}
                    <line
                      className={`cross ${hoveredPoint ? 'on' : ''}`}
                      x1={hoveredPoint?.x ?? 0}
                      x2={hoveredPoint?.x ?? 0}
                      y1={PT - 6}
                      y2={SH - PB}
                    />

                    {/* Area fill */}
                    <path className="area" d={areaD} />

                    {/* Main stroke line */}
                    <path
                      className="lineP"
                      d={lineD}
                      style={{ '--len': dashLen } as React.CSSProperties}
                    />

                    {/* Pulsing ring on peak (last point) */}
                    <circle className="ring" cx={pts[4][0]} cy={pts[4][1]} r="5" />

                    {/* Data Points */}
                    {pts.map((p, i) => (
                      <React.Fragment key={i}>
                        <circle
                          className={`pt ${i === 4 ? 'peak' : ''} ${hoveredPoint?.index === i ? 'hot' : ''}`}
                          cx={p[0]}
                          cy={p[1]}
                          style={{ '--n': i } as React.CSSProperties}
                          r="4.5"
                        />
                        <text
                          className={`xlab ${i === 4 ? 'last' : ''}`}
                          x={cx(i)}
                          y={SH - 8}
                          textAnchor="middle"
                        >
                          {yrs[i]}
                        </text>
                      </React.Fragment>
                    ))}

                    {/* Peak text */}
                    <text className="peakl" x={pts[4][0] - 9} y={pts[4][1] - 9} textAnchor="end">
                      PEAK
                    </text>
                  </svg>

                  {/* Floating Tooltip */}
                  <div
                    className={`tip ${hoveredPoint ? 'on' : ''}`}
                    id="tip"
                    style={
                      hoveredPoint
                        ? {
                            left: `${(hoveredPoint.x / SW) * 100}%`,
                            top: `${(hoveredPoint.y / SH) * 100}%`,
                          }
                        : undefined
                    }
                  >
                    {hoveredPoint?.text ?? ''}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </article>

        {/* Toast */}
        <div className={`toast ${toastText ? 'on' : ''}`} id="toast">
          {toastText}
        </div>
      </div>
    </div>
  );
}

export default AlumniProfileModal;
