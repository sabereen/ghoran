import { describe, expect, it, vi } from 'vitest'
import { AudioDemoPlayer, type DemoState } from './player'

vi.mock('@ghoran/audio/load', async () => {
  const { parhizgar } = await import('@ghoran/audio')
  return {
    loadAudioSource: async () => parhizgar,
    loadAudioContentManifest: async () => ({
      sourceId: parhizgar.id,
      contentRevision: parhizgar.metadata.contentRevision,
      getHash: () =>
        'ebdcfb0ef813f6ca1ee0ba9df9d55dbe9d2093aadf2a936206c95e1e2536bc95',
    }),
  }
})

function fixture(
  request: typeof fetch = async () => new Response('demo fixture'),
) {
  const nodes: {
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    onended?: () => void
  }[] = []
  const gains: {
    value: number
    setTargetAtTime: ReturnType<typeof vi.fn>
    setValueAtTime: ReturnType<typeof vi.fn>
  }[] = []
  const states: DemoState[] = []
  const context = {
    currentTime: 1,
    destination: {},
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    decodeAudioData: vi.fn(async () => ({ duration: 1 })),
    createGain() {
      const gain = {
        value: 1,
        setTargetAtTime: vi.fn(),
        setValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      }
      gains.push(gain)
      return { gain, connect: () => ({ connect: vi.fn() }) }
    },
    createBufferSource() {
      const node = {
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: undefined as (() => void) | undefined,
      }
      nodes.push(node)
      return node
    },
  }
  return {
    nodes,
    gains,
    states,
    context,
    player: new AudioDemoPlayer(
      (state) => states.push(state),
      () => context as unknown as AudioContext,
      request,
    ),
  }
}
const track = { sourceId: 'parhizgar', ayahIndex: 0, label: 'fixture' } as const

describe('listening comparison', () => {
  it('toggles gain on the same playing node while leaving monitor volume unchanged', async () => {
    const { player, nodes, gains, states } = fixture()
    const playing = player.play([track])
    await vi.waitFor(() => expect(states.at(-1)?.phase).toBe('playing'))
    const coefficient = 10 ** (-7.54 / 20)
    expect(gains[0].setValueAtTime).toHaveBeenCalledWith(coefficient, 1)
    expect(gains[1].value).toBe(0.35)
    player.setEnabled(false)
    expect(gains[0].setTargetAtTime).toHaveBeenLastCalledWith(1, 1, 0.02)
    player.setEnabled(true)
    expect(gains[0].setTargetAtTime).toHaveBeenLastCalledWith(
      coefficient,
      1,
      0.02,
    )
    expect(nodes).toHaveLength(1)
    expect(nodes[0].start).toHaveBeenCalledTimes(1)
    expect(nodes[0].stop).not.toHaveBeenCalled()
    expect(gains[1].setTargetAtTime).not.toHaveBeenCalled()
    player.stop()
    await playing
    expect(states.at(-1)?.phase).toBe('idle')
  })
  it('rejects changed bytes before decoding or playing the recording', async () => {
    const { player, context, nodes, states } = fixture(
      async () => new Response('changed'),
    )
    await player.play([track])
    expect(states.at(-1)).toMatchObject({
      phase: 'error',
      message: 'CONTENT_MISMATCH',
    })
    expect(context.decodeAudioData).not.toHaveBeenCalled()
    expect(nodes).toHaveLength(0)
  })
  it('cancels a pending fetch without starting late playback', async () => {
    let finish!: (response: Response) => void
    const request = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    const { player, nodes, states } = fixture(request)
    const playing = player.play([track])
    await vi.waitFor(() => expect(request).toHaveBeenCalled())
    player.stop()
    expect(request.mock.calls[0][1]!.signal!.aborted).toBe(true)
    finish(new Response('demo fixture'))
    await playing
    expect(nodes).toHaveLength(0)
    expect(states.at(-1)?.phase).toBe('idle')
  })
  it('sequences clips without overlapping their source nodes', async () => {
    const { player, nodes, states } = fixture()
    const playing = player.play([track, track])
    await vi.waitFor(() => expect(nodes).toHaveLength(1))
    nodes[0].onended!()
    await vi.waitFor(() => expect(nodes).toHaveLength(2))
    nodes[1].onended!()
    await playing
    expect(states.at(-1)?.phase).toBe('idle')
  })
})
