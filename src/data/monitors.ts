// OLED monitors and the subpixel layout of the panel inside them.
// Compiled from Display Ninja's OLED market tables (panel -> layout, panel -> models), TFTCentral and PC Monitors, Nov 2026.
// One line per panel: panel id | size | width x height | Brand: model, model; Brand: model
const RAW = `
woled-rwbg|27" 1440p WOLED|2560x1440|LG: 27GR95QE, 27GS95QE, 27GS93QE, 27GX704A; ASUS: PG27AQDM, XG27AQDMG, XG27AQDMGR; Cooler Master: GZ2711; Corsair: 27QHD240; AOC: AG276QZD, Q27G41ZDP; Acer: Predator X27U; KTC: G27P6, G27P6S; ASRock: PGO27QFS, PGO27QFS2A; ViewSonic: XG272-2K-OLED; Koorui: 27E8QK; Innocn: 27A1S; Gigabyte: GO27Q24G, FO27Q24G
woled-rgwb|27" 1440p WOLED|2560x1440|ASUS: PG27AQDP, PG27AQWP, XG27AQWMG; Acer: X27U F3, X27U F8; Sony: Inzone M10S; AOC: AG276QKD, AGP277QKD, AGP277QKDC; LG: 27GX790A, 27GX790B, 27GX700A; Antgamer: ANT275ZQE; ViewSonic: XG273F-2K-OLED, VX27G70Z-2K-5; ASRock: TCO27QXB; Gigabyte: FO27Q54G, MO27Q28G, MO27Q28GR, FO27Q28G
rgb|27" 4K WOLED, RGB stripe|3840x2160|ASUS: PG27UCWM; ASRock: TCO27USB; AOC: AGP277UZD
woled-rgwb|24.5" 1080p WOLED|1920x1080|ASUS: XG259QWPG, PG259QWS; Gigabyte: GO25F54G
rgb|24.5" 1080p QD-OLED, RGB stripe|1920x1080|ASUS: XG259QDPG, XG259QDNS; Dell: AW2527HX
rgb|27" 1440p QD-OLED, RGB stripe|2560x1440|ASUS: XG27AQDNGR; Gigabyte: MO27Q40
qd-27-4k|27" 4K QD-OLED|3840x2160|MSI: 272URX, 272UP, 271UPX12G, 271UPXW12G; Samsung: G81SF, S27FG81, G80SH, S27HG80, G70SH, S27HG702; Dell: AW2725Q; Gigabyte: MO27U2, FO27U24GP; ASUS: PG27UCDM, XG27UCDMG, XG27UQDMS, PA27USD, PA279CDV, PA27UCDV; AOC: AG276UZD, U27G4D, U27U4, U27U4D; Philips: 27M2N8800, 27M4N8800, 27E2N6900; ViewSonic: XG273-4K-OLED, XG273-4K-OLED-2; Acer: Predator X27 X1, X27 V1, CE270K, PE270K; Lenovo: 27UD-10; BenQ: EX271UZ; Innocn: GA27W1Q; ASRock: TCO27USA; HKC: 27U240B; Deco Gear: DGOLED274K
qd-27-1440|27" 1440p QD-OLED|2560x1440|MSI: 271QRX, 271QPX, 271QPX32, 271QP, 272QP, 272QPW, 272QPX50, 271QRX50, 273QP, 274QP, 272QPCT, 271QPX14G; Samsung: G60SF, S27FG60, G60SD, S27DG60, S27DF60, G61SD, S27DG61, G61SH, S27GH61, G61SF, S27HG612, G50SF, S27FG50; Gigabyte: FO27Q5P, FO27Q3, MO27Q3, FO27Q2, MO27Q2, MO27Q2A, GO27Q24, GO27Q24A, GO27Q32; ASUS: XG27AQDPG, PG27AQDPR, XG27ACDNG, XG27AQDNG, XG27ACDMS, XG27ACDMSR, XG27AQDMES; Dell: AW2725DF, AW2725D, AW2726DM; Acer: X27U F5, X27U F, X27U Z1, X27U Z2, X27U X1, X27U W1, X27U W2, CE270U; AOC: AG276QKD2, AG276QSD, AG277QSD, AG276QZD2, Q27G4KD, Q27G40SDE, Q27G4SD, Q27G4SDR, Q27G41ZDE, Q27G4ZD, Q27G4ZDR, Q27GAZD, Q27GAZDV, Q27G40ZDF, Q27G41ZDF, Q27U4D, Q27GADE; ViewSonic: XG273E-2K-OLED, XG273B-2K-OLED, XG273-2K-OLED, XG2738-2K-OLED, VX2738-2K-OLED, VX27G60Z-2K-2, VX27G60Z-2K-3, VX27G70Z-2K, VX27G70Z-2K-2, VX27G70Z-2K-3; BenQ: EX271QZ, EX271QMZ; Philips: 27M2N8500, 27M2N8500X, 27M4N8500V, 27M2N6500, 27M2N6500P, 27M2N6500NS, 27M2N6501L; Innocn: GA27M1Q, 2780S; HP: OMEN 27qs, OMEN 27q; ASRock: TCO27QXA, PGO270W2A, PGO27QFV, PGO27QSA; HKC: 27Q320B; Titan Army: G27T8T; Pixio: PX277 OLED Max; Deco Gear: DGOLED27
qd-32-4k|32" 4K QD-OLED|3840x2160|Dell: AW3225QF, S3225QC, U3226Q; ASUS: PG32UCDM, PG32UCDMR, PG32UCDM3, PA32UCDM, PA32UCDMR, XG32UQDMS, XG32UQDS, PA32USD, PA329CDV; MSI: 321URX, 321URXW, 322URX, 322UR, 321CURX, 321UPX, 321UP, 322UP, 321CUP, 321UPX18; Samsung: G80SD, S32DG80, S32FG81, S32HG80, M90SF, S32FM90; Gigabyte: FO32U2P, FO32U2, FO32U, MO32U, MO32U2, MO32U24, GO32U18; HP: OMEN Transcend 32; Acer: Predator X32 X, X32 X2, X32 V3, PE320QK, CE320QK; AOC: AG326UZD, AG326UZD2, AG326UD, U32U4, U32G5D; Philips: 32M2N8900, 32M2N8900P, 32M2N8900X, 32M2N6901A; BenQ: EX321UZ; Titan Army: G3280W; Deco Gear: DGOLED32; ASRock: PGO32UFSA; Lenovo: 32UD-10; Koorui: S3241XO; Eizo: CG3200X
rgb|32" 4K QD-OLED, RGB stripe|3840x2160|MSI: 322URDX36; ASUS: PG32UCDN; Samsung: G80SJ
rgb|32" 4K WOLED, RGB stripe|3840x2160|ASUS: PG32UCWM; Dell: AW3226Q
woled-rgwb|32" 4K WOLED|3840x2160|LG: 32GS95UE, 32GS95UV, 32GX870A, 32GX870B, 32GX850A; ASUS: PG32UCDP, XG32UCWMG, XG32UCWG, XG32UQWMS; AOC: AGP327UZD, AG327UD; Gigabyte: FO32U24G, FO32U24GP; Acer: Predator X32 X3; ViewSonic: XG323-4K-OLED2; KTC: G32P5; ASRock: PGO32UFS, PGO32UFS2C
rgb|34" 1440p QD-OLED, RGB stripe|3440x1440|MSI: 341CQRX36, 341CQPX28, 341CQPX24, 341QPXW14G; HP: OMEN 34; ASUS: PG34WCDN, XG34WCDMS; Acer: X34 F3, X34 F1; Gigabyte: MO34WQC36; AOC: AGP346UCSD, CU34G4ZD; Dell: AW3426DW; Philips: 34M2C8600P
qd-34|34" 1440p QD-OLED|3440x1440|Dell: AW3423DW, AW3423DWF, AW3425DW; Samsung: G85SB, S34BG85, G85SD, S34DG85; MSI: 342C, 341CQP, 341CQPX; Gigabyte: MO34WQC, MO34WQC2; Philips: 34M2C8600, 34M2C6500; AOC: AG346UCD, PD34; Acer: X34 V, X34 X5; ASUS: XG34WCDG, XG34WCDMTG; Corsair: 34WQHD240; ASRock: PGO34QRS2A
woled-rwbg|34" 1440p WOLED|3440x1440|ASUS: PG34WCDM; LG: 34GS95QE, 34GX90SA, 34GX90SB, 34GX900A; Acer: X34 X; KTC: G34P5; Lenovo: 34WD-10
rgb|39" 5K2K WOLED, RGB stripe|5120x2160|Dell: AW3926QW
woled-rgwb|39" 5K2K WOLED|5120x2160|LG: 39GX950B
woled-rwbg|39" 1440p WOLED|3440x1440|LG: 39GS95QE, 39GS96QB, 39GX90SA, 39GX900A; Acer: Predator X39; ASUS: PG39WCDM; KTC: G39S5
woled-rgwb|45" 5K2K WOLED|5120x2160|LG: 45GX950A, 45GX950B, 45GX990A
woled-rwbg|45" 1440p WOLED|3440x1440|LG: 45GR95QE, 45GS95QE, 45GS96QB, 45GX90SA, 45GX900A; Acer: Predator X45; AOC: AG456UCZD; Corsair: 45WQHD240
rgb|49" QD-OLED, RGB stripe|5120x1440|Samsung: G95SJ
qd-49|49" QD-OLED|5120x1440|Samsung: G95SC, S49CG95, G93SC, S49CG93, G95SD, S49DG95, G93SD, S49DG93, G91SD, S49DG91; MSI: 491CQP, 491CQPX; ASUS: PG49WCD; Gigabyte: CO49DQ; Acer: Predator X49; AOC: PD49, AGP497UCZD; Philips: 49M2C8900; Koorui: S4941XO; Deco Gear: DG49OLED240, DGOLED49
woled-rwbg|42-48" 4K WOLED|3840x2160|ASUS: PG42UQ, PG48UQ; LG: 48GQ900, OLED42C2; Gigabyte: FO48U; AOC: AG485UD, AG485UD2; Philips: 42M2N8900; KTC: G42P5; BenQ: EX480UZ; Innocn: 48Q1V; Skyworth: G90
`;

