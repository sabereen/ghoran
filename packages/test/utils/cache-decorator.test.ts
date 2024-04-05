import { simpleCache } from '@ghoran/utils'

describe('cache decorator', () => {
  test('it should cache', () => {
    const mockFunction = vi.fn()
    mockFunction.mockReturnValueOnce(1)
    mockFunction.mockReturnValue(2)

    class Mock {
      @simpleCache()
      get stub() {
        return mockFunction()
      }
    }

    const mockInstance = new Mock()
    expect(mockInstance.stub).toBe(1)
    expect(mockInstance.stub).not.toBe(2)
    expect(mockFunction).toBeCalledTimes(1)
  })

  test('cache should be separate', () => {
    const mockFunction = vi.fn()
    mockFunction.mockReturnValueOnce(1)
    mockFunction.mockReturnValueOnce(2)
    mockFunction.mockReturnValue(3)

    class Mock {
      @simpleCache()
      get stub() {
        return mockFunction()
      }
    }

    const mock1 = new Mock()
    const mock2 = new Mock()

    expect(mock1.stub).toBe(1)
    expect(mock2.stub).toBe(2)

    // check result is cached
    expect(mock1.stub).not.toBe(3)
    expect(mock2.stub).not.toBe(3)

    expect(mockFunction).toBeCalledTimes(2)
  })
})
