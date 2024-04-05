import { simpleCache } from '@ghoran/utils'

describe('cache decorator', () => {
  const mockFunction = vi.fn()
  class Mock {
    @simpleCache
    get stub() {
      return mockFunction()
    }
  }

  const mockInstance = new Mock()
  mockInstance.stub
  mockInstance.stub
  expect(mockFunction).toBeCalledTimes(1)
})