export interface Monitor { brand: string; model: string; panel: string; size: string; w: number; h: number; code: string }

/** Upper-case, letters and digits only, marketing words removed. */
export const normalize = (s: string): string => s.toUpperCase().replace(/QD[\s-]?OLED|\bOLED(?=\b|\d)|\bMONITOR\b/g, ' ').replace(/[^A-Z0-9]/g, '');

export const MONITORS: Monitor[] = RAW.trim().split('\n').flatMap((line) => {
  const [panel, size, res, list] = line.split('|') as [string, string, string, string];
  const [w, h] = res.split('x').map(Number) as [number, number];
  return list.split(';').flatMap((g) => {
    const i = g.indexOf(':'), brand = g.slice(0, i).trim();
    return g.slice(i + 1).split(',').map((m) => ({ brand, model: m.trim(), panel, size, w, h, code: normalize(m).replace(/^(PREDATOR|INZONE|OMENTRANSCEND)/, (x) => (x === 'OMENTRANSCEND' ? x : '')) }));
  });
});

export type Match =
  | { kind: 'sure' | 'likely'; monitor: Monitor }
  /** The screen reports a name shared by many models; these fit its resolution. */
  | { kind: 'choose'; candidates: Monitor[] }
  | { kind: 'tv' }
  | { kind: 'none' };

