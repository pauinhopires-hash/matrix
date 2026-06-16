SET session_replication_role = replica;
UPDATE public.profiles SET status='active' WHERE id IN ('3c8aca54-788d-478b-b37c-1cf6be7e577e','0497d3d5-7c37-49a7-abf4-9942513e5ba2');
SET session_replication_role = origin;
INSERT INTO public.user_roles (user_id, role) VALUES ('3c8aca54-788d-478b-b37c-1cf6be7e577e','admin'),('0497d3d5-7c37-49a7-abf4-9942513e5ba2','admin') ON CONFLICT (user_id, role) DO NOTHING;