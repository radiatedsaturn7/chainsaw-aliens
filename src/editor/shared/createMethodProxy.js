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

const toDescriptorConfig = (descriptor) => {
  if (!descriptor) return { methods: {} };
  if (descriptor.methods) return descriptor;
  return { methods: descriptor };
};

export const createModuleFromDescriptor = (target, descriptor) => {
  const { methods = {}, extend = null } = toDescriptorConfig(descriptor);
  const module = createMethodProxy(target, methods);
  if (typeof extend === 'function') {
    return {
      ...module,
      ...extend({ target, module })
    };
  }
  return module;
};

export const createDescriptorModules = (target, descriptors = {}) => {
  const modules = {};
  Object.entries(descriptors).forEach(([moduleKey, descriptor]) => {
    modules[moduleKey] = createModuleFromDescriptor(target, descriptor);
  });
  return modules;
};
