const isString = (value) => typeof value === 'string' && value.length > 0;

const toConfig = (definition) => {
  if (isString(definition)) return { defaultMethod: definition };
  return definition || {};
};

const invokeTargetMethod = (target, methodName, args) => {
  if (!isString(methodName) || typeof target[methodName] !== 'function') return null;
  return target[methodName](...args);
};

export const createMethodProxy = (target, methodMap) => {
  const module = {};

  Object.entries(methodMap).forEach(([proxyName, definition]) => {
    const { defaultMethod = null } = toConfig(definition);

    module[proxyName] = (...args) => {
      const [firstArg, ...rest] = args;
      const methodName = isString(firstArg) ? firstArg : defaultMethod;
      const forwardedArgs = isString(firstArg) ? rest : args;
      return invokeTargetMethod(target, methodName, forwardedArgs);
    };
  });

  return module;
};
