import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const rankings = JSON.parse(await readFile(new URL("data/rankings-2026.json", root), "utf8"));
const projections = JSON.parse(await readFile(new URL("data/sleeper-projections-2026.json", root), "utf8"));
const teams = JSON.parse(await readFile(new URL("data/team-reports-2026.json", root), "utf8"));
const league = JSON.parse(await readFile(new URL("data/espn-league-history.json", root), "utf8"));

test("uses honest projection, injury, history, and freshness labels", () => {
  assert.doesNotMatch(html, /Projected games/i);
  assert.doesNotMatch(html, /Estimated return/i);
  assert.doesNotMatch(html, /real career stats for every player/i);
  assert.doesNotMatch(html, /6 August 2026/i);
  assert.match(html, /Projection horizon/);
  assert.match(html, /Planning outlook/);
  assert.match(html, /source-rankings-date/);
  assert.match(html, /source-projections-date/);
  assert.match(html, /source-team-date/);
});

test("includes persistent drafted and queue controls", () => {
  assert.match(html, /id="lab-availability"/);
  assert.match(html, /id="draft-queue"/);
  assert.match(html, /id="late-round-option"/);
  assert.match(html, /function isLateRoundTarget/);
  assert.match(html, /pool === 'late'/);
  assert.match(html, /id="drafted-count"/);
  assert.match(html, /draft-desk-2026-state-v1/);
  assert.match(html, /class="queue-toggle"/);
  assert.match(html, /class="draft-toggle"/);
  assert.match(html, /localStorage\.setItem/);
});

test("keeps the draft board compact and action-ready", () => {
  assert.match(html, /<th>Team<br><small>Depth<\/small><\/th>/);
  assert.doesNotMatch(html, /<th>Depth<\/th>/);
  assert.doesNotMatch(html, /<th>Board ADP/);
  assert.doesNotMatch(html, /label:'Board ADP/);
  assert.match(html, /class="team-cell"/);
  assert.match(html, /colspan="7"/);
  assert.match(html, /#p-lab-rankings \.lab-table th:last-child/);
  assert.match(html, /isDrafted \? 'Drafted' : 'Draft'/);
});

test("keeps the merged data contracts intact", () => {
  assert.equal(rankings.players.length, 144);
  assert.equal(projections.playerCount, projections.players.length);
  assert.ok(projections.players.length >= 500, "projection feed unexpectedly small");
  assert.equal(teams.teams.length, 32);
  assert.ok(rankings.lastUpdated);
  assert.ok(projections.fetchedAt);
  assert.ok(teams.lastUpdated);
  assert.equal(new Set(teams.teams.map((team) => team.abbr)).size, 32);
});

test("includes verified ESPN league history for both title seasons", () => {
  assert.equal(league.leagueId, "1634171350");
  assert.equal(league.teamName, "PINOY BOYZ");
  assert.deepEqual(league.seasons.map((season) => season.season), [2025, 2024]);
  assert.ok(league.seasons.every((season) => season.champion === "PINOY BOYZ"));
  assert.equal(league.seasons[0].standings.length, 12);
  assert.equal(league.seasons[1].standings.length, 12);
  assert.equal(league.seasons[0].finalRoster.length, 16);
  assert.equal(league.seasons[1].finalRoster.length, 16);
  assert.equal(league.seasons[0].teamSummary.pointsFor, 1808.02);
  assert.equal(league.seasons[1].teamSummary.pointsFor, null);
  assert.match(html, /aria-controls="p-lab-league"/);
  assert.match(html, /id="league-season"/);
  assert.match(html, /data\/espn-league-history\.json/);
  assert.match(html, /function renderLeagueHistory/);
  assert.match(html, /end-of-season lineups/);
});

test("keeps ids, aria references, and inline JavaScript valid", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "duplicate HTML id found");
  const controls = [...html.matchAll(/\baria-controls="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/));
  for (const id of controls) assert.ok(ids.includes(id), `aria-controls points to missing #${id}`);

  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/application\/json/i.test(match[1]))
    .map((match) => match[2]);
  assert.ok(scripts.length >= 3);
  for (const source of scripts) assert.doesNotThrow(() => new Function(source));
});

test("ships a consolidated 32-team depth one-pager", () => {
  assert.match(html, /aria-controls="p-lab-onepager"/);
  assert.match(html, /id="onepager-grid"/);
  assert.match(html, /function renderOnePager/);
  assert.match(html, /var ONEPAGER_SLOTS/);
  // fantasy-starter slots must cover QB1, RB1-2, WR1-3 and TE1
  assert.match(html, /starters: \[\['QB',1\],\['RB',2\],\['WR',3\],\['TE',1\]\]/);
  assert.match(html, /id="onepager-print"/);
  assert.match(html, /@media print/);
  // every team in the projection feed can be rendered
  const teamsWithSkill = new Set(
    projections.players
      .filter((p) => ["QB", "RB", "WR", "TE"].includes(p.position) && p.team && p.team !== "FA")
      .map((p) => p.team),
  );
  assert.equal(teamsWithSkill.size, 32, "expected all 32 teams to have skill players");
});

test("makes injury snapshot age visible and never fakes a refresh", () => {
  assert.match(html, /id="injury-freshness"/);
  assert.match(html, /function renderInjuryFreshness/);
  assert.match(html, /id="injury-refresh"/);
  assert.match(html, /Live refresh FAILED/);
  assert.match(html, /Nothing was changed/);
  // a failed refresh must not claim success
  assert.doesNotMatch(html, /refresh complete/i);
  assert.match(html, /function applyLiveInjuries/);
});

test("keeps the draft queue ordered and persistent", () => {
  assert.match(html, /data-move-queue="up"/);
  assert.match(html, /data-move-queue="down"/);
  assert.match(html, /class="queue-rank"/);
  assert.match(html, /next-up/);
  assert.match(html, /queueKeys\.splice\(to, 0, queueKeys\.splice\(from, 1\)\[0\]\)/);
});
