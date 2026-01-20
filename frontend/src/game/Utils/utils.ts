export type Ref<T> =
{
  value: T;
  listeners: Set<(v: T) => void>;
};

export function makeRef<T extends object, K extends keyof T>(obj: T, key: K): Ref<T[K]>
{
  const ref: Ref<T[K]> =
  {
    get value()
    {
      return obj[key];
    },
    set value(v)
    {
      obj[key] = v;
      ref.listeners.forEach(fn => fn(v));
    },
    listeners: new Set()
  };
  return (ref);
}

export function makeStandaloneRef<T>(value: T): Ref<T>
{
  return {
    value,
    listeners: new Set()
  };
}

export function makeRefsTree<T extends object>(obj: T): any
{
  const refs: any = {};
  for (const key in obj)
  {
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val))
    {
      refs[key] = makeRefsTree(val);
      continue;
    }
    refs[key] = makeRef(obj, key);
  }
  return (refs);
}