// SEED DATA, part 2. Placeholder records; see lib/data.ts. Editorials and code are real.
export const notifications = [
  { id: "n1", cat: "Finance", text: "Semester subscription of ৳300 is due in 4 days", href: "/app/finance", ago: "1h" },
  { id: "n2", cat: "Contest", text: "Codeforces round starts tonight at 20:35", href: "/app/contests", ago: "2h" },
  { id: "n3", cat: "Streak", text: "Your 41-day streak breaks at midnight", href: "/app", ago: "3h" },
  { id: "n4", cat: "Mentor", text: "Mehedi left a note on your weekly check-in", href: "/app/learn", ago: "5h" },
  { id: "n5", cat: "Event", text: "A seat opened: you are off the waitlist for ICPC Mock #3", href: "/app/events", ago: "1d" },
  { id: "n6", cat: "Social", text: "Zahid sent you kudos for your answer on 1352C", href: "/app/community", ago: "1d" },
];
export const notifCats = ["Finance", "Contest", "Streak", "Mentor", "Event", "Social"];
export const channels = ["In-app", "Email", "Push", "Telegram"];

export const courses = [
  { id: "dp", name: "DP Bootcamp", by: "nadia", weeks: 5, lessons: ["States and transitions", "1D DP: ribbons and stairs", "Knapsack", "DP on grids", "Bitmask DP", "Digit DP"], assign: ["189A", "455A", "698A"] },
  { id: "cpp", name: "C++ from zero", by: "mehedi", weeks: 4, lessons: ["Input, output, variables", "Loops and conditions", "Arrays and strings", "Functions", "STL: vector, map, set"], assign: ["4A", "71A", "231A"] },
  { id: "graphs", name: "Graphs in two weeks", by: "rahim", weeks: 2, lessons: ["BFS and DFS", "Shortest paths", "DSU and MST", "Trees"], assign: ["580C", "520B", "277A"] },
];
export const quizzes: Record<string, { q: string; opts: string[] }[]> = {
  dp: [
    { q: "What must a DP state capture?", opts: ["The whole input", "Everything future decisions depend on", "Only the last choice"] },
    { q: "0/1 knapsack with n items and capacity W runs in:", opts: ["O(n + W)", "O(n log W)", "O(n · W)"] },
    { q: "In Cut Ribbon, dp[i] is invalid when:", opts: ["length i cannot be cut exactly", "i is odd", "i is larger than a"] },
  ],
  cpp: [
    { q: "Which reads a whole line including spaces?", opts: ["cin >> s", "getline(cin, s)", "scanf(\"%s\")"] },
    { q: "int x = 7 / 2; x is:", opts: ["3.5", "4", "3"] },
    { q: "Fast lookup by key in sorted order:", opts: ["vector", "map", "queue"] },
  ],
  graphs: [
    { q: "BFS on an unweighted graph finds:", opts: ["Shortest paths", "A minimum spanning tree", "Cycles only"] },
    { q: "Dijkstra fails with:", opts: ["Dense graphs", "Negative edges", "Directed edges"] },
    { q: "DSU with both optimisations is about:", opts: ["O(log n) per op", "O(n) per op", "Nearly O(1) per op"] },
  ],
};

export const posts = [
  { id: "4A", title: "Watermelon", by: "tasnim", up: 41, tags: ["math", "800"], hints: ["Both parts must be even and positive.", "Even + even is even. What is the smallest such sum?"],
    body: "The weight splits into two even positive parts exactly when w is even and w > 2. w = 2 fails because the only split is 1 + 1.",
    code: "int w; cin >> w;\ncout << (w % 2 == 0 && w > 2 ? \"YES\" : \"NO\");" },
  { id: "189A", title: "Cut Ribbon", by: "nadia", up: 67, tags: ["dp", "1300"], hints: ["Think of dp[i] = the most pieces for a ribbon of length i.", "A length is reachable only from i − a, i − b or i − c, if those were reachable."],
    body: "Let dp[i] be the maximum number of pieces for length i, or −∞ if i cannot be cut exactly. dp[0] = 0 and dp[i] = 1 + max(dp[i−a], dp[i−b], dp[i−c]). The answer is dp[n], in O(n).",
    code: "vector<int> dp(n + 1, INT_MIN); dp[0] = 0;\nfor (int i = 1; i <= n; i++)\n  for (int x : {a, b, c})\n    if (i >= x && dp[i - x] != INT_MIN)\n      dp[i] = max(dp[i], dp[i - x] + 1);\ncout << dp[n];" },
  { id: "230B", title: "T-primes", by: "mehedi", up: 53, tags: ["number theory", "1300"], hints: ["Which numbers have an odd number of divisors?", "Exactly three divisors means 1, p and p²."],
    body: "A number has exactly three divisors only if it is the square of a prime. Sieve primes up to 10⁶, take the integer square root r of x (fix floating error by checking r·r == x), and answer YES when r is prime.",
    code: "long long r = sqrtl(x);\nwhile (r * r > x) r--;\nwhile ((r + 1) * (r + 1) <= x) r++;\ncout << (r * r == x && isPrime[r] ? \"YES\" : \"NO\");" },
];

