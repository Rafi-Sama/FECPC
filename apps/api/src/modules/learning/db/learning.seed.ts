import type { Pool, PoolClient } from 'pg';

type Queryable = Pool | PoolClient;

export const SEED_COURSES = [
  {
    title: 'Competitive Programming Core: Algorithms & Data Structures',
    instructor: 'Tasnim Ahmed',
    duration_weeks: 12,
    description: 'Master binary search, graph traversals, shortest paths, dynamic programming, and segment trees.',
    url: 'https://cp-algorithms.com',
  },
  {
    title: 'Introduction to Modern C++ for Contests',
    instructor: 'Tanvir Hossain',
    duration_weeks: 4,
    description: 'Fast I/O, STL containers, iterators, lambdas, bitsets, and custom comparators for speed.',
    url: 'https://en.cppreference.com/w/cpp',
  },
  {
    title: 'Graph Theory & Network Flows Deep Dive',
    instructor: 'Anika Rahman',
    duration_weeks: 8,
    description: 'DFS/BFS trees, articulation points, bridges, 2-SAT, Dinic algorithm, and min-cost max-flow.',
    url: 'https://usaco.guide/advanced',
  },
];

export const SEED_QUESTIONS = [
  {
    question: 'What is the worst-case time complexity of binary search on a sorted array of size n?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correct_index: 1,
  },
  {
    question: 'Which abstract data structure does Breadth-First Search (BFS) typically use?',
    options: ['Queue', 'Stack', 'Priority Queue', 'Disjoint Set Union'],
    correct_index: 0,
  },
  {
    question: 'What is the time complexity of building a Segment Tree for an array of size n?',
    options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(n^2)'],
    correct_index: 1,
  },
  {
    question: 'In Dijkstra algorithm with a binary min-heap, what is the standard time complexity for graph G(V, E)?',
    options: ['O(V^2)', 'O(V + E)', 'O((V + E) log V)', 'O(V * E)'],
    correct_index: 2,
  },
  {
    question: 'What is the space complexity of an adjacency matrix representation for a graph with V vertices?',
    options: ['O(V)', 'O(V + E)', 'O(V^2)', 'O(E^2)'],
    correct_index: 2,
  },
  {
    question: 'Which of the following problems can NOT be solved in polynomial time unless P = NP?',
    options: ['Minimum Spanning Tree', '0/1 Knapsack (exact)', 'Shortest Path with negative weights (no cycle)', 'Eulerian Circuit'],
    correct_index: 1,
  },
];

/**
 * Seeds learning courses and quiz questions if tables are empty. Safe to re-run.
 */
export async function seedLearning(db: Queryable): Promise<void> {
  const coursesCount = await db.query('SELECT count(*)::int as count FROM learning_courses');
  if (coursesCount.rows[0]?.count === 0) {
    for (const c of SEED_COURSES) {
      await db.query(
        `INSERT INTO learning_courses (title, instructor, duration_weeks, description, url)
         VALUES ($1, $2, $3, $4, $5)`,
        [c.title, c.instructor, c.duration_weeks, c.description, c.url],
      );
    }
  }

  const questionsCount = await db.query('SELECT count(*)::int as count FROM learning_quiz_questions');
  if (questionsCount.rows[0]?.count === 0) {
    for (const q of SEED_QUESTIONS) {
      await db.query(
        `INSERT INTO learning_quiz_questions (question, options, correct_index)
         VALUES ($1, $2::jsonb, $3)`,
        [q.question, JSON.stringify(q.options), q.correct_index],
      );
    }
  }
}
