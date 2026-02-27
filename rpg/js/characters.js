// ── Character definitions ───────────────────────────────
export const CHARS = [
  { name: 'Alex', palette: { skin:'#e8b878', hair:'#3a2208', shirt:'#f0f0f0', pants:'#4a5068', boots:'#2a2a30', eyes:'#1a3a6a', mouth:'#8a4545' }, accessory: 'coffee', isPlayer: true },
  { name: 'Morgan', palette: { skin:'#f0d0a0', hair:'#2a1a18', shirt:'#d0e8f8', pants:'#3a4058', boots:'#2a2030', eyes:'#2a4a2a', mouth:'#905050', hairLong:true }, accessory: 'laptop' },
  { name: 'Jordan', palette: { skin:'#d0a070', hair:'#1a1a1a', shirt:'#e0e0e4', pants:'#4a4a58', boots:'#2a2a30', eyes:'#2a2a1a', mouth:'#6a3838' }, accessory: 'lanyard' },
  { name: 'Riley', palette: { skin:'#c8a068', hair:'#4a2a10', shirt:'#2a2a3a', pants:'#3a3a48', boots:'#1a1a18', eyes:'#3a6a3a', mouth:'#5a3535' }, accessory: 'headphones' },
  { name: 'Casey', palette: { skin:'#e0c090', hair:'#6a3818', shirt:'#4a7a4a', pants:'#4a4a50', boots:'#3a2a10', eyes:'#2a5a2a', mouth:'#7a4040', hairLong:true }, accessory: 'coffee' },
  { name: 'Sam', palette: { skin:'#f0c898', hair:'#c06020', shirt:'#5a6a8a', pants:'#4a4a58', boots:'#3a2018', eyes:'#3a2a1a', mouth:'#9a5050' }, accessory: null },
  { name: 'Taylor', palette: { skin:'#d8b080', hair:'#8a6a3a', shirt:'#8a4050', pants:'#3a3a48', boots:'#3a2a18', eyes:'#3a3a2a', mouth:'#7a4040', hairLong:true }, accessory: 'laptop' },
  { name: 'Jamie', palette: { skin:'#d0b890', hair:'#c8c0b0', shirt:'#3a4a6a', pants:'#3a3a48', boots:'#2a2030', eyes:'#4a3a2a', mouth:'#6a4040' }, accessory: 'lanyard' },
  { name: 'Drew', palette: { skin:'#c09060', hair:'#1a1208', shirt:'#e8e8ec', pants:'#4a4a58', boots:'#2a2a28', eyes:'#1a1a1a', mouth:'#5a3535' }, accessory: 'coffee' },
];

export const SPAWNS = [
  { col: 15, row: 8,  ci: 0 },  // player — corridor near offices
  { col: 6,  row: 7,  ci: 1 },  // lobby, near plants
  { col: 7,  row: 10, ci: 2 },  // at desk, upper cubicle center
  { col: 18, row: 10, ci: 3 },  // at desk, upper cubicles
  { col: 25, row: 10, ci: 4 },  // at desk, upper cubicles right
  { col: 7,  row: 14, ci: 5 },  // at desk, lower cubicles
  { col: 3,  row: 18, ci: 6 },  // break room
  { col: 23, row: 18, ci: 7 },  // meeting room
  { col: 18, row: 14, ci: 8 },  // at desk, lower cubicles
];

