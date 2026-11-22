import Link from 'next/link';
import ProjectGrid from '@/components/site/ProjectGrid';
import { projects } from '@fecpc/content/site';

export const metadata = { title: 'Projects' };
const steps = [
  [
    'Pitch',
    'Post an idea on the board. If three people upvote it, it gets a channel and a committee sponsor.',
  ],
  ['Team up', 'The find-a-teammate board matches by skill and rating. Mixed years work best.'],
  [
    'Build in public',
    'Weekly demo, open repository. Half-finished and shown beats polished and hidden.',
  ],
  ['Ship', 'Launch it to the club first. Good ones get a page here and a line on your profile.'],
];

export default function Projects() {
  return (
    <>
      <section className="page-head t-e sheet" data-t="e">
        <div className="wrap">
          <div className="head">
            <h1 className="disp">
              Things that <span className="acc">did not exist</span> last year.
            </h1>
            <p className="lede">
              Hack-night prototypes, research models and software the club runs on. Every one has a
              repository and names you can ask.
            </p>
          </div>
          {/* A drawing's title block: the sheet says what it is, who drew it and how many parts it has. */}
          <dl className="titleblock">
            <div>
              <dt>Drawing</dt>
              <dd>FECPC-PRJ</dd>
            </div>
            <div>
              <dt>Sheet</dt>
              <dd>1 of 1</dd>
            </div>
            <div>
              <dt>Parts</dt>
              <dd>{projects.length} projects</dd>
            </div>
            <div>
              <dt>Drawn by</dt>
              <dd>{new Set(projects.flatMap((p) => p.by)).size} members</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="sec t-e sheet" data-t="e">
        <div className="wrap">
          <ProjectGrid />
        </div>
      </section>
      <section className="sec t-e" data-t="e" style={{ background: 'var(--panel)' }}>
        <div className="wrap">
          <div className="head">
            <h2 className="h2">
              How a project <span className="acc">starts here.</span>
            </h2>
          </div>
          <ol
            className="grid life-steps"
            style={{ '--min': '220px', '--g': '0px' } as React.CSSProperties}
          >
            {steps.map(([t, d], i) => (
              <li key={t}>
                <span className="mono acc">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="h3">{t}</h3>
                <p className="body">{d}</p>
              </li>
            ))}
          </ol>
          <p style={{ marginTop: 56 }}>
            <Link href="/join" className="btn">
              Join and pitch yours
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
