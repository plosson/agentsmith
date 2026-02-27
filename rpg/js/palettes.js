// ── Color palettes ──────────────────────────────────────
// Index = tile ID from LEGEND. Each entry is [color_a, color_b] for checkerboard.
// For sprite-backed tiles the floor base beneath uses FLOOR_PAL[0] (office floor).
export const FLOOR_PAL = [
  ['#78b8d8','#70b0d0'],  //  0  floor (blue — same as office floor)
  ['#e8e8ec','#e0e0e4'],  //  1  wall (white)
  ['#78b8d8','#70b0d0'],  //  2  blue floor (matches tile 0)
  ['#4898d0','#4090c8'],  //  3  sky (rich blue)
  ['#e8eef8','#e0e8f0'],  //  4  cloud (soft white)
  ['#787880','#707078'],  //  5  wall_top (dark strip)
  ['#c8a878','#c0a070'],  //  6  desk_l (wood)
  ['#c8a878','#c0a070'],  //  7  desk_r (wood)
  ['#7098b8','#6890b0'],  //  8  door (steel blue)
  ['#8a7050','#827048'],  //  9  bookshelf_tl
  ['#8a7050','#827048'],  // 10  bookshelf_tr
  ['#505058','#484850'],  // 11  chair (dark)
  ['#48a848','#40a040'],  // 12  plant_pot
  ['#8a7050','#827048'],  // 13  bookshelf_bl
  ['#8a7050','#827048'],  // 14  bookshelf_br
  ['#505058','#484850'],  // 15  chair2 (dark)
  ['#a0c0d8','#98b8d0'],  // 16  glass wall
  ['#b0b4bc','#a8acb4'],  // 17  cubicle_tl
  ['#b0b4bc','#a8acb4'],  // 18  cubicle_tr
  ['#b0b4bc','#a8acb4'],  // 19  cubicle_bl
  ['#b0b4bc','#a8acb4'],  // 20  cubicle_br
  ['#e0e0e8','#d8d8e0'],  // 21  whiteboard
  ['#907868','#887060'],  // 22  coffee machine (brown)
  ['#283848','#202838'],  // 23  monitor (dark)
  ['#505860','#484f58'],  // 24  keyboard
  ['#a0a8b0','#98a0a8'],  // 25  printer
  ['#383838','#303030'],  // 26  phone
  ['#d07028','#c86820'],  // 27  couch_l (warm orange)
  ['#d07028','#c86820'],  // 28  couch_m
  ['#d07028','#c86820'],  // 29  couch_r
  ['#c83030','#c02828'],  // 30  couch_red_l
  ['#c83030','#c02828'],  // 31  couch_red_r
  ['#38a038','#309830'],  // 32  plant_l (green)
  ['#38a038','#309830'],  // 33  plant_r (green)
  ['#5878a0','#507098'],  // 34  window_lt
  ['#5878a0','#507098'],  // 35  window_rt
  ['#405868','#384f60'],  // 36  elevator_lt
  ['#405868','#384f60'],  // 37  elevator_rt
  ['#5878a0','#507098'],  // 38  window2_lt
  ['#5878a0','#507098'],  // 39  window2_rt
  ['#505860','#484f58'],  // 40  vending_t
  ['#505860','#484f58'],  // 41  vending_b
  ['#505860','#484f58'],  // 42  vending2_t
  ['#505860','#484f58'],  // 43  vending2_b
  ['#303838','#282f30'],  // 44  server_t (dark)
  ['#303838','#282f30'],  // 45  server_b
  ['#a09080','#988878'],  // 46  microwave
  ['#a0a8b0','#98a0a8'],  // 47  filing_tl
  ['#a0a8b0','#98a0a8'],  // 48  filing_tr
  ['#a0a8b0','#98a0a8'],  // 49  filing_bl
  ['#a0a8b0','#98a0a8'],  // 50  filing_br
  ['#d8d8e0','#d0d0d8'],  // 51  calendar
  ['#d8d8e0','#d0d0d8'],  // 52  clock
  ['#d8d0c4','#d0c8bc'],  // 53  cat (floor base)
  ['#d8d0c4','#d0c8bc'],  // 54  corgi (floor base)
  ['#d8d0c4','#d0c8bc'],  // 55  flag_us (floor base)
  ['#d8d0c4','#d0c8bc'],  // 56  flag_in (floor base)
  ['#d8d0c4','#d0c8bc'],  // 57  flag_uk (floor base)
  ['#d8d0c4','#d0c8bc'],  // 58  trash (floor base)
  ['#d8d0c4','#d0c8bc'],  // 59  water_cooler (floor base)
  ['#d07028','#c86820'],  // 60  sofa_l
  ['#d07028','#c86820'],  // 61  sofa_r
  ['#5878a0','#507098'],  // 62  window_lb
  ['#5878a0','#507098'],  // 63  window_rb
  ['#405868','#384f60'],  // 64  elevator_lb
  ['#405868','#384f60'],  // 65  elevator_rb
  ['#5878a0','#507098'],  // 66  window2_lb
  ['#5878a0','#507098'],  // 67  window2_rb
];

// ── Helper: CSS hex to Phaser int ───────────────────────
export function hex(str) {
  return parseInt(str.replace('#',''), 16);
}
