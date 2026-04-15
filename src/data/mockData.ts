import { RegionData, REGIONS, WEEKS_COUNT } from '../types';

const generateWeeklyData = (baseVolatility: number, trend: number[]) => {
  const data: number[] = [];
  let currentVal = 0;
  
  for (let i = 0; i < WEEKS_COUNT; i++) {
    const randomFactor = (Math.random() - 0.5) * baseVolatility;
    const trendFactor = trend[i] || 0;
    currentVal = trendFactor + randomFactor;
    data.push(Number(currentVal.toFixed(2)));
  }
  return data;
};

// Create a global trend: Boom in early weeks, cooling down mid-year, slight recovery late year
const globalTrend = Array.from({ length: WEEKS_COUNT }, (_, i) => {
  if (i < 15) return 0.5 + (i * 0.05); // Boom
  if (i < 35) return 1.25 - ((i - 15) * 0.1); // Sharp Cooling
  return -0.75 + ((i - 35) * 0.05); // Recovery
});

export const MOCK_REGION_DATA: RegionData[] = REGIONS.map((region) => {
  // Add some regional variance
  const regionalMultiplier = region.id === 'seoul' || region.id === 'gyeonggi' ? 1.5 : 0.8;
  const regionalTrend = globalTrend.map(v => v * regionalMultiplier + (Math.random() - 0.5) * 0.2);
  
  return {
    id: region.id,
    name: region.name,
    weeklyChanges: generateWeeklyData(0.3, regionalTrend),
  };
});

export const WEEK_LABELS = Array.from({ length: WEEKS_COUNT }, (_, i) => {
  const date = new Date(2023, 0, 1);
  date.setDate(date.getDate() + (i * 7));
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
});
