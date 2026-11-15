const ROUTES = [
  [0, 1, 4, 5, 8],
  [0, 3, 4, 7, 8],
  [0, 3, 6, 7, 4, 1, 2, 5, 8],
  [0, 1, 2, 5, 4, 3, 6, 7, 8],
]
const STEPS = [-3, 1, 3, -1]

export function createCircuit(previous) {
  const candidates = ROUTES.filter((_, index) => index !== previous?.route)
  const route = candidates[Math.floor(Math.random() * candidates.length)]
  const tiles = Array.from({ length: 9 }, () => [0, Math.random() < .5 ? 1 : 2])

  route.forEach((tile, index) => {
    tiles[tile] = [
      index === 0 ? 3 : STEPS.indexOf(route[index - 1] - tile),
      index === route.length - 1 ? 1 : STEPS.indexOf(route[index + 1] - tile),
    ]
  })

  const rotations = tiles.map(() => Math.floor(Math.random() * 4))
  // Keep power disconnected at the source until the player rotates a piece.
  while (tiles[0].some((port) => (port + rotations[0]) % 4 === 3)) {
    rotations[0] = (rotations[0] + 1) % 4
  }
  return { route: ROUTES.indexOf(route), tiles, rotations }
}

export function portsAt(index, circuit) {
  return circuit.tiles[index].map((port) => (port + circuit.rotations[index]) % 4)
}

export function traceCircuit(circuit) {
  const powered = new Set()
  let index = 0
  let entry = 3
  while (!powered.has(index)) {
    const ports = portsAt(index, circuit)
    if (!ports.includes(entry)) break
    powered.add(index)
    const exit = ports.find((port) => port !== entry)
    if (index === 8 && exit === 1) return { powered, complete: true }
    if ((exit === 0 && index < 3) || (exit === 1 && index % 3 === 2) ||
        (exit === 2 && index >= 6) || (exit === 3 && index % 3 === 0)) break
    index += STEPS[exit]
    entry = (exit + 2) % 4
  }
  return { powered, complete: false }
}
