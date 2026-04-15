import * as XLSX from 'xlsx';
import { RegionData } from '../types';

export interface ParsedRealEstateData {
  saleData: RegionData[];
  jeonseData: RegionData[];
  labels: string[];
}

export const parseRealEstateExcel = async (file: File | ArrayBuffer): Promise<ParsedRealEstateData> => {
  let data: ArrayBuffer;
  if (file instanceof File) {
    data = await file.arrayBuffer();
  } else {
    data = file;
  }

  const workbook = XLSX.read(data, { type: 'array' });
  const saleSheet = workbook.Sheets['1.매매증감'];
  const jeonseSheet = workbook.Sheets['2.전세증감'];

  if (!saleSheet || !jeonseSheet) {
    throw new Error('엑셀 파일에 "1.매매증감" 또는 "2.전세증감" 시트가 없습니다.');
  }

  const [saleData, labels] = parseSheet(saleSheet);
  const [jeonseData] = parseSheet(jeonseSheet);

  return { saleData, jeonseData, labels };
};

const parseSheet = (sheet: XLSX.WorkSheet): [RegionData[], string[]] => {
  const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });
  
  // 2행(index 1) 지역 정보
  const regionNamesRow = jsonData[1];
  // 4행(index 3)부터 데이터 시작
  const dataRows = jsonData.slice(3);

  const labels: string[] = [];
  const regionMap = new Map<number, RegionData>();

  // 지역 초기화 (2열[index 1]부터 지역명이 있다고 가정, 1열[index 0]은 구분/날짜)
  for (let colIdx = 1; colIdx < regionNamesRow.length; colIdx++) {
    const regionName = regionNamesRow[colIdx];
    if (regionName && typeof regionName === 'string') {
      regionMap.set(colIdx, {
        id: regionName, // 나중에 TopoJSON과 매핑을 위해 원래 이름을 보존하거나 ID화
        name: regionName,
        weeklyChanges: []
      });
    }
  }

  dataRows.forEach((row, rowIndex) => {
    // 1열(index 0)은 날짜
    const dateCell = row[0];
    if (!dateCell) return;

    let dateStr = String(dateCell);
    // 날짜가 엑셀 시리얼 넘버일 경우 변환
    if (typeof dateCell === 'number') {
      const date = new Date(Math.round((dateCell - 25569) * 86400 * 1000));
      dateStr = `${date.getFullYear().toString().slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    }

    labels.push(dateStr);

    // 각 컬럼(지역별) 데이터 추출
    regionMap.forEach((regionData, colIdx) => {
      const cellValue = row[colIdx];
      const numericValue = typeof cellValue === 'number' ? cellValue : parseFloat(cellValue);
      regionData.weeklyChanges.push(isNaN(numericValue) ? 0 : numericValue);
    });
  });

  return [Array.from(regionMap.values()), labels];
};
