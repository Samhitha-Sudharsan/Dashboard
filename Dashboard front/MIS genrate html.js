const express = require('express');
const mysql = require('mysql');
const Excel = require('exceljs');
const app = express();
const cors = require('cors');
const fs = require('fs');
app.use(cors());

app.get('/', (req, res) => {    
    res.send('Server is running');
});

app.get('/get-mis', (req, res) => {


    const connection = mysql.createConnection({
    host: 'hostname',
    user: 'user',
    password: 'hostpwd',
    database: 'hostdb'
    });

    connection.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");

    const userEmail = 'example@gmail.com';

    const query1 = `
        SELECT agentId, partyid, agentCaseIds
        FROM mis_party_agents
        WHERE agentEmail = ?
    `;

    connection.query(query1, [userEmail], function(err, results) {
        if (err) throw err;
        if (results.length === 0) {
        console.log("No agents found for this email");
        connection.end();
        return;
        }

        const agentData = results;
        let allCaseIds = [];

        agentData.forEach(agent => {
        if (agent.agentCaseIds) {
            const caseIds = JSON.parse(agent.agentCaseIds);
            allCaseIds = allCaseIds.concat(caseIds.map(caseId => ({
            agentId: agent.agentId,
            partyid: agent.partyid,
            caseId: caseId
            })));
        }
        });

        if (allCaseIds.length === 0) {
        console.log("No case IDs found for the agents");
        connection.end();
        return;
        }

        const caseIdList = allCaseIds.map(item => item.caseId);
        const query2 = `
        SELECT caseId, caseTitle, case_created_at, totalClaimValue, hearingDatesSet, parties,
                borrowerName, contractNumber, arbitratorName, caseStatus,
                firstNoticeDate, secondNoticeDate, thirdNoticeDate,
                firstNoticeDispatchDate, secondNoticeDispatchDate, thirdNoticeDispatchDate,
                Sec17raisedDate, Sec17type, Sec17petitionDate,
                awardDate, awardDispatchDate, Sec21dispatchDate
        FROM mis_cases_parties
        WHERE caseId IN (?)
        `;

        connection.query(query2, [caseIdList], function(err, caseResults) {
        if (err) throw err;
        console.log("Retrieved case data successfully");

        const caseDataMap = caseResults.reduce((acc, caseItem) => {
            acc[caseItem.caseId] = caseItem;
            return acc;
        }, {});

        const workbook = xlsx.utils.book_new();
        const worksheetData = [
            [
            'CASE ID', 'CASE TITLE', 'DATE OF CREATION', 'TOTAL CLAIM VALUE',
            'HEARING DATES', 'AGENT ID', 'PARTY ID', 'BORROWER NAME', 'CONTRACT NUMBER',
            'ARBITRATOR NAME', 'CASE STATUS', 'FIRST NOTICE DATE', 'SECOND NOTICE DATE',
            'THIRD NOTICE DATE', 'FIRST NOTICE DISPATCH DATE', 'SECOND NOTICE DISPATCH DATE',
            'THIRD NOTICE DISPATCH DATE', 'SECTION 17 RAISED DATE', 'SECTION 17 TYPE',
            'SECTION 17 PETITION DATE', 'AWARD DATE', 'AWARD DISPATCH DATE', 'SECTION 21 DISPATCH DATE'
            ]
        ];

        const formatDate = (dateString) => {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        allCaseIds.forEach(item => {
            const caseData = caseDataMap[item.caseId];
            if (caseData && caseData.caseId && caseData.caseTitle && caseData.case_created_at && caseData.totalClaimValue && caseData.parties) {
            worksheetData.push([
                caseData.caseId.toString(), caseData.caseTitle, formatDate(caseData.case_created_at), caseData.totalClaimValue.toString(),
                (caseData.hearingDatesSet ? caseData.hearingDatesSet.toString() : ''), item.agentId.toString(), item.partyid.toString(),
                caseData.borrowerName, caseData.contractNumber, caseData.arbitratorName, caseData.caseStatus,
                caseData.firstNoticeDate, caseData.secondNoticeDate, caseData.thirdNoticeDate,
                caseData.firstNoticeDispatchDate, caseData.secondNoticeDispatchDate, caseData.thirdNoticeDispatchDate,
                caseData.Sec17raisedDate, caseData.Sec17Type, caseData.Sec17petitionDate,
                caseData.awardDate, caseData.awardDispatchDate, caseData.Sec21DispatchDate
            ]);
            }
        });

console.log("after fetching data")
    if (results.length === 0) {
        connection.end();
        
        return res.status(404).send('No data found');
    }

    try {

        const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);

        // Apply bold styling to the header row
        const headerRange = xlsx.utils.decode_range(worksheet['!ref']);
        for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
            const cell_address = xlsx.utils.encode_cell({ c: C, r: 0 });
            if (!worksheet[cell_address]) continue;
            worksheet[cell_address].s = {
            font: {
                bold: true
            }
            };
        }
    
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        xlsx.writeFile(workbook, 'output.xlsx');
        console.log("Excel file generated successfully");
      }
    catch (e) {
        // console.log("Not able to create excel file");
        res.status(500).send('Error in creating Excel file: ' + e.message);
    }
    finally {
        
            connection.end();
    }

        connection.end();
        });
    });
    });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