export const templates = [
  { name: "DSU", code: "struct DSU {\n  vector<int> p, sz;\n  DSU(int n) : p(n), sz(n, 1) { iota(p.begin(), p.end(), 0); }\n  int find(int x) { return p[x] == x ? x : p[x] = find(p[x]); }\n  bool unite(int a, int b) {\n    a = find(a); b = find(b);\n    if (a == b) return false;\n    if (sz[a] < sz[b]) swap(a, b);\n    p[b] = a; sz[a] += sz[b];\n    return true;\n  }\n};" },
  { name: "Segment tree (sum)", code: "struct Seg {\n  int n; vector<long long> t;\n  Seg(int n) : n(n), t(2 * n) {}\n  void set(int i, long long v) {\n    for (t[i += n] = v; i > 1; i >>= 1) t[i >> 1] = t[i] + t[i ^ 1];\n  }\n  long long sum(int l, int r) { // [l, r)\n    long long s = 0;\n    for (l += n, r += n; l < r; l >>= 1, r >>= 1) {\n      if (l & 1) s += t[l++];\n      if (r & 1) s += t[--r];\n    }\n    return s;\n  }\n};" },
  { name: "Dijkstra", code: "vector<long long> dijkstra(int s, vector<vector<pair<int,int>>>& g) {\n  vector<long long> d(g.size(), LLONG_MAX);\n  priority_queue<pair<long long,int>, vector<pair<long long,int>>, greater<>> pq;\n  pq.push({d[s] = 0, s});\n  while (!pq.empty()) {\n    auto [du, u] = pq.top(); pq.pop();\n    if (du > d[u]) continue;\n    for (auto [v, w] : g[u])\n      if (du + w < d[v]) pq.push({d[v] = du + w, v});\n  }\n  return d;\n}" },
];
export const myTeam = { name: "FEC_NullPointers", coach: "tanvir", members: ["nadia", "mehedi", "rahim"], mocks: [["Mock #1", 6, 14], ["Mock #2", 8, 9], ["Dhaka 2025 replay", 7, 11]] as [string, number, number][], map: [["Graphs", 82], ["DP", 74], ["Math", 61], ["Strings", 48], ["Geometry", 22], ["Flows", 31]] as [string, number][] };
export const lookingForTeam = [{ id: "sadia", wants: "Geometry, flows" }, { id: "anika", wants: "Math, constructive" }, { id: "farhan", wants: "Strings, implementation" }, { id: "priya", wants: "DP, graphs" }];

export const alumni = [
  { name: "Shahriar Kabir", batch: 16, at: "Software Engineer, fintech", city: "Dhaka", mentor: true },
  { name: "Tahmina Akhter", batch: 17, at: "ML Engineer, healthcare startup", city: "Singapore", mentor: true },
  { name: "Rakibul Islam", batch: 17, at: "Backend Engineer, e-commerce", city: "Dhaka", mentor: false },
  { name: "Fariha Noor", batch: 18, at: "PhD student, algorithms", city: "Toronto", mentor: true },
  { name: "Asif Mahmud", batch: 19, at: "SRE, telecom", city: "Dhaka", mentor: false },
  { name: "Nabila Karim", batch: 19, at: "Product Engineer, edtech", city: "Dhaka", mentor: true },
];
export const jobs = [
  { id: "j1", role: "Software Engineering Intern", org: "Fintech, Dhaka", by: "Shahriar Kabir", closes: "30 Nov" },
  { id: "j2", role: "Junior Backend Engineer", org: "E-commerce, Dhaka", by: "Rakibul Islam", closes: "12 Dec" },
  { id: "j3", role: "ML Research Assistant (remote)", org: "University lab, Toronto", by: "Fariha Noor", closes: "20 Dec" },
];
export const interview = [["Arrays and hashing", 18, 11], ["Two pointers", 12, 7], ["Trees and graphs", 20, 5], ["Dynamic programming", 15, 2], ["System design basics", 8, 0]] as const;

