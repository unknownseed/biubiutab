ALTER TABLE IF EXISTS ai_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_jobs_select_own" ON ai_jobs;
DROP POLICY IF EXISTS "ai_jobs_insert_own" ON ai_jobs;
DROP POLICY IF EXISTS "ai_jobs_update_own" ON ai_jobs;
DROP POLICY IF EXISTS "ai_jobs_delete_own" ON ai_jobs;
DROP POLICY IF EXISTS "ai_jobs_service_role_all" ON ai_jobs;

CREATE POLICY "ai_jobs_select_own" ON ai_jobs
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "ai_jobs_insert_own" ON ai_jobs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_jobs_update_own" ON ai_jobs
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_jobs_delete_own" ON ai_jobs
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "ai_jobs_service_role_all" ON ai_jobs
FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

