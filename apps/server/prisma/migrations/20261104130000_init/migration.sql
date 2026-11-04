CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "karaoke_rooms" (
  "id" VARCHAR(8) NOT NULL,
  "name" TEXT NOT NULL,
  "host_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "karaoke_rooms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "karaoke_rooms_host_id_idx" ON "karaoke_rooms"("host_id");

CREATE TABLE "room_members" (
  "id" UUID NOT NULL,
  "room_id" VARCHAR(8) NOT NULL,
  "user_id" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "room_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_members_room_id_user_id_key" ON "room_members"("room_id", "user_id");
CREATE INDEX "room_members_user_id_idx" ON "room_members"("user_id");

CREATE TABLE "room_tv_states" (
  "id" UUID NOT NULL,
  "room_id" VARCHAR(8) NOT NULL,
  "current_video_id" TEXT,
  "current_song_title" TEXT,
  "current_thumbnail" TEXT,
  "current_channel_title" TEXT,
  "current_song_id" TEXT,
  "current_requested_by" TEXT,
  "current_requested_by_name" TEXT,
  "playback_state" TEXT NOT NULL DEFAULT 'idle',
  "current_time" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "duration" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "host_id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "song_session_id" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "room_tv_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_tv_states_room_id_key" ON "room_tv_states"("room_id");

CREATE TABLE "song_queue" (
  "id" UUID NOT NULL,
  "room_id" VARCHAR(8) NOT NULL,
  "video_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "thumbnail" TEXT NOT NULL,
  "channel_title" TEXT NOT NULL DEFAULT '',
  "requested_by" UUID NOT NULL,
  "requested_by_name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "song_queue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "song_queue_room_id_status_position_idx" ON "song_queue"("room_id", "status", "position");

CREATE TABLE "tv_permissions" (
  "id" UUID NOT NULL,
  "room_id" VARCHAR(8) NOT NULL,
  "member_can_add_song" BOOLEAN NOT NULL DEFAULT true,
  "member_can_vote_skip" BOOLEAN NOT NULL DEFAULT true,
  "member_can_control_playback" BOOLEAN NOT NULL DEFAULT false,
  "cohost_can_control_playback" BOOLEAN NOT NULL DEFAULT true,
  "host_only_clear_queue" BOOLEAN NOT NULL DEFAULT true,
  "skip_threshold" INTEGER NOT NULL DEFAULT 2,
  "auto_skip_on_threshold" BOOLEAN NOT NULL DEFAULT false,
  "vote_cooldown_ms" INTEGER NOT NULL DEFAULT 5000,
  "vote_duration_ms" INTEGER NOT NULL DEFAULT 60000,
  CONSTRAINT "tv_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tv_permissions_room_id_key" ON "tv_permissions"("room_id");

CREATE TABLE "skip_votes" (
  "id" UUID NOT NULL,
  "room_id" VARCHAR(8) NOT NULL,
  "song_session_id" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "skip_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skip_votes_room_id_song_session_id_user_id_key" ON "skip_votes"("room_id", "song_session_id", "user_id");
CREATE INDEX "skip_votes_room_id_song_session_id_idx" ON "skip_votes"("room_id", "song_session_id");

CREATE TABLE "action_logs" (
  "id" UUID NOT NULL,
  "room_id" VARCHAR(8) NOT NULL,
  "user_id" UUID,
  "action" TEXT NOT NULL,
  "detail" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "action_logs_room_id_created_at_idx" ON "action_logs"("room_id", "created_at");

ALTER TABLE "karaoke_rooms" ADD CONSTRAINT "karaoke_rooms_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "karaoke_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_tv_states" ADD CONSTRAINT "room_tv_states_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "karaoke_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "song_queue" ADD CONSTRAINT "song_queue_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "karaoke_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "song_queue" ADD CONSTRAINT "song_queue_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tv_permissions" ADD CONSTRAINT "tv_permissions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "karaoke_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "skip_votes" ADD CONSTRAINT "skip_votes_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "karaoke_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "skip_votes" ADD CONSTRAINT "skip_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "karaoke_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
