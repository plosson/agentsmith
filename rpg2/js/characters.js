// ── Character definitions ───────────────────────────────
export const CHARS = [
  { name: 'Valen', palette: { skin:'#e8b878', hair:'#3a2208', shirt:'#28608a', pants:'#384868', boots:'#3a2810', eyes:'#1a3a6a', mouth:'#8a4545' }, accessory: 'sword', isPlayer: true },
  { name: 'Elyndra', palette: { skin:'#f0d0a0', hair:'#e8e0f0', shirt:'#4a2880', pants:'#3a2860', boots:'#2a1840', eyes:'#6020a0', mouth:'#905050', cloak:'#5a30a0', hairLong:true, ears:'elf' }, accessory: 'staff' },
  { name: 'Gareth', palette: { skin:'#d0a070', hair:'#2a1a08', shirt:'#5a5a6a', pants:'#4a4a58', boots:'#2a2a30', eyes:'#2a2a1a', mouth:'#6a3838' }, accessory: 'shield' },
  { name: 'Shade', palette: { skin:'#c8a068', hair:'#1a1a1a', shirt:'#2a2a2a', pants:'#222228', boots:'#1a1a18', eyes:'#3a6a3a', mouth:'#5a3535', cloak:'#1e1e28' }, accessory: 'hood' },
  { name: 'Fern', palette: { skin:'#e0c090', hair:'#6a3818', shirt:'#3a6a2a', pants:'#4a3a20', boots:'#3a2a10', eyes:'#2a5a2a', mouth:'#7a4040', hairLong:true }, accessory: 'bow' },
  { name: 'Pippin', palette: { skin:'#f0c898', hair:'#c06020', shirt:'#8a2040', pants:'#4a2838', boots:'#3a2018', eyes:'#3a2a1a', mouth:'#9a5050', acc:'#6a1838' }, accessory: 'hat' },
  { name: 'Marta', palette: { skin:'#d8b080', hair:'#8a6a3a', shirt:'#8a7030', pants:'#5a4a2a', boots:'#3a2a18', eyes:'#3a3a2a', mouth:'#7a4040', hairLong:true }, accessory: null },
  { name: 'Aldric', palette: { skin:'#d0b890', hair:'#c8c0b0', shirt:'#2a2a5a', pants:'#2a2840', boots:'#2a2030', eyes:'#4a3a2a', mouth:'#6a4040', cloak:'#3030a0', hairLong:true }, accessory: 'staff' },
  { name: 'Thane', palette: { skin:'#c09060', hair:'#1a1208', shirt:'#6a6a7a', pants:'#4a4a58', boots:'#2a2a28', eyes:'#1a1a1a', mouth:'#5a3535' }, accessory: 'sword' },
];

export const SPAWNS = [
  { col: 11, row: 15, ci: 0 },
  { col: 11, row: 3,  ci: 1 },
  { col: 22, row: 2,  ci: 2 },
  { col: 3,  row: 3,  ci: 3 },
  { col: 5,  row: 10, ci: 4 },
  { col: 13, row: 4,  ci: 5 },
  { col: 24, row: 15, ci: 6 },
  { col: 24, row: 17, ci: 7 },
  { col: 14, row: 9,  ci: 8 },
];

