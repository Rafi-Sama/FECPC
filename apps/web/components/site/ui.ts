export const crtBlockLg =
  'absolute [background:var(--acc)] right-[13.75%] top-[5%] w-[7.5%] [aspect-ratio:1]';

export const crtBlockSm =
  'absolute [background:var(--acc)] right-[11.25%] top-[12.5%] w-[2.5%] [aspect-ratio:1]';

export const crtCaption =
  'absolute left-[53%] [top:-2.5%] text-[14px] tracking-[0.06em] [background:var(--bg)] p-[2px_6px] silk';

export const loopSteps =
  'flex flex-col [&_li]:[display:grid] [&_li]:grid-cols-[clamp(64px,9vw,120px)_minmax(0,1fr)] [&_li]:gap-6 [&_li]:[padding-block:28px]';

export const lifeBackdrop =
  'bgfx w-full opacity-[0.4] [-webkit-mask-image:linear-gradient(180deg,transparent_30%,#000)] [mask-image:linear-gradient(180deg,transparent_30%,#000)] pointer-events-auto min-[1000px]:w-[44%] min-[1000px]:opacity-[1] min-[1000px]:[-webkit-mask-image:linear-gradient(90deg,transparent_4%,#000_42%)] min-[1000px]:[mask-image:linear-gradient(90deg,transparent_4%,#000_42%)] top-16 right-0 bottom-0 left-auto';

export const rainBackdrop =
  'bgfx rain [-webkit-mask-image:linear-gradient(90deg,rgba(0,0,0,0.07)_0_46%,#000_80%)] [mask-image:linear-gradient(90deg,rgba(0,0,0,0.07)_0_46%,#000_80%)]';

export const caret =
  'blink inline-block w-[0.42em] h-[0.78em] [background:var(--acc)] ml-[0.18em] [vertical-align:-0.04em]';

export const badgeGlyph =
  'glyph w-[52px] h-[52px] [display:grid] [place-items:center] [border:4px_solid_currentColor] [font:700_14px_var(--mono),monospace]';

export const recordList =
  '[&_.t]:[font-size:clamp(14px,1.3vw,15px)] [&_.t]:leading-[1.6] [&_.t]:mb-1.5 [&_li]:[display:grid] [&_li]:grid-cols-[70px_minmax(0,1fr)_auto] [&_li]:gap-5 [&_li]:items-center [&_li]:p-[20px_0] [&_li]:[border-bottom:4px_dotted_var(--line)] [&_li]:text-[14px]';