export const wiki = [
  { id: "icpc", title: "ICPC: rules and registration", rev: 7, by: "nadia", body: ["Teams of three share one computer for five hours and solve 10 to 13 problems.", "Ranking is by problems solved, then by penalty time: minutes to each accepted solution plus 20 for every rejected attempt on it.", "You may bring a printed team notebook of up to 25 pages. No internet, no phones.", "Each student can compete in at most five regionals and two world finals."] },
  { id: "setup", title: "Setting up your editor and judge", rev: 4, by: "mehedi", body: ["Install g++ 13 or newer and compile with: g++ -std=c++20 -O2 -Wall a.cpp", "Create a Codeforces account, then link the handle on your profile so solves sync.", "Use a template with fast I/O: ios::sync_with_stdio(false); cin.tie(nullptr);", "Test with the sample input from a file: ./a.out < in.txt"] },
  { id: "upsolve", title: "How to upsolve properly", rev: 3, by: "rahim", body: ["Within 48 hours of a contest, attempt every problem you did not solve for 30 more minutes.", "Read hint 1, try again. Read hint 2, try again. Only then read the editorial.", "Write the solution yourself without looking, and get it accepted.", "Add one line to your notes: the idea you were missing."] },
];

export const scoreboard = [
  { team: "FEC_NullPointers", solved: ["A", "B", "C", "D", "F", "H"], pen: 612, frozen: ["G"] },
  { team: "FEC_Overflow", solved: ["A", "B", "C", "D", "F"], pen: 540, frozen: ["H", "E"] },
  { team: "SegFault Squad", solved: ["A", "B", "C", "F", "H"], pen: 701, frozen: [] },
  { team: "Binary Bandits", solved: ["A", "B", "D", "F"], pen: 388, frozen: ["C"] },
  { team: "Off By One", solved: ["A", "B", "C"], pen: 301, frozen: ["D", "F"] },
  { team: "Stack Smashers", solved: ["A", "B"], pen: 122, frozen: [] },
];
export const probs = ["A", "B", "C", "D", "E", "F", "G", "H"];
export const balloonColor: Record<string, string> = { A: "#FF4D8D", B: "#3DE1FF", C: "#FFD23F", D: "#9BFF6B", E: "#C77DFF", F: "#FF8A5C", G: "#FFFFFF", H: "#6FA8FF" };
export const balloons = [{ id: "b1", team: "Off By One", p: "C", desk: "L2-14" }, { id: "b2", team: "Binary Bandits", p: "F", desk: "L1-07" }, { id: "b3", team: "SegFault Squad", p: "H", desk: "L2-03" }];
export const prints = [{ id: "pr1", team: "FEC_Overflow", pages: 3, desk: "L1-11" }, { id: "pr2", team: "Stack Smashers", pages: 2, desk: "L2-09" }];

export const cols = ["To do", "Doing", "Done"];
export const groupsData = [["Competitive Programming", "nadia", 96], ["Web Engineering", "sadia", 41], ["AI / ML", "anika", 33], ["Game Dev", "shuvo", 18], ["Security", "farhan", 22]] as const;
export const teammatePosts = [{ id: "tp1", by: "priya", text: "Need a third for Winter Hack Night: someone who likes frontends", tags: ["Hackathon", "Web"] }, { id: "tp2", by: "zahid", text: "Looking for two for the intra-college contest, rating 900–1200", tags: ["Contest", "CP"] }, { id: "tp3", by: "shuvo", text: "Game jam team needs a pixel artist who can code a little", tags: ["Game dev"] }];
export const volunteerShifts = [["Registration desk", "08:30–10:00", 4, 3], ["Balloon runner", "10:00–15:00", 12, 9], ["Print runner", "10:00–15:00", 4, 4], ["Ceremony and prizes", "15:00–17:00", 6, 2]] as const;
