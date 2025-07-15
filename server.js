const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));
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
                degreeType: dt.degreeType
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

                AreaOfStudyInfo: programAOSMap[p.ProgramID]?.[0] || {
                    AreaOfStudyID: null,
                    EnglishAOS: "",
                    SpanishAOS: "",
                    AcadIntCode: ""
                },
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