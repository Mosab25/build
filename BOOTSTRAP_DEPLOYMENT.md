# Owner Bootstrap Deployment Guide

## Overview

This guide explains how to deploy the application on Render's free plan using environment variables to bootstrap the owner account without shell access.

## Problem Solved

Render's free tier does not provide shell access, making it impossible to run `reset_owner_password.py` manually. The bootstrap feature solves this by creating the owner account during app startup using environment variables.

## Environment Variables

Set these variables in your Render Dashboard under "Environment":

```
BOOTSTRAP_OWNER=true
OWNER_EMAIL=mosabhassan025@gmail.com
OWNER_PASSWORD=<your-secure-password>
OWNER_NAME=مصعب حسن
APP_ENV=production
SECRET_KEY=<your-secret-key>
DATABASE_URL=<your-neon-connection-string>
```

### Variable Descriptions

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `BOOTSTRAP_OWNER` | Yes | `true` | Set to 'true' to enable bootstrap. Case-insensitive. |
| `OWNER_EMAIL` | Yes (if BOOTSTRAP_OWNER=true) | `admin@example.com` | Email for owner login |
| `OWNER_PASSWORD` | Yes (if BOOTSTRAP_OWNER=true) | `MySecure@Pass123` | Strong password (min 8 chars) |
| `OWNER_NAME` | No | `مصعب حسن` | Owner's full name. Defaults to "مالك النظام" |
| `BOOTSTRAP_OWNER` | No (after first run) | `false` | Set to 'false' after first successful login |

## Deployment Steps

### 1. First-Time Deployment

1. **Set Environment Variables** in Render Dashboard:
   - All variables from the table above
   - Keep `BOOTSTRAP_OWNER=true`

2. **Deploy the App**:
   - Push code to GitHub
   - Trigger deployment on Render
   - Wait for app to start

3. **Verify Bootstrap**:
   - Check Render logs for: "Owner bootstrap completed"
   - Open app and login with provided `OWNER_EMAIL` and `OWNER_PASSWORD`

4. **Test Admin Access**:
   - Verify you can access the admin dashboard
   - Check that the owner role has full permissions

### 2. Post-Deployment Security

**IMPORTANT:** Disable bootstrap after successful login:

1. **Go to Render Dashboard** → Your App → Environment
2. **Modify BOOTSTRAP_OWNER** from `true` to `false` (or remove it)
3. **Save and Redeploy**
4. **Verify** the app restarts without bootstrap

This prevents accidental owner account replacement on future deployments.

## What Happens During Bootstrap

### If BOOTSTRAP_OWNER=true and credentials present:

1. Read `OWNER_EMAIL` and `OWNER_PASSWORD`
2. Hash password using PBKDF2-SHA256 + random salt
3. Check if admin with this email exists:
   - **If exists**: Update their name, password, role to 'owner', and set is_active=true
   - **If not exists**: Create new admin with role='owner' and is_active=true
4. Log: "Owner bootstrap completed"
5. Continue normal startup

### If BOOTSTRAP_OWNER is not 'true':
Bootstrap is skipped entirely. Nothing happens.

### If OWNER_EMAIL or OWNER_PASSWORD is missing:
Log warning: "BOOTSTRAP_OWNER=true but OWNER_EMAIL or OWNER_PASSWORD is missing. Skipping bootstrap."
Continue startup.

## Security Features

✅ **Password Never Logged** - Password variable is never written to logs
✅ **Hashed Storage** - Uses PBKDF2-SHA256 with 180,000 iterations + random salt  
✅ **No Public Endpoint** - Bootstrap is called only during app startup
✅ **One-Time Setup** - Disable after first use
✅ **Existing Login Works** - Previous owner accounts continue to work
✅ **Environment-Only** - No hardcoded credentials in code

## Local Development

For local development with bootstrap (optional):

```bash
# Enable bootstrap locally
export BOOTSTRAP_OWNER=true
export OWNER_EMAIL=test@localhost.local
export OWNER_PASSWORD=TestPass@123
export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/real_estate

python server.py
```

Note: Local development can also use `reset_owner_password.py` for simpler setup.

## Troubleshooting

### "Owner bootstrap completed" not in logs
- Check that `BOOTSTRAP_OWNER=true`
- Check that `OWNER_EMAIL` and `OWNER_PASSWORD` are set
- Check Render logs for any errors

### Cannot login after bootstrap
- Verify email matches exactly (case-sensitive)
- Verify password is correct
- Check admin dashboard to confirm owner account was created

### Bootstrap ran again after first deployment
- Check that `BOOTSTRAP_OWNER` was changed to `false`
- Verify change was saved in Render Environment
- Verify app redeployed after change

### "BOOTSTRAP_OWNER=true but OWNER_EMAIL or OWNER_PASSWORD is missing"
- Add missing environment variables in Render Dashboard
- Ensure no typos in variable names
- Redeploy application

## Reverting Bootstrap

If you need to reset the owner account:

1. **Keep BOOTSTRAP_OWNER=false** (to not interfere)
2. **Use Database Admin Tools** to manually delete the admin:
   - Connect to your Neon database
   - Delete the admin row
3. **Re-enable Bootstrap**:
   - Set `BOOTSTRAP_OWNER=true`
   - Add new credentials
   - Redeploy
4. **Disable Again** after successful login

Or use local `reset_owner_password.py` if you have database access:

```bash
python reset_owner_password.py
```

## Best Practices

1. ✅ Use strong passwords (minimum 8 characters, mixed case, numbers, symbols)
2. ✅ Change password immediately after first login
3. ✅ Disable bootstrap after first deployment
4. ✅ Keep `OWNER_PASSWORD` secret (never commit to Git)
5. ✅ Use Render's "Protected" environment variables if available
6. ✅ Rotate passwords periodically
7. ❌ Don't hardcode passwords in code
8. ❌ Don't leave BOOTSTRAP_OWNER=true indefinitely
9. ❌ Don't share passwords in logs or emails

## FAQ

**Q: Can I change OWNER_EMAIL after bootstrap?**
A: No, the bootstrap identifies admins by email. If you need to change email, use the admin UI or database tools after bootstrap completes.

**Q: What if I forget the OWNER_PASSWORD?**
A: Re-enable bootstrap with the correct password and redeploy. The account will be updated.

**Q: Can bootstrap be called multiple times?**
A: Yes, it's safe. Each time it runs with BOOTSTRAP_OWNER=true and valid credentials, it will either create or update the owner account.

**Q: Is the password ever visible in logs?**
A: No. The bootstrap function never logs or prints the password. Only "Owner bootstrap completed" is logged.

**Q: What happens to existing admins?**
A: They are not affected. Bootstrap only creates/updates the account matching OWNER_EMAIL.

**Q: Can I use bootstrap in development?**
A: Yes, you can. But `reset_owner_password.py` is simpler for local development.