// ── SVG Avatar Factory ──────────────────────────────────
export function makeCharSVG(p, frame, accessory) {
  const leg = frame === 1 ? -4 : frame === 2 ? 4 : 0;
  const arm = frame === 1 ? 5 : frame === 2 ? -5 : 0;
  const bob = (frame === 1 || frame === 2) ? -2 : 0;

  let extra = '';
  if (accessory === 'coffee') {
    // Coffee mug in hand
    extra = `
      <rect x="${44+arm}" y="${40+bob}" width="6" height="7" fill="#f0f0f0"/>
      <rect x="${44+arm}" y="${41+bob}" width="6" height="5" fill="#c0a070"/>
      <rect x="${50+arm}" y="${42+bob}" width="3" height="3" fill="#f0f0f0"/>`;
  } else if (accessory === 'laptop') {
    // Laptop under arm
    extra = `
      <rect x="${10-arm}" y="${34+bob}" width="14" height="2" fill="#505060"/>
      <rect x="${10-arm}" y="${36+bob}" width="14" height="2" fill="#606070"/>`;
  } else if (accessory === 'lanyard') {
    // ID badge on lanyard
    extra = `
      <rect x="30" y="${24+bob}" width="4" height="12" fill="#3870a0"/>
      <rect x="28" y="${36+bob}" width="8" height="10" fill="#f0f0f0"/>
      <rect x="30" y="${38+bob}" width="4" height="4" fill="#3870a0"/>`;
  } else if (accessory === 'headphones') {
    // Headphones on head
    extra = `
      <rect x="16" y="${2+bob}" width="32" height="4" fill="#404048"/>
      <rect x="14" y="${4+bob}" width="6" height="10" fill="#404048"/>
      <rect x="44" y="${4+bob}" width="6" height="10" fill="#404048"/>
      <rect x="14" y="${8+bob}" width="6" height="6" fill="#505058"/>
      <rect x="44" y="${8+bob}" width="6" height="6" fill="#505058"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">
    <ellipse cx="32" cy="60" rx="14" ry="3" fill="rgba(0,0,0,0.3)"/>
    <rect x="${21+leg}" y="${52+bob}" width="8" height="7" fill="${p.boots}"/>
    <rect x="${20+leg}" y="${57+bob}" width="10" height="2" fill="${p.boots}"/>
    <rect x="${35-leg}" y="${52+bob}" width="8" height="7" fill="${p.boots}"/>
    <rect x="${34-leg}" y="${57+bob}" width="10" height="2" fill="${p.boots}"/>
    <rect x="${22+leg}" y="${44+bob}" width="7" height="10" fill="${p.pants}"/>
    <rect x="${35-leg}" y="${44+bob}" width="7" height="10" fill="${p.pants}"/>
    <rect x="21" y="${26+bob}" width="22" height="20" fill="${p.shirt}"/>
    <rect x="30" y="${28+bob}" width="2" height="14" fill="rgba(0,0,0,0.06)"/>
    <rect x="21" y="${43+bob}" width="22" height="3" fill="${p.pants}"/>
    <rect x="30" y="${43+bob}" width="4" height="3" fill="rgba(0,0,0,0.1)"/>
    <rect x="${14-arm}" y="${28+bob}" width="7" height="15" fill="${p.shirt}"/>
    <rect x="${14-arm}" y="${30+bob}" width="7" height="2" fill="rgba(0,0,0,0.06)"/>
    <rect x="${15-arm}" y="${42+bob}" width="5" height="5" fill="${p.skin}"/>
    <rect x="${43+arm}" y="${28+bob}" width="7" height="15" fill="${p.shirt}"/>
    <rect x="${43+arm}" y="${30+bob}" width="7" height="2" fill="rgba(0,0,0,0.06)"/>
    <rect x="${44+arm}" y="${42+bob}" width="5" height="5" fill="${p.skin}"/>
    ${extra}
    <rect x="27" y="${22+bob}" width="10" height="6" fill="${p.skin}"/>
    <rect x="19" y="${6+bob}" width="26" height="20" fill="${p.skin}"/>
    <rect x="17" y="${2+bob}" width="30" height="10" fill="${p.hair}"/>
    <rect x="17" y="${8+bob}" width="5" height="14" fill="${p.hair}"/>
    <rect x="42" y="${8+bob}" width="5" height="${p.hairLen || 10}" fill="${p.hair}"/>
    ${p.hairLong ? `<rect x="42" y="${8+bob}" width="5" height="20" fill="${p.hair}"/>
    <rect x="17" y="${8+bob}" width="5" height="20" fill="${p.hair}"/>` : ''}
    <rect x="24" y="${14+bob}" width="5" height="5" fill="#fff"/>
    <rect x="35" y="${14+bob}" width="5" height="5" fill="#fff"/>
    <rect x="26" y="${15+bob}" width="3" height="4" fill="${p.eyes}"/>
    <rect x="37" y="${15+bob}" width="3" height="4" fill="${p.eyes}"/>
    <rect x="26" y="${15+bob}" width="2" height="2" fill="white" opacity="0.8"/>
    <rect x="37" y="${15+bob}" width="2" height="2" fill="white" opacity="0.8"/>
    <rect x="23" y="${12+bob}" width="7" height="2" fill="${p.hair}"/>
    <rect x="34" y="${12+bob}" width="7" height="2" fill="${p.hair}"/>
    <rect x="29" y="${22+bob}" width="6" height="2" fill="${p.mouth || '#8a4040'}"/>
  </svg>`;
}
