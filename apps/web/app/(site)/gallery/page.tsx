import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fmtDate } from '@fecpc/content/site';
import { publicEvents } from '@/lib/api';

export const metadata = { title: 'Gallery' };

// Photos are whatever sits in public/gallery. File name becomes the caption.
export default async function Gallery() {
  const dir = path.join(process.cwd(), 'public/gallery');
  const shots = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
        .sort()
    : [];
  if (!shots.length) notFound(); // the page publishes itself once there is something to show
  const next = (await publicEvents())[0];
  return (
    <>
      <section className="page-head t-d" data-t="d">
        <div className="wrap">
          <div className="head">
            <h1 className="disp">
              Proof that we <span className="acc">left the lab.</span>
            </h1>
          </div>
        </div>
      </section>
      <section className="sec t-d" data-t="d" style={{ paddingTop: 0 }}>
        <div className="wrap">
          {shots.length ? (
            <ul className="shots">
              {shots.map((f) => (
                <li key={f}>
                  <img
                    src={`/gallery/${f}`}
                    alt={f.replace(/\.\w+$/, '').replace(/[-_]/g, ' ')}
                    loading="lazy"
                  />
                  <span className="label">{f.replace(/\.\w+$/, '').replace(/[-_]/g, ' ')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="split even" style={{ alignItems: 'center' }}>
              <div className="frame-empty" aria-hidden>
                {Array.from({ length: 6 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
              <div className="stack">
                <h2 className="h2" style={{ fontSize: 'clamp(28px,3.4vw,44px)' }}>
                  The first photos go up after{' '}
                  <span className="acc">{next ? next.title.split(',')[0] : 'the next event'}.</span>
                </h2>
                <p className="lede">
                  {next &&
                    fmtDate(next.startsAt.slice(0, 10), {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    }) + '. '}
                  Come and be in them.
                </p>
                <p>
                  <Link href="/events" className="btn">
                    See what is on
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
