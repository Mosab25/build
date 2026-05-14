# Owner Bootstrap - Testing Guide

## Unit Test Scenarios

### Test 1: Bootstrap Disabled (Default)
**Expected Behavior:** Bootstrap should be silently skipped
```python
# No BOOTSTRAP_OWNER env var set
import bootstrap_owner
bootstrap_owner.bootstrap_owner_account()
# Expected: Function returns immediately, no changes to database
```

### Test 2: Bootstrap Enabled but Missing Credentials
**Expected Behavior:** Log warning and skip
```python
# Set only BOOTSTRAP_OWNER, missing OWNER_EMAIL and OWNER_PASSWORD
import os
os.environ["BOOTSTRAP_OWNER"] = "true"
import bootstrap_owner
bootstrap_owner.bootstrap_owner_account()
# Expected: Log "BOOTSTRAP_OWNER=true but OWNER_EMAIL or OWNER_PASSWORD is missing. Skipping bootstrap."
```

### Test 3: Bootstrap Creates New Owner
**Expected Behavior:** Create new admin with role='owner'
```python
# Fresh database, BOOTSTRAP_OWNER=true, all credentials set
import os
os.environ["BOOTSTRAP_OWNER"] = "true"
os.environ["OWNER_EMAIL"] = "newowner@test.com"
os.environ["OWNER_PASSWORD"] = "Password@123"
os.environ["OWNER_NAME"] = "Test Owner"

import bootstrap_owner
bootstrap_owner.bootstrap_owner_account()

# Expected results in database:
# - New admin created with:
#   - email: "newowner@test.com"
#   - full_name: "Test Owner"
#   - role: "owner"
#   - is_active: TRUE
#   - password_hash: hashed password
#   - password_salt: random salt
# - Log shows: "Owner bootstrap completed"
```

### Test 4: Bootstrap Updates Existing Owner
**Expected Behavior:** Update existing admin password and properties
```python
# Database has existing admin with email "admin@test.com"
# BOOTSTRAP_OWNER=true with different password
import os
os.environ["BOOTSTRAP_OWNER"] = "true"
os.environ["OWNER_EMAIL"] = "admin@test.com"
os.environ["OWNER_PASSWORD"] = "NewPassword@456"
os.environ["OWNER_NAME"] = "Updated Name"

import bootstrap_owner
bootstrap_owner.bootstrap_owner_account()

# Expected results in database:
# - Existing admin updated with:
#   - full_name: "Updated Name"
#   - password_hash: new hashed password
#   - password_salt: new random salt
#   - role: "owner"
#   - is_active: TRUE
#   - updated_at: current timestamp
# - Login with newPassword works
# - Old password no longer works
```

### Test 5: Bootstrap with case-insensitive flag
**Expected Behavior:** Recognize "true", "True", "TRUE" as enabled
```python
# Test different case variations
for bootstrap_val in ["true", "True", "TRUE", "TrUe"]:
    os.environ["BOOTSTRAP_OWNER"] = bootstrap_val
    # All should enable bootstrap
```

### Test 6: Default Owner Name
**Expected Behavior:** Use default if OWNER_NAME not provided
```python
os.environ["BOOTSTRAP_OWNER"] = "true"
os.environ["OWNER_EMAIL"] = "owner@test.com"
os.environ["OWNER_PASSWORD"] = "Pass@123"
os.environ.pop("OWNER_NAME", None)  # Remove if exists

bootstrap_owner.bootstrap_owner_account()

# Expected: Admin created with full_name = "مالك النظام" (default)
```

## Integration Tests

### Integration Test 1: Full Startup with Bootstrap
**Scenario:** Fresh deployment on Render
```bash
# Set environment
export BOOTSTRAP_OWNER=true
export OWNER_EMAIL=admin@render.com
export OWNER_PASSWORD=SecurePass@789
export OWNER_NAME=Render Owner
export DATABASE_URL=postgresql://...

# Start app
python server.py

# Expected:
# 1. Tables created
# 2. Seed defaults run (basic owner created)
# 3. Bootstrap runs (owner updated with BOOTSTRAP_OWNER credentials)
# 4. App starts successfully
# 5. Can login with admin@render.com / SecurePass@789
```

## Manual Testing Checklist

- [ ] Bootstrap skipped when BOOTSTRAP_OWNER not set
- [ ] Bootstrap skipped when BOOTSTRAP_OWNER=false
- [ ] Bootstrap skipped when OWNER_EMAIL empty
- [ ] Bootstrap skipped when OWNER_PASSWORD empty
- [ ] Warning logged when credentials missing
- [ ] New owner created if email doesn't exist
- [ ] Existing owner updated if email exists
- [ ] Password hashed correctly (can login)
- [ ] Role set to 'owner'
- [ ] is_active set to TRUE
- [ ] Full name set correctly
- [ ] Default full name used if OWNER_NAME not provided
- [ ] "Owner bootstrap completed" logged
- [ ] Password never appears in logs
- [ ] Database transaction committed on success
- [ ] Error handling works on invalid config
- [ ] bootstrap_owner.py imports work without errors
- [ ] server.py imports work without errors
- [ ] init_db() calls bootstrap after seed_defaults
- [ ] Existing reset_owner_password.py still works

## Security Tests

### Test: Password Not in Logs
```python
import logging
import io

# Capture logs
log_stream = io.StringIO()
handler = logging.StreamHandler(log_stream)
logger = logging.getLogger("bootstrap_owner")
logger.addHandler(handler)

os.environ["BOOTSTRAP_OWNER"] = "true"
os.environ["OWNER_PASSWORD"] = "SuperSecretPass@123"
bootstrap_owner.bootstrap_owner_account()

log_output = log_stream.getvalue()
assert "SuperSecretPass@123" not in log_output
assert "Owner bootstrap completed" in log_output
```
