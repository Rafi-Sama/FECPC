export const annBackdrop =
  'cm-backdrop ann-modal-backdrop [background:rgba(0,0,0,0.6)] flex items-center justify-center p-[1rem]';

export const annModalBackdrop = 'inset-0 [backdrop-filter:blur(2px)] fixed z-[100] overflow-y-auto'; // was .ann-modal-backdrop
export const annModal =
  '[background:var(--ann-surface)] max-w-[700px] w-[90%] [box-shadow:12px_12px_0_rgba(0,_0,_0,_0.3)] [color:var(--ann-text)] [font-family:var(--ann-font-main)] relative flex-col overflow-hidden [.t-d_&]:[box-shadow:12px_12px_0_rgba(0,_0,_0,_0.8)]'; // was .ann-modal
export const annModalHeader = '[border-bottom:var(--ann-border-thick)] [background:var(--ann-bg)]'; // was .ann-modal-header
export const annCloseBtn =
  'p-0 [background:var(--ann-surface)] w-[32px] h-[32px] flex items-center justify-center cursor-pointer font-bold text-[1.2rem] leading-[1] [color:var(--ann-text)] hover:[background:color-mix(in_srgb,_var(--ann-surface)_85%,_var(--ann-text))] [.t-b_&:hover]:[background:#e5e5e5] [.t-d_&:hover]:[background:var(--line2)] [.t-d_&:hover]:text-hi'; // was .ann-close-btn
export const annModalBody = 'max-h-[70vh] overflow-y-auto'; // was .ann-modal-body
export const badgePinned = '[color:var(--ann-orange)] font-bold [.t-d_&]:text-acc'; // was .badge-pinned
export const badgeMustRead = '[color:var(--ann-red)] font-bold [.t-d_&]:[color:var(--ann-red)]'; // was .badge-must-read
