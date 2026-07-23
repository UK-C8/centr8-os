-- Same reasoning as 0002/0004/0007/0012/0015/0017/0020/0023/0027/0030/0033_force_rls*.sql.

alter table "performance_reviews" force row level security;
alter table "okrs" force row level security;
alter table "job_postings" force row level security;
alter table "candidates" force row level security;
alter table "hr_cases" force row level security;
alter table "training_courses" force row level security;
alter table "training_completions" force row level security;
alter table "engagement_surveys" force row level security;
alter table "survey_responses" force row level security;