// ── SVG Avatar Factory ──────────────────────────────────
export function makeCharSVG(p, frame, accessory) {
  const leg = frame === 1 ? -4 : frame === 2 ? 4 : 0;
  const arm = frame === 1 ? 5 : frame === 2 ? -5 : 0;
  const bob = (frame === 1 || frame === 2) ? -2 : 0;

  let extra = '';
  if (accessory === 'sword') {
    extra = `
      <rect x="${46+arm}" y="${28+bob}" width="3" height="22" fill="#a0a0b0"/>
      <rect x="${45+arm}" y="${26+bob}" width="5" height="4" fill="#c0a040"/>
      <rect x="${44+arm}" y="${30+bob}" width="7" height="2" fill="#c0a040"/>`;
  } else if (accessory === 'staff') {
    extra = `
      <rect x="${47+arm}" y="${10+bob}" width="3" height="38" fill="#6a5030"/>
      <rect x="${44+arm}" y="${6+bob}" width="9" height="8" fill="#7040c0" rx="0"/>
      <rect x="${46+arm}" y="${8+bob}" width="5" height="4" fill="#a060ff"/>`;
  } else if (accessory === 'shield') {
    extra = `
      <rect x="${10-arm}" y="${30+bob}" width="12" height="14" fill="#5a5a8a"/>
      <rect x="${12-arm}" y="${32+bob}" width="8" height="10" fill="#6a6a9a"/>
      <rect x="${14-arm}" y="${35+bob}" width="4" height="4" fill="#c0a040"/>`;
  } else if (accessory === 'bow') {
    extra = `
      <rect x="${48+arm}" y="${18+bob}" width="2" height="28" fill="#6a4a20"/>
      <rect x="${49+arm}" y="${18+bob}" width="1" height="28" fill="#c0b080" opacity="0.6"/>
      <rect x="${50+arm}" y="${16+bob}" width="3" height="4" fill="#6a4a20"/>
      <rect x="${50+arm}" y="${44+bob}" width="3" height="4" fill="#6a4a20"/>`;
  } else if (accessory === 'hat') {
    extra = `
      <rect x="14" y="${-2+bob}" width="36" height="6" fill="${p.acc || '#4a2080'}"/>
      <rect x="20" y="${-6+bob}" width="24" height="6" fill="${p.acc || '#4a2080'}"/>
      <rect x="30" y="${-4+bob}" width="3" height="3" fill="#e0c040"/>`;
  } else if (accessory === 'hood') {
    extra = `
      <rect x="16" y="${0+bob}" width="32" height="14" fill="${p.cloak || '#3a3a5a'}"/>
      <rect x="14" y="${8+bob}" width="6" height="18" fill="${p.cloak || '#3a3a5a'}"/>
      <rect x="44" y="${8+bob}" width="6" height="18" fill="${p.cloak || '#3a3a5a'}"/>`;
  }

  let cloakSvg = '';
  if (p.cloak && accessory !== 'hood') {
    cloakSvg = `
      <rect x="18" y="${26+bob}" width="28" height="24" fill="${p.cloak}" opacity="0.85"/>
      <rect x="16" y="${28+bob}" width="4" height="20" fill="${p.cloak}" opacity="0.7"/>
      <rect x="44" y="${28+bob}" width="4" height="20" fill="${p.cloak}" opacity="0.7"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">
    <ellipse cx="32" cy="60" rx="14" ry="3" fill="rgba(0,0,0,0.4)"/>
    <rect x="${21+leg}" y="${52+bob}" width="8" height="7" fill="${p.boots}"/>
    <rect x="${20+leg}" y="${57+bob}" width="10" height="2" fill="${p.boots}"/>
    <rect x="${35-leg}" y="${52+bob}" width="8" height="7" fill="${p.boots}"/>
    <rect x="${34-leg}" y="${57+bob}" width="10" height="2" fill="${p.boots}"/>
    <rect x="${22+leg}" y="${44+bob}" width="7" height="10" fill="${p.pants}"/>
    <rect x="${35-leg}" y="${44+bob}" width="7" height="10" fill="${p.pants}"/>
    <rect x="21" y="${26+bob}" width="22" height="20" fill="${p.shirt}"/>
    <rect x="30" y="${28+bob}" width="2" height="14" fill="rgba(0,0,0,0.1)"/>
    <rect x="21" y="${43+bob}" width="22" height="3" fill="${p.boots}"/>
    <rect x="30" y="${43+bob}" width="4" height="3" fill="#c0a040"/>
    ${cloakSvg}
    <rect x="${14-arm}" y="${28+bob}" width="7" height="15" fill="${p.shirt}"/>
    <rect x="${14-arm}" y="${30+bob}" width="7" height="2" fill="rgba(0,0,0,0.1)"/>
    <rect x="${15-arm}" y="${42+bob}" width="5" height="5" fill="${p.skin}"/>
    <rect x="${43+arm}" y="${28+bob}" width="7" height="15" fill="${p.shirt}"/>
    <rect x="${43+arm}" y="${30+bob}" width="7" height="2" fill="rgba(0,0,0,0.1)"/>
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
    ${p.ears === 'elf' ? `
      <rect x="15" y="${8+bob}" width="4" height="4" fill="${p.skin}"/>
      <rect x="13" y="${6+bob}" width="4" height="4" fill="${p.skin}"/>
      <rect x="45" y="${8+bob}" width="4" height="4" fill="${p.skin}"/>
      <rect x="47" y="${6+bob}" width="4" height="4" fill="${p.skin}"/>` : ''}
  </svg>`;
}
