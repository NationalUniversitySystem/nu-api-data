const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const session = require('express-session');
const VALID_USER = 'marketingdev';
const VALID_PASS = 'NatMDev2025!';

app.use(session({
  secret: process.env.SESSION_SECRET || 'nu-secret-key',
  resave: false,
  saveUninitialized: false, // better for login/session management
  cookie: {
    secure: false, // change to true in production with HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 // 1 hour
  }
}));

app.use(express.json());

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === VALID_USER && password === VALID_PASS) {
    req.session.authenticated = true;

    // Determine where to redirect user after login
    const redirectTo = req.session.returnTo || '/admin.html';
    delete req.session.returnTo;

    return res.json({ success: true, redirectTo });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

function requireAuth(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }

  // Save the original URL to redirect after login
  if (req.accepts('html')) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login.html');
  }

  res.status(401).json({ error: 'Unauthorized' });
}


app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html' || req.path === '/admin.html') return next();
  express.static(path.join(__dirname, 'public'))(req, res, next);
});

// Protect root route (index.html)
app.get(['/', '/index.html'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Protect admin.html
app.get('/admin.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.get('/api/check-auth', (req, res) => {
  if (req.session.authenticated) {
    return res.json({ authenticated: true });
  }
  return res.status(401).json({ authenticated: false });
});




app.get('/nu-api/programs', async (req, res) => {
    try {
        const readJson = (filename) =>
            JSON.parse(fs.readFileSync(path.join(__dirname, 'data', filename), 'utf8'));
        const programs = readJson('Programs.json');
        const schools = readJson('Schools.json');
        const degreeTypes = readJson('Degree.json');
        const tuitions = readJson('Tuitions.json');
        const specializations = readJson('Specializations.json');
        const stateRestrictions = readJson('State-Restrictions.json');
        const programAOS = readJson('Program-To-AOS.json');
        const areasOfStudy = readJson('AOS.json');
        const degreeTypeMap = Object.fromEntries(
            degreeTypes.map(dt => [dt.degreeTypeID, {
                degreeTypeID: dt.degreeTypeID,
                degreeType: dt.degreeType,
                displayOrder: dt.displayOrder ?? null
            }])
        );
            const schoolMap = Object.fromEntries(
          schools.map(s => [s.SchoolID, {
              SchoolID: s.SchoolID, // ✅ Include SchoolID
              EnglishSchool: s.School || "",
              SpanishSchool: "", // You can populate this later if needed
              WD_SchoolCODE: s.WD_SchoolCODE || ""
          }])
      );

        const areaOfStudyMap = Object.fromEntries(
            areasOfStudy.map(aos => [aos.AreaOfStudyID, {
                AreaOfStudyID: aos.AreaOfStudyID,
                EnglishAOS: aos.AreaOfStudy || "",
                SpanishAOS: aos.spanishTitle || "",
                AcadIntCode: aos.AcadIntCode || ""
            }])
        );
        const programAOSMap = {};
        programAOS.forEach(pa => {
            if (!programAOSMap[pa.programid]) programAOSMap[pa.programid] = [];
            if (areaOfStudyMap[pa.areaofstudyid]) {
                programAOSMap[pa.programid].push(areaOfStudyMap[pa.areaofstudyid]);
            }
        });
        const tuitionByProgram = tuitions.filter(t => t.State === null && t.Specialization === null)
            .reduce((acc, t) => {
                acc[Number(t.ProgramID)] = t;
                return acc;
            }, {});
        const stateLevelTuitions = tuitions.filter(t => t.State !== null && t.Specialization === null);
        const specializationTuitions = tuitions.filter(t => t.Specialization !== null)
            .reduce((acc, t) => {
                const programID = t.ProgramID;
                const specialization = t.Specialization;
                if (!acc[programID]) acc[programID] = {};
                if (!acc[programID][specialization]) acc[programID][specialization] = [];
                acc[programID][specialization].push({
                    State: t.State,
                    CreditsRequired: t.CreditsRequired || 0,
                    CoursesRequired: t.CoursesRequired || 0,
                    CostPerCredit: t.CostPerCredit || 0,
                    CostPerCourse: t.CostPerCourse || 0,
                    TuitionCost: t.TuitionCost || 0,
                    LMF: t.LMF || 0,
                    CMF: t.CMF || 0,
                    TotalProgramCost: t.TotalProgramCost || 0,
                    Subscription: t.Subscription || false
                });
                return acc;
            }, {});
        const specByProgram = specializations.reduce((acc, spec) => {
            const programID = spec.programID;
            if (!acc[programID]) acc[programID] = [];
            acc[programID].push({
                SpecializationID: spec.specializationID || null,
                EnglishName: spec.specialization || "",
                SpanishName: spec.spanishTitle || "",
                routeTo: spec.routingTo || "",
                SparkroomCode: spec.sparkroomCode || "",
                AppHide: spec.AppHide ?? false,
                RFIHide: spec.RFIHide ?? false,
                AdditionalStateRestriction: false,
                AdditionalStateLevelTuition: []
            });
            return acc;
        }, {});
        const restrictionsByProgram = stateRestrictions.reduce((acc, r) => {
            if (!acc[r.ProgramID]) acc[r.ProgramID] = [];
            acc[r.ProgramID].push(r.State);
            return acc;
        }, {});
        const finalData = programs.map(p => {
            const tuition = tuitionByProgram[Number(p.ProgramID)] || {};
            const programStateTuitions = stateLevelTuitions
                .filter(t => Number(t.ProgramID) === p.ProgramID)
                .map(t => ({
                    State: t.State,
                    CreditsRequired: t.CreditsRequired || 0,
                    CoursesRequired: t.CoursesRequired || 0,
                    CostPerCredit: t.CostPerCredit || 0,
                    CostPerCourse: t.CostPerCourse || 0,
                    TuitionCost: t.TuitionCost || 0,
                    LMF: t.LMF || 0,
                    CMF: t.CMF || 0,
                    TotalProgramCost: t.TotalProgramCost || 0,
                    Subscription: t.Subscription || false
                }));
            const specs = specByProgram[p.ProgramID] || [];
            specs.forEach(spec => {
                const specTuitionData = specializationTuitions[p.ProgramID]?.[spec.EnglishName] || [];
                spec.AdditionalStateLevelTuition = specTuitionData;
            });
            return {
                ProgramID: p.ProgramID,
                EnglishName: p.Program || "",
                SpanishName: p.spanishTitle || "",
                NCUProgramCode: p.NCUProgramCode || "",
                NUProgramCode: p.NUProgramCode || "",
                routingTo: p.routingTo || "",
                degreeType: degreeTypeMap[p.degreeTypeID] || {
                    degreeTypeID: p.degreeTypeID || null,
                    degreeType: ""
                },
                SparkroomCode: p.SparkroomCode || "",
                RFIHide: p.RFIHide ?? false,
                AppHide: p.AppHide ?? false,
                Teachout: p.Teachout ?? false,
                urlID: p.urlID || 0,
                url: "",
                supplierID: p.supplierID || 0,
                SchoolInfo: schoolMap[p.SchoolID] || {
                  SchoolID: null,
                  EnglishSchool: "",
                  SpanishSchool: "",
                  WD_SchoolCODE: ""
              },

               AreaOfStudyInfo: programAOSMap[p.ProgramID] || [],
                Tuition: {
                    CreditsRequired: tuition.CreditsRequired || 0,
                    CoursesRequired: tuition.CoursesRequired || 0,
                    CostPerCredit: tuition.CostPerCredit || 0,
                    CostPerCourse: tuition.CostPerCourse || 0,
                    TuitionCost: tuition.TuitionCost || 0,
                    LMF: tuition.LMF || 0,
                    CMF: tuition.CMF || 0,
                    TotalProgramCost: tuition.TotalProgramCost || 0,
                    Subscription: tuition.Subscription || false,
                    StateLevelTuition: programStateTuitions
                },
                StateRestrictions: restrictionsByProgram[p.ProgramID] || [],
                Specializations: specs
            };
        });

        // Load overrides
const overridesPath = path.join(dataDir, 'mergedOverrides.json');
let overrides = {};
if (fs.existsSync(overridesPath)) {
    overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
}

// Apply overrides per ProgramID
finalData.forEach(p => {
    const override = overrides[p.ProgramID];
    if (override) {
        Object.assign(p, override); // shallow merge
    }
});


        res.json(finalData);
    } catch (error) {
        console.error('Error building program data:', error);
        res.status(500).json({ error: 'Failed to load program data' });
    }
});
const adminDataPath = path.join(__dirname, 'admin-state.json');
const dataDir = path.join(__dirname, 'data');
const backupDir = path.join(__dirname, 'backup');
// Create backup folder if it doesn't exist
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
const adminState = {
    lastSync: null,
    lastRollback: null
};
if (fs.existsSync(adminDataPath)) {
    Object.assign(adminState, JSON.parse(fs.readFileSync(adminDataPath, 'utf8')));
}
function saveAdminState() {
    fs.writeFileSync(adminDataPath, JSON.stringify(adminState, null, 2));
}
// Sync endpoint
app.post('/admin/sync', (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const backupSubdir = path.join(backupDir, `backup-${timestamp}`);
        fs.mkdirSync(backupSubdir);
        fs.readdirSync(dataDir).forEach(file => {
            fs.copyFileSync(path.join(dataDir, file), path.join(backupSubdir, file));
        });
        adminState.lastSync = new Date().toISOString();
        saveAdminState();
        res.json({ success: true, message: 'Data synced and backed up.' });
    } catch (err) {
        console.error('Sync error:', err);
        res.status(500).json({ error: 'Sync failed.' });
    }
});
// Revert endpoint
app.post('/admin/revert', (req, res) => {
    try {
        const backups = fs.readdirSync(backupDir)
            .filter(name => name.startsWith('backup-'))
            .sort()
            .reverse();
        if (backups.length === 0) {
            return res.status(400).json({ error: 'No backups available.' });
        }
        const latestBackup = path.join(backupDir, backups[0]);
        fs.readdirSync(latestBackup).forEach(file => {
            fs.copyFileSync(path.join(latestBackup, file), path.join(dataDir, file));
        });
        adminState.lastRollback = new Date().toISOString();
        saveAdminState();
        res.json({ success: true, message: 'Rollback successful.' });
    } catch (err) {
        console.error('Rollback error:', err);
        res.status(500).json({ error: 'Rollback failed.' });
    }
});

