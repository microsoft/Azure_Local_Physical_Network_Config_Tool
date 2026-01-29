# Integration Testing Guide

## Overview
This document describes the end-to-end testing strategy for the Azure Local Network Config Tool.

## Test Scenarios

### Scenario 1: Dell TOR1 Configuration
**Input:** `frontend/examples/dell-tor1.json`
**Expected Output:** Dell OS10 configuration file for TOR1 switch

**Steps:**
1. Load frontend wizard at http://localhost:3000
2. Click "Load Example Configuration Template"
3. Select "Dell TOR1" template
4. Review configuration in wizard
5. Export JSON file
6. Run backend CLI: `python3 -m src.cli generate dell-tor1.json -o output/`
7. Verify generated configuration

**Verification:**
- Hostname: rr1-n25-r20-5248hl-23-1a
- VRRP priority: 150 (TOR1)
- MLAG priority: 1 (TOR1)
- MST priority: 8192 (TOR1)
- Config size: ~5.4KB

### Scenario 2: Dell TOR2 Configuration
**Input:** `frontend/examples/dell-tor2.json`
**Expected Output:** Dell OS10 configuration file for TOR2 switch

**Verification:**
- Hostname: rr1-n25-r20-5248hl-23-1b
- VRRP priority: 100 (TOR2)
- MLAG priority: 32667 (TOR2)
- MST priority: 16384 (TOR2)
- Config size: ~5.4KB

### Scenario 3: Dell BMC Configuration
**Input:** `frontend/examples/dell-bmc.json`
**Expected Output:** Dell OS10 configuration file for BMC switch

**Verification:**
- Hostname: rr1-n25-r20-3248hl-22-1a
- No MLAG configuration
- No BGP configuration
- Config size: ~1.9KB

## Manual Testing Steps

### Frontend Testing
```bash
# Start development server
cd frontend
npm run dev

# Open browser to http://localhost:3000
# Test each wizard step
# Test template loading
# Test JSON export/import
# Test form validation
```

### Backend Testing
```bash
# Run unit tests
cd backend
pytest tests/ -v

# Test validation
python3 -m src.cli validate ../frontend/examples/dell-tor1.json

# Test transformation
python3 -m src.cli transform ../frontend/examples/dell-tor1.json

# Test generation
python3 -m src.cli generate ../frontend/examples/dell-tor1.json -o /tmp/output

# Verify output
cat /tmp/output/rr1-n25-r20-5248hl-23-1a.cfg
```

### E2E Testing
```bash
# Install Playwright
npx playwright install chromium --with-deps

# Run E2E tests
npx playwright test

# View test report
npx playwright show-report
```

## Test Matrix

| Test Case | Frontend | Backend | Status |
|-----------|----------|---------|--------|
| Schema validation | ✅ | ✅ | Pass |
| Dell TOR1 generation | ✅ | ✅ | Pass |
| Dell TOR2 generation | ✅ | ✅ | Pass |
| Dell BMC generation | ✅ | ✅ | Pass |
| Template loading | ✅ | N/A | Pass |
| JSON export | ✅ | N/A | Pass |
| JSON import | ✅ | N/A | Pass |
| Wizard navigation | ✅ | N/A | Pass |
| Cross-validation | ✅ | ✅ | Pass |
| Role-based transforms | N/A | ✅ | Pass |

## Automated Testing

### Unit Tests
- **Frontend:** TypeScript type checking (`npm run typecheck`)
- **Backend:** 29 pytest tests with 80% coverage

### Integration Tests
- Playwright E2E tests in `tests/wizard-e2e.spec.ts`
- Tests cover: page load, template loading, navigation, export, import, validation

### CI/CD
- GitHub Actions workflow for Pages deployment (`.github/workflows/pages.yml`)
- Automated build and deployment on push to main branch

## Performance Benchmarks

- **Frontend Build:** < 300ms
- **Frontend Bundle:** 20.5KB (gzipped: 6.5KB)
- **Backend Tests:** < 1 second
- **Config Generation:** < 100ms per switch

## Known Limitations

1. State does not persist across page reloads (no localStorage implementation)
2. Cisco templates not yet implemented (Phase 3 follow-up)
3. Advanced features (ACLs, NTP, SNMP) not in scope
4. No real-time backend validation in wizard UI

## Future Enhancements

1. Add Cisco NXOS templates
2. Implement localStorage for wizard state persistence
3. Add real-time backend validation
4. Create Docker container for easy deployment
5. Add more comprehensive E2E test scenarios