const PREFIX = /^(ASUS|ROG|STRIX|SWIFT|MSI|MPG|MAG|MEG|PROMAX|PRO|LG|ULTRAGEAR|DELL|ALIENWARE|AORUS|GIGABYTE|SAMSUNG|ODYSSEY|ACER|PREDATOR|AOC|AGON|PHILIPS|EVNIA|HP|HYPERX|OMEN(?=2|3)|LC|LS(?=\d)|CORSAIR|XENEON|VIEWSONIC|BENQ|KTC|SONY|INZONE)+/;

/** px: the screen's resolution in real pixels, when known. */
export function matchMonitor(label: string, px?: { w: number; h: number }): Match {
  const full = normalize(label);
  if (!full) return { kind: 'none' };
  const bare = full.replace(PREFIX, (m) => (m.startsWith('LS') ? m.slice(1) : ''));
  const fits = (m: Monitor) => !px || Math.abs(m.w - px.w) < 4 && Math.abs(m.h - px.h) < 4;
  let best: { m: Monitor; score: number; end: boolean } | null = null;
  for (const m of MONITORS) {
    if (m.code.length < 3) continue;
    const atStart = bare.startsWith(m.code) || full.startsWith(m.code);
    // codes inside a longer string must be long enough not to hit by accident
    const inside = m.code.length >= 6 && full.includes(m.code);
    if (!atStart && !inside) continue;
    const end = bare === m.code || full.endsWith(m.code);
    const score = m.code.length * 10 + (end ? 5 : 0) + (fits(m) ? 3 : 0);
    if (!best || score > best.score) best = { m, score, end };
  }
  // short codes (Acer "X34 V") only count when the whole name matches
  if (best && (best.m.code.length >= 5 || best.end)) return { kind: best.end ? 'sure' : 'likely', monitor: best.m };
  if (/^LGTV/.test(full)) return { kind: 'tv' };
  const brand = /^LG|ULTRAGEAR/.test(full) ? 'LG' : /ODYSSEY|^SAMSUNG|^LS\d|^LC\d/.test(full) ? 'Samsung' : null;
  if (brand) {
    const c = MONITORS.filter((m) => m.brand === brand && fits(m) && !/^(S\d|OLED)/.test(m.model));
    if (c.length) return { kind: 'choose', candidates: c };
  }
  return { kind: 'none' };
}

/** Type-to-find, for browsers that do not reveal screen names. */
export function searchMonitors(q: string, limit = 8): Monitor[] {
  const words = q.toUpperCase().split(/\s+/).map((w) => w.replace(/[^A-Z0-9]/g, '')).filter(Boolean);
  if (!words.length) return [];
  return MONITORS.map((m) => {
    const hay = (m.brand + m.model).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return { m, s: words.every((w) => hay.includes(w)) ? (m.code.startsWith(words[words.length - 1]!) ? 2 : 1) : 0 };
  }).filter((x) => x.s).sort((a, b) => b.s - a.s || a.m.model.length - b.m.model.length).slice(0, limit).map((x) => x.m);
}
