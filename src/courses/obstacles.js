// Obstacles the ball can hit, as plain data. Each type lists its colliders in local metres
// (the 3D model in world/obstacles.js is built to match):
//   { c: 'circle', x, z, r, h, y0? }   upright cylinder from height y0 (default 0) to h
//   { c: 'box', x, z, w, d, h, y0? }   box w wide (x) by d deep (z)
// `group` spawns several copies around one spot (penguins, bikes, a line of Berlin Wall…).
// `big` obstacles are kept to the edges of the fairway rather than the middle.

const circle = (r, h, x = 0, z = 0, y0 = 0) => ({ c: 'circle', x, z, r, h, y0 });
const box = (w, d, h, x = 0, z = 0, y0 = 0) => ({ c: 'box', x, z, w, d, h, y0 });

export const OBSTACLES = {
  // ----- vehicles -----
  bus: { label: 'Double-decker bus', colliders: [box(2.6, 11, 4.4)], big: true },
  cab: { label: 'Yellow cab', colliders: [box(2, 4.8, 1.6)], group: { count: 2, spread: 8, layout: 'line' } },
  cableCar: { label: 'Cable car', colliders: [box(2.6, 8.5, 3.4)], big: true },
  tram: { label: 'Double-deck tram', colliders: [box(2.4, 12, 4.2)], big: true },
  tuktuk: { label: 'Tuk-tuk', colliders: [box(1.4, 2.8, 1.8)], group: { count: 2, spread: 6 } },
  hotdogCart: { label: 'Hot dog cart', colliders: [box(1.4, 2.2, 2.2)] },
  // ----- street things -----
  phoneBox: { label: 'Phone box', colliders: [box(1.1, 1.1, 2.6)], group: { count: 2, spread: 3, layout: 'line' } },
  guard: { label: 'Royal guard', colliders: [circle(0.4, 2.4)], group: { count: 2, spread: 4, layout: 'line' } },
  vendingMachine: { label: 'Vending machines', colliders: [box(1.1, 0.9, 1.9)], group: { count: 3, spread: 1.3, layout: 'line' } },
  neonSign: { label: 'Neon sign', colliders: [circle(0.25, 7, -1.8), circle(0.25, 7, 1.8), box(4.4, 0.3, 3, 0, 0, 4)] },
  slotMachine: { label: 'Slot machines', colliders: [box(1, 0.9, 1.8)], group: { count: 4, spread: 1.2, layout: 'line' } },
  dice: { label: 'Giant dice', colliders: [box(3, 3, 3)], group: { count: 2, spread: 5 } },
  wallSegment: { label: 'Berlin Wall', colliders: [box(3.6, 1.2, 3.6)], group: { count: 5, spread: 3.7, layout: 'line' } },
  bikes: { label: 'Bicycles', colliders: [box(0.6, 1.8, 1)], group: { count: 4, spread: 0.9, layout: 'line' } },
  cafeTables: { label: 'Café tables', colliders: [circle(0.9, 1.1)], group: { count: 3, spread: 4 } },
  surfboards: { label: 'Surfboards', colliders: [box(2.4, 0.6, 2.4)] },
  beachUmbrella: { label: 'Beach umbrellas', colliders: [circle(0.12, 2.5), circle(1.4, 2.6, 0, 0, 2.0)], group: { count: 3, spread: 5 } },
  footballGoal: { label: 'Football goal', colliders: [circle(0.12, 2.44, -3.66), circle(0.12, 2.44, 3.66), box(7.4, 0.15, 0.15, 0, 0, 2.32)] },
  hotAirBalloon: { label: 'Hot-air balloon', colliders: [circle(1.2, 15.5, 0, 0, 14), circle(5, 26, 0, 0, 17)] },
  car: { label: 'Parked car', colliders: [box(1.9, 4.4, 1.5)], group: { count: 2, spread: 7 } },
  trafficCone: { label: 'Traffic cones', colliders: [circle(0.25, 0.75)], group: { count: 5, spread: 2.2, layout: 'line' } },
  hydrant: { label: 'Fire hydrant', colliders: [circle(0.28, 0.85)] },
  planter: { label: 'Flower planter', colliders: [box(2.6, 1.2, 0.9)], group: { count: 2, spread: 5 } },
  bench: { label: 'Park bench', colliders: [box(1.9, 0.7, 0.9)], group: { count: 2, spread: 4, layout: 'line' } },
  lifeguardTower: { label: 'Lifeguard tower', colliders: [box(2.6, 2.6, 4.2)], big: true },
  sandcastle: { label: 'Sandcastle', colliders: [circle(1.4, 1.7)] },
  volleyballNet: { label: 'Volleyball net', colliders: [circle(0.1, 2.5, -4.5), circle(0.1, 2.5, 4.5), box(9, 0.1, 0.9, 0, 0, 1.6)] },
  slalomGate: { label: 'Slalom gate', colliders: [circle(0.06, 1.9, -2), circle(0.06, 1.9, 2), box(4, 0.08, 0.6, 0, 0, 1.25)] },
  snowCannon: { label: 'Snow cannon', colliders: [circle(0.9, 3.6)] },
  iceHut: { label: 'Ice-fishing hut', colliders: [box(2.6, 3, 2.8)] },
  hockeyNet: { label: 'Hockey net', colliders: [box(1.85, 1.1, 1.2)], group: { count: 2, spread: 10, layout: 'line' } },
  rock: { label: 'Boulders', colliders: [circle(1.5, 2.1)], group: { count: 3, spread: 4, shrink: 0.25 } },
  // ----- statues, ruins, buildings -----
  merlion: { label: 'Merlion', colliders: [circle(2.4, 8.6)], big: true },
  matryoshka: { label: 'Giant matryoshka', colliders: [circle(1.5, 4.4)], group: { count: 3, spread: 4, layout: 'line', shrink: 0.25 } },
  stoneLantern: { label: 'Stone lanterns', colliders: [circle(0.6, 2.2)], group: { count: 3, spread: 5, layout: 'line' } },
  stoneLion: { label: 'Stone lions', colliders: [circle(0.9, 2)], group: { count: 2, spread: 6, layout: 'line' } },
  column: { label: 'Ancient columns', colliders: [circle(1, 9)], group: { count: 4, spread: 5, layout: 'ring', shrink: 0.3 } },
  obelisk: { label: 'Obelisk', colliders: [circle(1.6, 18)], big: true },
  fountain: { label: 'Fountain', colliders: [circle(4.2, 2.6)], big: true },
  sphinx: { label: 'Little sphinx', colliders: [box(4, 10, 5)], big: true },
  stela: { label: 'Maya stelae', colliders: [circle(0.7, 4)], group: { count: 3, spread: 6 } },
  spiritHouse: { label: 'Spirit house', colliders: [circle(0.9, 2.6)] },
  torii: { label: 'Torii gate', colliders: [circle(0.5, 7, -3.5), circle(0.5, 7, 3.5), box(9.5, 0.8, 1, 0, 0, 6.4)] },
  totem: { label: 'Totem pole', colliders: [circle(0.8, 9)] },
  tiki: { label: 'Tiki statues', colliders: [circle(0.7, 3.2)], group: { count: 2, spread: 4, layout: 'line' } },
  lighthouse: { label: 'Lighthouse', colliders: [circle(3, 18)], big: true },
  logCabin: { label: 'Log cabin', colliders: [box(6, 8, 5.5)], big: true },
  skiLift: { label: 'Ski-lift tower', colliders: [circle(0.6, 12)], group: { count: 2, spread: 40, layout: 'line' } },
  snowman: { label: 'Snowmen', colliders: [circle(1, 2.6)], group: { count: 2, spread: 5 } },
  // ----- animals -----
  camel: { label: 'Camels', colliders: [circle(1, 2.3)], animal: true, group: { count: 2, spread: 6 } },
  kangaroo: { label: 'Kangaroos', colliders: [circle(0.5, 1.8)], animal: true, group: { count: 2, spread: 6 } },
  penguin: { label: 'Penguins', colliders: [circle(0.3, 0.7)], animal: true, group: { count: 4, spread: 3 } },
  deer: { label: 'Deer', colliders: [circle(0.6, 1.6)], animal: true, group: { count: 3, spread: 6 } },
  moose: { label: 'Moose', colliders: [circle(1.1, 2.3)], animal: true },
  bear: { label: 'Bear', colliders: [circle(0.9, 1.5)], animal: true },
  panda: { label: 'Pandas', colliders: [circle(0.8, 1.3)], animal: true, group: { count: 2, spread: 4 } },
  elephant: { label: 'Elephant', colliders: [circle(2, 3.2)], animal: true, big: true },
  otter: { label: 'Otters', colliders: [circle(0.3, 0.4)], animal: true, group: { count: 3, spread: 2.5 } },
  cat: { label: 'Cats', colliders: [circle(0.25, 0.35)], animal: true, group: { count: 4, spread: 3 } },
  puffin: { label: 'Puffins', colliders: [circle(0.2, 0.35)], animal: true, group: { count: 4, spread: 2.5 } },
  horse: { label: 'Icelandic horses', colliders: [circle(0.9, 1.6)], animal: true, group: { count: 2, spread: 5 } },
  cow: { label: 'Cows', colliders: [circle(1, 1.6)], animal: true, group: { count: 2, spread: 6 } },
  sealion: { label: 'Sea lions', colliders: [circle(1, 0.9)], animal: true, group: { count: 3, spread: 5 } },
  monkey: { label: 'Monkeys', colliders: [circle(0.4, 0.8)], animal: true, group: { count: 3, spread: 4 } },
  turtle: { label: 'Sea turtles', colliders: [circle(0.6, 0.4)], animal: true, group: { count: 2, spread: 4 } },
  pigeon: { label: 'Pigeons', colliders: [circle(0.15, 0.3)], animal: true, group: { count: 5, spread: 2.5 } },
  peacock: { label: 'Peacocks', colliders: [circle(0.5, 1.2)], animal: true, group: { count: 2, spread: 4 } },
};

// Rough radius of a type (for spacing), from its colliders.
export function obstacleRadius(type) {
  const def = OBSTACLES[type];
  if (!def) return 1;
  let r = 0;
  for (const c of def.colliders) {
    const reach = c.c === 'circle' ? Math.hypot(c.x, c.z) + c.r : Math.hypot(c.x, c.z) + Math.hypot(c.w, c.d) / 2;
    r = Math.max(r, reach);
  }
  return r;
}
