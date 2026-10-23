/// <reference lib="dom" />
import { loadAudioContentManifest, loadAudioSource } from '@ghoran/audio/load'
import { getVerifiedAudioGain } from '@ghoran/audio/verify'
import { getAudioUrl } from '@ghoran/audio/url'
import type { AudioSourceId } from '@ghoran/audio'

export interface DemoTrack {
  sourceId: AudioSourceId
  ayahIndex: number
  label: string
}
export interface DemoState {
  phase: 'idle' | 'loading' | 'playing' | 'error'
  track: DemoTrack | null
  gainDb: number | null
  message: string
}

/** One live signal chain makes A/B changes apply to the same clip and position. */
export class AudioDemoPlayer {
  private context?: AudioContext
  private gain?: GainNode
  private monitor?: GainNode
  private node?: AudioBufferSourceNode
  private abort?: AbortController
  private generation = 0
  private enabled = true
  private volume = 0.35
  private coefficient = 1
  private cache = new Map<
    string,
    { buffer: AudioBuffer; gain: number; gainDb: number }
  >()
  private finish?: () => void

  constructor(
    private update: (state: DemoState) => void,
    private createContext = () => new AudioContext(),
    private request: typeof fetch = (...args) => fetch(...args),
  ) {}

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    this.applyGain()
  }
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    this.monitor?.gain.setTargetAtTime(
      this.volume,
      this.context!.currentTime,
      0.02,
    )
  }
  private applyGain() {
    this.gain?.gain.setTargetAtTime(
      this.enabled ? this.coefficient : 1,
      this.context!.currentTime,
      0.02,
    )
  }
  stop() {
    this.generation++
    this.abort?.abort()
    this.node?.stop()
    this.node?.disconnect()
    this.node = undefined
    this.finish?.()
    this.finish = undefined
    this.update({ phase: 'idle', track: null, gainDb: null, message: '' })
  }
  async play(tracks: readonly DemoTrack[]) {
    this.stop()
    const generation = this.generation
    const controller = (this.abort = new AbortController())
    try {
      // Create/resume synchronously in the click handler, before any fetch awaits.
      if (!this.context) {
        this.context = this.createContext()
        this.gain = this.context.createGain()
        this.monitor = this.context.createGain()
        this.gain.connect(this.monitor).connect(this.context.destination)
        this.monitor.gain.value = this.volume
      }
      const resume = this.context.resume()
      await resume
      for (const track of tracks) {
        if (generation !== this.generation) return
        this.update({ phase: 'loading', track, gainDb: null, message: '' })
        const [source, hashes] = await Promise.all([
          loadAudioSource(track.sourceId),
          loadAudioContentManifest(track.sourceId),
        ])
        if (generation !== this.generation) return
        const url = getAudioUrl(source, track.ayahIndex)
        let audio = this.cache.get(url)
        if (!audio) {
          const response = await this.request(url, {
            signal: controller.signal,
            mode: 'cors',
          })
          if (!response.ok) throw Error(`HTTP ${response.status}`)
          const bytes = await response.arrayBuffer()
          const hash = [
            ...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
          ]
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('')
          const coefficient = getVerifiedAudioGain(
            source,
            hashes,
            track.ayahIndex,
            hash,
          )
          if (coefficient === null) throw Error('CONTENT_MISMATCH')
          const buffer = await this.context.decodeAudioData(bytes)
          if (generation !== this.generation) return
          audio = {
            buffer,
            gain: coefficient,
            gainDb: source.getGainDb(track.ayahIndex)!,
          }
          this.cache.set(url, audio)
          // Bounded by eight clips; changing source never keeps the whole Quran in memory.
          if (this.cache.size > 8)
            this.cache.delete(this.cache.keys().next().value!)
        }
        if (generation !== this.generation) return
        this.coefficient = audio.gain
        // Set the next clip's gain before starting it, without a loud leading transient.
        this.gain!.gain.cancelScheduledValues(this.context.currentTime)
        this.gain!.gain.setValueAtTime(
          this.enabled ? this.coefficient : 1,
          this.context.currentTime,
        )
        const node = (this.node = this.context.createBufferSource())
        node.buffer = audio.buffer
        node.connect(this.gain!)
        this.update({
          phase: 'playing',
          track,
          gainDb: audio.gainDb,
          message: '',
        })
        await new Promise<void>((resolve) => {
          this.finish = resolve
          node.onended = () => {
            node.disconnect()
            resolve()
          }
          node.start()
        })
        if (generation !== this.generation) return
        this.node = undefined
        this.finish = undefined
      }
      if (generation === this.generation) this.stop()
    } catch (error) {
      if (generation !== this.generation) return
      this.node?.stop()
      this.node?.disconnect()
      this.node = undefined
      this.update({
        phase: 'error',
        track: null,
        gainDb: null,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  dispose() {
    this.stop()
    this.cache.clear()
    void this.context?.close()
  }
}
