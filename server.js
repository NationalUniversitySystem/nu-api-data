const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

const readJson = (filename) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, 'data', filename), 'utf8'));

app.use(cors());

app.get('/nu-api/programs', async (req, res) => {
  try {
    const programs = readJson('Programs.json');
    const schools = readJson('Schools.json');
    const degreeTypes = readJson('Degree.json');
    const tuitions = readJson('Tuitions.json');
    const specializations = readJson('Specializations.json');
    const stateRestrictions = readJson('State-Restrictions.json');
    const programAOS = readJson('Program-To-AOS.json');
    const areasOfStudy = readJson('AOS.json');

    const degreeTypeMap = Object.fromEntries(
      degreeTypes.map(dt => [dt.degreeTypeID, dt.degreeType])
    );

    const schoolMap = Object.fromEntries(
      schools.map(s => [s.SchoolID, {
        EnglishSchool: s.School,
        SpanishSchool: "",
        WD_SchoolCODE: s.WD_SchoolCODE || ""
      }])
    );

    const areaOfStudyMap = Object.fromEntries(
      areasOfStudy.map(aos => [aos.AreaOfStudyID, {
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

    const stateLevelTuitions = tuitions.filter(t => t.State !== null);

    const specByProgram = specializations.reduce((acc, spec) => {
      const programID = spec.programID;
      if (!acc[programID]) acc[programID] = [];
      acc[programID].push({
        EnglishName: spec.specialization || "",
        SpanishName: spec.spanishTitle || "",
        routeTo: spec.routingTo || "",
        SparkroomCode: spec.sparkroomCode || "",
        AppHide: spec.AppHide ?? false,
        RFIHide: spec.RFIHide ?? false,
        AdditionalStateRestriction: false,
        AdditionalStateLevelTuition: false
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

      return {
        ProgramID: p.ProgramID,
        EnglishName: p.Program || "",
        SpanishName: p.spanishTitle || "",
        NCUProgramCode: p.NCUProgramCode || "",
        NUProgramCode: p.NUProgramCode || "",
        routingTo: p.routingTo || "",
        degreeType: degreeTypeMap[p.degreeTypeID] || "",
        SparkroomCode: p.SparkroomCode || "",
        RFIHide: p.RFIHide ?? false,
        AppHide: p.AppHide ?? false,
        Teachout: p.Teachout ?? false,
        urlID: p.urlID || 0,
        url: "",
        supplierID: p.supplierID || 0,
        SchoolInfo: schoolMap[p.SchoolID] || {
          EnglishSchool: "",
          SpanishSchool: "",
          WD_SchoolCODE: ""
        },
        AreaOfStudyInfo: programAOSMap[p.ProgramID]?.[0] || {
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
        Specializations: specByProgram[p.ProgramID] || []
      };
    });

    res.json(finalData);
  } catch (error) {
    console.error('Error building program data:', error);
    res.status(500).json({ error: 'Failed to load program data' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
