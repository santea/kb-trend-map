const XLSX = require('xlsx');
const workbook = XLSX.readFile('20260406_주간시계열.xlsx');
const sheetName = '1.매매증감';
const worksheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
console.log('Row 1:', jsonData[0]);
console.log('Row 2:', jsonData[1].slice(0, 10)); // just first 10
console.log('Row 3:', jsonData[2].slice(0, 10));
console.log('Row 4:', jsonData[3].slice(0, 10));
