/**
 * Converts a Jalali (Persian) date to a Gregorian (Western) date.
 * This is a standard algorithm implementation.
 * @param jy Jalali year
 * @param jm Jalali month
 * @param jd Jalali day
 * @returns An object with {gy, gm, gd} for Gregorian year, month, and day.
 */
function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number; } {
    const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    const breaksLength = breaks.length;
    let gy = jy + 621;
    let leapJ = -14;
    let jp = breaks[0];
    let jm2 = jm - 1;

    let jump = 0;
    for (let i = 1; i < breaksLength; i++, jp = jump) {
        const jm = breaks[i];
        jump = jm - jp;
        if (jy < jm) {
            leapJ += Math.floor((jy - jp) / 33) * 8 + Math.floor(((jy - jp) % 33 + 3) / 4);
            break;
        }
        leapJ += Math.floor(jump / 33) * 8 + Math.floor((jump % 33) / 4);
    }

    let n = jd + (jm2 < 6 ? jm2 * 31 : jm2 * 30 + 6);
    let leapG = Math.floor(gy / 4) - Math.floor((Math.floor(gy / 100) + 1) * 3 / 4) - 150;
    let march = 20 + leapJ + leapG;
    let day = n + march;

    if (day > 0) {
        let gy2 = gy + Math.floor(day / 365);
        day = (day - 1) % 365;
        gy = gy2;
    } else {
        let gy2 = gy + Math.floor(day / 365) - 1;
        day = (day - 1) % 365 + 365;
        gy = gy2;
    }
    
    const daysInMonth = [31, (gy % 4 === 0 && gy % 100 !== 0 || gy % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let i = 0;
    for (; i < 12 && day >= daysInMonth[i]; i++) {
        day -= daysInMonth[i];
    }

    return { gy: gy, gm: i + 1, gd: day + 1 };
}

/**
 * Parses a Jalali date string (e.g., "1403/05/10") into a Gregorian Date object.
 * @param jalaliStr The date string in YYYY/MM/DD or YYYY-MM-DD format.
 * @returns A JavaScript Date object, or null if the format is invalid.
 */
export function parseJalaliDate(jalaliStr: string): Date | null {
    if (!jalaliStr) return null;
    const parts = jalaliStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (!parts) return null;

    try {
        const jy = parseInt(parts[1], 10);
        const jm = parseInt(parts[2], 10);
        const jd = parseInt(parts[3], 10);

        if (isNaN(jy) || isNaN(jm) || isNaN(jd) || jm < 1 || jm > 12 || jd < 1 || jd > 31) {
             return null;
        }

        const gDate = jalaliToGregorian(jy, jm, jd);
        // We add timezone offset to make sure the date is parsed in local time, not UTC.
        const dt = new Date(gDate.gy, gDate.gm - 1, gDate.gd);
        // dt.setTime(dt.getTime() + dt.getTimezoneOffset()*60*1000);
        return dt;

    } catch(e) {
        console.error("Error parsing Jalali date:", e);
        return null;
    }
}