
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cbfhmgsxqudgynyxommv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZmhtZ3N4cXVkZ3lueXhvbW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0ODczOTIsImV4cCI6MjA4NTA2MzM5Mn0.rVksu-3L3z2bWn4or-RhEY0t-ESA7H6xuolAoAhEFJ4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
