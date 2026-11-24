import { serverQuery } from '@/lib/api.ts';
import Community, { type FeedFirst } from './client';

/** Community, with the feed's first page rendered on the server when the feed is the tab being opened. */
export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tab = (await searchParams).tab;
  const feed = !tab || (typeof tab === 'string' && tab.toLowerCase() === 'feed');
  // The same request client.tsx sends for its default filters.
  const initialFeed = feed
    ? await serverQuery<FeedFirst>('community', {
        action: 'listFeedPosts',
        q: '',
        category: 'all',
        sort: 'hot',
        mine: false,
        cursor: null,
        limit: 20,
      })
    : null;
  return <Community initialFeed={initialFeed} />;
}
