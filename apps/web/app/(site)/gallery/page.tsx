import fs from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';

export const metadata = { title: 'Gallery' };

// Photos are whatever sits in public/gallery. File name becomes the caption.
export default function Gallery() {
  const dir = path.join(process.cwd(), 'public/gallery');
  const shots = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
        .sort()
    : [];
  if (!shots.length) notFound(); // the page publishes itself once there is something to show
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
      <section className="sec t-d pt-0" data-t="d">
        <div className="wrap">
          <ul className="[columns:3_280px] gap-x-4 [&_li]:[break-inside:avoid] [&_li]:mb-4 [&_li]:flex [&_li]:flex-col [&_li]:gap-2 [&_img]:w-full [&_img]:h-auto [&_img]:[filter:grayscale(1)_contrast(1.1)] [&_img]:[transition:filter_0.2s] [&_li:hover_img]:[filter:none]">
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
        </div>
      </section>
    </>
  );
}
