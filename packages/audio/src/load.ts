/** Optional dynamic registry. Static source imports need none of these loaders. */
import { sourceLoaders, hashLoaders } from './generated/loaders'
import type {
  AudioContentManifest,
  AudioLoudnessTarget,
  AudioSourceId,
  AudioSourceProfile,
} from './types'
export async function loadAudioSource<Id extends AudioSourceId>(
  id: Id,
  options: { targetLufs?: AudioLoudnessTarget } = {},
): Promise<AudioSourceProfile<Id>> {
  const target = options.targetLufs ?? -20
  const loaders = sourceLoaders[target]
  if (!loaders || !Object.prototype.hasOwnProperty.call(loaders, id))
    throw new RangeError('Unknown audio source or loudness target')
  return (await loaders[id]()).default as AudioSourceProfile<Id>
}
export async function loadAudioContentManifest(
  id: AudioSourceId,
): Promise<AudioContentManifest> {
  if (!Object.prototype.hasOwnProperty.call(hashLoaders, id))
    throw new RangeError('Unknown audio source')
  return (await hashLoaders[id]()).default
}
