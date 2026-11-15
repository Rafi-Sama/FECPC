import Link from "next/link";

// Shown inside the member area's frame, for a page that does not exist or that this role cannot open.
export default function NotFound() {
  return <div className="page"><div className="panel" style={{ maxWidth: 560 }}><h1 className="h3">That page is not available.</h1><p className="body" style={{ marginBlock: 10 }}>It does not exist, or your role cannot open it.</p><Link className="btn sm" href="/app">Back to Today</Link></div></div>;
}
