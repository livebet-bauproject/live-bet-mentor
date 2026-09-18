-- =====================================================
-- LIVE BET MENTOR - Complete Supabase Setup
-- =====================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    full_name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'pending',
    plan TEXT DEFAULT 'trial',
    subscription_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    subscription_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    approved_by TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    is_banned BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Automatically Create Profile on User Sign Up (Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS \$\$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        display_name,
        full_name,
        status,
        plan,
        subscription_start,
        subscription_end
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        CASE 
            WHEN NEW.email = 'karabulut.hamza@gmail.com' OR NEW.email = 'admin@livebetmentor.com' THEN 'approved'
            ELSE 'pending'
        END,
        CASE 
            WHEN NEW.email = 'karabulut.hamza@gmail.com' OR NEW.email = 'admin@livebetmentor.com' THEN 'admin'
            ELSE 'trial'
        END,
        NOW(),
        CASE 
            WHEN NEW.email = 'karabulut.hamza@gmail.com' OR NEW.email = 'admin@livebetmentor.com' THEN NOW() + INTERVAL '100 years'
            ELSE NOW() + INTERVAL '7 days'
        END
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.system_settings (key, value) VALUES 
('telegram_support', '@Livebetdeskbot'),
('price_trial', '0'),
('price_pro', '29'),
('price_premium', '79'),
('price_currency', '€'),
('support_email', 'karabulut.hamza@gmail.com')
ON CONFLICT (key) DO NOTHING;

-- 4. Predictions / Ledger Table
CREATE TABLE IF NOT EXISTS public.predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    match_id TEXT,
    match_name TEXT,
    home_team TEXT,
    away_team TEXT,
    minute INTEGER,
    score_at_prediction TEXT,
    market TEXT,
    prediction TEXT,
    confidence INTEGER,
    source TEXT,
    dqs DECIMAL,
    xg_home DECIMAL,
    xg_away DECIMAL,
    consensus_count INTEGER,
    status TEXT DEFAULT 'PENDING',
    final_score TEXT,
    profit DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 5. AI Usage Logs Table
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    ai_reports_count INTEGER DEFAULT 0,
    smart_alerts_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- 6. Enable Row Level Security (RLS) & Hardened Production Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON public.profiles;
CREATE POLICY "Users can view own profile or admins view all" ON public.profiles 
    FOR SELECT USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND plan = 'admin'));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles 
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles 
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles 
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND plan = 'admin'));

-- System Settings RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view settings" ON public.system_settings;
CREATE POLICY "Public can view settings" ON public.system_settings 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update settings" ON public.system_settings;
CREATE POLICY "Admins can update settings" ON public.system_settings 
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND plan = 'admin'));

-- Predictions RLS
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own predictions" ON public.predictions;
CREATE POLICY "Users can view own predictions" ON public.predictions 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert predictions" ON public.predictions;
CREATE POLICY "Users can insert predictions" ON public.predictions 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update predictions" ON public.predictions;
CREATE POLICY "Users can update predictions" ON public.predictions 
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete predictions" ON public.predictions;
CREATE POLICY "Users can delete predictions" ON public.predictions 
    FOR DELETE USING (auth.uid() = user_id);

-- AI Usage Logs RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own ai usage" ON public.ai_usage_logs;
CREATE POLICY "Users can view own ai usage" ON public.ai_usage_logs 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own ai usage" ON public.ai_usage_logs;
CREATE POLICY "Users can manage own ai usage" ON public.ai_usage_logs 
    FOR ALL USING (auth.uid() = user_id);
