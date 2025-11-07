import { createClient } from '@supabase/supabase-js';

// User provided credentials are placed here as requested.
const supabaseUrl = 'https://uxsbdwtwnbotqgpcnlmy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4c2Jkd3R3bmJvdHFncGNubG15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzI5MjMsImV4cCI6MjA3ODEwODkyM30.A3UmStvMpH_yrCODEybkkdZDTpVUe4a9UlUcTLX_fPw';

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be provided.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);