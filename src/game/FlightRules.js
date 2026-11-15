export const EMERGENCY_LANDING_RADIUS = 100
const AIRPLANE_CLEARANCE = 1.2

export function getLandingArrival({ position: pad, radius }, previous, current) {
  const surface = pad.y + AIRPLANE_CLEARANCE
  if (previous.y < surface || current.y > surface || current.y >= previous.y) return null

  const contact = (previous.y - surface) / (previous.y - current.y)
  const x = previous.x + (current.x - previous.x) * contact
  const z = previous.z + (current.z - previous.z) * contact
  return Math.hypot(x - pad.x, z - pad.z) <= radius ? contact : null
}

export function isOutsideSurveyArea(position, mapSize) {
  return Math.max(Math.abs(position.x), Math.abs(position.z)) >= mapSize * 0.6
}

export function getFlightContact(environment, current) {
  const ground = environment.getGroundHeight(current.x, current.z)
  if (current.y <= ground + AIRPLANE_CLEARANCE) {
    return { reason: ground > 0 ? 'terrain' : 'water', position: current }
  }
  return null
}
