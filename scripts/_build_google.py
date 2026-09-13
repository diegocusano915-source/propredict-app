import io, re

# ---- get real anon key ----
admin = io.open('public/direct-admin.html', encoding='utf-8').read()
ANON = re.search(r"SUPABASE_ANON_KEY\s*=\s*'([^']+)'", admin).group(1)
SB_URL = 'https://veyydrngucgtnwqffnew.supabase.co'

# ============================================================
# 1. index.html — real Supabase client + Google button
# ============================================================
p = 'public/index.html'
src = io.open(p, encoding='utf-8').read()

# 1a. Google button in the auth modal (above the form)
old_form = '''      <form id="authForm" class="auth-form">
        <div class="form-group"><label for="authEmail" data-i18n="auth.email">Email</label>'''
assert old_form in src
new_form = '''      <button type="button" id="googleAuthBtn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px;margin-bottom:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.06);color:#e8edf5;font-weight:700;font-size:14px;cursor:pointer;transition:all .25s;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
        Continue with Google
      </button>
      <div style="display:flex;align-items:center;gap:12px;margin:2px 0 12px;"><div style="flex:1;height:1px;background:rgba(255,255,255,0.1);"></div><span style="font-size:11px;color:#8a9bb5;">or with email</span><div style="flex:1;height:1px;background:rgba(255,255,255,0.1);"></div></div>
      <form id="authForm" class="auth-form">
        <div class="form-group"><label for="authEmail" data-i18n="auth.email">Email</label>'''
src = src.replace(old_form, new_form, 1)

# 1b. Replace the FAKE supabase stub with a REAL minimal client
old_stub_start = src.index('(function initSupabase() {')
old_stub_end = src.index('console.log(\'\u2705 Supabase client initialized\');')
old_stub_end = src.index('})();', old_stub_end) + len('})();')
new_stub = '''(function initSupabase() {
  if (window.supabase) return;

  // REAL Supabase project credentials (anon key is public-by-design, RLS-protected)
  const SUPABASE_URL = '%s';
  const SUPABASE_ANON_KEY = '%s';

  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  window.supabase = {
    auth: {
      // Real OAuth: Supabase hosted authorize endpoint. The apikey is REQUIRED
      // as a query param for browser redirects.
      signInWithOAuth: async ({ provider, options }) => {
        const redirectTo = options?.redirectTo || (window.location.origin + '/auth/callback.html');
        const params = new URLSearchParams({ provider: provider, redirect_to: redirectTo, apikey: SUPABASE_ANON_KEY });
        window.location.href = SUPABASE_URL + '/auth/v1/authorize?' + params.toString();
        return { data: {}, error: null };
      },
      // Exchange the #hash tokens from the OAuth redirect for the user object
      exchangeCodeForSession: async () => {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        if (!accessToken) return { data: { session: null }, error: null };
        const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
          headers: { 'Authorization': 'Bearer ' + accessToken, 'apikey': SUPABASE_ANON_KEY }
        });
        if (!res.ok) return { data: { session: null }, error: new Error('Supabase session invalid') };
        const user = await res.json();
        return { data: { session: { access_token: accessToken, user: user } }, error: null };
      },
      getSession: async () => {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken) {
          const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
            headers: { 'Authorization': 'Bearer ' + accessToken, 'apikey': SUPABASE_ANON_KEY }
          });
          if (res.ok) {
            const user = await res.json();
            return { data: { session: { access_token: accessToken, refresh_token: refreshToken, user: user } }, error: null };
          }
        }
        return { data: { session: null }, error: null };
      }
    }
  };
})();''' % (SB_URL, ANON)
src = src[:old_stub_start] + new_stub + src[old_stub_end:]

# 1c. Wire the Google button
old_tail = '</body>\n</html>'
assert src.rstrip().endswith(old_tail)
src = src.rstrip()[: -len(old_tail)] + '''
<script>
  // Continue with Google -> real Supabase OAuth
  document.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest ? e.target.closest('#googleAuthBtn') : null;
    if (!btn) return;
    if (window.supabase && window.supabase.auth.signInWithOAuth) {
      window.supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback.html' } });
    } else {
      alert('Google sign-in is unavailable right now. Please use email.');
    }
  });
</script>
''' + old_tail