app.post('/admin/update-composed', express.json(), (req, res) => {
    const { id, updates } = req.body;

    if (!id || typeof updates !== 'object') {
        return res.status(400).json({ error: 'Invalid input.' });
    }

    const overridesPath = path.join(dataDir, 'mergedOverrides.json');
    let overrides = {};
    if (fs.existsSync(overridesPath)) {
        overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
    }

    // Backup before writing
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupSubdir = path.join(backupDir, `composed-update-${timestamp}`);
    fs.mkdirSync(backupSubdir);
    fs.copyFileSync(overridesPath, path.join(backupSubdir, 'mergedOverrides.json'));

    // Apply update
    overrides[id] = {
        ...(overrides[id] || {}),
        ...updates
    };

    fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2));
    adminState.lastRollback = timestamp;
    saveAdminState();

    res.json({ success: true, message: `Overrides for ProgramID ${id} updated.` });
});

app.post('/admin/revert-overrides', (req, res) => {
    const overridesPath = path.join(dataDir, 'mergedOverrides.json');
    if (!fs.existsSync(overridesPath)) {
        return res.status(400).json({ error: 'No override file found.' });
    }

    try {
        // Backup
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const backupSubdir = path.join(backupDir, `override-reset-${timestamp}`);
        fs.mkdirSync(backupSubdir);
        fs.copyFileSync(overridesPath, path.join(backupSubdir, 'mergedOverrides.json'));

        // Reset
        fs.writeFileSync(overridesPath, JSON.stringify({}, null, 2));
        adminState.lastRollback = timestamp;
        saveAdminState();

        res.json({ success: true, message: 'All overrides cleared.' });
    } catch (err) {
        console.error('Revert failed:', err);
        res.status(500).json({ error: 'Failed to revert overrides.' });
    }
});



// Status endpoint
app.get('/admin/status', (req, res) => {
    res.json(adminState);
});
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`\u2705 Server is running on http://localhost:${PORT}`);
});