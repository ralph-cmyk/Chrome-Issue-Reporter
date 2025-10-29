# OAuth Device Flow - Visual Diagram

## The Problem: Why 404 Occurs

```
┌─────────────────────────────────────────────────────────────┐
│ Extension sends:                                             │
│ POST https://github.com/login/device/code                   │
│ Body: client_id=Ov23liJyiD9bKVNz2X2w&scope=repo            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ GitHub checks:                                               │
│                                                              │
│ ❌ Does OAuth App with this Client ID exist?                │
│    └─ NO → Return 404 Not Found                            │
│                                                              │
│ ❌ Is Device Flow enabled for this OAuth App?               │
│    └─ NO → Return 404 Not Found                            │
│                                                              │
│ ✅ Both checks pass                                         │
│    └─ Return device_code and user_code                      │
└─────────────────────────────────────────────────────────────┘
```

## The Solution: Complete Setup Required

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Create GitHub OAuth App                             │
│ https://github.com/settings/developers                      │
│                                                              │
│ ✅ Application name: Chrome Issue Reporter                  │
│ ✅ Homepage URL: https://github.com/...                     │
│ ✅ Callback URL: http://localhost (not used but required)   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Enable Device Flow (CRITICAL!)                      │
│                                                              │
│ ⚠️  Click on OAuth App → Scroll down                        │
│ ⚠️  Find "Enable Device Flow" checkbox                      │
│ ✅ CHECK THE BOX (it's OFF by default!)                     │
│ ✅ Click "Update application"                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Copy Client ID                                      │
│                                                              │
│ Client ID: Ov23li_YOUR_REAL_CLIENT_ID_HERE                 │
│ (Looks like: Ov23li... followed by random characters)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Update Extension Code                               │
│ File: extension/background.js (line 15)                     │
│                                                              │
│ const GITHUB_CLIENT_ID = 'Ov23li_YOUR_CLIENT_ID';          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Reload Extension                                    │
│ chrome://extensions/ → Click 🔄 Reload button               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ NOW THE PAYLOAD WORKS!                                       │
│                                                              │
│ Extension sends:                                             │
│ POST https://github.com/login/device/code                   │
│ Body: client_id=YOUR_REAL_ID&scope=repo                     │
│                                                              │
│ GitHub responds:                                             │
│ ✅ 200 OK                                                    │
│ {                                                            │
│   "device_code": "...",                                      │
│   "user_code": "ABCD-1234",                                 │
│   "verification_uri": "https://github.com/login/device",    │
│   "expires_in": 900,                                         │
│   "interval": 5                                              │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
```

## The Full OAuth Device Flow (When Setup is Complete)

```
┌──────────────┐                                    ┌──────────────┐
│  Extension   │                                    │   GitHub     │
└──────┬───────┘                                    └──────┬───────┘
       │                                                   │
       │ 1. POST /login/device/code                       │
       │    client_id + scope                             │
       │─────────────────────────────────────────────────▶│
       │                                                   │
       │ 2. device_code, user_code, verification_uri      │
       │◀─────────────────────────────────────────────────│
       │                                                   │
       │                                                   │
┌──────▼───────┐                                    ┌──────▼───────┐
│   Shows      │                                    │              │
│  user_code   │     3. User enters code            │   User       │
│  to user     │         and authorizes             │ Authorization│
└──────────────┘                                    │   Page       │
                                                    └──────────────┘
       │                                                   │
       │ 4. Poll POST /login/oauth/access_token           │
       │    client_id + device_code + grant_type          │
       │─────────────────────────────────────────────────▶│
       │                                                   │
       │ 5a. {"error": "authorization_pending"}           │
       │    (user hasn't authorized yet)                  │
       │◀─────────────────────────────────────────────────│
       │                                                   │
       │ ... wait and poll again ...                      │
       │                                                   │
       │ 5b. {"access_token": "gho_..."}                  │
       │    (user authorized! success!)                   │
       │◀─────────────────────────────────────────────────│
       │                                                   │
┌──────▼───────┐                                          │
│ Saves token  │                                          │
│ Shows success│                                          │
└──────────────┘                                          │
```

## Common Mistake Timeline

### ❌ What Users Do Wrong

```
1. User downloads extension
2. User reads: "No OAuth app setup required" (OLD README - now fixed!)
3. User clicks "Sign in with GitHub"
4. Extension sends: client_id=Ov23liJyiD9bKVNz2X2w&scope=repo
5. GitHub returns: 404 Not Found
6. User sees error: "Failed to initiate device flow"
7. User is confused: "Why doesn't it work?"
```

### ✅ What Users Should Do (After Our Fix)

```
1. User downloads extension
2. User reads: "OAuth App with Device Flow is REQUIRED"
3. User reads: SETUP-DEVICE-FLOW.md
4. User creates OAuth App
5. User enables Device Flow checkbox ← CRITICAL STEP!
6. User updates GITHUB_CLIENT_ID in background.js
7. User reloads extension
8. User clicks "Sign in with GitHub"
9. Extension sends: client_id=USER_REAL_ID&scope=repo
10. GitHub returns: 200 OK + device_code + user_code
11. User enters code and authorizes
12. Extension receives access_token
13. ✅ SUCCESS!
```

## Error Message Comparison

### Before Our Fix

```
❌ "Failed to initiate device flow (status: 404)"

User thinks: "What does this mean? Is GitHub down?"
```

### After Our Fix

```
✅ "OAuth App not configured correctly!

Common causes:
1. Device Flow is not enabled in your GitHub OAuth App
2. The Client ID in background.js is incorrect
3. The OAuth App doesn't exist

To fix:
1. Go to https://github.com/settings/developers
2. Open your OAuth App settings
3. Enable "Device Flow" checkbox
4. Update GITHUB_CLIENT_ID in background.js
5. Reload the extension

See INSTALL.md for detailed instructions."

User thinks: "Ah! I need to enable Device Flow. Let me do that!"
```

## Quick Reference

| Status | Meaning | Solution |
|--------|---------|----------|
| 404 | OAuth App doesn't exist OR Device Flow disabled | Create app, enable Device Flow |
| 200 + device_code | Setup is correct! | Continue with authorization |
| authorization_pending | User hasn't authorized yet | User needs to enter code on GitHub |
| access_token received | SUCCESS! | Token saved, user signed in |

## Key Insight

**The payload `client_id=Ov23liJyiD9bKVNz2X2w&scope=repo` is:**
- ✅ Correct format
- ✅ Correct parameters
- ✅ Correct encoding
- ❌ **Insufficient without proper OAuth App setup!**

GitHub validates the Client ID server-side and requires Device Flow to be enabled. The payload alone cannot bypass this requirement.

---

See [SETUP-DEVICE-FLOW.md](SETUP-DEVICE-FLOW.md) for complete setup guide.
