// Simulasi role-based gun hit rules memakai physics.ts asli (hasil compile tsc).
const path = require('path');
const P = require(path.join(__dirname, 'out', 'physics', 'physics.js'));

const { updatePlayerPhysics, canShooterHitTarget } = P;

function mkPlayer(id, role, x, y) {
  return {
    id,
    username: id,
    avatar: 'cat-blue',
    role,
    stage: 1,
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: true,
  };
}

// world groundY / dimensi tidak penting: kita taruh peluru tepat di badan target
function roundAt(target, shooterId, shooterRole, extra = {}) {
  return {
    id: `r_${Math.random()}`,
    x: target.x + 10,
    y: target.y + 10,
    vx: 10,
    shooterId,
    damage: 1,
    len: 24,
    w: 24,
    h: 8,
    shooterRole,
    ...extra,
  };
}

function runHit({ shooterRole, targetRole, weapon, pvp }) {
  const target = mkPlayer('target', targetRole, 1000, 400);
  const rounds = [roundAt(target, 'shooter', shooterRole, weapon ? { weapon } : {})];
  const hits = [];
  updatePlayerPhysics(
    target,
    { left: false, right: false, jump: false },
    [],
    [],
    () => {},
    1,
    () => {},
    {
      playerRounds: rounds,
      isPvpEnabled: pvp,
      myPlayerId: 'target',
      onPlayerHitByRound: (victimId, shooterId, dmg, w) => hits.push({ victimId, shooterId, w }),
    },
  );
  return {
    dying: !!target.isDying,
    frozen: !!target.frozenUntil,
    stunned: !!target.stunnedUntil,
    pushedVx: target.vx,
    roundsLeft: rounds.length,
    hits,
  };
}

const scenarios = [
  { name: 'admin -> student (normal)', shooterRole: 'admin', targetRole: 'student', pvp: false },
  { name: 'admin -> teacher (normal)', shooterRole: 'admin', targetRole: 'teacher', pvp: false },
  { name: 'teacher -> student (normal)', shooterRole: 'teacher', targetRole: 'student', pvp: false },
  { name: 'teacher -> admin (normal)', shooterRole: 'teacher', targetRole: 'admin', pvp: true },
  { name: 'teacher -> teacher (normal)', shooterRole: 'teacher', targetRole: 'teacher', pvp: true },
  { name: 'student -> student (pvp off)', shooterRole: 'student', targetRole: 'student', pvp: false },
  { name: 'student -> student (pvp on)', shooterRole: 'student', targetRole: 'student', pvp: true },
  { name: 'student -> teacher (pvp on)', shooterRole: 'student', targetRole: 'teacher', pvp: true },
  { name: 'student -> admin (pvp on)', shooterRole: 'student', targetRole: 'admin', pvp: true },
  { name: 'admin -> student (ice)', shooterRole: 'admin', targetRole: 'student', weapon: 'ice', pvp: false },
  { name: 'teacher -> student (ice)', shooterRole: 'teacher', targetRole: 'student', weapon: 'ice', pvp: false },
  { name: 'teacher -> admin (ice)', shooterRole: 'teacher', targetRole: 'admin', weapon: 'ice', pvp: true },
  { name: 'admin -> student (stunt)', shooterRole: 'admin', targetRole: 'student', weapon: 'stunt', pvp: false },
  { name: 'student -> student (stunt, pvp off)', shooterRole: 'student', targetRole: 'student', weapon: 'stunt', pvp: false },
  { name: 'admin -> student (megalaser)', shooterRole: 'admin', targetRole: 'student', weapon: 'megalaser', pvp: false },
];

const expect = {
  'admin -> student (normal)': 'HIT',
  'admin -> teacher (normal)': 'HIT',
  'teacher -> student (normal)': 'HIT',
  'teacher -> admin (normal)': 'NO',
  'teacher -> teacher (normal)': 'NO',
  'student -> student (pvp off)': 'NO',
  'student -> student (pvp on)': 'HIT',
  'student -> teacher (pvp on)': 'NO',
  'student -> admin (pvp on)': 'NO',
  'admin -> student (ice)': 'FREEZE',
  'teacher -> student (ice)': 'FREEZE',
  'teacher -> admin (ice)': 'NO',
  'admin -> student (stunt)': 'STUN',
  'student -> student (stunt, pvp off)': 'NO',
  'admin -> student (megalaser)': 'HIT',
};

let fail = 0;
console.log('rule fn sanity:');
console.log('  canShooterHitTarget(undefined,"student") =', canShooterHitTarget(undefined, 'student'));
console.log('  canShooterHitTarget("admin","teacher")   =', canShooterHitTarget('admin', 'teacher'));
console.log('');

for (const sc of scenarios) {
  const r = runHit(sc);
  let actual;
  if (r.frozen && r.stunned) actual = 'STUN';
  else if (r.frozen) actual = 'FREEZE';
  else if (r.dying) actual = 'HIT';
  else actual = 'NO';
  const ok = actual === expect[sc.name];
  if (!ok) fail += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${sc.name.padEnd(38)} expect=${expect[sc.name].padEnd(6)} got=${actual.padEnd(6)} ` +
      `(dying=${r.dying} frozen=${r.frozen} stunned=${r.stunned} vx=${r.pushedVx} roundsLeft=${r.roundsLeft} hits=${r.hits.length})`,
  );
}

console.log('');
console.log(fail === 0 ? 'ALL PASS' : `FAILURES: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
