/**
 * ============================================================================
 *  src/lib/supabase.ts  —  REMOVED / NO-OP STUB
 * ============================================================================
 *
 *  Supabase has been fully removed from this project. The application now uses
 *  Firebase (Auth, Firestore, Storage, Cloud Functions, Trigger Email
 *  extension) for ALL backend functionality.
 *
 *  This file remains ONLY as a transitional stub so that legacy imports
 *  (`import { supabase } from '@/lib/supabase'`) do not break the build while
 *  the remaining call-sites are migrated to their Firebase equivalents.
 *
 *  Every method on the stub:
 *    • returns an empty/no-op result
 *    • logs a one-time console warning identifying the caller, so you can grep
 *      the console and find any code path that is still pointing at Supabase
 *    • returns the shape Supabase callers expect (`{ data, error }`) so that
 *      destructuring keeps working
 *
 *  If you see "[supabase-stub]" warnings in the browser console, that code
 *  path needs to be rewritten to call Firebase directly.
 * ============================================================================
 */

const STUB_ERROR = {
  message:
    'Supabase has been removed from this project. Migrate this call to Firebase (Firestore / Storage / Cloud Functions).',
  name: 'SupabaseRemovedError',
  code: 'SUPABASE_REMOVED',
};

const warned = new Set<string>();
function warnOnce(label: string) {
  if (warned.has(label)) return;
  warned.add(label);
  // eslint-disable-next-line no-console
  console.warn(
    `[supabase-stub] Call to "${label}" was ignored — Supabase is removed. ` +
      `Migrate this code path to Firebase.`,
  );
}

// ---------------------------------------------------------------------------
// Query builder — supports the chainable Supabase syntax we use across the app
// ---------------------------------------------------------------------------
function makeQueryBuilder(table: string) {
  const noResult = { data: null, error: STUB_ERROR };
  const emptyList = { data: [] as any[], error: null };

  const builder: any = {
    select: (..._args: any[]) => {
      warnOnce(`supabase.from('${table}').select`);
      return builder;
    },
    insert: (..._args: any[]) => {
      warnOnce(`supabase.from('${table}').insert`);
      return builder;
    },
    update: (..._args: any[]) => {
      warnOnce(`supabase.from('${table}').update`);
      return builder;
    },
    upsert: (..._args: any[]) => {
      warnOnce(`supabase.from('${table}').upsert`);
      return builder;
    },
    delete: () => {
      warnOnce(`supabase.from('${table}').delete`);
      return builder;
    },
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    in: () => builder,
    is: () => builder,
    or: () => builder,
    and: () => builder,
    contains: () => builder,
    containedBy: () => builder,
    range: () => builder,
    limit: () => builder,
    order: () => builder,
    match: () => builder,
    not: () => builder,
    filter: () => builder,
    single: () => Promise.resolve(noResult),
    maybeSingle: () => Promise.resolve(noResult),
    then: (resolve: any) => Promise.resolve(emptyList).then(resolve),
  };

  return builder;
}

// ---------------------------------------------------------------------------
// Storage stub
// ---------------------------------------------------------------------------
const storageBucket = (bucket: string) => ({
  upload: async (..._args: any[]) => {
    warnOnce(`supabase.storage.from('${bucket}').upload`);
    return { data: null, error: STUB_ERROR };
  },
  download: async (..._args: any[]) => {
    warnOnce(`supabase.storage.from('${bucket}').download`);
    return { data: null, error: STUB_ERROR };
  },
  remove: async (..._args: any[]) => {
    warnOnce(`supabase.storage.from('${bucket}').remove`);
    return { data: null, error: STUB_ERROR };
  },
  list: async (..._args: any[]) => {
    warnOnce(`supabase.storage.from('${bucket}').list`);
    return { data: [], error: null };
  },
  getPublicUrl: (_path: string) => ({ data: { publicUrl: '' } }),
  createSignedUrl: async (..._args: any[]) => {
    warnOnce(`supabase.storage.from('${bucket}').createSignedUrl`);
    return { data: null, error: STUB_ERROR };
  },
});

// ---------------------------------------------------------------------------
// Auth stub (no-ops — Firebase Auth is the real source of truth)
// ---------------------------------------------------------------------------
const authStub = {
  getUser: async () => ({ data: { user: null }, error: null }),
  getSession: async () => ({ data: { session: null }, error: null }),
  signInWithPassword: async () => {
    warnOnce('supabase.auth.signInWithPassword');
    return { data: null, error: STUB_ERROR };
  },
  signUp: async () => {
    warnOnce('supabase.auth.signUp');
    return { data: null, error: STUB_ERROR };
  },
  signOut: async () => ({ error: null }),
  onAuthStateChange: (_cb: any) => ({
    data: { subscription: { unsubscribe: () => {} } },
  }),
  updateUser: async () => {
    warnOnce('supabase.auth.updateUser');
    return { data: null, error: STUB_ERROR };
  },
  resetPasswordForEmail: async () => {
    warnOnce('supabase.auth.resetPasswordForEmail');
    return { data: null, error: STUB_ERROR };
  },
  admin: {
    getUserById: async () => ({ data: { user: null }, error: STUB_ERROR }),
  },
};

// ---------------------------------------------------------------------------
// Edge-function invoke stub
// ---------------------------------------------------------------------------
const functionsStub = {
  invoke: async (name: string, _opts?: any) => {
    warnOnce(`supabase.functions.invoke('${name}')`);
    return { data: null, error: STUB_ERROR };
  },
};

// ---------------------------------------------------------------------------
// Realtime channel stub
// ---------------------------------------------------------------------------
function channelStub(_name: string) {
  const ch: any = {
    on: () => ch,
    subscribe: () => ch,
    unsubscribe: () => Promise.resolve('ok'),
  };
  return ch;
}

// ---------------------------------------------------------------------------
// The exported stub client
// ---------------------------------------------------------------------------
export const supabase = {
  from: (table: string) => makeQueryBuilder(table),
  storage: { from: (bucket: string) => storageBucket(bucket) },
  auth: authStub,
  functions: functionsStub,
  channel: (name: string) => channelStub(name),
  removeChannel: (_ch: any) => Promise.resolve('ok'),
  rpc: async (fn: string, _params?: any) => {
    warnOnce(`supabase.rpc('${fn}')`);
    return { data: null, error: STUB_ERROR };
  },
};

// Back-compat: a couple of files imported this helper. Keep it as a no-op
// that always reports failure so any leftover health-check UI is honest.
export async function testSupabaseConnection() {
  return {
    success: false,
    error:
      'Supabase has been removed from this project. Firebase is the active backend.',
  };
}

export default supabase;
