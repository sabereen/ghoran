export function simpleCache() {
  const cache = new WeakMap<any, any>()
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.get
    if (!originalMethod) throw new Error('this is getter decorator')

    descriptor.get = function (this: any) {
      if (!cache.has(this)) {
        cache.set(this, originalMethod.call(this))
      }
      return cache.get(this)
    }
  }
}
