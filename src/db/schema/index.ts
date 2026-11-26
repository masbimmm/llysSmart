import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
};

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    fullName: text('full_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    // SSO: NIS/NIP dari Siakad. Null untuk user yang daftar manual.
    externalId: text('external_id'),
    role: text('role', { enum: ['admin', 'teacher', 'student'] }).notNull(),
    avatar: text('avatar').notNull().default('cat-blue'),
    totalPoints: integer('total_points').notNull().default(0),
    totalStars: integer('total_stars').notNull().default(0),
    customNick: text('custom_nick'),
    tag1: text('tag1'),
    tag2: text('tag2'),
    tag3: text('tag3'),
    customColors: text('custom_colors'),
    unlockedBodies: text('unlocked_bodies'),
    equippedBody: text('equipped_body'),
    ...timestamps,
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    usernameIdx: uniqueIndex('users_username_idx').on(t.username),
    externalIdIdx: uniqueIndex('users_external_id_idx').on(t.externalId),
  }),
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    ...timestamps,
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
  }),
);

export const classrooms = sqliteTable(
  'classrooms',
  {
    id: text('id').primaryKey(),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    subject: text('subject').notNull(),
    grade: text('grade').notNull(),
    description: text('description').notNull().default(''),
    joinCode: text('join_code').notNull(),
    ...timestamps,
  },
  (t) => ({
    joinCodeIdx: uniqueIndex('classrooms_join_code_idx').on(t.joinCode),
    teacherIdx: index('classrooms_teacher_idx').on(t.teacherId),
  }),
);

export const classroomMembers = sqliteTable(
  'classroom_members',
  {
    id: text('id').primaryKey(),
    classroomId: text('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => ({
    memberIdx: uniqueIndex('classroom_members_unique_idx').on(t.classroomId, t.studentId),
  }),
);

export const questions = sqliteTable(
  'questions',
  {
    id: text('id').primaryKey(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['multiple_choice', 'true_false', 'short_answer', 'fill_blank'],
    })
      .notNull()
      .default('multiple_choice'),
    content: text('content').notNull(),
    imageUrl: text('image_url'),
    correctAnswer: text('correct_answer').notNull(),
    explanation: text('explanation').notNull().default(''),
    difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] })
      .notNull()
      .default('easy'),
    category: text('category').notNull().default('umum'),
    points: integer('points').notNull().default(10),
    timeLimit: integer('time_limit').notNull().default(30),
    ...timestamps,
  },
  (t) => ({
    creatorIdx: index('questions_creator_idx').on(t.creatorId),
  }),
);

export const questionOptions = sqliteTable(
  'question_options',
  {
    id: text('id').primaryKey(),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    label: text('label', { enum: ['A', 'B', 'C', 'D', 'E'] }).notNull(),
    content: text('content').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => ({
    questionIdx: index('question_options_question_idx').on(t.questionId),
  }),
);

export const questionCollections = sqliteTable('question_collections', {
  id: text('id').primaryKey(),
  teacherId: text('teacher_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  ...timestamps,
});

export const collectionQuestions = sqliteTable(
  'collection_questions',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => questionCollections.id, { onDelete: 'cascade' }),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    uniqueIdx: uniqueIndex('collection_questions_unique_idx').on(t.collectionId, t.questionId),
  }),
);

export const levels = sqliteTable(
  'levels',
  {
    id: text('id').primaryKey(),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] })
      .notNull()
      .default('easy'),
    mapConfig: text('map_config').notNull().default('{}'),
    rewardConfig: text('reward_config').notNull().default('{}'),
    completionRequirement: integer('completion_requirement').notNull().default(1),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    teacherIdx: index('levels_teacher_idx').on(t.teacherId),
  }),
);

export const levelQuestions = sqliteTable(
  'level_questions',
  {
    id: text('id').primaryKey(),
    levelId: text('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'cascade' }),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => ({
    levelIdx: index('level_questions_level_idx').on(t.levelId),
  }),
);

export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    hostId: text('host_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classroomId: text('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    levelId: text('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    maxPlayers: integer('max_players').notNull().default(40),
    status: text('status', {
      enum: ['waiting', 'starting', 'in_progress', 'paused', 'completed'],
    })
      .notNull()
      .default('waiting'),
    settings: text('settings').notNull().default('{}'),
    activeQuestionId: text('active_question_id'),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    endedAt: integer('ended_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (t) => ({
    codeIdx: uniqueIndex('rooms_code_idx').on(t.code),
    hostIdx: index('rooms_host_idx').on(t.hostId),
  }),
);

export const roomPlayers = sqliteTable(
  'room_players',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    avatar: text('avatar').notNull().default('cat-blue'),
    lastX: real('last_x').notNull().default(120),
    lastY: real('last_y').notNull().default(600),
    lastFacing: integer('last_facing').notNull().default(1),
    ready: integer('ready', { mode: 'boolean' }).notNull().default(false),
    joinedAt: integer('joined_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    roomIdx: index('room_players_room_idx').on(t.roomId),
    uniqueIdx: uniqueIndex('room_players_unique_idx').on(t.roomId, t.userId),
  }),
);

export const gameSessions = sqliteTable(
  'game_sessions',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    levelId: text('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'cascade' }),
    score: integer('score').notNull().default(0),
    stars: integer('stars').notNull().default(0),
    progressPct: integer('progress_pct').notNull().default(0),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (t) => ({
    roomUserIdx: index('game_sessions_room_user_idx').on(t.roomId, t.userId),
  }),
);

export const playerAnswers = sqliteTable(
  'player_answers',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => gameSessions.id, { onDelete: 'cascade' }),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    answer: text('answer').notNull(),
    isCorrect: integer('is_correct', { mode: 'boolean' }).notNull(),
    pointsEarned: integer('points_earned').notNull().default(0),
    assisted: integer('assisted', { mode: 'boolean' }).notNull().default(false),
    timeSpent: integer('time_spent').notNull().default(0),
    answeredAt: integer('answered_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    sessionIdx: index('player_answers_session_idx').on(t.sessionId),
  }),
);

export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    senderName: text('sender_name').notNull(),
    text: text('text').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    roomIdx: index('chat_messages_room_idx').on(t.roomId),
  }),
);

export const gameEvents = sqliteTable(
  'game_events',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    eventType: text('event_type').notNull(),
    payload: text('payload').notNull().default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    roomIdx: index('game_events_room_idx').on(t.roomId),
  }),
);

export const playerProgress = sqliteTable(
  'player_progress',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    levelId: text('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'cascade' }),
    stars: integer('stars').notNull().default(0),
    bestScore: integer('best_score').notNull().default(0),
    bestTime: integer('best_time').notNull().default(0),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    unlocked: integer('unlocked', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    uniqueIdx: uniqueIndex('player_progress_unique_idx').on(t.userId, t.levelId),
  }),
);

export const achievements = sqliteTable(
  'achievements',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    label: text('label').notNull(),
    earnedAt: integer('earned_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    userIdx: index('achievements_user_idx').on(t.userId),
  }),
);

export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
