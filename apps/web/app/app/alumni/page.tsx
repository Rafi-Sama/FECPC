import { redirect } from 'next/navigation';

// Old URL; alumni and jobs live at /app/career.
export default function Alumni() {
  redirect('/app/career');
}
