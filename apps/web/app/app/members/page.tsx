import { redirect } from 'next/navigation';

// Old URL; the member directory lives at /app/directory.
export default function Members() {
  redirect('/app/directory');
}
