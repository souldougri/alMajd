export const APPRECIATION_BANDS = [
  { min: 16, max: 20, labelAr: "ممتاز", labelFr: "Excellent" },
  { min: 14, max: 15.99, labelAr: "جيد جدا", labelFr: "Très bien" },
  { min: 12, max: 13.99, labelAr: "جيد", labelFr: "Bien" },
  { min: 10, max: 11.99, labelAr: "مقبول", labelFr: "Assez bien" },
  { min: 0, max: 9.99, labelAr: "ضعيف", labelFr: "Faible" },
] as const;

export function getAppreciation(average: number): string {
  for (const band of APPRECIATION_BANDS) {
    if (average >= band.min && average <= band.max) {
      return band.labelAr;
    }
  }
  return APPRECIATION_BANDS[APPRECIATION_BANDS.length - 1].labelAr;
}
