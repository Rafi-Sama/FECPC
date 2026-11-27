import Link from 'next/link';

// Shown inside the member area's frame, for a page that does not exist or that this role cannot open.
export default function NotFound() {
  return (
    <div className="page">
      <div className="panel max-w-[560px]">
        <h1 className="h3">That page is not available.</h1>
        <p className="body my-2.5">It does not exist, or your role cannot open it.</p>
        <Link className="btn sm" href="/app">
          Back to Today
        </Link>
      </div>
    </div>
  );
}
