import sprite11 from '../assets/split/agents/sprite-1-1.png'
import sprite12 from '../assets/split/agents/sprite-1-2.png'
import sprite13 from '../assets/split/agents/sprite-1-3.png'
import sprite14 from '../assets/split/agents/sprite-1-4.png'
import sprite21 from '../assets/split/agents/sprite-2-1.png'
import sprite22 from '../assets/split/agents/sprite-2-2.png'
import sprite23 from '../assets/split/agents/sprite-2-3.png'
import sprite24 from '../assets/split/agents/sprite-2-4.png'
import sprite31 from '../assets/split/agents/sprite-3-1.png'
import sprite32 from '../assets/split/agents/sprite-3-2.png'
import sprite33 from '../assets/split/agents/sprite-3-3.png'
import sprite34 from '../assets/split/agents/sprite-3-4.png'
import sprite41 from '../assets/split/agents/sprite-4-1.png'
import sprite42 from '../assets/split/agents/sprite-4-2.png'
import sprite43 from '../assets/split/agents/sprite-4-3.png'
import sprite44 from '../assets/split/agents/sprite-4-4.png'

const AGENT_AVATARS = [
  sprite11,
  sprite12,
  sprite13,
  sprite14,
  sprite21,
  sprite22,
  sprite23,
  sprite24,
  sprite31,
  sprite32,
  sprite33,
  sprite34,
  sprite41,
  sprite42,
  sprite43,
  sprite44,
]

/** Deterministically picks one of the agent sprite tiles for a given agent
 *  name, so the same agent always shows the same avatar everywhere. */
export function agentAvatar(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return AGENT_AVATARS[Math.abs(hash) % AGENT_AVATARS.length]
}
