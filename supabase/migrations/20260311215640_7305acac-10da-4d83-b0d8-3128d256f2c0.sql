
-- Fix certificate RLS: make verification truly public by switching to PERMISSIVE
DROP POLICY IF EXISTS "Public certificate verification" ON public.certificates;
DROP POLICY IF EXISTS "Users can view own certificate" ON public.certificates;
DROP POLICY IF EXISTS "Admins can manage certificates" ON public.certificates;

-- Permissive SELECT for public verification
CREATE POLICY "Public certificate verification"
ON public.certificates FOR SELECT
TO public
USING (true);

-- Permissive ALL for admins
CREATE POLICY "Admins can manage certificates"
ON public.certificates FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow authenticated users to insert their own certificate
CREATE POLICY "Users can insert own certificate"
ON public.certificates FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
