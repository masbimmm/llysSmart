// Uji jalur 2: peluru milik player lokal `p` mengenai `otherPlayers` (stacking loop di physics.ts)
const path = require('path');
const { updatePlayerPhysics } = require(path.join(__dirname, 'out', 'physics', 'physics.js'));

function mkPlayer(id, role, x, y) {
  return { id, username: id, avatar: 'cat-blue', role, stage: 1, x, y, vx: 0, vy: 0, facing: 1, onGround: true };
}

function run({ shooterRole, targetRole, pvp }) {
  const shooter = mkPlayer('shooter', shooterRole, 1000, 400);
  const target = mkPlayer('target', targetRole, 1040, 400);
  const rounds = [
    { id: 'r1', x: 1045, y: 410, vx: 10, shooterId: 'shooter', damage: 1, len: 24, w: 24, h: 8, shooterRole },
  ];
  const hits = [];
  updatePlayerPhysics(
    shooter,
    { left: false, right: false, jump: false },
    [target],
    [],
    () => {},
    1,
    () => {},
    {
      playerRounds: rounds,
      isPvpEnabled: pvp,
      myPlayerId: 'shooter',
      onPlayerHitByRound: (victimId, shooterId) => hits.push({ victimId, shooterId }),
    },
  );
  return { roundsLeft: rounds.length, hits };
}

const cases = [
  ['admin -> student', { shooterRole: 'admin', targetRole: 'student', pvp: false }, 'HIT'],
  ['admin -> teacher', { shooterRole: 'admin', targetRole: 'teacher', pvp: false }, 'HIT'],
  ['teacher -> student', { shooterRole: 'teacher', targetRole: 'student', pvp: false }, 'HIT'],
  ['teacher -> admin', { shooterRole: 'teacher', targetRole: 'admin', pvp: true }, 'NO'],
  ['teacher -> teacher', { shooterRole: 'teacher', targetRole: 'teacher', pvp: true }, 'NO'],
  ['student -> student pvp off', { shooterRole: 'student', targetRole: 'student', pvp: false }, 'NO'],
  ['student -> student pvp on', { shooterRole: 'student', targetRole: 'student', pvp: true }, 'HIT'],
  ['student -> admin pvp on', { shooterRole: 'student', targetRole: 'admin', pvp: true }, 'NO'],
];

let fail = 0;
for (const [name, args, exp] of cases) {
  const r = run(args);
  const got = r.hits.length > 0 && r.roundsLeft === 0 ? 'HIT' : 'NO';
  const ok = got === exp;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  path2 ${name.padEnd(28)} expect=${exp} got=${got} hits=${r.hits.length} roundsLeft=${r.roundsLeft}`);
}
console.log(fail === 0 ? '\nALL PASS (path2)' : `\nFAILURES: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