io.open(p, 'w', encoding='utf-8', newline='\n').write(src)
print('index.html: real supabase client + google button')

# ============================================================
# 2. public/auth/callback.html — the missing OAuth landing page
# ============================================================
callback = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Signing you in... | ProPredict</title>
<style>
  body { margin:0; background:#070b14; color:#a0b3d9; font-family:Inter,system-ui,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
  .box { text-align:center; padding:40px; }
  .pulse { width:54px; height:54px; margin:0 auto 22px; border-radius:50%; border:3px solid rgba(0,245,255,0.15); border-top-color:#00f5ff; animation:spin .9s linear infinite; box-shadow:0 0 22px rgba(0,245,255,0.25); }
  @keyframes spin { to { transform:rotate(360deg); } }
  h1 { color:#fff; font-size:1.2rem; margin:0 0 8px; }
  .err { color:#ff6b6b; font-size:.85rem; margin-top:14px; }
  a { color:#00f5ff; }
</style>
</head>
<body>
<div class="box">
  <div class="pulse" id="spinner"></div>
  <h1 id="status">Completing Google sign-in...</h1>
  <div class="err" id="err"></div>
</div>
<script>
(function() {
  var SUPABASE_URL = '%s';
  var SUPABASE_ANON_KEY = '%s';

  function fail(msg) {
    document.getElementById('spinner').style.display = 'none';
    document.getElementById('status').textContent = 'Sign-in failed';
    document.getElementById('err').textContent = msg;
    setTimeout(function() { window.location.href = '/'; }, 3500);
  }

  (async function() {
    try {
      var params = new URLSearchParams(window.location.hash.substring(1) || window.location.search.substring(1));
      var accessToken = params.get('access_token');

      // Supabase PKCE flow may return a code instead of tokens
      if (!accessToken) {
        var code = params.get('code');
        if (code) {
          var r0 = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=pkce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
            body: JSON.stringify({ auth_code: code })
          });
          if (r0.ok) { var j0 = await r0.json(); accessToken = j0.access_token; }
        }
      }

      if (!accessToken) return fail('No session returned by Google. Please try again.');

      // Verify the session with Supabase and load the account
      var r1 = await fetch(SUPABASE_URL + '/auth/v1/user', {
        headers: { 'Authorization': 'Bearer ' + accessToken, 'apikey': SUPABASE_ANON_KEY }
      });
      if (!r1.ok) return fail('Your Google session expired. Please try again.');
      var sbUser = await r1.json();

      // Exchange for OUR app session (server verifies the token again)
      var r2 = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: accessToken,
          email: sbUser.email,
          supabaseId: sbUser.id,
          name: (sbUser.user_metadata && (sbUser.user_metadata.full_name || sbUser.user_metadata.name)) || null,
          avatarUrl: (sbUser.user_metadata && sbUser.user_metadata.avatar_url) || null
        })
      });
      var data = await r2.json();
      if (!r2.ok || !data.token) return fail(data.error || 'Server rejected the sign-in. Please try email instead.');

      // Store exactly like the email login does
      localStorage.setItem('propredict_token', data.token);
      localStorage.setItem('pp_token', data.token);
      localStorage.setItem('token', data.token);
      localStorage.setItem('propredict_user', JSON.stringify({ email: data.email || sbUser.email, name: data.name || null, avatarUrl: (sbUser.user_metadata && sbUser.user_metadata.avatar_url) || null }));
      if (data.referralCode) localStorage.setItem('referralCode', data.referralCode);

      document.getElementById('status').textContent = 'Welcome' + (data.name ? ', ' + data.name : '') + '! Redirecting...';
      setTimeout(function() { window.location.href = '/'; }, 700);
    } catch (e) {
      fail(e.message || 'Unexpected error during sign-in.');
    }
  })();
})();
</script>
</body>
</html>
''' % (SB_URL, ANON)
io.open('public/auth/callback.html', 'w', encoding='utf-8', newline='\n').write(callback)
print('auth/callback.html created')
