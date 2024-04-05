export function simpleCache<T>(
  originalMethod: () => T,
  context: ClassGetterDecoratorContext,
) {
  const cache = new WeakMap<any, any>()
  function replacementFunction(this: any) {
    if (!cache.has(this)) {
      cache.set(this, originalMethod.call(this))
    }
    return cache.get(this)
  }
  return replacementFunction
}
