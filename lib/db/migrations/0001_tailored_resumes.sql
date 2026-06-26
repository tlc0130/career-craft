-- Tailored resume history. Run once against the production database.
CREATE TABLE IF NOT EXISTS "tailored_resumes" (
  "id"              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"         varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title"           text NOT NULL,
  "company"         text,
  "job_title"       text,
  "original_text"   text NOT NULL,
  "tailored_text"   text NOT NULL,
  "job_description" text NOT NULL,
  "created_at"      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tailored_resumes_user_id_created_at_idx"
  ON "tailored_resumes" ("user_id", "created_at" DESC);
